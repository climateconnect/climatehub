from organization.utility.cache import generate_project_ranking_cache_key
from organization.utility.project_ranking import ProjectRanking
from location.models import Location
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from organization.models import (
    Organization,
)
from organization.models.type import ProjectTypesChoices
from climateconnect_api.models import (
    Skill,
)
from climateconnect_api.models.language import Language


def project_image_path(instance, filename):
    return "projects/{}/{}".format(instance.id, filename)


class Project(models.Model):
    name = models.CharField(
        help_text="Points to project name", verbose_name="Name", max_length=1024
    )

    url_slug = models.CharField(
        help_text="URL slug for project",
        verbose_name="URL slug",
        unique=True,
        max_length=1024,
        null=True,
        blank=True,
    )

    image = models.ImageField(
        help_text="Project image",
        verbose_name="Image",
        null=True,
        blank=True,
        upload_to=project_image_path,
    )

    thumbnail_image = models.ImageField(
        help_text="Image to show on project card",
        verbose_name="Thumbnail image",
        null=True,
        blank=True,
        upload_to=project_image_path,
    )

    # Deprecated: project status is no longer used. The column is kept (nullable,
    # no default) so existing rows and the ProjectStatus table stay intact.
    status = models.ForeignKey(
        "ProjectStatus",
        help_text="Points to project's status",
        verbose_name="Project Status",
        related_name="project_status",
        on_delete=models.PROTECT,
        blank=True,
        null=True,
    )

    project_type = models.CharField(
        max_length=2,
        choices=ProjectTypesChoices.choices,
        default=ProjectTypesChoices.project,
    )

    start_date = models.DateTimeField(
        help_text="Points to start date of the project",
        verbose_name="Start Date",
        null=True,
        blank=True,
    )

    end_date = models.DateTimeField(
        help_text="Points to end date of the project",
        verbose_name="End Date",
        null=True,
        blank=True,
    )

    # created_at value automatically added when new project is created

    created_at = models.DateTimeField(
        help_text="Points to creation date of the project",
        verbose_name="Created At",
        auto_now_add=True,
    )

    # updated_at value automatically changes every time there is change in project object.
    updated_at = models.DateTimeField(
        help_text="Points to time when project was updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    short_description = models.TextField(
        help_text="Points to short description about the project",
        verbose_name="Short Description",
        null=True,
        blank=True,
        max_length=280,
    )

    description = models.TextField(
        help_text="Points to detailed description about the project",
        verbose_name="Description",
        null=True,
        blank=True,
        max_length=4800,
    )

    description_html = models.TextField(
        help_text="Rich-text HTML description (Tiptap output)",
        verbose_name="Description HTML",
        null=True,
        blank=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    country = models.CharField(
        help_text="Points to a country of the project",
        verbose_name="Country",
        max_length=512,
        null=True,
        blank=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    city = models.CharField(
        help_text="Points to a city of the project",
        verbose_name="City",
        max_length=512,
        null=True,
        blank=True,
    )

    loc = models.ForeignKey(
        Location,
        help_text="Points to the project's location",
        verbose_name="Location",
        related_name="project_loc",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    collaborators_welcome = models.BooleanField(
        help_text="If collaborators are welcome or not for the project",
        verbose_name="Collaborators welcome",
        default=False,
    )

    # DEPRECATED: Project skills are deprecated. See issue #1785.
    # This field is kept for backwards compatibility but should not be used.
    skills = models.ManyToManyField(
        Skill,
        related_name="project_skills",
        help_text="Points to all skills project persist or required",
        verbose_name="Skills",
        blank=True,
    )

    helpful_connections = ArrayField(
        models.CharField(max_length=264), blank=True, null=True, size=10
    )

    is_draft = models.BooleanField(
        help_text="Whether project is public or just a private draft",
        verbose_name="Is Draft?",
        default=False,
    )

    website = models.CharField(
        help_text="Website",
        verbose_name="Project's website",
        max_length=256,
        null=True,
        blank=True,
    )

    rating = models.SmallIntegerField(
        help_text="The larger the number, the more to the top this project will be displayed. Negative values downrank the project.",
        verbose_name="Rating",
        default=100,
    )

    is_active = models.BooleanField(
        help_text="Flags if the project is still publically active or not",
        verbose_name="Is an Active Project",
        default=True,
        null=False,
    )

    language = models.ForeignKey(
        Language,
        related_name="project_language",
        help_text="Original project language",
        verbose_name="Language",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    additional_loc_info = models.CharField(
        help_text="e.g. Room or other instructions to get to the location",
        verbose_name="Additional location info",
        max_length=256,
        null=True,
        blank=True,
    )

    related_hubs = models.ManyToManyField(
        "hubs.Hub", related_name="projects_related_hubs", blank=True
    )

    parent_project = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_projects",
        help_text="Parent project for multi-event structures (e.g., festival with sub-events)",
        db_index=True,
    )

    has_children = models.BooleanField(
        default=False,
        help_text="Flag indicating if this project has child projects (events).",
        db_index=True,
    )

    is_online = models.BooleanField(
        help_text="Whether the project takes place online",
        verbose_name="Is Online",
        default=False,
    )

    devlink_component = models.CharField(
        help_text=(
            "Devlink component name from Webflow. Use the full component name "
            "including the language prefix (e.g. 'EnChErlangenLandingpage'). "
            "If the component has localized variants, include the En or De prefix "
            "— the system will swap it automatically based on the user's locale. "
            "If the component has no language prefix (e.g. 'Wasseraktionswochen'), "
            "it will be shown as-is for all languages."
        ),
        verbose_name="Devlink component name",
        max_length=128,
        null=True,
        blank=True,
    )

    @property
    def cached_ranking(self) -> int:
        """Carful with this property, it might trigger an N+1 query problem"""
        cache_key = generate_project_ranking_cache_key(project_id=self.id)
        project_rank = cache.get(cache_key)
        if not project_rank:
            return self.ranking
            # return self.rating
        return project_rank

    @property
    def ranking(self) -> int:
        return ProjectRanking().calculate_ranking(
            description=self.description_html,
            location=self.loc,
            project_id=self.id,
            project_manually_set_rating=self.rating,
            project_type=self.project_type,
            start_date=self.start_date,
            end_date=self.end_date,
            created_at=self.created_at,
        )

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(generate_project_ranking_cache_key(project_id=self.id))

    def clean(self):
        """Validate parent/child relationships."""
        super().clean()

        if self.parent_project:
            # Prevent self-reference
            if self.parent_project == self:
                from django.core.exceptions import ValidationError

                raise ValidationError("A project cannot be its own parent")

            # Prevent nesting beyond one level
            if self.parent_project.parent_project is not None:
                from django.core.exceptions import ValidationError

                raise ValidationError("Projects can only be nested one level deep")

            # Prevent making a parent if already has children
            if self.pk and self.child_projects.exists():
                from django.core.exceptions import ValidationError

                raise ValidationError(
                    "A project with child projects cannot have a parent"
                )

    class Meta:
        app_label = "organization"
        verbose_name = "Project"
        verbose_name_plural = "Projects"
        ordering = ["-rating", "-id"]

    def __str__(self):
        return "(%d) %s: %s" % (self.pk, self.project_type, self.name)


@receiver(post_save, sender="organization.ProjectLike")
@receiver(post_save, sender="organization.ProjectFollower")
@receiver(post_save, sender="organization.ProjectComment")
def update_project_ranking_cache_on_save(sender, instance, created, **kwargs):
    if created:
        cache.delete(generate_project_ranking_cache_key(project_id=instance.project_id))
        instance.project.ranking


@receiver(post_delete, sender="organization.ProjectFollower")
@receiver(post_delete, sender="organization.ProjectComment")
@receiver(post_delete, sender="organization.ProjectLike")
def update_project_ranking_cache_on_delete(sender, instance, **kwargs):
    cache.delete(generate_project_ranking_cache_key(project_id=instance.project_id))


class ProjectParents(models.Model):
    project = models.ForeignKey(
        Project,
        help_text="Points to organizations's project",
        verbose_name="Project",
        related_name="project_parent",
        on_delete=models.CASCADE,
    )

    parent_organization = models.ForeignKey(
        Organization,
        help_text="Points to organization",
        verbose_name="Organization",
        related_name="project_parent_org",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    parent_user = models.ForeignKey(
        "auth.User",
        help_text="Points to user who created a project",
        verbose_name="User",
        related_name="project_parent_user",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )

    created_at = models.DateTimeField(
        help_text="Time when project was linked to an organization",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when project was updated. i.e.: Order change etc.",
        verbose_name="Updated At",
        auto_now=True,
    )

    class Meta:
        app_label = "organization"
        verbose_name_plural = "Project Parents"

    def __str__(self):
        return "Project parent for project %s" % (self.project.name)


class ProjectCollaborators(models.Model):
    project = models.ForeignKey(
        Project,
        help_text="Points to organizations's project",
        verbose_name="Project",
        related_name="project_collaborator",
        on_delete=models.CASCADE,
    )

    collaborating_organization = models.ForeignKey(
        Organization,
        help_text="Points to organization",
        verbose_name="Organization",
        related_name="collaborating_organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    created_at = models.DateTimeField(
        help_text="Time when project was linked to an organization",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when project was updated. i.e.: Order change etc.",
        verbose_name="Updated At",
        auto_now=True,
    )

    class Meta:
        app_label = "organization"
        verbose_name_plural = "Project Collaborators"

    def __str__(self):
        return "Project collaborator for project %s" % (self.project.id)
