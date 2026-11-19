from django.contrib.auth.models import User
from django.db.models.signals import post_delete, pre_delete
from django.dispatch import receiver

from climateconnect_api.models import RichTextImage
from climateconnect_api.utility.rich_text_images import delete_image_files_on_commit


@receiver(pre_delete, sender=User)
def delete_unused_rich_text_images(sender, instance, **kwargs):
    """Delete the user's rich-text images that are not used anywhere.

    Used images are kept as content of their entity; the owner reference is
    cleared by ``on_delete=SET_NULL`` afterwards.
    """
    RichTextImage.objects.filter(owner=instance, usages__isnull=True).delete()


@receiver(post_delete, sender=RichTextImage)
def delete_rich_text_image_files(sender, instance, **kwargs):
    """Remove the stored files once the delete has committed."""
    delete_image_files_on_commit(instance)
