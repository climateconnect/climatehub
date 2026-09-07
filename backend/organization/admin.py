from django.contrib import admin

from organization.models import (
    Comment,
    CommentTranslation,
    EventRegistration,
    EventRegistrationConfig,
    Organization,
    OrganizationFollower,
    OrganizationMember,
    OrganizationSectorMapping,
    OrganizationTagging,
    OrganizationTags,
    OrganizationTranslation,
    OrgProjectPublished,
    Post,
    PostComment,
    PostTranslation,
    Project,
    ProjectCollaborators,
    ProjectComment,
    ProjectFollower,
    ProjectLike,
    ProjectMember,
    ProjectParents,
    ProjectSectorMapping,
    ProjectTranslation,
    RegistrationField,
    RegistrationFieldAnswer,
    RegistrationFieldOption,
    Sector,
    UserProfileSectorMapping,
)
from organization.models.members import MembershipRequests

pass_through_models = (
    OrganizationTags,
    OrganizationTagging,
    Post,
    Comment,
    PostComment,
    ProjectComment,
    ProjectCollaborators,
    ProjectFollower,
    PostTranslation,
    CommentTranslation,
    ProjectLike,
    MembershipRequests,
    OrganizationFollower,
    OrgProjectPublished,
    Sector,
    ProjectSectorMapping,
    OrganizationSectorMapping,
    UserProfileSectorMapping,
)

for model in pass_through_models:
    admin.site.register(model, admin.ModelAdmin)


class OrganizationAdmin(admin.ModelAdmin):
    search_fields = ("name", "country", "state", "city", "url_slug")


admin.site.register(Organization, OrganizationAdmin)


class ProjectAdmin(admin.ModelAdmin):
    search_fields = (
        "name",
        "url_slug",
        "loc__name",
        "loc__city",
        "loc__state",
        "loc__country",
        "parent_project__name",
        "parent_project__url_slug",
        "project_parent__parent_user__username",
        "project_parent__parent_user__email",
        "project_parent__parent_user__user_profile__name",
        "project_parent__parent_organization__name",
    )
    list_filter = ("status", "has_children", "project_type", "updated_at")
    list_display = (
        "name",
        "url_slug",
        "status",
        "get_owner",
        "parent_project",
        "has_children",
        "project_type",
        "created_at",
        "updated_at",
    )
    raw_id_fields = ("parent_project",)  # Better UX for selecting parent project
    readonly_fields = (
        "has_children",
        "created_at",
        "updated_at",
    )  # Managed by signals/auto fields
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "name",
                    "url_slug",
                    "status",
                    "project_type",
                    "short_description",
                    "description",
                    "description_html",
                    "devlink_component",
                    "image",
                    "thumbnail_image",
                    "website",
                    "language",
                )
            },
        ),
        (
            "Location",
            {
                "fields": (
                    "is_online",
                    "loc",
                    "additional_loc_info",
                    "country",
                    "city",
                )
            },
        ),
        (
            "Dates & Status",
            {
                "fields": (
                    "start_date",
                    "end_date",
                    "created_at",
                    "updated_at",
                    "is_draft",
                    "is_active",
                )
            },
        ),
        (
            "Collaboration",
            {
                "fields": (
                    "collaborators_welcome",
                    "helpful_connections",
                    "related_hubs",
                    "rating",
                )
            },
        ),
        (
            "Hierarchy",
            {
                "fields": (
                    "parent_project",
                    "has_children",
                )
            },
        ),
    )

    def get_owner(self, obj):
        """Display the project owner (organization or user)."""
        try:
            project_parent = obj.project_parent.first()
            if project_parent:
                if project_parent.parent_organization:
                    return project_parent.parent_organization.name
                elif project_parent.parent_user:
                    # Try to get the user's profile name, fallback to username
                    if (
                        hasattr(project_parent.parent_user, "user_profile")
                        and project_parent.parent_user.user_profile
                    ):
                        return project_parent.parent_user.user_profile.name
                    return project_parent.parent_user.username
        except Exception:
            pass
        return "-"

    get_owner.short_description = "Owner"


admin.site.register(Project, ProjectAdmin)


class ProjectMemberAdmin(admin.ModelAdmin):
    search_fields = (
        "user__user_profile__name",
        "user__id",
        "project__name",
    )
    list_filter = ("role__name",)


admin.site.register(ProjectMember, ProjectMemberAdmin)


class OrganizationMemberAdmin(admin.ModelAdmin):
    search_fields = (
        "user__user_profile__name",
        "user__id",
        "organization__name",
    )
    list_filter = ("role__name",)


admin.site.register(OrganizationMember, OrganizationMemberAdmin)


class ProjectParentsAdmin(admin.ModelAdmin):
    search_fields = ("project__name", "organization__name")


admin.site.register(ProjectParents, ProjectParentsAdmin)


class ProjectTranslationAdmin(admin.ModelAdmin):
    search_fields = (
        "language__id",
        "language__name",
        "language__language_code",
        "project__id",
        "project__name",
        "name_translation",
    )
    list_filter = ("language__language_code",)


admin.site.register(ProjectTranslation, ProjectTranslationAdmin)


class OrganizationTranslationAdmin(admin.ModelAdmin):
    search_fields = (
        "language__id",
        "language__name",
        "language__language_code",
        "organization__name",
        "organization__id",
        "name_translation",
    )
    list_filter = ("language__language_code",)


admin.site.register(OrganizationTranslation, OrganizationTranslationAdmin)


class EventRegistrationConfigAdmin(admin.ModelAdmin):
    search_fields = ("project__name", "project__url_slug")
    list_display = (
        "project",
        "max_participants",
        "registration_end_date",
        "status",
        "created_at",
    )
    list_filter = ("status", "registration_end_date")
    raw_id_fields = ("project",)


admin.site.register(EventRegistrationConfig, EventRegistrationConfigAdmin)


class EventRegistrationAdmin(admin.ModelAdmin):
    search_fields = (
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "registration_config__project__name",
        "registration_config__project__url_slug",
    )
    list_display = (
        "user",
        "get_event_name",
        "registered_at",
    )
    list_filter = ("registered_at",)
    raw_id_fields = ("user", "registration_config")
    readonly_fields = ("registered_at",)

    def get_event_name(self, obj):
        return obj.registration_config.project.name

    get_event_name.short_description = "Event"


admin.site.register(EventRegistration, EventRegistrationAdmin)


class RegistrationFieldOptionInline(admin.TabularInline):
    model = RegistrationFieldOption
    extra = 0
    fields = ("title", "order")
    ordering = ("order",)


class RegistrationFieldAdmin(admin.ModelAdmin):
    list_display = ("label", "field_type", "order", "is_required", "get_event_name")
    list_filter = ("field_type", "is_required")
    search_fields = (
        "label",
        "registration_config__project__name",
        "registration_config__project__url_slug",
    )
    raw_id_fields = ("registration_config",)
    inlines = [RegistrationFieldOptionInline]

    def get_event_name(self, obj):
        return obj.registration_config.project.name

    get_event_name.short_description = "Event"


admin.site.register(RegistrationField, RegistrationFieldAdmin)


class RegistrationFieldOptionAdmin(admin.ModelAdmin):
    list_display = ("title", "order", "get_field_type", "get_event_name")
    search_fields = ("title", "field__registration_config__project__name")
    raw_id_fields = ("field",)

    def get_field_type(self, obj):
        return obj.field.field_type

    get_field_type.short_description = "Field type"

    def get_event_name(self, obj):
        return obj.field.registration_config.project.name

    get_event_name.short_description = "Event"


admin.site.register(RegistrationFieldOption, RegistrationFieldOptionAdmin)


class RegistrationFieldAnswerAdmin(admin.ModelAdmin):
    list_display = (
        "registration",
        "field",
        "get_field_type",
        "get_value",
        "get_event_name",
    )
    list_filter = ("field__field_type", "registration__registered_at")
    search_fields = (
        "registration__user__username",
        "registration__user__email",
        "field__registration_config__project__name",
    )
    raw_id_fields = ("registration", "field", "value_option")
    readonly_fields = ("registration", "field")

    def get_field_type(self, obj):
        return obj.field.field_type

    get_field_type.short_description = "Field Type"

    def get_value(self, obj):
        if obj.value_boolean is not None:
            return obj.value_boolean
        if obj.value_option:
            return obj.value_option.title
        if obj.value_number is not None:
            return obj.value_number
        if obj.value_text is not None:
            return obj.value_text[:80]
        return "-"

    get_value.short_description = "Value"

    def get_event_name(self, obj):
        return obj.field.registration_config.project.name

    get_event_name.short_description = "Event"


admin.site.register(RegistrationFieldAnswer, RegistrationFieldAnswerAdmin)
