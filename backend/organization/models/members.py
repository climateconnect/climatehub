from django.db import models
from django.contrib.auth.models import User
from organization.models import Project, Organization
from climateconnect_api.models import Role, Availability
from organization.utility import MembershipTarget, RequestStatus


class ProjectMember(models.Model):
    user = models.ForeignKey(
        User,
        related_name="project_member_user",
        help_text="Points to user table",
        verbose_name="User",
        on_delete=models.CASCADE,
    )

    project = models.ForeignKey(
        Project,
        related_name="project_member_project",
        help_text="Points to project table",
        verbose_name="Project",
        on_delete=models.CASCADE,
    )

    role = models.ForeignKey(
        Role,
        related_name="project_member_role",
        verbose_name="Role(permissions)",
        help_text="Points to user role",
        on_delete=models.PROTECT,
    )

    role_in_project = models.CharField(
        help_text="Points to the role of the person in the project, e.g. 'project manager'",
        verbose_name="Role in project",
        max_length=1024,
        null=True,
        blank=True,
    )

    availability = models.ForeignKey(
        Availability,
        related_name="member_availability",
        help_text="Shows how many hours per week the user is putting into this specific project.",
        verbose_name="Time per week",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        help_text="Time when project members were created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when project members were updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    is_active = models.BooleanField(
        help_text="Indicates whether the user is still assigned to the project ",
        verbose_name="Active",
        null=False,
        blank=False,
        default=True,
    )

    class Meta:
        app_label = "organization"
        verbose_name = "Project Member"
        verbose_name_plural = "Project Members"
        ordering = ["id"]
        unique_together = ("user", "project")

    def __str__(self):
        return "User %s %s member for Project %s" % (
            self.user.first_name,
            self.user.last_name,
            self.project.name,
        )


class OrganizationMember(models.Model):
    user = models.ForeignKey(
        User,
        related_name="org_member",
        help_text="Point to user table",
        verbose_name="User",
        on_delete=models.CASCADE,
    )

    organization = models.ForeignKey(
        Organization,
        related_name="organization_member",
        help_text="Points to organization table",
        verbose_name="Organization",
        on_delete=models.CASCADE,
    )

    role = models.ForeignKey(
        Role,
        related_name="organization_role",
        help_text="Points ot Role table",
        verbose_name="Role(Permissions)",
        on_delete=models.PROTECT,
    )

    created_at = models.DateTimeField(
        help_text="Time when organization member was created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when organization member was updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    role_in_organization = models.CharField(
        help_text="Points to the role of the person in the organization, e.g.:`Organization Manager`",
        verbose_name="Role in organization",
        max_length=1024,
        null=True,
        blank=True,
    )

    time_per_week = models.ForeignKey(
        Availability,
        related_name="org_member_availability",
        help_text="Points to availability of a member for the organization",
        verbose_name="Availability",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        app_label = "organization"
        verbose_name = "Organization Member"
        verbose_name_plural = "Organization Members"
        ordering = ["-id"]
        unique_together = ("user", "organization")

    def __str__(self):
        return "User %s %s member for organization %s" % (
            self.user.first_name,
            self.user.last_name,
            self.organization.name,
        )


class MembershipRequests(models.Model):
    user = models.ForeignKey(
        User,
        verbose_name="Requesting user",
        help_text="Points to the user who sent the request",
        on_delete=models.CASCADE,
        null=False,
        related_name="users",
    )

    target_membership_type = models.SmallIntegerField(
        choices=[(x.value, x.name) for x in MembershipTarget],
        null=False,
        verbose_name="Membership Request Target Type",
        help_text="The type of entity a user requested to join (organization, project...)",
    )

    target_project = models.ForeignKey(
        Project,
        null=True,
        on_delete=models.CASCADE,
        help_text="Points to the requested project",
        verbose_name="Target Project of Membership Request",
        related_name="projects",
    )

    target_organization = models.ForeignKey(
        Organization,
        null=True,
        on_delete=models.CASCADE,
        help_text="Points to the requested organization",
        related_name="organizations",
        verbose_name="Target Ogranization of Membership request",
    )

    availability = models.ForeignKey(
        Availability,
        null=False,
        on_delete=models.CASCADE,
        help_text="Points to the Availability offered by the user",
        verbose_name="requested membership availability",
        related_name="availabilities",
    )

    requested_at = models.DateTimeField(
        help_text="Time of request",
        verbose_name="Requested at",
        default=None,
        null=False,
    )
    approved_at = models.DateTimeField(
        help_text="Time of request approval",
        verbose_name="Approved at",
        default=None,
        null=True,
    )
    rejected_at = models.DateTimeField(
        help_text="Time of request rejection",
        verbose_name="Rejected at",
        default=None,
        null=True,
    )

    message = models.TextField(
        help_text="Message associated with the request",
        verbose_name="Request Message",
        max_length=4096,
        null=True,
        blank=True,
    )

    request_status = models.SmallIntegerField(
        choices=[(x.value, x.name) for x in RequestStatus],
        default=RequestStatus.PENDING.value,
    )

    class Meta:
        unique_together = ("user", "target_project")
        verbose_name = "Membership Request"
        verbose_name_plural = "Membership Requests"

    def __str__(self):
        if self.target_project:
            target = self.target_project.name
        elif self.target_organization:
            target = self.target_organization.name
        else:
            target = "unknown target"
        return "Membership request by %s to join %s" % (self.user.username, target)
