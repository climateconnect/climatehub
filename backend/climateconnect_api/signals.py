"""
Django signals for the ``climateconnect_api`` app.

Handles image-variant generation dispatch for ``UserProfile`` image fields
(mirroring the logic in ``organization/signals.py``), plus invalidation of the
cached members listing when a profile's image changes.
"""

import logging

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from climateconnect_main.utility.image_variants import (
    _FIELD_CHANGES_ATTR,
    capture_image_field_changes,
    delete_image_files,
    handle_image_field_changes,
)

logger = logging.getLogger(__name__)


def invalidate_member_list_cache():
    """Drop the cached ``/api/members/`` pages.

    ``ListMemberProfilesView`` is wrapped in ``cache_page`` with a two-day TTL,
    and ``UserProfile.remove_cache_keys`` only invalidates on *creation*. So
    without this, changing an avatar leaves the members list showing the old
    picture (or none) for up to two days.
    """
    if not hasattr(cache, "keys"):
        logger.debug(
            "Cache backend does not support keys() - skipping member list "
            "cache invalidation."
        )
        return
    keys = cache.keys("*LIST_MEMBERS*")
    if keys:
        cache.delete_many(keys)


@receiver(pre_save, sender="climateconnect_api.UserProfile")
def _capture_userprofile_image_changes(sender, instance, **kwargs):
    capture_image_field_changes(sender, instance, **kwargs)


@receiver(post_save, sender="climateconnect_api.UserProfile")
def _handle_userprofile_image_changes(sender, instance, created, **kwargs):
    handle_image_field_changes(sender, instance, created, **kwargs)


@receiver(post_delete, sender="climateconnect_api.UserProfile")
def _delete_userprofile_image_files(sender, instance, **kwargs):
    """Delete the originals and variants of a deleted profile (and its User)."""
    delete_image_files(sender, instance, **kwargs)


@receiver(post_save, sender="climateconnect_api.UserProfile")
def _invalidate_member_list_on_image_change(sender, instance, created, **kwargs):
    """Refresh the members listing when a profile's picture changes.

    Two moments matter, because variant generation is asynchronous:

    1. the upload itself, when ``thumbnail_image`` starts pointing at a new
       file, and
    2. the Celery task writing ``image_variants``, which is what lets the
       listing serve WebP instead of the original.

    Creation is already covered by ``remove_cache_keys`` in ``models/user.py``.
    """
    if created:
        return

    update_fields = kwargs.get("update_fields")
    if update_fields and "image_variants" in update_fields:
        invalidate_member_list_cache()
        return

    if getattr(instance, _FIELD_CHANGES_ATTR, None):
        invalidate_member_list_cache()
