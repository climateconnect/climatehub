from location.models import Location
from django.db import models

#
from climateconnect_api.models.language import Language


def organization_image_path(instance, filename):
    return "organization_images/{}/profile/{}".format(instance.id, filename)


def organization_background_image_path(instance, filename):
    return "organization_images/{}/background/{}".format(instance.id, filename)


class Organization(models.Model):
    name = models.CharField(
        help_text="Points to name of the organization",
        verbose_name="Organization",
        max_length=1024,
    )

    url_slug = models.CharField(
        help_text="Points to organization url slug",
        verbose_name="URL Slug",
        max_length=1024,
        unique=True,
        null=True,
        blank=True,
    )

    image = models.ImageField(
        help_text="Organization image",
        verbose_name="Organization Image",
        upload_to=organization_image_path,
        null=True,
        blank=True,
    )

    thumbnail_image = models.ImageField(
        help_text="Thumbnail image",
        verbose_name="Thumbnail Image",
        upload_to=organization_image_path,
        null=True,
        blank=True,
    )

    background_image = models.ImageField(
        help_text="Points to background image of an organization",
        verbose_name="Background image",
        upload_to=organization_background_image_path,
        null=True,
        blank=True,
    )

    parent_organization = models.ForeignKey(
        "self",
        related_name="organization_parent",
        help_text="Points to parent organization",
        verbose_name="Parent Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    created_at = models.DateTimeField(
        help_text="Time when organization was created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when organization object was updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    country = models.CharField(
        help_text="Points to what country the organization is located.",
        verbose_name="Country",
        max_length=512,
        null=True,
        blank=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    state = models.CharField(
        help_text="Points to what state the organization is located.",
        verbose_name="State",
        max_length=512,
        null=True,
        blank=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    city = models.CharField(
        help_text="Points to what city the organization is located",
        verbose_name="City",
        max_length=1024,  # Keeping higher len because city name in some countries are pretty long
        null=True,
        blank=True,
    )

    location = models.ForeignKey(
        Location,
        help_text="Points to the organization's location",
        verbose_name="Location",
        related_name="organization_loc",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    about = models.TextField(
        help_text="About section of the organization page",
        verbose_name="About",
        null=True,
        blank=True,
    )

    short_description = models.TextField(
        help_text="Short description of the org: 240 characters max!",
        verbose_name="Short description",
        null=True,
        blank=True,
        max_length=280,
    )

    school = models.CharField(
        help_text="Points to a school if the organization is school org",
        verbose_name="School",
        null=True,
        blank=True,
        max_length=512,
    )

    organ = models.CharField(
        help_text="Used for organization who is gov organization",
        verbose_name="Organ",
        null=True,
        blank=True,
        max_length=512,
    )

    website = models.CharField(
        help_text="Website",
        verbose_name="Organization's website",
        max_length=256,
        null=True,
        blank=True,
    )

    rating = models.PositiveSmallIntegerField(
        help_text="organizations with a rating of 99 are being shown as featured. Could later be used to sort organizations.",
        verbose_name="Rating (1-100)",
        default=100,
    )

    language = models.ForeignKey(
        Language,
        related_name="orgnaization_language",
        help_text="Points to original language organization was created on",
        verbose_name="Language",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    get_involved = models.TextField(
        help_text="How to get involved textfield",
        verbose_name="How to get involved",
        null=True,
        blank=True,
        max_length=250,
    )

    VERY_SMALL_ORGANIZATION_SIZE = 0
    SMALL_ORGANIZATION_SIZE = 1
    SMALL_MEDIUM_ORGANIZATION_SIZE = 2
    MEDIUM_ORGANIZATION_SIZE = 3
    LARGE_MEDIUM_ORGANIZATION_SIZE = 4
    LARGE_ORGANIZATION_SIZE = 5
    VERY_LARGE_ORGANIZATION_SIZE = 6
    HUGE_ORGANIZATION_SIZE = 7

    # These options are also hardcoded in the frontend because I figured this will hardly ever change and isn't worth it to get from the server.
    # Changes here will need to also be made in the frontend
    ORGANIZATION_SIZE_OPTIONS = (
        (VERY_SMALL_ORGANIZATION_SIZE, "1-10"),
        (SMALL_ORGANIZATION_SIZE, "11-50"),
        (SMALL_MEDIUM_ORGANIZATION_SIZE, "51-250"),
        (MEDIUM_ORGANIZATION_SIZE, "251-500"),
        (LARGE_MEDIUM_ORGANIZATION_SIZE, "501-1000"),
        (LARGE_ORGANIZATION_SIZE, "1001-5000"),
        (VERY_LARGE_ORGANIZATION_SIZE, "5001-50000"),
        (HUGE_ORGANIZATION_SIZE, "50000+"),
    )

    organization_size = models.IntegerField(
        help_text="The number of people working in this organization",
        verbose_name="Organization size",
        choices=ORGANIZATION_SIZE_OPTIONS,
        null=True,
        blank=True,
    )

    # TODO: obsolete field --> should be removed, as mappings to sector hubs in not nessary anymore
    hubs = models.ManyToManyField(
        "hubs.Hub",
        related_name="organization_hubs",
        help_text="SectorHubs that the organization is active in. These hubs will be displayed on the organization page.",
        verbose_name="Hubs",
        blank=True,
    )

    # TODO: obsolete field --> should be using sector mappings instead
    # sectors = models.ManyToManyField(
    #     "organization.Sector",
    #     related_name="organization_sectors",
    #     help_text="Sectors that the organization is active in. These sectors will be displayed on the organization page.",
    #     verbose_name="Sectors",
    #     blank=True,
    # )

    related_hubs = models.ManyToManyField(
        "hubs.Hub",
        related_name="organizations_related_hubs",
        help_text="(Custom) hubs that the organization is part of. The organization wil appear in these hubs.",
        blank=True,
    )

    is_draft = models.BooleanField(
        help_text="Whether organization is public or just a private draft",
        verbose_name="Is Draft?",
        default=False,
    )

    class Meta:
        app_label = "organization"
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ["-id"]

    def __str__(self):
        return "%s (%d)" % (self.name, self.pk)
