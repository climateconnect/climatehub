import logging

# Django imports
from django.contrib.auth.models import User
from django.contrib.gis.db.models import GeometryField, Union
from django.contrib.gis.db.models.functions import Distance
from django.db import transaction
from django.db.models import Prefetch, Q
from django.db.models.functions import Cast
from django.utils.translation import gettext as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.filters import SearchFilter
from rest_framework.generics import (
    ListAPIView,
    RetrieveUpdateDestroyAPIView,
)

# REST imports
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Backend app imports
from climateconnect_api.models import Role, UserProfile
from climateconnect_api.models.language import Language
from climateconnect_api.pagination import MembersPagination
from climateconnect_api.utility.common import create_unique_slug
from climateconnect_api.utility.content_shares import save_content_shared
from climateconnect_api.utility.translation import (
    edit_translations,
    get_translations,
)
from climateconnect_main.utility.general import get_image_from_data_url
from hubs.models.hub import Hub
from location.utility import get_location, get_location_with_range
from organization.models import (
    Organization,
    OrganizationMember,
    OrganizationSectorMapping,
    OrganizationTagging,
    OrganizationTags,  # TODO: rename to type
    OrganizationTranslation,
    ProjectParents,
    Sector,
)
from organization.pagination import OrganizationsPagination, ProjectsPagination
from organization.permissions import (
    AddOrganizationMemberPermission,
    ChangeOrganizationCreatorPermission,
    OrganizationMemberReadWritePermission,
    OrganizationReadWritePermission,
)
from organization.serializers.organization import (
    EditOrganizationSerializer,
    OrganizationCardSerializer,
    OrganizationFollowerSerializer,
    OrganizationMemberSerializer,
    OrganizationSerializer,
    OrganizationSitemapEntrySerializer,
    UserOrganizationSerializer,
)
from organization.serializers.project import ProjectFromProjectParentsSerializer
from organization.serializers.tags import (
    OrganizationTagsSerializer,
)  # TODO: rename to organizationType
from organization.utility.follow import (
    check_if_user_follows_organization,
    get_list_of_organization_followers,
    set_user_following_organization,
)
from organization.utility.organization import (
    check_create_existing_name,
    check_edit_exisiting_name,
    check_existing_name,
    check_existing_name_translation,
    create_organization_translation,
    get_existing_name_message,
    is_valid_organization_size,
    get_visible_organization_projects_queryset,
)
from organization.utility.sector import (
    create_context_for_hub_specific_sector,
    sanitize_sector_inputs,
)

logger = logging.getLogger(__name__)


class ListOrganizationFollowersView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = OrganizationFollowerSerializer

    def get_queryset(self):
        return get_list_of_organization_followers(self)


class IsUserFollowing(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, url_slug):
        return check_if_user_follows_organization(request.user, url_slug)


class SetFollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        # probably a better way -> .mo / po files todo

        return set_user_following_organization(request, url_slug)


class ListOrganizationsAPIView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter, DjangoFilterBackend]
    pagination_class = OrganizationsPagination
    search_fields = ["name"]

    def get_serializer_class(self):
        return OrganizationCardSerializer

    def get_serializer_context(self):
        context = create_context_for_hub_specific_sector(self.request)
        return {"language_code": self.request.LANGUAGE_CODE, **context}

    def get_queryset(self):
        organizations = (
            Organization.objects.all()
            .prefetch_related(
                Prefetch(
                    "organization_sector_mapping",
                    queryset=OrganizationSectorMapping.objects.select_related("sector"),
                ),
                Prefetch(
                    "tag_organization",
                    queryset=OrganizationTagging.objects.select_related(
                        "organization_tag"
                    ),
                ),
                "organization_member",
                "location__translate_location__language",
            )
            .select_related("language", "location")
        )

        if "hub" in self.request.query_params:
            hub = Hub.objects.filter(url_slug=self.request.query_params["hub"]).first()

            if not hub:
                return organizations.none()

            hubs = [hub]
            if hub.parent_hub:
                hubs.append(hub.parent_hub)

            for current_hub in hubs:
                if current_hub.hub_type == Hub.SECTOR_HUB_TYPE:
                    sectors = current_hub.sectors.all()
                    sector_ids = [x.id for x in sectors]

                    organizations = organizations.filter(
                        organization_sector_mapping__sector_id__in=sector_ids
                    ).distinct()

                elif current_hub.hub_type == Hub.LOCATION_HUB_TYPE:
                    hub_locations = current_hub.location.all()

                    if not hub_locations.exists():
                        organizations = organizations.none()
                    else:
                        hub_location_ids = hub_locations.values_list("id", flat=True)

                        aggregated_geometry = hub_locations.annotate(
                            geom_as_geometry=Cast("multi_polygon", GeometryField())
                        ).aggregate(combined=Union("geom_as_geometry"))["combined"]

                        organizations = organizations.filter(
                            Q(location__country=hub_locations.first().country)
                        )

                        organizations_by_location_id = organizations.filter(
                            location__id__in=hub_location_ids
                        )

                        if aggregated_geometry:
                            organizations_by_geometry = organizations.filter(
                                Q(
                                    location__centre_point__coveredby=(
                                        aggregated_geometry
                                    )
                                )
                                | Q(
                                    location__multi_polygon__coveredby=(
                                        aggregated_geometry
                                    )
                                )
                            )

                            organizations = (
                                (
                                    organizations_by_location_id
                                    | organizations_by_geometry
                                )
                                .annotate(
                                    distance=Distance(
                                        "location__centre_point", aggregated_geometry
                                    )
                                )
                                .distinct()
                            )
                        else:
                            organizations = organizations_by_location_id.distinct()

                elif current_hub.hub_type == Hub.CUSTOM_HUB_TYPE:
                    organizations = organizations.filter(related_hubs=current_hub)

        if "sectors" in self.request.query_params:
            _sector_keys = self.request.query_params.get("sectors").split(",")
            sector_keys, err = sanitize_sector_inputs(_sector_keys)
            if err:
                logger.error(
                    "Passed sectors are not in list format: 'error':'{}','sector_keys':{}".format(
                        err, _sector_keys
                    )
                )
                # TODO: should I "crash" with 400, or what should I ommit the sectors
            else:
                organizations = organizations.filter(
                    organization_sector_mapping__sector__key__in=sector_keys
                ).distinct()

        # TODO: rename oragnizationTag to OrganizationType
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
            organizations = organizations.filter(
                tag_organization__in=organization_taggings
            ).distinct()

        if (
            "osm_id" in self.request.query_params
            and "osm_type" in self.request.query_params
        ) or "place_id" in self.request.query_params:
            location_data = get_location_with_range(self.request.query_params)
            organizations = (
                organizations.filter(
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
            organizations = organizations.filter(
                location__country=self.request.query_params.get("country"),
                location__city=self.request.query_params.get("city"),
            )

        if (
            "city" in self.request.query_params
            and "country" not in self.request.query_params
        ):
            organizations = organizations.filter(
                location__city=self.request.query_params.get("city")
            )

        if (
            "country" in self.request.query_params
            and "city" not in self.request.query_params
        ):
            organizations = organizations.filter(
                location__country=self.request.query_params.get("country")
            )

        return organizations

    def post(self, request, *args, **kwargs):
        """
        Handle POST requests for search functionality.

        Mirrors ListProjectsView.post(): the frontend sends the location object
        in the request body. When present (place_id + geojson), inject it into
        query_params so the existing get_queryset() location filter works.
        """
        location = request.data

        query_params = request.query_params.copy()

        if "place_id" in location and "geojson" in location:
            query_params["location"] = location

        request._request.GET = query_params

        return self.list(request, *args, **kwargs)


class CreateOrganizationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        required_params = [
            "name",
            "team_members",
            "location",
            "image",
            "organization_tags",
            "sectors",
            "translations",
            "source_language",
            "short_description",
        ]
        for param in required_params:
            if param not in request.data:
                return Response(
                    {"message": "Required parameter missing: {}".format(param)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if check_create_existing_name(request.data["name"]):
            message = get_existing_name_message(request.data["name"])
            existing_org = Organization.objects.get(name__iexact=request.data["name"])
            return Response(
                {
                    "message": message,
                    "url_slug": existing_org.url_slug,
                    "existing_name": existing_org.name,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        texts = {"name": request.data["name"].strip()}

        if "short_description" in request.data:
            texts["short_description"] = request.data["short_description"]
        if "about" in request.data:
            texts["about"] = request.data["about"]
        if "get_involved" in request.data:
            texts["get_involved"] = request.data["get_involved"]

        try:
            translations = get_translations(
                texts,
                request.data["translations"],
                request.data["source_language"],
                ["name"],
            )
        except ValueError as ve:
            translations = None
            logger.error("TranslationFailed: Error translating texts, {}".format(ve))

        try:
            # Wrap the entire organization creation in a transaction
            with transaction.atomic():
                organization, created = Organization.objects.get_or_create(
                    name=request.data["name"].strip()
                )

                if not created:
                    return Response(
                        {
                            "message": get_existing_name_message(organization.name),
                            "url_slug": organization.url_slug,
                            "existing_name": organization.name,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                organization.url_slug = create_unique_slug(
                    organization.name, organization.id, Organization.objects
                )

                # Add primary language
                source_language = Language.objects.get(
                    language_code=request.data["source_language"]
                )
                organization.language = source_language

                # Handle images
                if "image" in request.data:
                    organization.image = get_image_from_data_url(request.data["image"])[
                        0
                    ]
                if "thumbnail_image" in request.data:
                    organization.thumbnail_image = get_image_from_data_url(
                        request.data["thumbnail_image"]
                    )[0]
                if "background_image" in request.data:
                    organization.background_image = get_image_from_data_url(
                        request.data["background_image"]
                    )[0]

                # Handle parent organization
                if "parent_organization" in request.data:
                    try:
                        parent_org = Organization.objects.get(
                            id=int(request.data["parent_organization"])
                        )
                        organization.parent_organization = parent_org
                    except Organization.DoesNotExist:
                        raise NotFound("Parent organization not found.")

                # Handle location and other fields
                if "location" in request.data:
                    organization.location = get_location(request.data["location"])

                # Add hub type if organization was shared in a custom hub
                if "created_in_hub" in request.data:
                    hub = Hub.objects.filter(
                        url_slug=request.data["created_in_hub"]
                    ).first()
                    organization.related_hubs.add(hub)

                # Set other fields
                fields_to_set = [
                    "short_description",
                    "about",
                    "website",
                    "organization_size",
                    "get_involved",
                ]
                for field in fields_to_set:
                    if field in request.data:
                        if (
                            field == "organization_size"
                            and not is_valid_organization_size(request.data[field])
                        ):
                            continue
                        setattr(organization, field, request.data[field])

                # Create organization translations
                if translations:
                    for key in translations["translations"]:
                        if not key == "is_manual_translation":
                            language_code = key
                            texts = translations["translations"][language_code]
                            language = Language.objects.get(language_code=language_code)
                            if language_code in request.data["translations"]:
                                is_manual_translation = request.data["translations"][
                                    language_code
                                ]["is_manual_translation"]
                            else:
                                is_manual_translation = False
                            create_organization_translation(
                                organization, language, texts, is_manual_translation
                            )

                # Create organization members
                roles = Role.objects.all()
                for member in request.data["team_members"]:
                    user_role = roles.filter(
                        id=int(member["permission_type_id"])
                    ).first()
                    try:
                        user = User.objects.get(id=int(member["user_id"]))
                    except User.DoesNotExist:
                        logger.error(
                            "Passed user id {} does not exist".format(member["user_id"])
                        )
                        continue

                    if user:
                        OrganizationMember.objects.create(
                            user=user, organization=organization, role=user_role
                        )
                        logger.info("Organization member created {}".format(user.id))

                # Create organization tags
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
                                "During organization creation of organization {}: Passed sector {} does not exists".format(
                                    organization.url_slug,
                                    sector_key,
                                )
                            )
                    OrganizationSectorMapping.objects.bulk_create(
                        [
                            OrganizationSectorMapping(
                                sector=sector,
                                organization=organization,
                                order=len(sectors) - i,
                            )
                            for i, sector in enumerate(sectors)
                        ]
                    )

                # TODO: rename organizationTags to organizationTypes
                if "organization_tags" in request.data:
                    for organization_tag in request.data["organization_tags"]:
                        try:
                            organization_tag = OrganizationTags.objects.get(
                                id=int(organization_tag["key"])
                            )
                        except OrganizationTags.DoesNotExist:
                            logger.error(
                                "Passed organization tag ID {} does not exist".format(
                                    organization_tag
                                )
                            )
                            continue
                        if organization_tag:
                            OrganizationTagging.objects.create(
                                organization=organization,
                                organization_tag=organization_tag,
                            )
                            logger.info(
                                "Organization tagging created for organization {}".format(
                                    organization.id
                                )
                            )
                organization.save()
                return Response(
                    {
                        "message": "Organization {} successfully created".format(
                            organization.name
                        ),
                        "url_slug": organization.url_slug,
                    },
                    status=status.HTTP_201_CREATED,
                )

        except Exception as e:
            logger.error(f"Error creating organization: {str(e)}")
            return Response(
                {
                    "message": "Error creating organization. Please try again or contact support if the problem persists.",
                    "error": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class LookUpOrganizationAPIView(APIView):
    def get(self, *args, **kwargs):
        query = self.request.query_params.get("search")
        message = get_existing_name_message(query)
        if check_existing_name(query):
            organization = Organization.objects.filter(name__iexact=query)
            return Response(
                {
                    "message": message,
                    "url": organization[0].url_slug,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if check_existing_name_translation(query):
            organization_translation = OrganizationTranslation.objects.filter(
                name_translation__iexact=query
            )
            return Response(
                {
                    "message": message,
                    "url": organization_translation[0].organization.url_slug,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_200_OK)


class OrganizationAPIView(APIView):
    permission_classes = [OrganizationReadWritePermission]
    lookup_field = "url_slug"

    def get(self, request, url_slug, format=None):
        try:
            organization = (
                Organization.objects.select_related("location")
                .prefetch_related("location__translate_location__language")
                .get(url_slug=str(url_slug))
            )
        except Organization.DoesNotExist:
            return Response(
                {"message": _("Organization not found:") + url_slug},
                status=status.HTTP_404_NOT_FOUND,
            )
        _context = create_context_for_hub_specific_sector(self.request)
        if "edit_view" in request.query_params:
            serializer = EditOrganizationSerializer(
                organization,
                many=False,
                context={"language_code": request.LANGUAGE_CODE, **_context},
            )
        else:
            serializer = OrganizationSerializer(
                organization,
                many=False,
                context={"language_code": request.LANGUAGE_CODE, **_context},
            )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, url_slug, format=None):
        try:
            organization = Organization.objects.get(url_slug=str(url_slug))
        except Organization.DoesNotExist:
            return Response(
                {"message": _("Organization not found:") + url_slug},
                status=status.HTTP_404_NOT_FOUND,
            )
        pass_through_params = [
            "name",
            "short_description",
            "about",
            "school",
            "organ",
            "website",
            "organization_size",
            "get_involved",
        ]
        if "name" in request.data:
            if check_edit_exisiting_name(organization, request.data["name"]):
                message = get_existing_name_message(request.data["name"])
                existing_org = Organization.objects.get(
                    name__iexact=request.data["name"]
                )
                return Response(
                    {
                        "message": message,
                        "url_slug": existing_org.url_slug,
                        "existing_name": existing_org.name,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        for param in pass_through_params:
            if param in request.data:
                setattr(organization, param, request.data[param])
        if "location" in request.data:
            organization.location = get_location(request.data["location"])
        if "language" in request.data:
            language = Language.objects.filter(language_code=request.data["language"])
            if language.exists():
                organization.language = language[0]
        if "image" in request.data:
            organization.image = get_image_from_data_url(request.data["image"])[0]
        if "thumbnail_image" in request.data:
            organization.thumbnail_image = get_image_from_data_url(
                request.data["thumbnail_image"]
            )[0]
        if "background_image" in request.data:
            if request.data["background_image"] is not None:
                organization.background_image = get_image_from_data_url(
                    request.data["background_image"]
                )[0]

            elif request.data["background_image"] is None:
                organization.background_image = None

        if "hubs" in request.data:
            for hub in organization.hubs.all():
                if hub.url_slug not in request.data["hubs"]:
                    organization.hubs.remove(hub)
            for hub_url_slug in request.data["hubs"]:
                try:
                    hub = Hub.objects.get(url_slug=hub_url_slug)
                    organization.hubs.add(hub)
                except Hub.DoesNotExist:
                    logger.error("Passed hub url_slug {} does not exists")
        if "parent_organization" in request.data:
            if (
                "has_parent_organization" in request.data
                and request.data["has_parent_organization"] is False
            ):
                organization.parent_organization = None
            else:
                try:
                    parent_organization = Organization.objects.get(
                        id=request.data["parent_organization"]
                    )
                except Organization.DoesNotExist:
                    return Response(
                        {
                            "message": _(
                                "Parent organization not found for organization"
                            )
                            + url_slug
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )
                organization.parent_organization = parent_organization

        items_to_translate = [
            {
                "key": "short_description",
                "translation_key": "short_description_translation",
            },
            {"key": "about", "translation_key": "about_translation"},
            {"key": "school", "translation_key": "school_translation"},
            {"key": "organ", "translation_key": "organ_translation"},
            {"key": "get_involved", "translation_key": "get_involved_translation"},
        ]

        edit_translations(
            items_to_translate, request.data, organization, "organization"
        )

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
                old_org_sector_mapping = OrganizationSectorMapping.objects.filter(
                    organization=organization
                )
                # delete sectors that are not in the request data
                for o_s_mapping in old_org_sector_mapping:
                    if o_s_mapping.sector.key not in sector_keys:
                        o_s_mapping.delete()

                # add new sectors that are in the request data
                old_sector_keys = list(
                    set([x.sector.key for x in old_org_sector_mapping])
                )

                order_value = len(sector_keys)
                for sector_key in sector_keys:
                    # create mapping only if the sector is not already mapped
                    # to the organization

                    if sector_key in old_sector_keys:
                        mapping = OrganizationSectorMapping.objects.filter(
                            sector__key=sector_key, organization=organization
                        ).first()
                        mapping.order = order_value
                        mapping.save()
                        order_value -= 1
                    else:
                        try:
                            sector = Sector.objects.get(key=sector_key)
                            OrganizationSectorMapping.objects.create(
                                sector=sector,
                                organization=organization,
                                order=order_value,
                            )
                            order_value -= 1
                        except Sector.DoesNotExist:
                            logger.error(
                                "Passed organization tag ID {} does not exist".format(
                                    sector_key
                                )
                            )

                pass

        # TODO: rename organizationTags to organizationTypes
        old_organization_taggings = OrganizationTagging.objects.filter(
            organization=organization
        ).values("organization_tag")
        if "types" in request.data:
            for tag in old_organization_taggings:
                if tag["organization_tag"] not in request.data["types"]:
                    tag_to_delete = OrganizationTags.objects.get(
                        id=tag["organization_tag"]
                    )
                    OrganizationTagging.objects.filter(
                        organization=organization, organization_tag=tag_to_delete
                    ).delete()
            for tag in request.data["types"]:
                if not old_organization_taggings.filter(
                    organization_tag=tag["key"]
                ).exists():
                    try:
                        tag = OrganizationTags.objects.get(id=tag["key"])
                        OrganizationTagging.objects.create(
                            organization_tag=tag, organization=organization
                        )
                    except OrganizationTags.DoesNotExist:
                        logger.error(
                            _("Passed organization tag id does not exists: ")
                            + tag["key"]
                        )

        organization.save()
        return Response(
            {"message": _("successfully updated organization.")},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, url_slug, format=None):
        try:
            organization = Organization.objects.get(url_slug=str(url_slug))
        except Organization.DoesNotExist:
            return Response(
                {"message": _("Organization not found:") + url_slug},
                status=status.HTTP_404_NOT_FOUND,
            )
        project_count = get_visible_organization_projects_queryset(organization).count()
        if project_count > 0:
            return Response(
                {
                    "message": _(
                        "The organisation has %(count)d projects. Please first delete these"
                        " projects or assign them to other organisations or users."
                    )
                    % {"count": project_count}
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        organization_name = organization.name
        organization.delete()
        return Response(
            {
                "message": _("Organisation %(name)s successfully deleted.")
                % {"name": organization_name}
            },
            status=status.HTTP_200_OK,
        )


class UpdateOrganizationMemberView(RetrieveUpdateDestroyAPIView):
    permission_classes = [OrganizationMemberReadWritePermission]
    serializer_class = OrganizationMemberSerializer

    def get_queryset(self):
        organization = Organization.objects.get(url_slug=str(self.kwargs["url_slug"]))
        return OrganizationMember.objects.filter(
            id=int(self.kwargs["pk"]), organization=organization
        )

    def perform_destroy(self, instance):
        instance.delete()
        return "Organization Member successfully deleted."

    def perform_update(self, serializer):
        serializer.save()
        return serializer.data


class AddOrganizationMembersView(APIView):
    permission_classes = [AddOrganizationMemberPermission]

    def post(self, request, url_slug):
        organization = Organization.objects.get(url_slug=url_slug)

        roles = Role.objects.all()
        if "organization_members" not in request.data:
            return Response(
                {"message": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for member in request.data["organization_members"]:
            try:
                user = User.objects.get(id=int(member["id"]))
            except User.DoesNotExist:
                logger.error(
                    "[AddOrganizationMembersView] Passed user id {} does not exists".format(
                        int(member["id"])
                    )
                )
                continue
            if "permission_type_id" not in member:
                logger.error(
                    "[AddOrganizationMembersView] Not permissions passed for user id {}.".format(
                        int(member["id"])
                    )
                )
                continue
            user_role = roles.filter(id=int(member["permission_type_id"])).first()
            if user:
                OrganizationMember.objects.create(
                    organization=organization,
                    user=user,
                    role=user_role,
                    role_in_organization=member["role_in_organization"],
                )

                logger.info("Organization member created for user {}".format(user.id))

        return Response(
            {"message": "Member added to the organization"},
            status=status.HTTP_201_CREATED,
        )


class ChangeOrganizationCreator(APIView):
    permission_classes = [ChangeOrganizationCreatorPermission]

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

        organization = Organization.objects.get(url_slug=url_slug)
        roles = Role.objects.all()
        if OrganizationMember.objects.filter(
            user=new_creator_user, organization=organization
        ).exists():
            # update old creator profile and new creator profile
            new_creator = OrganizationMember.objects.filter(
                user=request.data["user"],
                organization=organization,
                id=request.data["id"],
            )[0]
            new_creator.role = roles.filter(role_type=Role.ALL_TYPE)[0]
            if "role_in_organization" in request.data:
                new_creator.role_in_organization = request.data["role_in_organization"]
            new_creator.save()
        else:
            # create new creator profile and update old creator profile
            new_creator = OrganizationMember.objects.create(
                role=roles.filter(role_type=Role.ALL_TYPE)[0],
                organization=organization,
                user=new_creator_user,
            )
            if "role_in_organization" in request.data:
                new_creator.role_in_organization = request.data["role_in_organization"]
            new_creator.save()
        old_creator = OrganizationMember.objects.filter(
            user=request.user,
            organization=organization,
        )[0]
        old_creator.role = roles.filter(role_type=Role.READ_WRITE_TYPE)[0]
        old_creator.save()

        return Response(
            {"message": "Changed organization creator"}, status=status.HTTP_200_OK
        )


class PersonalOrganizationsView(ListAPIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if not UserProfile.objects.filter(user=request.user).exists():
            raise NotFound(detail="Profile not found.", code=status.HTTP_404_NOT_FOUND)
        user_organization_members = OrganizationMember.objects.filter(user=request.user)
        serializer = UserOrganizationSerializer(
            user_organization_members,
            many=True,
            context={"language_code": request.LANGUAGE_CODE},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class ListOrganizationProjectsAPIView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["parent_organization__url_slug"]
    pagination_class = ProjectsPagination
    serializer_class = ProjectFromProjectParentsSerializer

    def get_queryset(self):
        return ProjectParents.objects.filter(
            parent_organization__url_slug=self.kwargs["url_slug"],
            project__is_draft=False,
            project__is_active=True,
        ).order_by("-project__created_at")


class ListOrganizationMembersAPIView(ListAPIView):
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter]
    search_fields = ["organization__url_slug"]
    serializer_class = OrganizationMemberSerializer
    pagination_class = MembersPagination

    def get_queryset(self):
        return OrganizationMember.objects.filter(
            organization__url_slug=self.kwargs["url_slug"],
        ).order_by("id")


class ListOrganizationTags(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = OrganizationTagsSerializer

    def get_queryset(self):
        return OrganizationTags.objects.all()


class ListFeaturedOrganizations(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = OrganizationCardSerializer

    def get_serializer_context(self):
        context = create_context_for_hub_specific_sector(self.request)
        return {"language_code": self.request.LANGUAGE_CODE, **context}

    def get_queryset(self):
        return Organization.objects.filter(rating__lte=99)[0:4]


class ListOrganizationsForSitemap(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = OrganizationSitemapEntrySerializer

    def get_queryset(self):
        return Organization.objects.all()


class SetOrganisationSharedView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, url_slug):
        try:
            organization = Organization.objects.get(url_slug=url_slug)
        except Organization.DoesNotExist:
            raise NotFound(
                detail="Organization not found.", code=status.HTTP_404_NOT_FOUND
            )
        save_content_shared(request, organization)
        return Response(status=status.HTTP_201_CREATED)
