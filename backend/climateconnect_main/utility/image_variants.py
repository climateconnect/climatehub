"""
Shared image-variant generation orchestration.

Provides:
* :data:`IMAGE_VARIANT_CONFIGS` — which variant widths each image field gets.
* :data:`IMAGE_FIELD_NAMES` — which image fields are monitored for changes.
  (Both live in :mod:`.image_variant_models`, together with
  :class:`ImageVariantsModelMixin`, and are re-exported here.)
* :func:`capture_image_field_changes` — ``pre_save`` helper that detects
  changed image fields and collects the files they replace.
* :func:`handle_image_field_changes` — ``post_save`` helper that drops the
  stale ``image_variants`` entries, deletes the replaced files and enqueues
  the Celery task.
* :func:`delete_image_files` — ``post_delete`` helper that deletes every
  original and variant of a deleted row.
* :func:`generate_and_store_variants` — generates WebP variants for an
  instance and persists them in ``image_variants``.

This module is intentionally storage-agnostic (reads through ``storage.open()``,
never ``.path``) so it works on Azure Blob Storage.
"""

import logging

from django.db import transaction
from django.db.models import F, Func, JSONField, TextField, Value
from django.db.models.functions import Cast, Coalesce
from rest_framework import serializers

from climateconnect_main.utility.image_variant_models import (  # noqa: F401
    IMAGE_FIELD_NAMES,
    IMAGE_VARIANT_CONFIGS,
    ImageVariantsModelMixin,
    current_image_name,
    image_fields_changed_since_load,
)

logger = logging.getLogger(__name__)

# Attribute name used to stash changed-field info between pre_save and post_save.
_FIELD_CHANGES_ATTR = "_image_variant_changes"

# Attribute name used to stash the replaced files (``(storage, name)`` pairs)
# between pre_save, which still sees the old row, and post_save, which deletes.
_FILES_TO_DELETE_ATTR = "_image_files_to_delete"


def _variant_filename(original_name, width):
    """Compute the storage name for a WebP variant of *original_name*.

    Mirrors the naming convention used by
    :func:`climateconnect_main.utility.images.generate_webp_variant` so
    that cleanup can locate files without reading them back.

    * ``width`` of ``None`` → format-only conversion (``name_webp.webp``)
    * ``width`` of ``1200`` → ``name_1200.webp``
    """
    base = original_name.rsplit(".", 1)[0] if "." in original_name else original_name
    if width is not None:
        return "{}_{}.webp".format(base, width)
    else:
        return "{}_webp.webp".format(base)


def _image_file_names(field_name, original_name, recorded_variants, widths):
    """Every storage name belonging to one image field: original + variants.

    Prefers the variant paths actually recorded in ``image_variants``:
    ``storage.save()`` may have had to suffix a name to avoid a collision, in
    which case the recomputed name would not match the file on disk. Computed
    names are added as well, for variants that were never recorded.
    """
    names = {original_name}
    names.update(recorded_variants.get(field_name, {}).values())
    names.update(_variant_filename(original_name, width) for width in widths)
    return names


def capture_image_field_changes(sender, instance, update_fields=None, **kwargs):
    """``pre_save`` receiver: detect changed image fields, collect replaced files.

    1. Candidates are the image fields this save writes (only those in
       ``update_fields``, if given) whose name differs from what the instance
       was loaded with (:class:`ImageVariantsModelMixin`). This needs no query,
       so unrelated saves cost nothing.
    2. Only when there are candidates, one narrow query reads the row's current
       names and ``image_variants``. Comparing against the database, not the
       loaded state, matters for stale instances: what gets overwritten — and
       must be cleaned up — is what the row holds *now*.
    3. For each confirmed change, the old original and its variant files are
       collected (see :func:`_image_file_names`); uploads never share a file —
       every upload gets a fresh random name — so nothing else can still
       reference them. They are only deleted in ``post_save``
       (:func:`handle_image_field_changes`): deleting here would, outside a
       transaction, remove them before the row is written.

    Both results are stored on the instance. They are always reset, so a save
    that failed after this point never leaks into the next one.
    """
    setattr(instance, _FIELD_CHANGES_ATTR, [])
    setattr(instance, _FILES_TO_DELETE_ATTR, [])

    model_name = sender.__name__
    fields = IMAGE_FIELD_NAMES.get(model_name, [])
    if update_fields is not None:
        fields = [field for field in fields if field in update_fields]
    candidates = image_fields_changed_since_load(instance, fields)
    if not candidates:
        return

    if instance._state.adding:
        # A new row replaces nothing.
        setattr(instance, _FIELD_CHANGES_ATTR, candidates)
        return

    old = (
        sender.objects.filter(pk=instance.pk)
        .values(*candidates, "image_variants")
        .first()
    )
    old = old or {}
    recorded = old.get("image_variants") or {}
    config = IMAGE_VARIANT_CONFIGS.get(model_name, {})

    changed = []
    to_delete = []
    for field_name in candidates:
        old_name = old.get(field_name) or None
        if old_name == current_image_name(instance, field_name):
            continue
        changed.append(field_name)
        if old_name and field_name in config:
            storage = sender._meta.get_field(field_name).storage
            names = _image_file_names(
                field_name, old_name, recorded, config[field_name]["widths"]
            )
            to_delete.extend((storage, name) for name in names)
        # Keep the in-memory instance consistent for the response serialized
        # after this save; the database entry is dropped in post_save.
        if instance.image_variants:
            instance.image_variants.pop(field_name, None)

    setattr(instance, _FIELD_CHANGES_ATTR, changed)
    setattr(instance, _FILES_TO_DELETE_ATTR, to_delete)


def _remove_variant_entries(model, pk, field_names):
    """Drop *field_names* from the row's ``image_variants`` in one statement.

    ``jsonb - key`` in an ``UPDATE`` is atomic, so it cannot overwrite entries
    another writer (the variant task) added concurrently — unlike writing back
    an in-memory dict.
    """
    expression = Coalesce(F("image_variants"), Value({}, output_field=JSONField()))
    for field_name in field_names:
        expression = Func(
            expression,
            Cast(Value(field_name), TextField()),
            template="(%(expressions)s)",
            arg_joiner=" - ",
            output_field=JSONField(),
        )
    model.objects.filter(pk=pk).update(image_variants=expression)


def _dispatch_image_variant_task(sender, instance, changed):
    """Enqueue variant generation once the save commits.

    ``transaction.on_commit`` ensures the task never observes an uncommitted
    row (spec constraint).
    """
    model_name = sender.__name__
    app_label = sender._meta.app_label
    pk = instance.pk

    def _enqueue():
        # Local import avoids circular dependency at module load time.
        from organization.tasks import generate_image_variants

        generate_image_variants.delay(
            app_label=app_label,
            model_name=model_name,
            pk=pk,
            field_names=changed,
        )

    transaction.on_commit(_enqueue)


def handle_image_field_changes(sender, instance, created, **kwargs):
    """``post_save`` receiver: finish an image change detected in ``pre_save``.

    In this order, so nothing can observe a half-finished state:

    1. Drop the replaced fields' ``image_variants`` entries in the database
       (:func:`_remove_variant_entries`) — the API must not serve URLs of files
       about to be deleted. Before the task is enqueued, so the removal can
       never wipe variants the task already wrote for the new image.
    2. Delete the replaced files once the save commits
       (:func:`_delete_files_on_commit`). The row already points at the new
       file, so even in autocommit mode — where ``on_commit`` runs immediately —
       it never references a deleted one; a save that failed never gets here.
    3. Enqueue variant generation for the changed fields (only when an image
       field changed — acceptance criterion #5).
    """
    changed = getattr(instance, _FIELD_CHANGES_ATTR, None)
    if not changed:
        return

    if not created:
        _remove_variant_entries(sender, instance.pk, changed)

    to_delete = getattr(instance, _FILES_TO_DELETE_ATTR, None) or []
    setattr(instance, _FILES_TO_DELETE_ATTR, [])
    _delete_files_on_commit(
        to_delete, "handle_image_field_changes", sender.__name__, instance.pk
    )

    _dispatch_image_variant_task(sender, instance, changed)


def _delete_files_on_commit(to_delete, caller, model_name, pk):
    """Delete ``(storage, name)`` pairs once the current transaction commits.

    Deleting before the commit would leave a rolled-back row pointing at
    missing files — and ``<picture>`` does not fall back to ``<img>`` when a
    source 404s. Failures are logged per file and never raised.

    Outside an atomic block ``on_commit`` runs the deletion immediately, so
    callers must only call this once the row write has happened (``post_save``
    / ``post_delete``), never from ``pre_save``.
    """
    if not to_delete:
        return

    def _delete():
        for storage, name in to_delete:
            try:
                storage.delete(name)
            except Exception as exc:
                logger.error(
                    "%s: failed to delete %s (%s pk=%s): %s",
                    caller,
                    name,
                    model_name,
                    pk,
                    exc,
                )

    transaction.on_commit(_delete)


def delete_image_files(sender, instance, **kwargs):
    """``post_delete`` receiver: delete every image file of a deleted row.

    Removes each image field's original and all of its variants. Django never
    deletes files when a row is deleted, so without this they would stay in
    storage forever. Fires for cascaded deletes too (deleting a ``User``
    deletes its ``UserProfile``). Files are removed only once the delete
    commits, so a rolled-back delete keeps its images.
    """
    model_name = sender.__name__
    config = IMAGE_VARIANT_CONFIGS.get(model_name)
    if not config:
        return

    recorded = instance.image_variants or {}
    to_delete = []
    for field_name in IMAGE_FIELD_NAMES[model_name]:
        field_file = getattr(instance, field_name, None)
        if not field_file or not field_file.name:
            continue
        names = _image_file_names(
            field_name, field_file.name, recorded, config[field_name]["widths"]
        )
        to_delete.extend((field_file.storage, name) for name in names)

    _delete_files_on_commit(to_delete, "delete_image_files", model_name, instance.pk)


def incomplete_variant_fields(instance, verify=False):
    """Return the image fields of *instance* whose variants need (re)generating.

    A field needs work when it holds an image but lacks a configured variant
    key, or when it is empty but still has an entry (which
    :func:`generate_and_store_variants` then drops).

    With ``verify=True`` every recorded variant path is also checked with
    ``storage.exists()``, so entries pointing at files that are gone — a manual
    blob delete, or rows written before the stale-instance fixes — are
    regenerated too. ``<picture>`` does not fall back to ``<img>`` when a
    source 404s, so such a row would otherwise stay broken. On Azure each check
    is a request, so this is opt-in (``backfill_image_variants --verify``).
    """
    config = IMAGE_VARIANT_CONFIGS.get(instance.__class__.__name__)
    if not config:
        return []

    stored = instance.image_variants or {}
    incomplete = []

    for field_name, field_config in config.items():
        field_file = getattr(instance, field_name, None)
        recorded = stored.get(field_name) or {}
        if not field_file:
            if recorded:
                incomplete.append(field_name)
            continue
        expected = {
            str(width) if width is not None else "webp"
            for width in field_config["widths"]
        }
        if not expected.issubset(recorded):
            incomplete.append(field_name)
            continue
        if verify and not all(
            _variant_file_exists(field_file.storage, path) for path in recorded.values()
        ):
            incomplete.append(field_name)

    return incomplete


def _variant_file_exists(storage, path):
    """``storage.exists()`` that treats a failing check as "missing"."""
    try:
        return storage.exists(path)
    except Exception as exc:
        logger.warning("incomplete_variant_fields: could not check %s: %s", path, exc)
        return False


def has_all_variants(instance, verify=False):
    """Return ``True`` when no image field of *instance* needs work.

    Used by the backfill command to skip rows that need no work, so a re-run
    does not re-download and re-encode the entire image corpus. See
    :func:`incomplete_variant_fields` for what counts, and for ``verify``.
    """
    return not incomplete_variant_fields(instance, verify=verify)


def generate_and_store_variants(instance, field_names=None):
    """Generate WebP variants for *instance* and persist them.

    Variant **storage paths** (not URLs) are written to ``image_variants``;
    use :func:`build_variant_urls` to resolve them for API responses.  Storing
    paths keeps the rows portable: the storage account or CDN domain can change
    without invalidating every backfilled row.

    *instance* may be stale by the time the variants are encoded: the image can
    be replaced (or the row deleted) while a Celery task or a long backfill run
    is working on it. The results are therefore committed per field against the
    locked, current row (see :func:`_commit_variants`), and only for fields that
    still hold the image the variants were generated from.

    Parameters
    ----------
    instance : Model
        A ``Project``, ``Organization``, or ``UserProfile`` instance.
    field_names : list[str] | None
        Subset of image fields to process.  If ``None``, all configured
        image fields are processed.

    Returns
    -------
    list[tuple[str, str]]
        ``(field_name, source_name)`` for each field whose original could not
        be read, so the Celery task can retry them.  Empty on success.
    """
    from climateconnect_main.utility.images import (
        generate_webp_variant,
        read_source_bytes,
    )

    model_name = instance.__class__.__name__
    config = IMAGE_VARIANT_CONFIGS.get(model_name)
    if not config:
        return []

    if field_names is None:
        field_names = list(config.keys())

    recorded = instance.image_variants or {}

    # field_name -> (source name the variants belong to, {key: path}).
    # An empty dict means "no variants": the entry is dropped on commit.
    outcomes = {}
    unreadable = []

    for field_name in field_names:
        if field_name not in config:
            continue

        field_file = getattr(instance, field_name)
        if not field_file:
            # The field was cleared. cleanup_orphaned_variants already deleted
            # the files and popped the entry, but that pop is only persisted if
            # the save wrote image_variants — a save(update_fields=["image"])
            # would drop it, leaving the API serving URLs for deleted files.
            # The task re-reads from the database, so make it authoritative.
            outcomes[field_name] = (None, {})
            continue

        widths = config[field_name]["widths"]
        storage = field_file.storage
        previous = recorded.get(field_name, {})
        variants = {}

        # Read the original once, not once per width — on Azure each read is a
        # blob download, and a backfill does this for every row in the table.
        source_bytes = read_source_bytes(field_file)
        if source_bytes is None:
            unreadable.append((field_name, field_file.name))
            continue

        for width in widths:
            content_file = generate_webp_variant(
                field_file, max_width=width, source_bytes=source_bytes
            )
            if content_file is None:
                continue

            key = str(width) if width is not None else "webp"

            # Delete the file we are about to replace so storage.save() reuses
            # the deterministic name instead of suffixing it to dodge the
            # collision — otherwise every regeneration leaks an orphan file.
            for stale_name in {previous.get(key), content_file.name}:
                if stale_name:
                    try:
                        storage.delete(stale_name)
                    except Exception as exc:
                        logger.warning(
                            "generate_and_store_variants: could not delete "
                            "stale variant %s: %s",
                            stale_name,
                            exc,
                        )

            try:
                variants[key] = storage.save(content_file.name, content_file)
            except Exception as exc:
                # The previous file for this key was just deleted, so leaving
                # its path in the map would serve a 404. Drop the key instead
                # and let the client fall back to the original; the next
                # backfill run repairs the row.
                logger.error(
                    "generate_and_store_variants: could not store %s for "
                    "%s pk=%s: %s",
                    content_file.name,
                    model_name,
                    instance.pk,
                    exc,
                )

        # Replace rather than merge: a key missing from this run is a variant
        # that no longer exists on storage. If everything failed, the old files
        # are gone too, so the entry is dropped and the API falls back to the
        # original instead of serving 404s.
        outcomes[field_name] = (field_file.name, variants)

    _commit_variants(instance, outcomes)
    return unreadable


def _commit_variants(instance, outcomes):
    """Write *outcomes* into the current row's ``image_variants``.

    Runs under ``select_for_update`` and merges per field into the row as it is
    *now*, not into the possibly stale ``instance``:

    * A field whose image changed since *instance* was loaded is skipped and the
      variants generated for the old image are deleted. The new image has its
      own task; recording the old variants would serve the wrong (or a deleted)
      picture.
    * Entries of fields not processed here are kept as they are, so a
      concurrent task for another field is not overwritten.

    The save uses ``update_fields=["image_variants"]``, which the change
    detection skips, so it can never be mistaken for an image change.
    """
    if not outcomes:
        return

    model = instance.__class__
    discard = []

    with transaction.atomic():
        row = model.objects.select_for_update().filter(pk=instance.pk).first()
        if row is None:
            # Deleted meanwhile: delete_image_files may have run before these
            # variants were written, so nothing else will remove them.
            for field_name, (_source, variants) in outcomes.items():
                discard.extend((field_name, name) for name in variants.values())
        else:
            current = dict(row.image_variants or {})
            for field_name, (source_name, variants) in outcomes.items():
                current_name = getattr(row, field_name).name or None
                if current_name != source_name:
                    logger.info(
                        "generate_and_store_variants: %s of %s pk=%s changed "
                        "from %s to %s while generating variants; discarding",
                        field_name,
                        model.__name__,
                        instance.pk,
                        source_name,
                        current_name,
                    )
                    discard.extend((field_name, name) for name in variants.values())
                    continue
                if variants:
                    current[field_name] = variants
                else:
                    current.pop(field_name, None)

            if current != (row.image_variants or {}):
                row.image_variants = current
                row.save(update_fields=["image_variants"])
            instance.image_variants = current

    for field_name, name in discard:
        storage = model._meta.get_field(field_name).storage
        try:
            storage.delete(name)
        except Exception as exc:
            logger.warning(
                "generate_and_store_variants: could not delete discarded "
                "variant %s: %s",
                name,
                exc,
            )


def build_variant_urls(instance):
    """Resolve the stored variant paths on *instance* to absolute URLs.

    ``image_variants`` holds storage-relative paths (see
    :func:`generate_and_store_variants`).  API responses need URLs, so this
    maps each path through the owning field's ``storage.url()``.

    Returns an empty dict when the instance has no variants, so serializers can
    use the result unconditionally.
    """
    stored = getattr(instance, "image_variants", None)
    if not stored:
        return {}

    config = IMAGE_VARIANT_CONFIGS.get(instance.__class__.__name__, {})
    urls = {}

    for field_name, variants in stored.items():
        if field_name not in config or not variants:
            continue

        field_file = getattr(instance, field_name, None)
        if not field_file:
            continue

        storage = field_file.storage
        resolved = {}
        for key, name in variants.items():
            try:
                resolved[key] = storage.url(name)
            except Exception as exc:
                logger.error(
                    "build_variant_urls: could not build URL for %s (%s pk=%s): %s",
                    name,
                    instance.__class__.__name__,
                    instance.pk,
                    exc,
                )
        if resolved:
            urls[field_name] = resolved

    return urls


class ImageVariantsField(serializers.Field):
    """Read-only serializer field exposing ``image_variants`` as absolute URLs.

    The model column stores storage-relative paths; clients need URLs.  Declare
    it on any serializer that lists ``image_variants`` in ``Meta.fields``::

        image_variants = ImageVariantsField()

    ``source="*"`` hands the whole instance to :func:`build_variant_urls`, which
    needs the image fields (for their storage backend), not just the JSON value.
    """

    def __init__(self, **kwargs):
        kwargs.setdefault("read_only", True)
        kwargs.setdefault("source", "*")
        super().__init__(**kwargs)

    def to_representation(self, instance):
        return build_variant_urls(instance)
