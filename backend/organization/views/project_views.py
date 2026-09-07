import logging
import re
import traceback
import zoneinfo

from dateutil.parser import parse
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.gis.db.models.functions import Distance
from django.core.cache import cache
from django.db import transaction
from django.db.models import Case, Prefetch, Q, When
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend, OrderingFilter
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.generics import (
    ListAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from climateconnect_api.models import (
    Availability,
    Role,
    UserProfile,
)
from climateconnect_api.models.language import Language
from climateconnect_api.tasks import calculate_project_rankings
from climateconnect_api.utility.content_shares import save_content_shared
from climateconnect_api.utility.translation import (
    edit_translations,
)
from climateconnect_api.utility.html import (
    sanitize_html,
    PROJECT_DESCRIPTION_ALLOWED_TAGS,
    PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES,
)
from climateconnect_main.utility.general import get_image_from_data_url
from hubs.models.hub import Hub
from location.models import Location
from location.utility import get_location, get_location_with_range

# Organization models
from organization.models import (
    Organization,
    OrganizationFollower,
    OrganizationTagging,
    OrganizationTags,
    Post,
    Project,
    ProjectCollaborators,
    ProjectComment,
    ProjectFollower,
    ProjectLike,
    ProjectMember,
    ProjectParents,
    ProjectSectorMapping,
    Sector,
)
from organization.models.event_registration import (
    EventRegistration,
    EventRegistrationConfig,
)
from organization.models.members import MembershipRequests
from organization.models.translations import ProjectTranslation
from organization.models.type import PROJECT_TYPES, ProjectTypesChoices
from organization.pagination import (
    MembersPagination,
    ProjectPostPagination,
    ProjectsPagination,
    ProjectsSitemapPagination,
)
from organization.permissions import (
    AddProjectMemberPermission,
    ChangeProjectCreatorPermission,
    ProjectMemberReadWritePermission,
    ProjectReadWritePermission,
    ReadWriteSensibleProjectDataPermission,
)
from organization.serializers.content import PostSerializer, ProjectCommentSerializer
from organization.serializers.event_registration import (
    EventRegistrationConfigSerializer,
)
from organization.serializers.project import (
    EditProjectSerializer,
    InsertProjectMemberSerializer,
    ProjectFollowerSerializer,
    ProjectLikeSerializer,
    ProjectMemberSerializer,
    ProjectRequesterSerializer,
    ProjectSerializer,
    ProjectSitemapEntrySerializer,
    ProjectStubSerializer,
)
from organization.serializers.project_types import ProjectTypesSerializer
from organization.utility import MembershipTarget
from organization.utility.cache import generate_project_ranking_cache_key
from organization.utility.follow import (
    get_list_of_project_followers,
    set_user_following_project,
)
from organization.utility.notification import (
    create_comment_mention_notification,
    create_organization_project_published_notification,
    create_project_comment_notification,
    create_project_comment_reply_notification,
    create_project_join_request_approval_notification,
    create_project_join_request_notification,
    create_project_like_notification,
    get_mentions,
)
from organization.utility.organization import check_organization
from organization.utility.project import (
    apply_hub_filter,
    create_new_project,
    get_project_admin_creators,
    get_project_translations,
    get_similar_projects,
)
from organization.utility.requests import MembershipRequestsManager
from organization.utility.sector import (
    create_context_for_hub_specific_sector,
    sanitize_sector_inputs,
)

logger = logging.getLogger(__name__)


class ProjectsOrderingFilter(OrderingFilter):
    def filter_queryset(self, request, queryset, view):
        ordering = request.query_params.get("sort_by")
        if ordering is not None:
            if ordering == "newest":
                queryset = queryset.order_by("-id")
            elif ordering == "oldest":
                queryset = queryset.order_by("id")
        return queryset

    def get_schema_operation_parameters(self, view):
        """Return schema parameters for OpenAPI documentation."""
        return [
            {
                "name": "sort_by",
                "required": False,
                "in": "query",
                "description": "Sort projects by newest or oldest",
                "schema": {"type": "string", "enum": ["newest", "oldest"]},
            }
        ]


class ListProjectsView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter, DjangoFilterBackend, ProjectsOrderingFilter]
    search_fields = ["name", "translation_project__name_translation"]
    filterset_fields = ["collaborators_welcome"]
    pagination_class = ProjectsPagination
    serializer_class = ProjectStubSerializer

    def post(self, request, *args, **kwargs):
        """
        Handle POST requests for search functionality.
        """
        # Extract location from the POST data
        location = request.data

        # Add location to the query params
        query_params = request.query_params.copy()

        if "place_id" in location and "geojson" in location:
            query_params["location"] = location

        # Replace request.query_params with our updated version
        request._request.GET = query_params

        # Call the standard list method which handles filtering and pagination
        return self.list(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        # TODO: remove user profile, as it is not used
        user_profile = None
        if user.is_authenticated:
            user_profile = user.user_profile if user.user_profile else None  # noqa
        # Get project ranking
        projects = (
            Project.objects.filter(is_draft=False, is_active=True)
            .select_related("loc", "language", "registration_config")
            .prefetch_related(
                "loc__translate_location__language",
                Prefetch(
                    "project_comment",
                    queryset=ProjectComment.objects.select_related("comment_ptr"),
                ),
                "project_liked",
                "project_following",
                "project_collaborator",
                Prefetch(
                    "project_parent",
                    queryset=ProjectParents.objects.select_related(
                        "parent_organization",
                        "parent_user__user_profile",
                    ),
                ),
                Prefetch(
                    "project_sector_mapping",
                    queryset=ProjectSectorMapping.objects.select_related("sector"),
                ),
            )
        )

        # Conditionally select_related parent_project for detail views or when filtering by parent
        # This avoids unnecessary JOINs in list views
        # Check if self.action exists (ViewSets) or if we're filtering by parent (APIViews)
        if (
            (
                hasattr(self, "action") and self.action == "retrieve"
            )  # Detail view in ViewSet
            or "parent_project" in self.request.query_params
            or "parent_project_slug" in self.request.query_params
        ):
            projects = projects.select_related("parent_project")

        # maybe use .annotate() to calculate ranking/counts of coments etc.

        if "sectors" in self.request.query_params:
            _sector_names = self.request.query_params.get("sectors")
            sector_names, err = sanitize_sector_inputs(_sector_names)

            if err:
                # TODO: should I "crash" with 400, or what should I ommit the sectors
                logger.error(
                    "Passed sectors are not in list format: 'error':'{}','sector_keys':{}".format(
                        err, _sector_names
                    )
                )
            else:
                projects = projects.filter(
                    Q(project_sector_mapping__sector__name__in=sector_names)
                    | Q(
                        project_sector_mapping__sector__relates_to_sector__name__in=sector_names
                    )
                )

        if "hub" in self.request.query_params:
            projects = apply_hub_filter(projects, self.request.query_params["hub"])

        if "collaboration" in self.request.query_params:
            collaborators_welcome = self.request.query_params.get("collaboration")
            if collaborators_welcome == "yes":
                projects = projects.filter(collaborators_welcome=True)
            if collaborators_welcome == "no":
                projects = projects.filter(collaborators_welcome=False)

        if "organization_type" in self.request.query_params:
            organization_type_names = self.request.query_params.get(
                "organization_type"
            ).split(",")
            organization_types = OrganizationTags.objects.filter(
                name__in=organization_type_names
            )
            organization_taggings = OrganizationTagging.objects.filter(
                organization_tag__in=organization_types
            )
            project_parents = ProjectParents.objects.filter(
                parent_organization__tag_organization__in=organization_taggings
            )
            projects = projects.filter(project_parent__in=project_parents)

        # Filter by parent project ID
        if "parent_project" in self.request.query_params:
            parent_id = self.request.query_params.get("parent_project")
            try:
                projects = projects.filter(parent_project_id=int(parent_id))
            except (ValueError, TypeError):
                # Invalid parent_project ID, return empty queryset
                return projects.none()

        # Filter by parent project slug (preferred Climate Connect pattern)
        if "parent_project_slug" in self.request.query_params:
            parent_slug = self.request.query_params.get("parent_project_slug")
            projects = projects.filter(parent_project__url_slug=parent_slug)

        # Filter by has_children flag (find all parent events)
        if "has_children" in self.request.query_params:
            has_children_param = self.request.query_params.get("has_children").lower()
            if has_children_param == "true":
                projects = projects.filter(has_children=True)
            elif has_children_param == "false":
                projects = projects.filter(has_children=False)

        if (
            "osm_id" in self.request.query_params
            and "osm_type" in self.request.query_params
        ) or "place_id" in self.request.query_params:
            location_data = get_location_with_range(self.request.query_params)
            projects = (
                projects.filter(
                    Q(loc__country=location_data["country"])
                    & (
                        Q(
                            loc__multi_polygon__distance_lte=(
                                location_data["location"],
                                location_data["radius"],
                            )
                        )
                        | Q(
                            loc__centre_point__distance_lte=(
                                location_data["location"],
                                location_data["radius"],
                            )
                        )
                    )
                )
                .annotate(
                    distance=Distance("loc__centre_point", location_data["location"])
                )
                .order_by("distance")
            )

        if (
            "country" in self.request.query_params
            and "city" in self.request.query_params
        ):
            location_ids = Location.objects.filter(
                country=self.request.query_params.get("country"),
                city=self.request.query_params.get("city"),
            )
            projects = projects.filter(loc__in=location_ids)

        if (
            "city" in self.request.query_params
            and "country" not in self.request.query_params
        ):
            location_ids = Location.objects.filter(
                city=self.request.query_params.get("city")
            )
            projects = projects.filter(loc__in=location_ids)

        if (
            "country" in self.request.query_params
            and "city" not in self.request.query_params
        ):
            location_ids = Location.objects.filter(
                country=self.request.query_params.get("country")
            )
            projects = projects.filter(loc__in=location_ids)

        if settings.CACHE_BACHED_RANK_REQUEST:
            ### retrieve all cached rankings for all projects
            ### and recalculate the rankings for projects that are missing cached rankings

            # generate all cache keys cached rankings of all projects
            project_ids = [project.id for project in projects]
            cache_keys = [
                generate_project_ranking_cache_key(project_id=pid)
                for pid in project_ids
            ]

            # prefetch the cached rankings all at once
            cached_rankings = cache.get_many(cache_keys)

            # save the cached values to the view
            _cached_rankings = {
                key: cached_rankings[key] if key in cached_rankings else project.ranking
                for key, project in zip(cache_keys, projects)
            }

            # sort by _cached_rankings and then drop the cache_keys
            project_ids = map(
                lambda x: x[0],
                sorted(
                    zip(project_ids, cache_keys),
                    key=lambda x: _cached_rankings[x[1]] * (-1),
                ),
            )
        else:
            project_ids = [
                project.id
                for project in sorted(
                    projects, key=lambda project: -project.cached_ranking
                )
            ]

        preferred_order = Case(
            *(
                When(id=id, then=position)
                for position, id in enumerate(project_ids, start=1)
            )
        )
        return projects.order_by(preferred_order)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        _context = create_context_for_hub_specific_sector(self.request)
        context.update({**_context})
        return context


class ListEventsView(ListAPIView):
    """
    Lists event-type projects chronologically for the Event Calendar feature.

    Always available (no feature toggle). Supports text search, topic (sectors),
    hub scoping, and a start_date "jump to date" filter. Paginated via
    ProjectsPagination (default page_size=12). Orders strictly by start_date.
    """

    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["name", "translation_project__name_translation"]
    serializer_class = ProjectStubSerializer
    pagination_class = ProjectsPagination

    def get_queryset(self):
        queryset = (
            Project.objects.filter(
                is_draft=False,
                is_active=True,
                project_type=ProjectTypesChoices.event,
                start_date__isnull=False,
            )
            .select_related("loc", "language", "status", "registration_config")
            .prefetch_related(
                "loc__translate_location__language",
                Prefetch(
                    "project_sector_mapping",
                    queryset=ProjectSectorMapping.objects.select_related("sector"),
                ),
            )
        )

        # --- Jump-to-date filter ---
        start_date = self._parse_date_param(self.request.query_params.get("start_date"))
        if start_date is not None:
            queryset = queryset.filter(start_date__gte=start_date)

        # --- Topic (sectors) filter ---
        if "sectors" in self.request.query_params:
            _sector_names = self.request.query_params.get("sectors")
            sector_names, err = sanitize_sector_inputs(_sector_names)
            if not err:
                queryset = queryset.filter(
                    Q(project_sector_mapping__sector__name__in=sector_names)
                    | Q(
                        project_sector_mapping__sector__relates_to_sector__name__in=sector_names
                    )
                )

        # --- Hub scoping ---
        if "hub" in self.request.query_params:
            queryset = apply_hub_filter(queryset, self.request.query_params["hub"])

        # The sector filter joins project_sector_mapping, which can produce
        # multiple rows for a single event (e.g. an event matching several
        # selected topics, or a topic and its parent sector). Deduplicate so
        # each event is returned exactly once.
        return queryset.distinct().order_by("start_date")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        _context = create_context_for_hub_specific_sector(self.request)
        context.update({**_context})
        return context

    @staticmethod
    def _parse_date_param(value):
        if not value:
            return None
        try:
            return parse(value)
        except (ValueError, OverflowError):
            return None


class EventCalendarCountsView(APIView):
    """
    Returns per-day event counts for a given month so the Event Calendar
    picker can highlight days that have events.

    Always available (no feature toggle). Accepts `year` and `month`
    (required) plus the same filters as ListEventsView (`search`, `sectors`,
    `hub`). An optional `timezone` param (IANA name, e.g. "Europe/Berlin")
    controls the day the counts are bucketed into — this must match the
    viewer's timezone so the highlighted days line up with the events that
    the frontend groups by the browser's local day. When omitted, the
    server's timezone is used as a fallback.

    Each event is counted on its start_date day only (multi-day events are
    NOT counted on the days they span). Returns a list of
    {"date": "YYYY-MM-DD", "count": N} objects.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        try:
            year = int(request.query_params.get("year"))
            month = int(request.query_params.get("month"))
        except (TypeError, ValueError):
            return Response(
                {"error": "year and month query parameters are required as integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (1 <= month <= 12):
            return Response(
                {"error": "month must be an integer between 1 and 12"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Bucket per-day counts in the viewer's timezone so the highlighted
        # days match the browser-local day grouping used on the frontend.
        tz = self._resolve_timezone(request.query_params.get("timezone"))

        # Build the month window in the viewer's timezone, then convert to UTC
        # for the database overlap query. This keeps the window aligned with
        # the local month the user actually sees in the picker (not the
        # server's timezone).
        month_start_local = datetime(year, month, 1, tzinfo=tz)
        month_end_local = (
            month_start_local + relativedelta(months=1) - relativedelta(days=1)
        ).replace(hour=23, minute=59, second=59)
        month_start = month_start_local.astimezone(dt_timezone.utc)
        month_end = month_end_local.astimezone(dt_timezone.utc)

        queryset = Project.objects.filter(
            is_draft=False,
            is_active=True,
            project_type=ProjectTypesChoices.event,
            start_date__isnull=False,
        ).filter(
            # Count each event on its start_date day only: the calendar shows
            # a multi-day event solely on its start date, so spanned days are
            # not highlighted.
            Q(start_date__gte=month_start)
            & Q(start_date__lte=month_end)
        )

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(translation_project__name_translation__icontains=search)
            )

        if "sectors" in request.query_params:
            _sector_names = request.query_params.get("sectors")
            sector_names, err = sanitize_sector_inputs(_sector_names)
            if not err:
                queryset = queryset.filter(
                    Q(project_sector_mapping__sector__name__in=sector_names)
                    | Q(
                        project_sector_mapping__sector__relates_to_sector__name__in=sector_names
                    )
                )

        if "hub" in request.query_params:
            queryset = apply_hub_filter(queryset, request.query_params["hub"])

        # Deduplicate: the sector filter joins project_sector_mapping and can
        # yield multiple rows per event (matching several topics, or a topic
        # and its parent sector). Without this, multi-topic events would be
        # counted more than once on their start day.
        queryset = queryset.distinct()

        counts = {}
        for start_date in queryset.values_list("start_date", flat=True):
            # Bucket each event on its start_date, converted into the viewer's
            # timezone so the highlighted day matches the frontend's local day
            # grouping. Multi-day events are counted on the start day only.
            key = start_date.astimezone(tz).date().isoformat()
            counts[key] = counts.get(key, 0) + 1

        result = [
            {"date": date, "count": count} for date, count in sorted(counts.items())
        ]
        return Response(result, status=status.HTTP_200_OK)

    @staticmethod
    def _resolve_timezone(timezone_name):
        if timezone_name:
            try:
                return zoneinfo.ZoneInfo(timezone_name)
            except (ValueError, zoneinfo.ZoneInfoNotFoundError):
                pass
        return timezone.get_current_timezone()


class ListUpcomingEventsView(APIView):
    """
    Returns up to 4 upcoming event-type projects for the Browse page highlights.

    Always available (no feature toggle). Accepts the same filters as ListProjectsView
    (search, hub, sectors, location) with start_date being the "current time" baseline.
    The frontend sends the browser's local midnight timestamp so that "upcoming"
    aligns with the user's local day.

    Returns a plain list (no pagination) of ProjectStubSerializer results,
    ordered by start_date ascending. Events returned are removed from the
    main projects grid to avoid duplication.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return self._list_events(request)

    def post(self, request):
        location = request.data
        query_params = request.query_params.copy()
        if "place_id" in location and "geojson" in location:
            query_params["location"] = location
        request._request.GET = query_params
        return self._list_events(request)

    def _list_events(self, request):
        queryset = (
            Project.objects.filter(
                is_draft=False,
                is_active=True,
                project_type=ProjectTypesChoices.event,
                start_date__isnull=False,
            )
            .select_related("loc", "language", "status", "registration_config")
            .prefetch_related(
                "loc__translate_location__language",
                Prefetch(
                    "project_sector_mapping",
                    queryset=ProjectSectorMapping.objects.select_related("sector"),
                ),
            )
        )

        start_date = self._parse_date_param(request.query_params.get("start_date"))
        if start_date is not None:
            queryset = queryset.filter(start_date__gte=start_date)
        else:
            queryset = queryset.filter(start_date__gte=timezone.now())

        if "sectors" in request.query_params:
            _sector_names = request.query_params.get("sectors")
            sector_names, err = sanitize_sector_inputs(_sector_names)
            if not err:
                queryset = queryset.filter(
                    Q(project_sector_mapping__sector__name__in=sector_names)
                    | Q(
                        project_sector_mapping__sector__relates_to_sector__name__in=sector_names
                    )
                )

        if "hub" in request.query_params:
            queryset = apply_hub_filter(queryset, request.query_params["hub"])

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(translation_project__name_translation__icontains=search)
            )

        if (
            "osm_id" in request.query_params and "osm_type" in request.query_params
        ) or "place_id" in request.query_params:
            location_data = get_location_with_range(request.query_params)
            queryset = queryset.filter(
                Q(loc__country=location_data["country"])
                & (
                    Q(
                        loc__multi_polygon__distance_lte=(
                            location_data["location"],
                            location_data["radius"],
                        )
                    )
                    | Q(
                        loc__centre_point__distance_lte=(
                            location_data["location"],
                            location_data["radius"],
                        )
                    )
                )
            )

        queryset = queryset.distinct().order_by("start_date")[:4]

        context = create_context_for_hub_specific_sector(request)
        serializer = ProjectStubSerializer(queryset, many=True, context=context)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @staticmethod
    def _parse_date_param(value):
        if not value:
            return None
        try:
            return parse(value)
        except (ValueError, OverflowError):
            return None


class CreateProjectView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic()
    def post(self, request):
        if "parent_organization" in request.data:
            organization = check_organization(int(request.data["parent_organization"]))
        else:
            organization = None

        is_draft = request.data.get("is_draft", False) in (True, "true", "True", "1", 1)

        required_params = ["name"]
        # If 'is_draft' is not set or is set to a falsy value then run the code in this if block
        if not is_draft:
            required_params += [
                "short_description",
                "collaborators_welcome",
                "team_members",
                "loc",
                "image",
                "source_language",
                "translations",
                "sectors",
                "hubName",  # TODO: fix this behavior: 'hubName' has to be set, but can be None
            ]
        for param in required_params:
            if param not in request.data:
                logger.error(
                    "Missing required information to create project:{}".format(param)
                )
                return Response(
                    {
                        "message": "Missing required information to create project:"
                        + param
                        + " Please contact administrator"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        max_chars = {
            "name": 1024,
            "short_description": 280,
            "description": 4800,
            "description_html": 20000,
            "website": 256,
            "additional_loc_info": 256,
        }
        for param in max_chars.keys():
            if param in request.data and len(request.data[param]) > max_chars[param]:
                return Response(
                    {
                        "message": "Your value for this field is too long: "
                        + param
                        + ". Please make a change or contact an administrator at contact@climatehub.org"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if "description_html" in request.data:
            stripped = re.sub(r"<[^>]+>", "", request.data["description_html"])
            if len(stripped) > 4000:
                return Response(
                    {
                        "message": "Your description text is too long (max 4000 characters). Please shorten it."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # --- registration_config pre-creation validation ---
        # Run before the status check so invalid data is rejected early.
        # Type coercion (str→int, str→datetime) and business rules are handled
        # by EventRegistrationConfigSerializer — no manual int()/parse() needed.
        er_data = request.data.get("registration_config")
        er_serializer = None
        if er_data is not None:
            project_type_id = (request.data.get("project_type") or {}).get(
                "type_id", ""
            )
            end_date_raw = request.data.get("end_date")
            er_serializer = EventRegistrationConfigSerializer(
                data=er_data,
                context={
                    "is_event_type": project_type_id == "event",
                    "is_draft": is_draft,
                    "event_end_date": parse(end_date_raw) if end_date_raw else None,
                },
            )
            if not er_serializer.is_valid():
                return Response(
                    er_serializer.errors, status=status.HTTP_400_BAD_REQUEST
                )
        # --- end registration_config validation ---

        # Sanitize description_html before saving
        if "description_html" in request.data:
            request.data["description_html"] = sanitize_html(
                request.data["description_html"],
                allowed_tags=PROJECT_DESCRIPTION_ALLOWED_TAGS,
                allowed_attributes=PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES,
            )

        translations_object = None
        # Only process translations if both source_language and translations are provided
        if "source_language" in request.data and "translations" in request.data:
            try:
                translations_object = get_project_translations(request.data)
            except ValueError:
                # Translation parsing failed, but continue without translations
                logger.warning("Failed to parse translations for project creation")

        source_language = None
        translations = None
        if translations_object:
            source_language = Language.objects.get(
                language_code=translations_object["source_language"]
            )
            translations = translations_object["translations"]

        project = create_new_project(request.data, source_language)

        # Create EventRegistrationConfig (and any nested custom fields) atomically.
        # Using serializer.save() so the serializer's create() handles nested fields.
        if er_serializer is not None:
            er_serializer.save(
                project=project, is_draft=is_draft, registration_enabled=True
            )
            logger.info(
                "EventRegistrationConfig created for project %s (is_draft=%s)",
                project.url_slug,
                is_draft,
            )

        if translations_object and translations and source_language:
            for language in translations:
                if not language == source_language.language_code:
                    texts = translations[language]
                    try:
                        language_object = Language.objects.get(language_code=language)
                        translation = ProjectTranslation.objects.create(
                            project=project,
                            language=language_object,
                            name_translation=texts["name"],
                        )
                        if "short_description" in texts:
                            translation.short_description_translation = texts[
                                "short_description"
                            ]
                        if "description_html" in texts:
                            translation.description_html_translation = sanitize_html(
                                texts["description_html"],
                                allowed_tags=PROJECT_DESCRIPTION_ALLOWED_TAGS,
                                allowed_attributes=PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES,
                            )
                        if "description" in texts:
                            translation.description_translation = texts["description"]
                        translation.save()
                    except Language.DoesNotExist:
                        logger.error(
                            "A language with language_code {} does not exist".format(
                                language
                            )
                        )

        project_parents = ProjectParents.objects.create(
            project=project, parent_user=request.user
        )

        if organization:
            project_parents.parent_organization = organization
            project_parents.save()

        if "collaborating_organizations" in request.data:
            for organization_id in request.data["collaborating_organizations"]:
                try:
                    collaborating_organization = Organization.objects.get(
                        id=int(organization_id)
                    )
                    ProjectCollaborators.objects.create(
                        project=project,
                        collaborating_organization=collaborating_organization,
                    )
                except Organization.DoesNotExist:
                    logger.error(
                        "Passed collaborating organization id {} does not exist.".format(
                            organization_id
                        )
                    )

        # There are only certain roles user can have. So get all the roles first.
        roles = Role.objects.all()
        team_members = request.data.get("team_members", [])

        if "sectors" in request.data:
            _sector_keys = request.data["sectors"]
            sector_keys, err = sanitize_sector_inputs(_sector_keys)

            if err:
                logger.error(
                    "Passed sectors are not in list format: 'error':'{}','sector_keys':{}".format(
                        err, _sector_keys
                    )
                )
                return Response(
                    {
                        "message": "Passed sectors are not in list format: 'error':'{}','sector_keys':{}".format(
                            err, _sector_keys
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            sectors = []

            for sector_key in sector_keys:
                try:
                    sector = Sector.objects.get(key=sector_key)
                    sectors.append(sector)
                except Sector.DoesNotExist:
                    logger.error(
                        "During project creation of project {}: Passed sector {} does not exists".format(
                            project.url_slug,
                            sector_key,
                        )
                    )
            ProjectSectorMapping.objects.bulk_create(
                [
                    ProjectSectorMapping(
                        project=project, sector=sector, order=len(sectors) - i
                    )
                    for i, sector in enumerate(sectors)
                ]
            )

        # TODO: completely remove availability
        for member in team_members:
            user_role = roles.filter(id=int(member["role"])).first()
            try:
                user_availability = None
                if "availability" in member.keys():
                    user_availability = Availability.objects.filter(
                        id=int(member["availability"])
                    ).first()
            except Availability.DoesNotExist:
                raise NotFound(
                    detail="Availability not found.", code=status.HTTP_404_NOT_FOUND
                )
            try:
                user = User.objects.get(id=int(member["id"]))
            except User.DoesNotExist:
                for user in User.objects.all():
                    logger.error(user.id)
                logger.error(
                    "[CreateProjectView]Passed user id {} does not exists".format(
                        int(member["id"])
                    )
                )
                continue
            if user:
                ProjectMember.objects.create(
                    project=project,
                    user=user,
                    role=user_role,
                    availability=user_availability,
                    role_in_project=member["role_in_project"],
                )
                logger.info("Project member created for user {}".format(user.id))
        # handle new project from org creation
        if organization is not None:
            followers_of_org = OrganizationFollower.objects.filter(
                organization__name=organization.name
            )

            if not project.is_draft:
                create_organization_project_published_notification(
                    followers_of_org, organization, project
                )
        calculate_project_rankings([project.id])
        return Response(
            {
                "message": "Project {} successfully created".format(project.name),
                "url_slug": project.url_slug,
            },
            status=status.HTTP_201_CREATED,
        )


class ProjectAPIView(APIView):
    permission_classes = [ProjectReadWritePermission]

    def get(self, request, url_slug, format=None):
        try:
            prefetches = ["loc__translate_location__language"]
            if request.user.is_authenticated:
                # Prefetch only the requesting user's active registration (and its
                # custom field answers) so get_my_event_registration on the
                # serializer can use it without an extra DB round-trip.
                prefetches.append(
                    Prefetch(
                        "registration_config__registrations",
                        queryset=EventRegistration.objects.filter(
                            user=request.user,
                            cancelled_at__isnull=True,
                        )
                        .select_related("user__user_profile")
                        .prefetch_related(
                            "field_answers__field",
                            "field_answers__value_option",
                        ),
                        to_attr="_my_registrations",
                    )
                )
            project = (
                Project.objects.select_related("loc", "registration_config")
                .prefetch_related(*prefetches)
                .get(url_slug=str(url_slug))
            )
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        context = create_context_for_hub_specific_sector(request)

        if "edit_view" in request.query_params:
            serializer = EditProjectSerializer(project, many=False, context=context)
        else:
            serializer = ProjectSerializer(project, many=False, context=context)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, url_slug, format=None):
        # TODO: shouldnt this be run as a transaction
        # I guess we will never have a conflict, but it would be safer
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Author: Dip
        # Code formatting here. So fields are just pass through so combing them and using setattr method insted.
        pass_through_params = [
            "collaborators_welcome",
            "additional_loc_info",
            "description",
            "description_html",
            "helpful_connections",
            "is_online",
            "short_description",
            "website",
        ]
        for param in pass_through_params:
            if param in request.data:
                setattr(project, param, request.data[param])

        # Rollout compat: old frontend may send description (plain text) without
        # description_html.  Convert on the fly so description_html is always set.
        if "description" in request.data and "description_html" not in request.data:
            from organization.utility.legacy_description_to_tiptap import (
                legacy_description_to_tiptap_html,
            )

            project.description_html = legacy_description_to_tiptap_html(
                request.data["description"]
            )

        if "description_html" in request.data:
            raw = request.data["description_html"]
            if len(raw) > 20000:
                return Response(
                    {"message": "Description HTML is too long (max 20000 characters)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            stripped = re.sub(r"<[^>]+>", "", raw)
            if len(stripped) > 4000:
                return Response(
                    {
                        "message": "Your description text is too long (max 4000 characters). Please shorten it."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            project.description_html = sanitize_html(
                raw,
                allowed_tags=PROJECT_DESCRIPTION_ALLOWED_TAGS,
                allowed_attributes=PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES,
            )

        if "name" in request.data and request.data["name"] != project.name:
            project.name = request.data["name"]

        if "project_type" in request.data:
            project.project_type = ProjectTypesChoices[request.data["project_type"]]

        if "sectors" in request.data:
            _sector_keys = request.data["sectors"]
            sector_keys, err = sanitize_sector_inputs(_sector_keys)

            if err:
                # TODO: should I "crash" with 400, or what should I ommit the sectors
                logger.error(
                    "Passed sectors are not in list format: 'error':'{}','sector_keys':{}".format(
                        err, _sector_keys
                    )
                )
                return Response(
                    {
                        "message": "Passed sectors are not in list format: 'error':'{}','sector_keys':{}".format(
                            err, _sector_keys
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # delete sectors that are not mapped to the project anymore
            for sectorMapping in ProjectSectorMapping.objects.filter(project=project):
                if sectorMapping.sector.key not in sector_keys:
                    sectorMapping.delete()

            # create mapping or update
            order_value = len(sector_keys)
            for sector_key in sector_keys:
                old_sector_mapping = ProjectSectorMapping.objects.filter(
                    project=project, sector__key=sector_key
                )
                if not old_sector_mapping.exists():
                    # create new project mapping
                    try:
                        sector = Sector.objects.get(key=sector_key)
                        ProjectSectorMapping.objects.create(
                            project=project, sector=sector, order=order_value
                        )
                    except Sector.DoesNotExist:
                        logger.error(
                            "Passed sector key {} does not exists".format(sector_key)
                        )
                else:
                    # update existing mappings order value
                    old_sector_mapping = old_sector_mapping[0]
                    old_sector_mapping.order = order_value

                    old_sector_mapping.save()
                # reduce for next element
                order_value -= 1

        if "image" in request.data:
            project.image = get_image_from_data_url(request.data["image"])[0]
        if "thumbnail_image" in request.data:
            project.thumbnail_image = get_image_from_data_url(
                request.data["thumbnail_image"]
            )[0]
        if "hubUrl" in request.data:
            related_hub_slug = request.data["hubUrl"]
            if (
                related_hub_slug == ""
            ):  # If the slug is an empty string, clear the related_hubs
                project.related_hubs.clear()
            else:  # Otherwise, try to find the Hub and add it
                hub = Hub.objects.filter(url_slug=related_hub_slug).first()
                if hub:
                    project.related_hubs.add(hub)
        if "start_date" in request.data:
            project.start_date = parse(request.data["start_date"])
        if "end_date" in request.data:
            project.end_date = parse(request.data["end_date"])
        if "location" in request.data:
            project.location = request.data["location"]
        if "loc" in request.data:
            location = get_location(request.data["loc"])
            project.loc = location
        if "is_draft" in request.data:
            # One way transition: draft → published, never back
            project.is_draft = False
            # Date collision check: if the project has a published registration
            # config, validate registration_end_date <= new end_date.
            if hasattr(project, "registration_config"):
                rc = project.registration_config
                if not rc.is_draft and rc.registration_end_date:
                    effective_end = (
                        parse(request.data["end_date"])
                        if "end_date" in request.data
                        else project.end_date
                    )
                    if effective_end and rc.registration_end_date > effective_end:
                        return Response(
                            {
                                "registration_config": {
                                    "registration_end_date": (
                                        "Registration end date must be on or before "
                                        "the event end date. Update the registration "
                                        "settings before publishing."
                                    )
                                }
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
        if "is_personal_project" in request.data:
            if request.data["is_personal_project"] is True:
                project_parents = ProjectParents.objects.get(project=project)
                project_parents.parent_organization = None
                project_parents.save()
        if "parent_organization" in request.data:
            project_parents = ProjectParents.objects.get(project=project)
            try:
                organization = Organization.objects.get(
                    id=request.data["parent_organization"]
                )
            except Organization.DoesNotExist:
                organization = None
                logger.error("Passed parent organization id {} does not exist")

            project_parents.parent_organization = organization
            project_parents.save()

        project.save()

        items_to_translate = [
            {"key": "name", "translation_key": "name_translation"},
            {
                "key": "short_description",
                "translation_key": "short_description_translation",
            },
            {"key": "description", "translation_key": "description_translation"},
            {
                "key": "description_html",
                "translation_key": "description_html_translation",
            },
            {
                "key": "helpful_connections",
                "translation_key": "helpful_connections_translation",
            },
        ]
        if "translations" in request.data:
            edit_translations(items_to_translate, request.data, project, "project")
        calculate_project_rankings([project.id])
        return Response(
            {
                "message": "Project {} successfully updated".format(project.name),
                "url_slug": project.url_slug,
                "hubUrl": list(project.related_hubs.values("url_slug")),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, url_slug, format=None):
        try:
            project = Project.objects.get(url_slug=str(url_slug))
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )
        project.delete()
        return Response(
            {
                "message": "Project {} successfully deleted".format(project.name),
                "url_slug": project.url_slug,
            },
            status=status.HTTP_200_OK,
        )


class ListProjectPostsView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["project__url_slug"]
    pagination_class = ProjectPostPagination
    serializer_class = PostSerializer

    def get_queryset(self):
        return Post.objects.filter(
            project__url_slug=self.kwargs["url_slug"],
        ).order_by("id")


class ListProjectCommentsView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["project__url_slug"]
    pagination_class = ProjectPostPagination
    serializer_class = ProjectCommentSerializer

    def get_queryset(self):
        return ProjectComment.objects.filter(
            project__url_slug=self.kwargs["url_slug"],
        )


class AddProjectMembersView(APIView):
    permission_classes = [AddProjectMemberPermission]

    def post(self, request, url_slug):
        project = Project.objects.get(url_slug=url_slug)

        roles = Role.objects.all()
        if "team_members" not in request.data:
            return Response(
                {"message": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for member in request.data["team_members"]:
            try:
                user = User.objects.get(id=int(member["id"]))
                user_inactive = (
                    True
                    if ProjectMember.objects.filter(
                        user=user, project=project, is_active=False
                    ).count()
                    == 1
                    else False
                )
            except User.DoesNotExist:
                logger.error(
                    "[AddProjectMembersView] Passed user id {} does not exists".format(
                        int(member["id"])
                    )
                )
                continue
            if "permission_type_id" not in member:
                logger.error(
                    "[AddProjectMembersView] Not permissions passed for user id {}.".format(
                        int(member["id"])
                    )
                )
                continue
            user_role = roles.filter(id=int(member["permission_type_id"])).first()
            if user and not (user_inactive):
                new_member = ProjectMember.objects.create(
                    project=project,
                    user=user,
                    role=user_role,
                    role_in_project=member["role_in_project"],
                )
                if "availability" in member.keys():
                    try:
                        user_availability = Availability.objects.filter(
                            id=int(member["availability"])
                        ).first()
                        new_member.availability = user_availability
                        new_member.save()
                    except Availability.DoesNotExist:
                        raise NotFound(
                            detail="Availability not found.",
                            code=status.HTTP_404_NOT_FOUND,
                        )
                logger.info("Project member created for user {}".format(user.id))
            elif user and user_inactive:
                record = ProjectMember.objects.get(project=project, user=user)
                record.is_active = True
                record.save()
                logger.info("Project member reactivated for user {}".format(user.id))

                logger.info("Project member created for user {}".format(user.id))

        return Response(
            {"message": "Member added to the project"}, status=status.HTTP_201_CREATED
        )


class UpdateProjectMemberView(RetrieveUpdateDestroyAPIView):
    permission_classes = [ProjectMemberReadWritePermission]
    serializer_class = InsertProjectMemberSerializer

    def get_queryset(self):
        project = Project.objects.get(url_slug=str(self.kwargs["url_slug"]))
        return ProjectMember.objects.filter(id=int(self.kwargs["pk"]), project=project)

    def perform_destroy(self, instance):
        instance.delete()
        return "Project Member successfully deleted."

    def perform_update(self, serializer):
        serializer.save()
        return serializer.data


class ChangeProjectCreator(APIView):
    permission_classes = [ChangeProjectCreatorPermission]

    def post(self, request, url_slug):
        if "user" not in request.data:
            return Response(
                {"message": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            new_creator_user = User.objects.get(id=int(request.data["user"]))
        except User.DoesNotExist:
            raise NotFound(detail="Profile not found.", code=status.HTTP_404_NOT_FOUND)

        if request.user.id == new_creator_user.id:
            return Response(
                {"message": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = Project.objects.get(url_slug=url_slug)
        roles = Role.objects.all()

        if ProjectMember.objects.filter(
            user=new_creator_user, project=project
        ).exists():
            # update old creator profile and new creator profile
            new_creator = ProjectMember.objects.filter(
                user=request.data["user"], project=project, id=request.data["id"]
            )[0]
            new_creator.role = roles.filter(role_type=Role.ALL_TYPE)[0]
            if "role_in_project" in request.data:
                new_creator.role_in_project = request.data["role_in_project"]
            if "availability" in request.data:
                try:
                    Availability.objects.filter(
                        id=int(request.data["availability"])
                    ).first()
                except Availability.DoesNotExist:
                    raise NotFound(
                        detail="Availability not found.", code=status.HTTP_404_NOT_FOUND
                    )
                new_creator.user_availability = request.data["availability"]
            new_creator.save()
        else:
            # create new creator profile and update old creator profile
            new_creator = ProjectMember.objects.create(
                role=roles.filter(role_type=Role.ALL_TYPE)[0],
                project=project,
                user=new_creator_user,
            )
            if "role_in_project" in request.data:
                new_creator.role_in_project = request.data["role_in_project"]
            new_creator.save()
        old_creator = ProjectMember.objects.filter(user=request.user, project=project)[
            0
        ]
        old_creator.role = roles.filter(role_type=Role.READ_WRITE_TYPE)[0]
        old_creator.save()

        return Response(
            {"message": "Changed project creator"}, status=status.HTTP_200_OK
        )


class ListProjectMembersView(ListAPIView):
    lookup_field = "url_slug"
    serializer_class = ProjectMemberSerializer
    pagination_class = MembersPagination
    permission_classes = [AllowAny]

    def get_queryset(self):
        project = Project.objects.get(url_slug=self.kwargs["url_slug"])

        return project.project_member_project.filter(is_active=True)


class ListProjectTypeOptions(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        project_type_values = [type for type in PROJECT_TYPES.values()]
        serializer = ProjectTypesSerializer(project_type_values, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SetFollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        # probably a better way -> .mo / po files todo

        return set_user_following_project(request, url_slug)


class SetLikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        if "liking" not in request.data:
            return Response(
                {"message": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            raise NotFound(detail="Project not found.", code=status.HTTP_404_NOT_FOUND)

        if request.data["liking"] is True:
            if ProjectLike.objects.filter(user=request.user, project=project).exists():
                raise ValidationError("You've already liked this project.")
            else:
                project_like = ProjectLike.objects.create(
                    user=request.user, project=project
                )
                create_project_like_notification(project_like)
                return Response(
                    {"message": "You have liked this project.", "liking": True},
                    status=status.HTTP_201_CREATED,
                )
        if request.data["liking"] is False:
            try:
                liking_user_object = ProjectLike.objects.get(
                    user=request.user, project=project
                )
            except ProjectLike.DoesNotExist:
                raise NotFound(
                    detail="You haven't been liking this project.",
                    code=status.HTTP_404_NOT_FOUND,
                )
            liking_user_object.delete()
            return Response(
                {"message": "You do not like this project anymore.", "liking": False},
                status=status.HTTP_201_CREATED,
            )
        else:
            return Response(
                {"message": 'Invalid value for variable "liking"'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class GetUserInteractionsWithProjectView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, url_slug):
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            raise NotFound(
                detail="Project not found:" + url_slug, code=status.HTTP_404_NOT_FOUND
            )

        is_liking = ProjectLike.objects.filter(
            user=request.user, project=project
        ).exists()

        is_following = ProjectFollower.objects.filter(
            user=request.user, project=project
        ).exists()

        has_open_membership_request = MembershipRequests.objects.filter(
            target_project=project,
            rejected_at=None,
            approved_at=None,
            user=self.request.user,
        ).exists()

        is_registered = False
        has_attended = False
        admin_cancelled = False
        if hasattr(project, "registration_config"):
            try:
                rc = project.registration_config
                user_reg = EventRegistration.objects.filter(
                    user=request.user, registration_config=rc
                ).first()
                if user_reg is not None:
                    if user_reg.cancelled_at is None:
                        # Active registration.
                        is_registered = True
                        # has_attended: event has started AND registration is active.
                        if project.start_date and project.start_date <= timezone.now():
                            has_attended = True
                    else:
                        # Cancelled registration.
                        # admin_cancelled: cancelled by someone other than the member.
                        if (
                            user_reg.cancelled_by_id is not None
                            and user_reg.cancelled_by_id != request.user.id
                        ):
                            admin_cancelled = True
            except EventRegistrationConfig.DoesNotExist:
                pass

        return Response(
            {
                "liking": is_liking,
                "following": is_following,
                "has_requested_to_join": has_open_membership_request,
                "is_registered": is_registered,
                "has_attended": has_attended,
                "admin_cancelled": admin_cancelled,
            },
            status=status.HTTP_200_OK,
        )


class ProjectCommentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            raise NotFound(
                detail="Project not found:" + url_slug, code=status.HTTP_404_NOT_FOUND
            )
        if "content" not in request.data:
            return Response(
                {"message": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comment = ProjectComment.objects.create(
            author_user=request.user, content=request.data["content"], project=project
        )
        if "parent_comment" in request.data:
            try:
                parent_comment = ProjectComment.objects.get(
                    id=request.data["parent_comment"]
                )
            except ProjectComment.DoesNotExist:
                raise NotFound(
                    detail="Parent comment not found:" + request.data["parent_comment"],
                    code=status.HTTP_404_NOT_FOUND,
                )
            comment.parent_comment = parent_comment
        comment.save()
        mentioned_users = get_mentions(text=comment.content, url_slugs_only=True)
        if len(mentioned_users) > 0:
            create_comment_mention_notification(
                entity_type="project",
                entity=project,
                comment=comment,
                sender=request.user,
            )
        if comment.parent_comment:
            create_project_comment_reply_notification(
                project=project,
                comment=comment,
                sender=request.user,
                user_url_slugs_to_ignore=mentioned_users,
            )
        else:
            create_project_comment_notification(
                project=project,
                comment=comment,
                sender=request.user,
                user_url_slugs_to_ignore=mentioned_users,
            )
        return Response(
            {"comment": ProjectCommentSerializer(comment).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, url_slug, comment_id):
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            raise NotFound(
                detail="Project not found:" + url_slug, code=status.HTTP_404_NOT_FOUND
            )
        try:
            comment = ProjectComment.objects.get(
                project=project, id=comment_id, author_user=request.user
            )
        except ProjectComment.DoesNotExist:
            raise NotFound(
                detail="Project comment not found. Project:"
                + url_slug
                + " Comment:"
                + comment_id,
                code=status.HTTP_404_NOT_FOUND,
            )
        comment.delete()
        return Response(status=status.HTTP_200_OK)


class ListFeaturedProjects(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ProjectStubSerializer

    def get_queryset(self):
        return Project.objects.filter(
            rating__gte=0, rating__lte=99, is_draft=False, is_active=True
        ).prefetch_related("loc__translate_location__language")[0:4]


class ListProjectsForSitemap(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ProjectSitemapEntrySerializer
    pagination_class = ProjectsSitemapPagination

    def get_queryset(self):
        return Project.objects.filter(is_draft=False, is_active=True)


class ListProjectFollowersView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectFollowerSerializer

    def get_queryset(self):
        return get_list_of_project_followers(self)


class ListProjectRequestersView(ListAPIView):
    permission_classes = [ReadWriteSensibleProjectDataPermission]
    """This is the endpoint view to return a list of users
    who have requested membership for a specific project, including their request IDs."""

    serializer_class = ProjectRequesterSerializer

    def get_queryset(self):
        try:
            project = Project.objects.get(url_slug=self.kwargs["url_slug"])
        except Project.DoesNotExist:
            return Response(
                data={"message": f"Project does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only show requests that are currently open, as
        # in they haven't been approved nor rejected.
        open_membership_requests = MembershipRequests.objects.filter(
            target_project=project,
            rejected_at=None,
            approved_at=None,
        )

        print(
            f"Total number of OPEN membership requests for this project: {len(open_membership_requests)}"
        )

        return open_membership_requests


class ListProjectLikesView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectLikeSerializer

    def get_queryset(self):
        try:
            project = Project.objects.get(url_slug=self.kwargs["url_slug"])
        except Project.DoesNotExist:
            return None

        likes = ProjectLike.objects.filter(project=project)
        return likes


class LeaveProject(RetrieveUpdateAPIView):
    """
    A view that enables a user to unsubscribe from a project
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, url_slug):
        updatable_records = list()
        try:
            project = Project.objects.get(url_slug=url_slug)
            project_member_record = ProjectMember.objects.get(
                user=self.request.user, project=project, is_active=True
            )
            active_members_in_project = ProjectMember.objects.filter(
                project=project, is_active=True
            ).count()

            if project_member_record.role.name == "Super-Admin":
                if active_members_in_project > 1:
                    return Response(
                        data={"message": f"A new creator needs to be assigned first"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if active_members_in_project == 1:
                    # deactivate project
                    project.is_active = False
                    updatable_records.append(project)

            project_member_record.is_active = False
            updatable_records.append(project_member_record)
            for updatable_record in updatable_records:
                updatable_record.save()
            return Response(
                data={"message": f"Left project {url_slug} successfully"},
                status=status.HTTP_200_OK,
            )

        except ProjectMember.DoesNotExist:
            return Response(
                data={"message": f"User and/or Project not found "},
                status=status.HTTP_404_NOT_FOUND,
            )

        except ProjectMember.MultipleObjectsReturned:
            # Multiple records for the same user/ project id. Duplicate records.
            # TODO: Implement a signal to send dev a message
            return Response(
                data={"message": f"We ran into some issues processing your request."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception:
            # Send E to dev
            # send to dev logs E= traceback.format_exc()
            return Response(
                data={"message": f"We ran into some issues processing your request."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RequestJoinProject(RetrieveUpdateAPIView):
    """
    A view that enables a user to request to join a project
    """

    permission_classes = (IsAuthenticated,)

    def post(self, request, user_slug, url_slug):
        required_params = ["user_availability", "message"]
        missing_param = any([param not in request.data for param in required_params])
        if missing_param:
            return Response(
                {"message": f"Missing required parameters. Need {required_params}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # To avoid spoofing
        user = request.user
        user_profile_slug = UserProfile.objects.get(user=user).url_slug
        if user_profile_slug != user_slug:
            return Response(
                {
                    "message": f"Unauthorized. The provided user slug {user_slug} does not match the user {user_profile_slug}"
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Requested project does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_availability = Availability.objects.filter(
            id=request.data["user_availability"]
        ).first()

        request_manager = MembershipRequestsManager(
            user=user,
            membership_target=MembershipTarget.PROJECT,
            user_availability=user_availability,
            project=project,
            organization=None,
            message=request.data["message"],
        )

        exists = request_manager.duplicate_request
        if exists:
            return Response(
                {"message": "Request already exists to join project"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            request = request_manager.create_membership_request()
            project_admins = get_project_admin_creators(project)
            create_project_join_request_notification(
                requester=user,
                project_admins=project_admins,
                project=project,
                request=request,
            )

            # Now pass the requestId back to the client.
            return Response({"requestId": request.id}, status=status.HTTP_200_OK)
        except Exception:
            logging.error(traceback.format_exc())
            return Response(
                {"message": f"Internal Server Error {traceback.format_exc()}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# class ManageJoinProjectView(RetrieveUpdateAPIView):
class ManageJoinProjectView(RetrieveUpdateDestroyAPIView):
    """
    A view that enables a user to request to join a project.
    """

    # This class attribute needed to be added for the project join
    # feature.
    #
    # Note that authentication always runs at the very start of the view,
    # before the permission and throttling checks occur, and before any other code is
    # allowed to proceed. If the request to join the project isn't authenticated
    # (HTTP 401), then the remainder of this View code will not execute. See
    # https://www.django-rest-framework.org/api-guide/authentication/
    #
    # Keep in mind that when we redefine class attributes at the View level,
    # we're overwriting the default permission and authentication classes
    # that're defined within settings.py.
    permission_classes = [ReadWriteSensibleProjectDataPermission]

    serializer_class = ProjectMemberSerializer

    lookup_field = "url_slug"

    def post(self, request, url_slug, request_action, request_id):
        try:
            project = Project.objects.filter(url_slug=url_slug).first()
        except Exception:
            return Response(
                {"message": "Project Does Not Exist"}, status=status.HTTP_404_NOT_FOUND
            )

        try:
            request_manager = MembershipRequestsManager(
                membership_request_id=request_id,
                project=project,
                membership_target=MembershipTarget.PROJECT,
            )
            if request_manager.corrupt_membership_request_id:
                return Response(
                    {"message": "Request Does Not Exist"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if request_manager.validation_failed:
                return Response(
                    {
                        f"message': 'Operation failed. Errors: {' | '.join(request_manager.errors)}"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if request_action == "approve":
                request_manager.approve_request()
                create_project_join_request_approval_notification(request_id=request_id)
            elif request_action == "reject":
                request_manager.reject_request()
            else:
                raise NotImplementedError(
                    f"membership request action <{request_action}> is not implemented"
                )

            return Response(
                data={"message": "Operation succeeded"}, status=status.HTTP_200_OK
            )
        except Exception:
            return Response(
                {"message": f"Internal Server Error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get_queryset(self):
        membership_requests = MembershipRequests.objects.all()
        return membership_requests


class SetProjectSharedView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, url_slug):
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            raise NotFound(detail="Project not found.", code=status.HTTP_404_NOT_FOUND)
        save_content_shared(request, project)
        return Response(status=status.HTTP_201_CREATED)


class SimilarProjects(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = ProjectStubSerializer

    def get_queryset(self):
        source_slug = self.kwargs["url_slug"]

        candidates = Project.objects.filter(
            is_draft=False, rating__gte=49, is_active=True
        )

        hub_slug = self.request.query_params.get("hub")
        if hub_slug and Hub.objects.filter(url_slug=hub_slug).exists():
            candidates = apply_hub_filter(candidates, hub_slug)

        candidates = (
            candidates.distinct()
            | Project.objects.filter(url_slug=source_slug).distinct()
        )

        similar_projects_url_slugs = get_similar_projects(
            url_slug=source_slug,
            target_projects=candidates,
        )

        return Project.objects.filter(
            url_slug__in=similar_projects_url_slugs,
            is_draft=False,
            rating__gte=49,
            is_active=True,
        ).prefetch_related("loc__translate_location__language")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        _context = create_context_for_hub_specific_sector(self.request)
        context.update({**_context})
        return context
