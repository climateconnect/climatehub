"""
Django signals for maintaining parent/child project relationships.

This module contains signals that keep the has_children denormalized flag
synchronized with the actual child_projects relationships, plus image-variant
generation dispatch for ``Project`` and ``Organization`` image fields.
"""

from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from climateconnect_main.utility.image_variants import (
    capture_image_field_changes,
    cleanup_orphaned_variants,
    dispatch_image_variant_task,
)


@receiver(pre_save, sender="organization.Project")
def track_old_parent_before_save(sender, instance, **kwargs):
    """
    Track the old parent_project value before save.

    This allows us to detect parent changes in post_save and update
    the old parent's has_children flag.
    """
    if instance.pk:
        try:
            old_instance = sender.objects.get(pk=instance.pk)
            # Store old parent on the instance (will be available in post_save)
            instance._old_parent_project = old_instance.parent_project
        except sender.DoesNotExist:
            instance._old_parent_project = None
    else:
        instance._old_parent_project = None


@receiver(post_save, sender="organization.Project")
def update_parent_has_children_on_save(sender, instance, created, **kwargs):
    """
    Update parent's has_children flag when a child is created or modified.

    This signal fires after a Project is saved. If the project has a parent,
    we check if the parent actually has children and update the flag accordingly.

    Also handles the case where a child is moved from one parent to another.
    """
    # Update new parent's has_children flag
    if instance.parent_project:
        has_children = instance.parent_project.child_projects.exists()
        if instance.parent_project.has_children != has_children:
            sender.objects.filter(pk=instance.parent_project.pk).update(
                has_children=has_children
            )

    # Update old parent's has_children flag if parent changed
    if hasattr(instance, "_old_parent_project"):
        old_parent = instance._old_parent_project

        # If there was an old parent and it's different from the new parent
        if old_parent and old_parent != instance.parent_project:
            # Check if old parent still has children
            has_children = old_parent.child_projects.exists()

            # Only update if value changed
            if old_parent.has_children != has_children:
                sender.objects.filter(pk=old_parent.pk).update(
                    has_children=has_children
                )


@receiver(pre_delete, sender="organization.Project")
def update_parent_has_children_on_delete(sender, instance, **kwargs):
    """
    Update parent's has_children flag when a child is deleted.

    This signal fires before a Project is deleted. If the project has a parent,
    we check if the parent will still have children after this deletion.
    """
    if instance.parent_project:
        # After deletion, check if parent will still have children
        remaining_children = instance.parent_project.child_projects.exclude(
            pk=instance.pk
        ).exists()

        # Only update if value changed
        if instance.parent_project.has_children != remaining_children:
            sender.objects.filter(pk=instance.parent_project.pk).update(
                has_children=remaining_children
            )


# ---------------------------------------------------------------------------
# Image-variant generation dispatch for Project and Organization
# ---------------------------------------------------------------------------

@receiver(pre_save, sender="organization.Project")
def _capture_project_image_changes(sender, instance, **kwargs):
    capture_image_field_changes(sender, instance, **kwargs)


@receiver(pre_save, sender="organization.Project")
def _cleanup_project_orphaned_variants(sender, instance, **kwargs):
    """Delete old variant files before the image is replaced (post-capture)."""
    cleanup_orphaned_variants(sender, instance, **kwargs)


@receiver(post_save, sender="organization.Project")
def _dispatch_project_image_variants(sender, instance, created, **kwargs):
    dispatch_image_variant_task(sender, instance, created, **kwargs)


@receiver(pre_save, sender="organization.Organization")
def _capture_organization_image_changes(sender, instance, **kwargs):
    capture_image_field_changes(sender, instance, **kwargs)


@receiver(pre_save, sender="organization.Organization")
def _cleanup_organization_orphaned_variants(sender, instance, **kwargs):
    """Delete old variant files before the image is replaced (post-capture)."""
    cleanup_orphaned_variants(sender, instance, **kwargs)


@receiver(post_save, sender="organization.Organization")
def _dispatch_organization_image_variants(sender, instance, created, **kwargs):
    dispatch_image_variant_task(sender, instance, created, **kwargs)
