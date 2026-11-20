"""
Model-side support for image variants: configuration and load tracking.

Kept free of DRF and of any model imports so model modules can import
:class:`ImageVariantsModelMixin` without import cycles.
:mod:`climateconnect_main.utility.image_variants` re-exports everything here.
"""

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
}

# Image fields monitored for changes (trigger variant generation). Derived from
# the config so the two can never drift apart.
IMAGE_FIELD_NAMES = {
    model: list(fields) for model, fields in IMAGE_VARIANT_CONFIGS.items()
}

# Instance attribute holding ``{field_name: storage name}`` as last loaded from
# or written to the database.
_LOADED_NAMES_ATTR = "_image_names_at_load"

# Marker for a field that is not loaded on the instance (deferred).
_MISSING = object()


def current_image_name(instance, field_name):
    """The storage name *instance* holds for *field_name*, or :data:`_MISSING`.

    Reads ``__dict__`` directly so a deferred field is reported as missing
    instead of being loaded with an extra query. Empty names normalise to
    ``None``. For a freshly assigned upload this is the upload's own name, which
    never equals a stored name (those carry the ``upload_to`` directory).
    """
    if field_name not in instance.__dict__:
        return _MISSING
    value = instance.__dict__[field_name]
    return getattr(value, "name", value) or None


def remember_image_names(instance, field_names=None):
    """Record the image names *instance* now shares with the database.

    Called after loading, refreshing, or saving. With *field_names*, only those
    fields are recorded, so an unsaved change to another field is not forgotten.
    """
    fields = IMAGE_FIELD_NAMES.get(instance.__class__.__name__, [])
    if field_names is not None:
        fields = [field for field in fields if field in field_names]
    loaded = dict(getattr(instance, _LOADED_NAMES_ATTR, None) or {})
    for field_name in fields:
        name = current_image_name(instance, field_name)
        if name is _MISSING:
            loaded.pop(field_name, None)
        else:
            loaded[field_name] = name
    setattr(instance, _LOADED_NAMES_ATTR, loaded)


def image_fields_changed_since_load(instance, field_names):
    """The image fields among *field_names* changed in memory since loading.

    Needs no query. A field whose loaded value is unknown (constructed instance,
    field deferred at load time) counts as changed if it holds a value — callers
    confirm candidates against the database before acting on them.
    """
    loaded = getattr(instance, _LOADED_NAMES_ATTR, None)
    changed = []
    for field_name in field_names:
        current = current_image_name(instance, field_name)
        if current is _MISSING:
            continue
        if instance._state.adding or loaded is None or field_name not in loaded:
            if current is not None:
                changed.append(field_name)
        elif loaded[field_name] != current:
            changed.append(field_name)
    return changed


class ImageVariantsModelMixin:
    """Mixin for models with image fields and an ``image_variants`` column.

    * **No lost updates of ``image_variants``.** A plain ``save()`` on an
      existing row writes every loaded field *except* ``image_variants`` and
      image fields unchanged since loading. ``image_variants`` is only written
      by the variant task (``save(update_fields=["image_variants"])`` under a
      row lock) and by atomic key removal when an image changes, so an edit
      view saving an instance loaded before the task finished can no longer
      overwrite fresh variants with an outdated map — nor write back an image
      someone else has since replaced.
    * **No query for unrelated saves.** The image names each instance was
      loaded with are remembered, so change detection compares in memory and
      only queries the database when an image actually changed.

    A ``save()`` that names ``update_fields`` explicitly is passed through as
    is. Note that, as with any ``update_fields`` save, a plain ``save()`` on a
    row deleted in the meantime raises ``DatabaseError`` instead of
    re-inserting it.
    """

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        remember_image_names(instance)
        return instance

    def refresh_from_db(self, using=None, fields=None, from_queryset=None):
        super().refresh_from_db(using=using, fields=fields, from_queryset=from_queryset)
        remember_image_names(self, fields)

    def save(self, *args, **kwargs):
        if (
            not args
            and kwargs.get("update_fields") is None
            and not kwargs.get("force_insert")
            and not self._state.adding
            and self.pk is not None
        ):
            kwargs["update_fields"] = self._fields_for_full_save()
        super().save(*args, **kwargs)
        remember_image_names(self, kwargs.get("update_fields"))

    def _fields_for_full_save(self):
        image_fields = IMAGE_FIELD_NAMES.get(self.__class__.__name__, [])
        changed_images = set(image_fields_changed_since_load(self, image_fields))
        deferred = self.get_deferred_fields()
        fields = []
        for field in self._meta.concrete_fields:
            if field.primary_key or field.attname in deferred:
                continue
            if field.name == "image_variants":
                continue
            if field.name in image_fields and field.name not in changed_images:
                continue
            fields.append(field.name)
        return fields
