from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q

from organization.models.project import Project


def rich_text_image_path(instance, filename):
    # The caller passes a random name; no user or entity id ends up in the
    # path, because the variant paths are written into public HTML.
    return f"rich_text_images/{filename}"


class RichTextImage(models.Model):
    """An image uploaded for a rich-text field (e.g. a project description).

    The image is owned by the user who uploaded it. Where it is used is
    recorded in :class:`RichTextImageUsage`, which is kept in sync with the
    stored HTML on every save of the entity.
    """

    owner = models.ForeignKey(
        User,
        related_name="rich_text_images",
        verbose_name="Owner",
        help_text="The user who uploaded the image",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    original = models.FileField(
        upload_to=rich_text_image_path,
        verbose_name="Original",
        help_text="The uploaded file, with metadata removed. Never linked publicly.",
        max_length=255,
    )

    variants = models.JSONField(
        verbose_name="Variants",
        help_text=(
            "WebP variants as a list of {name, width, height}, sorted by width."
            " Storage names, not URLs."
        ),
        default=list,
    )

    width = models.PositiveIntegerField(
        verbose_name="Width",
        help_text="Width of the original in pixels, after applying the orientation",
    )

    height = models.PositiveIntegerField(
        verbose_name="Height",
        help_text="Height of the original in pixels, after applying the orientation",
    )

    file_size = models.PositiveIntegerField(
        verbose_name="File size",
        help_text="Size of the stored original in bytes",
    )

    FORMAT_CHOICES = (("jpeg", "JPEG"), ("png", "PNG"), ("webp", "WebP"))
    format = models.CharField(
        verbose_name="Format",
        help_text="Format of the original, detected from its content",
        max_length=8,
        choices=FORMAT_CHOICES,
    )

    created_at = models.DateTimeField(
        verbose_name="Created At",
        help_text="Time when the image was uploaded",
        auto_now_add=True,
    )

    class Meta:
        app_label = "climateconnect_api"
        verbose_name = "Rich-text image"
        verbose_name_plural = "Rich-text images"
        ordering = ["-id"]

    def __str__(self):
        return "Rich-text image %s (%s)" % (self.id, self.owner)


class RichTextImageUsage(models.Model):
    """One place where a :class:`RichTextImage` is used.

    Exactly one entity foreign key is set. One row covers all language
    versions of the field.
    """

    PROJECT_DESCRIPTION = "project_description"
    FIELD_CHOICES = ((PROJECT_DESCRIPTION, "Project description"),)

    image = models.ForeignKey(
        RichTextImage,
        related_name="usages",
        verbose_name="Image",
        on_delete=models.CASCADE,
    )

    # Deleting the project only removes the usage: the image is unlinked, not
    # deleted, and stays with its owner.
    project = models.ForeignKey(
        Project,
        related_name="rich_text_image_usages",
        verbose_name="Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    field = models.CharField(
        verbose_name="Field",
        help_text="The rich-text field the image is used in",
        max_length=64,
        choices=FIELD_CHOICES,
    )

    created_at = models.DateTimeField(
        verbose_name="Created At",
        auto_now_add=True,
    )

    class Meta:
        app_label = "climateconnect_api"
        verbose_name = "Rich-text image usage"
        verbose_name_plural = "Rich-text image usages"
        constraints = [
            models.UniqueConstraint(
                fields=["image", "project", "field"],
                condition=Q(project__isnull=False),
                name="unique_rich_text_image_usage_project",
            ),
            # Later entity types add their FK here: exactly one must be set.
            models.CheckConstraint(
                condition=Q(project__isnull=False),
                name="rich_text_image_usage_has_entity",
            ),
        ]

    def __str__(self):
        return "Image %s in %s of project %s" % (
            self.image_id,
            self.field,
            self.project_id,
        )
