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
* :func:`rows_with_images` / :func:`incomplete_variant_fields` — find the
  rows and fields that still need variants (backfill command and the periodic
  repair task).

**Key invariant:** ``image_variants`` only ever lists files that exist.
``<picture>`` does not fall back to its ``<img>`` when a ``<source>`` 404s, and
CSS background banners do not fall back at all. Hence every variant file gets a
fresh name (:func:`_variant_filename`), a file is only deleted once no committed
map references it, and file cleanup is driven by the names *recorded* in the
map.

This module is intentionally storage-agnostic (reads through ``storage.open()``,
never ``.path``) so it works on Azure Blob Storage.
"""

import logging
import secrets

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import F, Func, JSONField, Q, TextField, Value
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


def variant_key(width):
    """The ``image_variants`` key of a configured width (``"1200"``, ``"webp"``)."""
    return str(width) if width is not None else "webp"


def _variant_filename(original_name, width):
    """A new, unique storage name for a WebP variant of *original_name*.

    ``<base>_<key>_<token>.webp``, e.g. ``projects/7/3fa9…_1200_9c1e04ab.webp``.
    This is the only place variant files are named.

    The random token gives every generated file a name of its own, also when
    the variants of an unchanged original are regenerated (``--force``,
    ``--verify``, a task retry). So a regeneration never has to delete or
    overwrite a file the committed map still points at, and CDN or browser
    caches can never serve stale content under a reused name. The flip side is
    that names cannot be recomputed: cleanup must use the names recorded in
    ``image_variants``.
    """
    base = original_name.rsplit(".", 1)[0] if "." in original_name else original_name
    return "{}_{}_{}.webp".format(base, variant_key(width), secrets.token_hex(4))


def _image_file_names(field_name, original_name, recorded_variants):
    """Every storage name belonging to one image field: original + variants.

    Variant names carry a random token (:func:`_variant_filename`), so they are
    taken from ``image_variants``. A variant that was written but never
    recorded (a crash between upload and commit) is not found here.
    """
    names = {original_name}
    names.update((recorded_variants.get(field_name) or {}).values())
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
            names = _image_file_names(field_name, old_name, recorded)
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

    Enqueueing must never fail the save: by the time the callback runs, the row
    and the new image are committed (in autocommit mode the callback runs right
    away, inside the request). So a broker error (Redis down) is logged with
    the model and pk, and ``robust=True`` additionally keeps any other error in
    the callback from turning the successful save into a 500. Nothing is
    retried here: the row simply has no variants for these fields — the API
    serves the original, since ``post_save`` already dropped the stale entries
    — until the periodic ``regenerate_missing_image_variants`` task (or the
    backfill command) picks it up.
    """
    model_name = sender.__name__
    app_label = sender._meta.app_label
    pk = instance.pk

    def _enqueue():
        # Local import avoids circular dependency at module load time.
        from organization.tasks import generate_image_variants

        try:
            generate_image_variants.delay(
                app_label=app_label,
                model_name=model_name,
                pk=pk,
                field_names=changed,
            )
        except Exception:
            logger.exception(
                "Could not enqueue generate_image_variants for %s pk=%s "
                "fields=%s; the periodic repair task will pick it up",
                model_name,
                pk,
                changed,
            )

    transaction.on_commit(_enqueue, robust=True)


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
    storage forever. Fires for cascaded deletes too. Variant names come from
    ``image_variants`` (see :func:`_image_file_names`). Files are removed only
    once the delete commits, so a rolled-back delete keeps its images.
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
        names = _image_file_names(field_name, field_file.name, recorded)
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
        expected = {variant_key(width) for width in field_config["widths"]}
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


def rows_with_images(model):
    """Rows of *model* with at least one configured image field set.

    The candidates of the backfill command and the periodic repair task.
    """
    image_fields = IMAGE_VARIANT_CONFIGS.get(model.__name__, {})
    if not image_fields:
        return model.objects.none()
    filter_q = Q()
    for field_name in image_fields:
        filter_q |= Q(**{"{}__gt".format(field_name): ""})
    return model.objects.filter(filter_q)


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

    Regenerating the variants of an unchanged original (``--force``,
    ``--verify``, a task retry) never touches the files the map currently
    references: each new variant is saved under a new name, the map is
    switched over, and only then — after that commit — are the previous files
    deleted. A variant that could not be encoded or stored keeps its previous
    file. So the API never lists a file that does not exist.

    Parameters
    ----------
    instance : Model
        A ``Project`` or ``Organization`` instance.
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
        decode_image,
        encode_webp_variant,
        read_source_bytes,
    )

    model_name = instance.__class__.__name__
    config = IMAGE_VARIANT_CONFIGS.get(model_name)
    if not config:
        return []

    if field_names is None:
        field_names = list(config.keys())

    # field_name -> (source name the variants belong to, {key: new path}).
    # A source name of None means the field is empty: the entry is dropped.
    outcomes = {}
    unreadable = []

    for field_name in field_names:
        if field_name not in config:
            continue

        field_file = getattr(instance, field_name)
        if not field_file:
            # The field was cleared. The save that cleared it already dropped
            # the entry, but the task re-reads from the database, so make it
            # authoritative for rows that still carry one.
            outcomes[field_name] = (None, {})
            continue

        # Read and decode the original once, not once per width — on Azure each
        # read is a blob download, and a backfill does this for every row.
        source_bytes = read_source_bytes(field_file)
        if source_bytes is None:
            unreadable.append((field_name, field_file.name))
            continue
        image = decode_image(source_bytes, name=field_file.name)
        del source_bytes

        variants = {}
        if image is not None:
            storage = field_file.storage
            for width in config[field_name]["widths"]:
                # Every width is resized from the decoded original, never from
                # another (already resized) variant.
                data = encode_webp_variant(image, max_width=width)
                if data is None:
                    continue
                name = _variant_filename(field_file.name, width)
                try:
                    variants[variant_key(width)] = storage.save(name, ContentFile(data))
                except Exception as exc:
                    # Nothing was deleted, so the previous variant (if any)
                    # stays in place and referenced; see _commit_variants.
                    logger.error(
                        "generate_and_store_variants: could not store %s for "
                        "%s pk=%s: %s",
                        name,
                        model_name,
                        instance.pk,
                        exc,
                    )
            image.close()

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
    * Otherwise each configured variant key points at the newly generated file,
      or — if that one could not be generated or stored — keeps its previous
      file. Files the map no longer references are deleted with
      ``transaction.on_commit``, i.e. only once the new map is committed.
    * Entries of fields not processed here are kept as they are, so a
      concurrent task for another field is not overwritten.

    The save uses ``update_fields=["image_variants"]``, which the change
    detection skips, so it can never be mistaken for an image change.
    """
    if not outcomes:
        return

    model = instance.__class__
    config = IMAGE_VARIANT_CONFIGS[model.__name__]
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
            superseded = []
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

                # Entries are dropped whenever the image changes, so a recorded
                # entry belongs to this same source.
                previous = current.get(field_name) or {}
                merged = {}
                if source_name is not None:
                    for width in config[field_name]["widths"]:
                        key = variant_key(width)
                        path = variants.get(key) or previous.get(key)
                        if path:
                            merged[key] = path
                if merged:
                    current[field_name] = merged
                else:
                    current.pop(field_name, None)

                storage = model._meta.get_field(field_name).storage
                superseded.extend(
                    (storage, name)
                    for name in set(previous.values()) - set(merged.values())
                )

            if current != (row.image_variants or {}):
                row.image_variants = current
                row.save(update_fields=["image_variants"])
            instance.image_variants = current

            _delete_files_on_commit(
                superseded, "generate_and_store_variants", model.__name__, row.pk
            )

    # Files this run wrote but did not record: nothing references them.
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
