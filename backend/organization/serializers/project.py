from django.utils.translation import get_language
from rest_framework import serializers
from rest_framework.fields import SerializerMethodField

from climateconnect_api.models import UserProfile
from climateconnect_api.models.role import Role
from climateconnect_api.serializers.common import (
    AvailabilitySerializer,
)
from climateconnect_api.serializers.role import RoleSerializer
from climateconnect_api.serializers.user import UserProfileStubSerializer
from location.utility import (
    get_language_code_from_context,
    get_translated_exact_location_name,
    get_translated_location_name,
)
from organization.models import (
    Project,
    ProjectCollaborators,
    ProjectFollower,
    ProjectLike,
    ProjectMember,
    ProjectParents,
)
from organization.models.event_registration import EventRegistrationConfig
from organization.models.members import MembershipRequests
from organization.models.translations import ProjectTranslation
from organization.models.type import PROJECT_TYPES
from organization.models.event_registration import EventRegistration
from organization.serializers.event_registration import (
    EventRegistrationConfigSerializer,
    EventRegistrationSerializer,
)
from organization.serializers.organization import OrganizationStubSerializer
from organization.serializers.project_types import ProjectTypesSerializer
from organization.serializers.sector import (
    ProjectSectorMappingSerializer,
)
from organization.serializers.translation import ProjectTranslationSerializer
from organization.utility.project import (
    get_project_description,
    get_project_name,
    get_project_short_description,
)
from organization.utility.sector import (
    get_sectors_based_on_hub,
)


class _LocationNameMixin:
    """Mixin that provides a shared ``_get_location_name`` helper for project serializers.

    Centralises the conditional logic that selects exact-location formatting
    (when ``loc.place_name`` or ``loc.exact_address`` is set) versus the general
    translated name, so the logic lives in one place across
    ProjectSerializer, ProjectMinimalSerializer, and ProjectStubSerializer.

    The provided ``loc`` must have its ``translate_location`` relation pre-fetched
    via ``prefetch_related("loc__translate_location__language")`` on the queryset
    to avoid N+1 queries when translation lookups occur.
    """

    def _get_location_name(self, loc):
        lang = get_language_code_from_context(self.context)
        if loc.place_name or loc.exact_address:
            return get_translated_exact_location_name(loc, lang)
        return get_translated_location_name(loc, lang)


class ProjectSerializer(_LocationNameMixin, serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    description_html = serializers.SerializerMethodField()
    project_parents = serializers.SerializerMethodField()
    sectors = serializers.SerializerMethodField()
    collaborating_organizations = serializers.SerializerMethodField()
    number_of_followers = serializers.SerializerMethodField()
    number_of_likes = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    loc = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    project_type = serializers.SerializerMethodField()
    registration_config = serializers.SerializerMethodField()
    my_event_registration = serializers.SerializerMethodField()

    # Parent/child relationship fields (detail view)
    parent_project_id = serializers.IntegerField(
        source="parent_project.id", read_only=True, allow_null=True
    )
    parent_project_name = serializers.SerializerMethodField()
    parent_project_slug = serializers.CharField(
        source="parent_project.url_slug", read_only=True, allow_null=True
    )
    child_projects_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "url_slug",
            "image",
            "start_date",
            "end_date",
            "short_description",
            "description",
            "description_html",
            "loc",
            "location",
            "collaborators_welcome",
            "project_parents",
            "sectors",
            "created_at",
            "collaborating_organizations",
            "is_draft",
            "website",
            "number_of_followers",
            "number_of_likes",
            "language",
            "project_type",
            "additional_loc_info",
            "parent_project_id",
            "parent_project_name",
            "parent_project_slug",
            "has_children",
            "child_projects_count",
            "is_online",
            "registration_config",
            "my_event_registration",
            "devlink_component",
        )

    def get_name(self, obj):
        return get_project_name(obj, get_language())

    def get_short_description(self, obj):
        return get_project_short_description(obj, get_language())

    def get_description(self, obj):
        return get_project_description(obj, get_language())

    def get_description_html(self, obj):
        return get_project_description(obj, get_language())

    def get_collaborating_organizations(self, obj):
        serializer = ProjectCollaboratorsSerializer(
            obj.project_collaborator, many=True, context=self.context
        )
        return serializer.data

    def get_project_parents(self, obj):
        serializer = ProjectParentsSerializer(obj.project_parent, many=True)
        return serializer.data

    def get_sectors(self, obj):
        hub = self.context.get("hub")

        sector_mappings = get_sectors_based_on_hub(
            obj.project_sector_mapping.all(), hub
        )

        serializer = ProjectSectorMappingSerializer(sector_mappings, many=True)
        return serializer.data

    def get_number_of_followers(self, obj):
        return obj.project_following.count()

    def get_number_of_likes(self, obj):
        return obj.project_liked.count()

    def get_loc(self, obj):
        if obj.loc is None:
            return None
        return self._get_location_name(obj.loc)

    def get_location(self, obj):
        if obj.loc is None:
            return None
        return self._get_location_name(obj.loc)

    def get_language(self, obj):
        return obj.language.language_code

    def get_project_type(self, obj):
        possible_project_types = list(PROJECT_TYPES.values())
        project_type = next(
            filter(
                lambda type: type.type_id_short == obj.project_type,
                possible_project_types,
            ),
            None,
        )
        serializer = ProjectTypesSerializer(project_type, many=False)
        return serializer.data

    def get_parent_project_name(self, obj):
        """Get parent project name with translation support."""
        if obj.parent_project:
            return get_project_name(obj.parent_project, get_language())
        return None

    def get_child_projects_count(self, obj):
        """Get count of child projects (only in detail view)."""
        if hasattr(obj, "child_projects"):
            return obj.child_projects.count()
        return 0

    def get_registration_config(self, obj):
        """Return event registration config including available_seats (detail only).

        Disabled configs are hidden from everyone. Draft configs are only
        visible to project admins.
        """
        try:
            rc = obj.registration_config
        except EventRegistrationConfig.DoesNotExist:
            return None

        if not rc.registration_enabled:
            return None

        if rc.is_draft:
            request = self.context.get("request")
            if not request or not request.user.is_authenticated:
                return None
            is_admin = ProjectMember.objects.filter(
                project=obj,
                user=request.user,
                role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            ).exists()
            if not is_admin:
                return None

        return EventRegistrationConfigSerializer(
            rc,
            context={"include_seat_count": True},
        ).data

    def get_my_event_registration(self, obj):
        """
        Return the requesting user's active EventRegistration for this project.

        Populated only on the detail endpoint when the requesting user has an
        active (non-cancelled) registration.  Returns ``None`` otherwise.

        Identity is derived strictly from ``request.user`` — never from any
        path or query parameter — to prevent IDOR.

        When the view adds a filtered ``Prefetch`` with ``to_attr='_my_registrations'``
        on ``registration_config__registrations`` the method uses that cached list;
        otherwise it falls back to a direct DB query.
        """
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return None
        try:
            config = obj.registration_config
        except EventRegistrationConfig.DoesNotExist:
            return None

        if hasattr(config, "_my_registrations"):
            registrations = config._my_registrations
            if not registrations:
                return None
            registration = registrations[0]
        else:
            # Fallback: direct DB lookup (used when serializer is called outside
            # the standard detail view, e.g. in tests that bypass the view layer).
            try:
                registration = (
                    EventRegistration.objects.select_related("user__user_profile")
                    .prefetch_related(
                        "field_answers__field",
                        "field_answers__value_option",
                    )
                    .get(
                        registration_config=config,
                        user=request.user,
                        cancelled_at__isnull=True,
                    )
                )
            except EventRegistration.DoesNotExist:
                return None

        return EventRegistrationSerializer(registration, context=self.context).data


class EditProjectSerializer(ProjectSerializer):
    loc = serializers.SerializerMethodField()
    translations = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    description_html = serializers.SerializerMethodField()
    related_hubs = serializers.SerializerMethodField()

    def get_loc(self, obj):
        if obj.loc is None:
            return None
        return obj.loc.name

    def get_translations(self, obj):
        translations = ProjectTranslation.objects.filter(project=obj)
        if translations.exists():
            serializer = ProjectTranslationSerializer(translations, many=True)
            return serializer.data
        else:
            return {}

    def get_name(self, obj):
        return obj.name

    def get_short_description(self, obj):
        return obj.short_description

    def get_description(self, obj):
        return obj.description

    def get_description_html(self, obj):
        return obj.description_html

    def get_related_hubs(self, obj):
        return [hub.url_slug for hub in obj.related_hubs.all()]

    # Override the get_sectors method to use the hub-specific sectors
    def get_sectors(self, obj):
        serializer = ProjectSectorMappingSerializer(
            obj.project_sector_mapping.all(), many=True
        )
        return serializer.data

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ("loc", "translations", "related_hubs")


class ProjectParentsSerializer(serializers.ModelSerializer):
    parent_organization = serializers.SerializerMethodField()
    parent_user = serializers.SerializerMethodField()

    class Meta:
        model = ProjectParents
        fields = ("parent_organization", "parent_user", "created_at")

    def get_parent_organization(self, obj):
        if obj.parent_organization:
            return OrganizationStubSerializer(
                obj.parent_organization, context=self.context
            ).data

    def get_parent_user(self, obj):
        if obj.parent_user:
            try:
                return UserProfileStubSerializer(obj.parent_user.user_profile).data
            except Exception:
                print(obj.parent_user)


class ProjectMinimalSerializer(_LocationNameMixin, serializers.ModelSerializer):
    project_parents = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "name",
            "url_slug",
            "image",
            "location",
            "project_parents",
            "is_draft",
            "website",
        )

    def get_name(self, obj):
        return get_project_name(obj, get_language())

    def get_project_parents(self, obj):
        serializer = ProjectParentsSerializer(
            obj.project_parent, many=True, context=self.context
        )
        return serializer.data

    def get_location(self, obj):
        if obj.loc is None:
            return None
        return self._get_location_name(obj.loc)


class ProjectStubSerializer(_LocationNameMixin, serializers.ModelSerializer):
    project_parents = serializers.SerializerMethodField()
    sectors = serializers.SerializerMethodField()
    project_type = SerializerMethodField()
    image = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    number_of_comments = serializers.SerializerMethodField()
    number_of_likes = serializers.SerializerMethodField()
    collaborating_organizations = serializers.SerializerMethodField()
    registration_config = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "url_slug",
            "image",
            "location",
            "project_type",
            "project_parents",
            "sectors",
            "is_draft",
            "short_description",
            "number_of_comments",
            "number_of_likes",
            "collaborating_organizations",
            "start_date",
            "end_date",
            "has_children",
            "is_online",
            "registration_config",
        )

    def get_name(self, obj):
        return get_project_name(obj, get_language())

    def get_short_description(self, obj):
        return get_project_short_description(obj, get_language())

    def get_project_parents(self, obj):
        # Query the first element but use .all()
        # as it is aware of prefetched Data
        # .first() triggers a new query with ... LIMIT 1
        parents = list(obj.project_parent.all())
        if not parents:
            return []

        parent = parents[0]  # Get the first parent from prefetched data

        if parent.parent_organization:
            return [
                {
                    "parent_user": None,
                    "parent_organization": (
                        OrganizationStubSerializer(
                            parent.parent_organization, context=self.context
                        )
                    ).data,
                }
            ]
        else:
            return [
                {
                    "parent_user": (
                        UserProfileStubSerializer(parent.parent_user.user_profile)
                    ).data,
                    "parent_organization": None,
                }
            ]

    def get_sectors(self, obj):
        hub = self.context.get("hub")

        sector_mappings = get_sectors_based_on_hub(
            obj.project_sector_mapping.all(), hub
        )

        serializer = ProjectSectorMappingSerializer(sector_mappings, many=True)
        return serializer.data

    def get_image(self, obj):
        if obj.thumbnail_image:
            return obj.thumbnail_image.url
        if obj.image:
            return obj.image.url
        else:
            return None

    def get_location(self, obj):
        if obj.loc is None:
            return None
        return self._get_location_name(obj.loc)

    def get_project_type(self, obj):
        possible_project_types = list(PROJECT_TYPES.values())
        project_type = next(
            filter(
                lambda type: type.type_id_short == obj.project_type,
                possible_project_types,
            ),
            None,
        )
        serializer = ProjectTypesSerializer(project_type, many=False)
        return serializer.data["type_id"]

    def get_number_of_comments(self, obj):
        return obj.project_comment.count()

    def get_number_of_likes(self, obj):
        return obj.project_liked.count()

    def get_collaborating_organizations(self, obj):
        serializer = ProjectCollaboratorsSerializer(
            obj.project_collaborator, many=True, context=self.context
        )
        return serializer.data

    def get_registration_config(self, obj):
        """Return event registration config if present, else None.

        Disabled configs are hidden from everyone. Draft configs are only
        visible to project admins.
        """
        try:
            rc = obj.registration_config
        except EventRegistrationConfig.DoesNotExist:
            return None

        if not rc.registration_enabled:
            return None

        if rc.is_draft:
            request = self.context.get("request")
            if not request or not request.user.is_authenticated:
                return None
            is_admin = ProjectMember.objects.filter(
                project=obj,
                user=request.user,
                role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            ).exists()
            if not is_admin:
                return None

        return EventRegistrationConfigSerializer(rc).data


class ProjectSuggestionSerializer(ProjectStubSerializer):
    project_creator = serializers.SerializerMethodField()

    class Meta(ProjectStubSerializer.Meta):
        fields = ProjectStubSerializer.Meta.fields + ("project_creator",)

    def get_project_creator(self, obj):
        member = ProjectMember.objects.filter(
            project=obj, role__role_type=Role.ALL_TYPE
        ).first()
        return (ProjectMemberSerializer(member)).data


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    role = RoleSerializer()
    availability = AvailabilitySerializer()

    class Meta:
        model = ProjectMember
        fields = ("id", "user", "role", "role_in_project", "availability")

    def get_user(self, obj):
        return UserProfileStubSerializer(
            UserProfile.objects.filter(user=obj.user)[0]
        ).data


class InsertProjectMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMember
        fields = ("id", "user", "role", "role_in_project", "availability")


class ProjectCollaboratorsSerializer(serializers.ModelSerializer):
    collaborating_organization = serializers.SerializerMethodField()

    class Meta:
        model = ProjectCollaborators
        fields = ["collaborating_organization"]

    def get_collaborating_organization(self, obj):
        serializer = OrganizationStubSerializer(
            obj.collaborating_organization, context=self.context
        )
        return serializer.data


class ProjectFromProjectParentsSerializer(serializers.ModelSerializer):
    project = serializers.SerializerMethodField()

    class Meta:
        model = ProjectParents
        fields = ("project",)

    def get_project(self, obj):
        serializer = ProjectStubSerializer(obj.project, context=self.context)
        return serializer.data


class ProjectFromProjectMemberSerializer(serializers.ModelSerializer):
    project = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = ("project",)

    def get_project(self, obj):
        serializer = ProjectStubSerializer(obj.project, context=self.context)
        return serializer.data


class ProjectSitemapEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("url_slug", "updated_at")


class ProjectFollowerSerializer(serializers.ModelSerializer):
    user_profile = serializers.SerializerMethodField()

    class Meta:
        model = ProjectFollower
        fields = ("user_profile", "created_at")

    def get_user_profile(self, obj):
        user_profile = UserProfile.objects.get(user=obj.user)
        serializer = UserProfileStubSerializer(user_profile)
        return serializer.data


class ProjectRequesterSerializer(serializers.ModelSerializer):
    """Serializer class required to return the request ID
    to the client, so that it can be sent appropriately
    alongside the approve/deny actions for project requesters.
    """

    user_profile = serializers.SerializerMethodField()

    class Meta:
        model = MembershipRequests

        # Locally defined variables take precedence
        # over what's defined on the model
        fields = ("user_profile", "id")

    def get_user_profile(self, obj):
        user_profile = UserProfile.objects.get(user=obj.user)
        serializer = UserProfileStubSerializer(user_profile)
        return serializer.data


class ProjectLikeSerializer(serializers.ModelSerializer):
    user_profile = serializers.SerializerMethodField()

    class Meta:
        model = ProjectLike
        fields = ("user_profile", "created_at")

    def get_user_profile(self, obj):
        user_profile = UserProfile.objects.get(user=obj.user)
        serializer = UserProfileStubSerializer(user_profile)
        return serializer.data


class ProjectNotificationSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ("name", "url_slug", "image")

    def get_name(self, obj):
        return get_project_name(obj, get_language())

    def get_image(self, obj):
        if obj.thumbnail_image:
            return obj.thumbnail_image.url
        if obj.image:
            return obj.image.url
        else:
            return None
