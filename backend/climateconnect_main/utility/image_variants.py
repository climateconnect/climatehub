"""
Shared image-variant generation orchestration.

Provides:
* :data:`IMAGE_VARIANT_CONFIGS` — which variant widths each image field gets.
* :data:`IMAGE_FIELD_NAMES` — which image fields are monitored for changes.
* :func:`capture_image_field_changes` — ``pre_save`` helper that detects
  changed image fields.
* :func:`dispatch_image_variant_task` — ``post_save`` helper that enqueues
  the Celery task via ``transaction.on_commit``.
* :func:`generate_and_store_variants` — generates WebP variants for an
  instance and persists them in ``image_variants``.

This module is intentionally storage-agnostic (reads through ``storage.open()``,
never ``.path``) so it works on Azure Blob Storage.
"""

import logging

from django.db import transaction
from rest_framework import serializers

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Which variant widths to generate per image field.
#   - Main images (``image``, ``background_image``): 1200px and 600px WebP.
#   - Thumbnails (``thumbnail_image``): format-only WebP (no resize,
#     already capped at source by the frontend crop).
IMAGE_VARIANT_CONFIGS = {
    "Project": {
        "image": {"widths": [1200, 600]},
        "thumbnail_image": {"widths": [None]},
    },
    "Organization": {
        "image": {"widths": [1200, 600]},
        "thumbnail_image": {"widths": [None]},
        "background_image": {"widths": [1200, 600]},
    },
    "UserProfile": {
        "image": {"widths": [1200, 600]},
        "thumbnail_image": {"widths": [None]},
        "background_image": {"widths": [1200, 600]},
    },
}

# Image fields monitored for changes (trigger variant generation).
IMAGE_FIELD_NAMES = {
    "Project": ["image", "thumbnail_image"],
    "Organization": ["image", "thumbnail_image", "background_image"],
    "UserProfile": ["image", "thumbnail_image", "background_image"],
}

# Attribute name used to stash changed-field info between pre_save and post_save.
_FIELD_CHANGES_ATTR = "_image_variant_changes"


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


def _get_changed_image_fields(sender, instance):
    """Return the list of image fields that changed for *instance*."""
    model_name = instance.__class__.__name__
    fields = IMAGE_FIELD_NAMES.get(model_name, [])
    if not fields:
        return []

    changed = []
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
        except sender.DoesNotExist:
            old = None
    else:
        old = None

    for field_name in fields:
        new_field = getattr(instance, field_name)
        old_field = getattr(old, field_name) if old else None
        # Compare by underlying storage name (string), not by FieldFile
        # object identity — two FieldFile instances wrapping the same
        # value compare unequal even when the stored name hasn't changed.
        new_name = getattr(new_field, "name", None) or None
        old_name = getattr(old_field, "name", None) or None
        if new_name != old_name:
            changed.append(field_name)

    return changed


def capture_image_field_changes(sender, instance, **kwargs):
    """``pre_save`` receiver: store changed image fields on the instance.

    Called from ``pre_save`` signal handlers.  The result is read by
    :func:`dispatch_image_variant_task` in ``post_save``.
    """
    changed = _get_changed_image_fields(sender, instance)
    # Always set the attribute (even when empty) so stale values from a
    # previous save cycle do not trigger spurious task dispatch.
    setattr(instance, _FIELD_CHANGES_ATTR, changed)


def dispatch_image_variant_task(sender, instance, created, **kwargs):
    """``post_save`` receiver: enqueue variant-generation for changed fields.

    Only fires when at least one image field changed (satisfies acceptance
    criterion #5).  Uses ``transaction.on_commit`` so the task never
    observes an uncommitted row (satisfies spec constraint on
    ``transaction.on_commit``).
    """
    model_name = sender.__name__
    if model_name not in IMAGE_FIELD_NAMES:
        return

    changed = getattr(instance, _FIELD_CHANGES_ATTR, [])
    if not changed:
        return

    app_label = sender._meta.app_label

    def _enqueue():
        # Local import avoids circular dependency at module load time.
        from organization.tasks import generate_image_variants

        generate_image_variants.delay(
            app_label=app_label,
            model_name=model_name,
            pk=instance.pk,
            field_names=changed,
        )

    transaction.on_commit(_enqueue)


def cleanup_orphaned_variants(sender, instance, **kwargs):
    """``pre_save`` receiver: delete variant files for image fields being replaced.

    Must run **after** :func:`capture_image_field_changes` so that
    ``_FIELD_CHANGES_ATTR`` is already populated.

    For each image field that is about to change:

    1. Fetch the old instance from the database.
    2. Collect the variant file paths recorded in the *old* instance's
       ``image_variants`` map, falling back to names computed with
       :func:`_variant_filename` for entries that were never recorded.
    3. Delete each variant file via ``storage.delete()`` (storage-agnostic).
    4. Clear the stale entries from ``image_variants`` so the API never
       returns URLs pointing at deleted files.

    The Celery task enqueued by :func:`dispatch_image_variant_task`
    (in ``post_save``) will regenerate variants for the new image.
    """
    model_name = sender.__name__
    if model_name not in IMAGE_FIELD_NAMES:
        return

    if not instance.pk:
        return

    changed = getattr(instance, _FIELD_CHANGES_ATTR, [])
    if not changed:
        return

    try:
        old_instance = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    config = IMAGE_VARIANT_CONFIGS.get(model_name, {})

    for field_name in changed:
        if field_name not in config:
            continue

        old_field = getattr(old_instance, field_name)
        if not old_field or not old_field.name:
            continue

        storage = old_field.storage

        # Prefer the paths actually recorded for the old image: storage.save()
        # may have had to suffix a name to avoid a collision, in which case the
        # recomputed name would not match the file on disk.
        recorded = (old_instance.image_variants or {}).get(field_name, {})
        variant_names = set(recorded.values())
        variant_names.update(
            _variant_filename(old_field.name, width)
            for width in config[field_name]["widths"]
        )

        for variant_name in variant_names:
            try:
                storage.delete(variant_name)
            except Exception as exc:
                logger.error(
                    "cleanup_orphaned_variants: failed to delete %s (%s.%s pk=%s): %s",
                    variant_name,
                    sender._meta.app_label,
                    model_name,
                    instance.pk,
                    exc,
                )

        if instance.image_variants:
            instance.image_variants.pop(field_name, None)


def has_all_variants(instance):
    """Return ``True`` when every populated image field already has variants.

    Used by the backfill command to skip rows that need no work, so a re-run
    does not re-download and re-encode the entire image corpus.
    """
    config = IMAGE_VARIANT_CONFIGS.get(instance.__class__.__name__)
    if not config:
        return True

    stored = instance.image_variants or {}

    for field_name, field_config in config.items():
        if not getattr(instance, field_name, None):
            continue
        expected = {
            str(width) if width is not None else "webp"
            for width in field_config["widths"]
        }
        if not expected.issubset(set(stored.get(field_name, {}))):
            return False

    return True


def generate_and_store_variants(instance, field_names=None):
    """Generate WebP variants for *instance* and persist them.

    Variant **storage paths** (not URLs) are written to ``image_variants``;
    use :func:`build_variant_urls` to resolve them for API responses.  Storing
    paths keeps the rows portable: the storage account or CDN domain can change
    without invalidating every backfilled row.

    Parameters
    ----------
    instance : Model
        A ``Project``, ``Organization``, or ``UserProfile`` instance.
    field_names : list[str] | None
        Subset of image fields to process.  If ``None``, all configured
        image fields are processed.
    """
    from climateconnect_main.utility.images import (
        generate_webp_variant,
        read_source_bytes,
    )

    model_name = instance.__class__.__name__
    config = IMAGE_VARIANT_CONFIGS.get(model_name)
    if not config:
        return

    if field_names is None:
        field_names = list(config.keys())

    if not instance.image_variants:
        instance.image_variants = {}

    changed = False

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
            if instance.image_variants.get(field_name):
                instance.image_variants.pop(field_name, None)
                changed = True
            continue

        widths = config[field_name]["widths"]
        storage = field_file.storage
        previous = instance.image_variants.get(field_name, {})
        variants = {}

        # Read the original once, not once per width — on Azure each read is a
        # blob download, and a backfill does this for every row in the table.
        source_bytes = read_source_bytes(field_file)
        if source_bytes is None:
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
        # that no longer exists on storage.
        if variants:
            if variants != previous:
                instance.image_variants[field_name] = variants
                changed = True
        elif previous:
            # Everything failed and the old files are gone — clear the entry so
            # the API falls back to the original instead of serving 404s.
            instance.image_variants.pop(field_name, None)
            changed = True

    if changed:
        instance.save(update_fields=["image_variants"])


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
