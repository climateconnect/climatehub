import logging
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.contrib.gis.db.models import GeometryField, Union
from django.contrib.gis.db.models.functions import Distance
from django.db.models import Count, Q
from django.db.models.functions import Cast
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.translation import gettext as _
from django.views.decorators.cache import cache_page
from django_filters.rest_framework import DjangoFilterBackend
from knox.views import LoginView as KnoxLoginView
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth_app.models import LoginAuditLog
from auth_app.utility.ip import anonymise_ip
from climateconnect_api.models import Availability, Skill, UserProfile
from climateconnect_api.models.language import Language
from climateconnect_api.pagination import MembersPagination, MembersSitemapPagination
from climateconnect_api.permissions import UserPermission
from climateconnect_api.serializers.user import (
    EditUserProfileSerializer,
    PersonalProfileSerializer,
    UserProfileMinimalSerializer,
    UserProfileSerializer,
    UserProfileSitemapEntrySerializer,
    UserProfileStubSerializer,
)
from climateconnect_api.utility.common import create_unique_slug
from climateconnect_api.utility.email_setup import (
    send_password_link,
    send_user_verification_email,
)
from climateconnect_api.utility.translation import edit_translations
from climateconnect_api.utility.user import get_user_profile_hub_slug
from climateconnect_main.utility.general import get_image_from_data_url
from hubs.models.hub import Hub
from ideas.models.support import IdeaSupporter
from ideas.serializers.idea import IdeaFromIdeaSupporterSerializer
from location.models import Location
from location.utility import get_location, get_location_with_range
from organization.models import Project, Sector, UserProfileSectorMapping
from organization.models.members import OrganizationMember, ProjectMember
from organization.serializers.organization import OrganizationsFromOrganizationMember
from organization.serializers.project import (
    ProjectFromProjectMemberSerializer,
    ProjectStubSerializer,
)
from organization.utility.sector import sanitize_sector_inputs

logger = logging.getLogger(__name__)


class LoginView(KnoxLoginView):
    permission_classes = [AllowAny]

    # Tries to log the user in with the provided
    # credentials (username and password).
    def post(self, request, format=None):
        if "username" and "password" not in request.data:
            message = "Must include 'username' and 'password'"
            return Response({"message": message}, status=status.HTTP_400_BAD_REQUEST)

        username = request.data.get("username", "")

        # First, authenticate the user
        user = authenticate(
            username=request.data["username"], password=request.data["password"]
        )

        if user:
            user_profile = UserProfile.objects.filter(user=user)[0]
            if not user_profile.is_profile_verified:
                LoginAuditLog.objects.create(
                    email=username,
                    user=user,
                    outcome=LoginAuditLog.Outcome.FAILED,
                    ip_address=anonymise_ip(request.META.get("REMOTE_ADDR")),
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
                )
                message = "You first have to activate your account by clicking the link we sent to your E-Mail."
                return Response(
                    {"message": message, "type": "not_verified"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user.is_authenticated:
                print("User is authenticated")

            # Then, log in the user to attach them to the current Django session,
            # and ensure we have a valid User object (instead of AnonymousUser).
            # See more: https://docs.djangoproject.com/en/4.0/topics/auth/default/#how-to-log-a-user-in
            login(request, user)

            if user_profile.has_logged_in < 2:
                user_profile.has_logged_in = user_profile.has_logged_in + 1
                user_profile.save()

            LoginAuditLog.objects.create(
                email=username,
                user=user,
                outcome=LoginAuditLog.Outcome.VERIFIED,
                ip_address=anonymise_ip(request.META.get("REMOTE_ADDR")),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
            )

            return super(LoginView, self).post(request, format=None)
        else:
            looked_up_user = User.objects.filter(username=username).first()
            LoginAuditLog.objects.create(
                email=username,
                user=looked_up_user,
                outcome=LoginAuditLog.Outcome.FAILED,
                ip_address=anonymise_ip(request.META.get("REMOTE_ADDR")),
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
            )
            return Response(
                {"message": _("Invalid email or password")},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(
            {"message": "Invalid password."}, status=status.HTTP_401_UNAUTHORIZED
        )


class SignUpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        required_params = [
            "email",
            "first_name",
            "last_name",
            "location",
            "send_newsletter",
            "source_language",
        ]
        for param in required_params:
            if param not in request.data:
                raise ValidationError("Required parameter is missing")

        if User.objects.filter(username=request.data["email"]).exists():
            raise ValidationError("Email already in use.")

        location = get_location(request.data["location"])

        user = User.objects.create(
            username=request.data["email"],
            email=request.data["email"],
            first_name=request.data["first_name"],
            last_name=request.data["last_name"],
            is_active=True,
        )

        # Handle password-based vs passwordless signup
        password = request.data.get("password")
        if password:
            user.set_password(password)
            auth_method = UserProfile.AuthMethod.PASSWORD
        else:
            user.set_unusable_password()
            auth_method = UserProfile.AuthMethod.OTP
        user.save()

        full_name = user.first_name + "-" + user.last_name
        url_slug = create_unique_slug(full_name, user.id, UserProfile.objects)
        # Get location
        source_language = Language.objects.get(
            language_code=request.data["source_language"]
        )
        user_profile = UserProfile.objects.create(
            user=user,
            location=location,
            url_slug=url_slug,
            name=request.data["first_name"] + " " + request.data["last_name"],
            verification_key=uuid.uuid4(),
            send_newsletter=request.data["send_newsletter"],
            language=source_language,
            auth_method=auth_method,
        )
        if "is_activist" in request.data:
            user_profile.is_activist = request.data["is_activist"]
        # if "last_completed_tutorial_step" in request.data:
        #     user_profile.last_completed_tutorial_step = request.data[
        #         "last_completed_tutorial_step"
        #     ]

        hub = Hub.objects.filter(url_slug=request.data["hub"]).first()
        if hub:
            user_profile.related_hubs.add(hub)
        hub_url = hub.url_slug if hub else None

        if settings.AUTO_VERIFY is True:
            user_profile.is_profile_verified = True
            message = "Congratulations! Your account has been created"
        else:
            # Only send verification email for password-based signups
            # OTP-based signups use the OTP code entry as verification
            if auth_method == UserProfile.AuthMethod.PASSWORD:
                send_user_verification_email(
                    user, user_profile.verification_key, hub_url
                )
                message = "You're almost done! We have sent an email with a confirmation link to {}. Finish creating your account by clicking the link.".format(
                    user.email
                )  # NOQA
            else:
                # For OTP signups, account is created unverified
                # It will be verified when they complete the OTP flow
                message = "Account created successfully"

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
                sector_keys = []

            sectors = []
            for sector_key in sector_keys:
                try:
                    sector = Sector.objects.get(key=sector_key)
                    sectors.append(sector)
                except Sector.DoesNotExist:
                    logger.error(
                        "During signup {}: Passed sector {} does not exists".format(
                            user_profile.url_slug,
                            sector_key,
                        )
                    )
            UserProfileSectorMapping.objects.bulk_create(
                [
                    UserProfileSectorMapping(
                        sector=sector,
                        user_profile=user_profile,
                        order=len(sectors) - i,
                    )
                    for i, sector in enumerate(sectors)
                ]
            )

        user_profile.save()

        return Response({"success": message}, status=status.HTTP_201_CREATED)


class PersonalProfileView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        # TODO: Add filters
        user = request.user
        if not UserProfile.objects.filter(user=user).exists():
            raise NotFound(detail="Profile not found.", code=status.HTTP_404_NOT_FOUND)

        user_profile = UserProfile.objects.get(user=self.request.user)
        serializer = PersonalProfileSerializer(user_profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListMemberProfilesView(ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = MembersPagination
    filter_backends = [SearchFilter, DjangoFilterBackend]
    filterset_fields = ["name"]
    search_fields = ["name"]
    serializer_class = UserProfileStubSerializer

    @method_decorator(
        cache_page(settings.DEFAULT_CACHE_TIMEOUT, key_prefix="LIST_MEMBERS")
    )
    def dispatch(self, *args, **kwargs):
        return super(ListMemberProfilesView, self).dispatch(*args, **kwargs)

    def get_queryset(self):
        user_profiles = (
            UserProfile.objects.filter(is_profile_verified=True)
            .prefetch_related(
                "user", "location", "location__translate_location__language"
            )
            .annotate(is_image_null=Count("image", filter=Q(image="")))
            .order_by("is_image_null", "-id")
        )
        if "hub" in self.request.query_params:
            hub = Hub.objects.filter(url_slug=self.request.query_params["hub"]).first()

            if not hub:
                return user_profiles.none()

            hubs = [hub]
            if hub.parent_hub:
                hubs.append(hub.parent_hub)

            user_filter = Q()
            for current_hub in hubs:
                user_filter |= Q(related_hubs=current_hub)

                if current_hub.hub_type == Hub.LOCATION_HUB_TYPE:
                    hub_locations = current_hub.location.all()

                    if hub_locations.exists():
                        hub_location_ids = hub_locations.values_list("id", flat=True)

                        aggregated_geometry = hub_locations.annotate(
                            geom_as_geometry=Cast("multi_polygon", GeometryField())
                        ).aggregate(combined=Union("geom_as_geometry"))["combined"]

                        country_filter = Q(
                            location__country=hub_locations.first().country
                        )
                        by_location_id = country_filter & Q(
                            location__id__in=hub_location_ids
                        )

                        if aggregated_geometry:
                            by_geometry = country_filter & (
                                Q(location__centre_point__coveredby=aggregated_geometry)
                                | Q(
                                    location__multi_polygon__coveredby=aggregated_geometry
                                )
                            )
                            user_filter |= by_location_id | by_geometry

                            user_profiles = user_profiles.annotate(
                                distance=Distance(
                                    "location__centre_point", aggregated_geometry
                                )
                            )
                        else:
                            user_filter |= by_location_id
            # apply combined filters of all hubs
            user_profiles = user_profiles.filter(user_filter).distinct()

        if "skills" in self.request.query_params:
            skill_names = self.request.query_params.get("skills").split(",")
            skills = Skill.objects.filter(name__in=skill_names)
            user_profiles = user_profiles.filter(skills__in=skills).distinct()
            # user_profiles = user_profiles.filter(id__in=user_profiles.filter(skills__in=skills).values('id'))

        if (
            "osm_id" in self.request.query_params
            and "osm_type" in self.request.query_params
        ) or "place_id" in self.request.query_params:
            location_data = get_location_with_range(self.request.query_params)
            user_profiles = (
                user_profiles.filter(
                    Q(location__country=location_data["country"])
                    & (
                        Q(
                            location__multi_polygon__distance_lte=(
                                location_data["location"],
                                location_data["radius"],
                            )
                        )
                        | Q(
                            location__centre_point__distance_lte=(
                                location_data["location"],
                                location_data["radius"],
                            )
                        )
                    )
                )
                .annotate(
                    distance=Distance(
                        "location__centre_point", location_data["location"]
                    )
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
            user_profiles = user_profiles.filter(location__in=location_ids)

        if (
            "city" in self.request.query_params
            and "country" not in self.request.query_params
        ):
            location_ids = Location.objects.filter(
                city=self.request.query_params.get("city")
            )
            user_profiles = user_profiles.filter(location__in=location_ids)

        if (
            "country" in self.request.query_params
            and "city" not in self.request.query_params
        ):
            location_ids = Location.objects.filter(
                country=self.request.query_params.get("country")
            )
            user_profiles = user_profiles.filter(location__in=location_ids)

        return user_profiles

    def post(self, request, *args, **kwargs):
        """
        Handle POST requests for search functionality.

        Mirrors ListProjectsView.post(): the frontend sends the location object
        in the request body. When present (place_id + geojson), inject it into
        query_params so the existing get_queryset() location filter works.

        NOTE: this method intentionally does not touch dispatch() so the
        @cache_page decorator stays effective for GET responses.
        """
        location = request.data

        query_params = request.query_params.copy()

        if "place_id" in location and "geojson" in location:
            query_params["location"] = location

        request._request.GET = query_params

        return self.list(request, *args, **kwargs)


class MemberProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, url_slug, format=None):
        try:
            profile = (
                UserProfile.objects.select_related("location")
                .prefetch_related("location__translate_location__language")
                .get(url_slug=str(url_slug))
            )
        except UserProfile.DoesNotExist:
            return Response(
                {"message": "Profile not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if self.request.user.is_authenticated:
            serializer = UserProfileSerializer(profile, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            serializer = UserProfileMinimalSerializer(
                profile, context={"request": request}
            )
            return Response(serializer.data, status=status.HTTP_200_OK)


class ListMemberProjectsView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["parent_organization__url_slug"]
    pagination_class = MembersPagination
    serializer_class = ProjectFromProjectMemberSerializer

    def get_queryset(self):
        try:
            searched_user = UserProfile.objects.get(
                url_slug=self.kwargs["url_slug"]
            ).user
        except UserProfile.DoesNotExist:
            return ProjectMember.objects.none()
        if self.request.user == searched_user:
            return ProjectMember.objects.filter(
                user=searched_user, is_active=True
            ).order_by("-id")
        else:
            return ProjectMember.objects.filter(
                user=searched_user, project__is_draft=False, is_active=True
            ).order_by("-id")


class ListMemberIdeasView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["parent_organization__url_slug"]
    pagination_class = MembersPagination
    serializer_class = IdeaFromIdeaSupporterSerializer

    def get_queryset(self):
        try:
            searched_user = UserProfile.objects.get(
                url_slug=self.kwargs["url_slug"]
            ).user
        except UserProfile.DoesNotExist:
            return IdeaSupporter.objects.none()
        return IdeaSupporter.objects.filter(user=searched_user).order_by("-id")


class ListMemberOrganizationsView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["parent_organization__url_slug"]
    pagination_class = MembersPagination
    serializer_class = OrganizationsFromOrganizationMember

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["language_code"] = self.request.LANGUAGE_CODE
        return context

    def get_queryset(self):
        try:
            user = UserProfile.objects.get(url_slug=self.kwargs["url_slug"]).user
        except UserProfile.DoesNotExist:
            return OrganizationMember.objects.none()
        return OrganizationMember.objects.filter(
            user=user,
        ).order_by("id")


class ListMemberRegisteredEventsView(ListAPIView):
    """
    GET /api/members/me/registered-events/

    Returns upcoming events (start_date >= today) that the authenticated user
    has an active registration for, ordered by start_date ascending.
    Auth required (401 if unauthenticated). Page size: 12 (MembersPagination).
    Only returns events for the currently authenticated user.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = MembersPagination
    serializer_class = ProjectStubSerializer

    def get_queryset(self):
        today = timezone.now().date()
        return (
            Project.objects.filter(
                registration_config__registrations__user=self.request.user,
                registration_config__registrations__cancelled_at__isnull=True,
                start_date__isnull=False,
                start_date__date__gte=today,
            )
            .select_related("loc", "language", "status", "registration_config")
            .prefetch_related(
                "loc__translate_location__language",
                "project_liked",
                "project_comment",
                "project_collaborator",
                "project_parent",
                "project_sector_mapping",
            )
            .order_by("start_date")
            .distinct()
        )


class EditUserProfile(APIView):
    permission_classes = [UserPermission]

    def get(self, request):
        try:
            user_profile = (
                UserProfile.objects.select_related("location")
                .prefetch_related("location__translate_location__language")
                .get(user=self.request.user)
            )
        except UserProfile.DoesNotExist:
            raise NotFound("User not found.")

        serializer = EditUserProfileSerializer(
            user_profile, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            user_profile = UserProfile.objects.get(user=self.request.user)
        except UserProfile.DoesNotExist:
            raise NotFound("User not found.")
        user = user_profile.user
        if "first_name" in request.data:
            user.first_name = request.data["first_name"]

        if "last_name" in request.data:
            user.last_name = request.data["last_name"]
        user_profile.name = user.first_name + " " + user.last_name
        user.save()

        if "image" in request.data:
            if request.data["image"] is not None:
                user_profile.image = get_image_from_data_url(request.data["image"])[0]
            elif request.data["image"] is None:
                user_profile.image = None

        if "thumbnail_image" in request.data:
            if request.data["thumbnail_image"] is not None:
                user_profile.thumbnail_image = get_image_from_data_url(
                    request.data["thumbnail_image"]
                )[0]
            elif request.data["thumbnail_image"] is None:
                user_profile.thumbnail_image = None

        if "background_image" in request.data:
            if request.data["background_image"] is not None:
                user_profile.background_image = get_image_from_data_url(
                    request.data["background_image"], True, 1280
                )[0]

            elif request.data["background_image"] is None:
                user_profile.background_image = None

        if "location" in request.data:
            geo_location = get_location(request.data["location"])
            user_profile.location = geo_location

        if "biography" in request.data:
            user_profile.biography = request.data["biography"]
        if "website" in request.data:
            user_profile.website = request.data["website"]
        if "language" in request.data:
            language = Language.objects.filter(language_code=request.data["language"])
            if language.exists():
                user_profile.language = language[0]

        if "availability" in request.data:
            try:
                availability = Availability.objects.get(
                    id=int(request.data["availability"])
                )
            except Availability.DoesNotExist:
                raise NotFound("Availability not found.")

            user_profile.availability = availability

        if "skills" in request.data:
            for skill in user_profile.skills.all():
                if skill.id not in request.data["skills"]:
                    user_profile.skills.remove(skill)
            for skill_id in request.data["skills"]:
                try:
                    skill = Skill.objects.get(id=int(skill_id))
                    user_profile.skills.add(skill)
                except Skill.DoesNotExist:
                    logger.error("Passed skill id {} does not exists")

        if "sectors" in request.data:
            _sector_keys = request.data["sectors"]
            sector_keys, err = sanitize_sector_inputs(_sector_keys)
            if err:
                # do not perform an update of sectors
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
            else:
                # perform update of sectors
                old_user_sector_mapping = UserProfileSectorMapping.objects.filter(
                    user_profile=user_profile
                )
                # delete sectors that are not in the request data
                for o_s_mapping in old_user_sector_mapping:
                    if o_s_mapping.sector.key not in sector_keys:
                        o_s_mapping.delete()

                # add new sectors that are in the request data
                old_sector_keys = list(
                    set([x.sector.key for x in old_user_sector_mapping])
                )

                order_value = len(sector_keys)
                for sector_key in sector_keys:
                    # create mapping only if the sector is not already mapped
                    # to the user profile

                    if sector_key in old_sector_keys:
                        mapping = UserProfileSectorMapping.objects.filter(
                            sector__key=sector_key, user_profile=user_profile
                        ).first()
                        mapping.order = order_value
                        mapping.save()
                        order_value -= 1
                    else:
                        try:
                            sector = Sector.objects.get(key=sector_key)
                            UserProfileSectorMapping.objects.create(
                                sector=sector,
                                user_profile=user_profile,
                                order=order_value,
                            )
                            order_value -= 1
                        except Sector.DoesNotExist:
                            logger.error(
                                "Passed organization tag ID {} does not exist".format(
                                    sector_key
                                )
                            )

        user_profile.save()

        items_to_translate = [
            {"key": "biography", "translation_key": "biography_translation"},
        ]
        if "translations" not in request.data:
            request.data["translations"] = {}
        edit_translations(
            items_to_translate, request.data, user_profile, "user_profile"
        )

        serializer = UserProfileSerializer(user_profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserEmailVerificationLinkView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        if "uuid" not in request.data:
            return Response(
                {"message": _("Required parameters are missing.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # convert verification string
        verification_key = request.data["uuid"].replace("%2D", "-")
        try:
            user_profile = UserProfile.objects.get(verification_key=verification_key)
        except UserProfile.DoesNotExist:
            return Response(
                {
                    "message": _("User profile not found.")
                    + " "
                    + _(
                        "Contact contact@climatehub.org if you repeatedly experience problems."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user_profile:
            if user_profile.is_profile_verified:
                return Response(
                    {
                        "message": _(
                            "Account already verified. Please contact us if you are having trouble signing in."
                        )
                    },
                    status=status.HTTP_204_NO_CONTENT,
                )
            else:
                user_profile.is_profile_verified = True
                user_profile.save()
                return Response(
                    {"message": _("Your profile is successfully verified")},
                    status=status.HTTP_200_OK,
                )
        else:
            return Response(
                {"message": _("Permission Denied")}, status=status.HTTP_403_FORBIDDEN
            )


class SendResetPasswordEmail(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        if "email" not in request.data:
            return Response(
                {"message": "Required parameters are missing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user_profile = UserProfile.objects.get(user__username=request.data["email"])
        except UserProfile.DoesNotExist:
            return Response(
                {"message": "There is no profile with this email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        hub_url = get_user_profile_hub_slug(user_profile)
        user_profile.password_reset_key = uuid.uuid4()
        timeout = datetime.now(dt_timezone.utc) + timedelta(minutes=15)
        user_profile.password_reset_timeout = timeout
        send_password_link(user_profile.user, user_profile.password_reset_key, hub_url)
        user_profile.save()

        return Response(
            {
                "message": "We have sent you an email with your new password. It may take up to 5 minutes to arrive."
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationEmail(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        if "email" not in request.data:
            return Response(
                {"message": "Required parameters are missing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user_profile = UserProfile.objects.get(user__username=request.data["email"])
        except UserProfile.DoesNotExist:
            return Response(
                {
                    "message": "There is no profile with this email address. Try entering the correct email address or signing up again."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user_profile.is_profile_verified:
            return Response(
                {
                    "message": "Your profile is already verified. You now log in with your account."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        hub_url = get_user_profile_hub_slug(user_profile)
        send_user_verification_email(
            user_profile.user, user_profile.verification_key, hub_url
        )

        return Response(
            {
                "message": "We have sent you your verification email again. It may take up to 5 minutes to arrive. Make sure to also check your junk or spam folder."
            },
            status=status.HTTP_200_OK,
        )


class SetNewPassword(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        if (
            "password_reset_key" not in request.data
            or "new_password" not in request.data
        ):
            return Response(
                {"message": "Required parameters are missing."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        password_reset_key = request.data["password_reset_key"].replace("%2D", "-")
        try:
            user_profile = UserProfile.objects.get(
                password_reset_key=password_reset_key
            )
        except UserProfile.DoesNotExist:
            return Response(
                {"message": "Profile not found.", "type": "not_found"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user_profile.password_reset_timeout > datetime.now(dt_timezone.utc):
            user_profile.user.set_password(request.data["new_password"])
            user_profile.password_reset_timeout = datetime.now(dt_timezone.utc)
            user_profile.user.save()
            user_profile.save()
            logger.error("reset password for user " + user_profile.url_slug)
        else:
            return Response(
                {
                    "message": "This link has expired. Please reset your password again.",
                    "type": "link_timed_out",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": "You have successfully set a new password. You may now log in with your new password."
            },
            status=status.HTTP_200_OK,
        )


class ListMembersForSitemap(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = UserProfileSitemapEntrySerializer
    pagination_class = MembersSitemapPagination

    def get_queryset(self):
        return UserProfile.objects.filter(is_profile_verified=True)
