# Python imports
from ideas.utility.notification import create_idea_join_notification
from ideas.models.support import IdeaSupporter
import logging

# Django/Django REST imports
from django.db.models import Case, When
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Climate connect imports
from climateconnect_api.models import Language, Role
from climateconnect_api.utility.translation import get_translations
from climateconnect_api.utility.content_shares import save_content_shared
from climateconnect_main.utility.general import get_image_from_data_url
from chat_messages.models.message import MessageParticipants, Participant
from chat_messages.utility.chat_setup import create_private_or_group_chat
from hubs.models.hub import Hub
from ideas.models import Idea
from ideas.pagination import IdeasBoardPagination
from ideas.permissions import IdeaReadWritePermission
from ideas.serializers.idea import IdeaMinimalSerializer, IdeaSerializer
from ideas.utility.idea import create_idea, verify_idea, idea_translations
from location.utility import get_location
from organization.models import Organization

logger = logging.getLogger(__name__)


class IdeasBoardView(ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = IdeasBoardPagination
    filter_backends = [SearchFilter]
    search_fields = ["name"]
    serializer_class = IdeaMinimalSerializer

    def get_queryset(self):
        queryset = Idea.objects.all()
        if "hub" in self.request.query_params:
            hub = Hub.objects.filter(url_slug=self.request.query_params["hub"])
            if hub.exists() and hub[0].hub_type == Hub.LOCATION_HUB_TYPE:
                queryset = Idea.objects.filter(hub_shared_in=hub[0])
        if "idea" in self.request.query_params:
            queryset = queryset.order_by(
                Case(
                    When(url_slug=self.request.query_params.get("idea"), then=0),
                    default=1,
                ),
                "-id",
            )
        return queryset


# This is API view is used to edit one idea
class IdeaView(APIView):
    permission_classes = [IdeaReadWritePermission]

    def get(self, request, url_slug, format=None):
        idea = verify_idea(url_slug)
        if not idea:
            return Response(
                {"message": "Idea not found"}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = IdeaSerializer(idea)

        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, url_slug, format=None):
        idea = verify_idea(url_slug)
        if not idea:
            return Response(
                {"message": "Idea not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if "name" in request.data and idea.name != request.data["name"]:
            idea.name = request.data["name"]

        if (
            "short_description" in request.data
            and idea.short_description != request.data["short_description"]
        ):
            idea.short_description = request.data["short_description"]

        if "image" in request.data and request.data["image"] is not None:
            image = get_image_from_data_url(request.data["image"])[0]
            idea.image = image

        if "thumbnail_image" in request.data and request.data["thumbnail_image"]:
            thumbnail_image = get_image_from_data_url(request.data["thumbnail_image"])[
                0
            ]
            idea.thumbnail_image = thumbnail_image

        if "location" in request.data and request.data["location"]:
            idea.location = get_location(request.data["location"])

        if "hub" in request.data:
            try:
                hub = Hub.objects.get(url_slug=request.data["hub"])
            except Hub.DoesNotExist:
                hub = None

            if hub:
                idea.hub = hub

        if "parent_organization" in request.data:
            try:
                organization = Organization.objects.get(
                    id=request.data["parent_organization"]
                )
            except Organization.DoesNotExist:
                organization = None

            if organization and not organization.is_draft:
                idea.organization = organization

        idea.save()

        # TODO (Dip 8-6-2021): Transfer this logic to celery task.
        texts = {"name": idea.name, "short_description": idea.short_description}
        try:
            translations = get_translations(texts, {}, idea.language.language_code)
        except ValueError as ve:
            translations = None
            logger.error("TranslationFailed: Error translating texts, {}".format(ve))

        if translations:
            idea_translations(
                idea=idea,
                translations=translations["translations"],
                source_language=idea.language,
            )

        serializer = IdeaSerializer(idea)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CreateIdeaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        required_params = [
            "name",
            "short_description",
            "hub",
            "location",
            "source_language",
            "hub_shared_in",
        ]
        for param in required_params:
            if param not in request.data:
                raise ValidationError("Required parameter missing: " + param)
        texts = {
            "name": request.data["name"],
            "short_description": request.data["short_description"],
        }
        try:
            translations = get_translations(texts, {}, request.data["source_language"])
        except ValueError as ve:
            translations = None
            logger.error("TranslationFailed: Error translating texts, {}".format(ve))

        language = None
        if translations:
            language = Language.objects.get(
                language_code=translations["source_language"]
            )

        idea = create_idea(request.data, language, request.user)

        # translate idea
        if translations:
            idea_translations(
                idea=idea,
                translations=translations["translations"],
                source_language=language,
            )

        # Creating group chat for the idea.
        if idea:
            IdeaSupporter.objects.create(user=request.user, idea=idea)
            create_private_or_group_chat(
                creator=request.user, group_chat_name=idea.name, related_idea=idea
            )
        return Response(idea.url_slug, status=status.HTTP_200_OK)


class JoinIdeaChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        idea = verify_idea(url_slug)
        if not idea:
            return Response(
                {"message": "Idea not found"}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            chat = MessageParticipants.objects.get(related_idea=idea.id)
            member_role = Role.objects.get(role_type=Role.READ_ONLY_TYPE)
            idea_supporter = IdeaSupporter.objects.get_or_create(
                idea=idea, user=request.user
            )
            try:
                Participant.objects.get(user=request.user, chat=chat)
            except Participant.DoesNotExist:
                Participant.objects.create(
                    user=request.user, chat=chat, role=member_role
                )
            create_idea_join_notification(idea, idea_supporter[0], chat.chat_uuid)
        except MessageParticipants.DoesNotExist:
            return Response(
                {"message": "Group chat not found"}, status=status.HTTP_404_NOT_FOUND
            )
        # Participant.objects.get_or_create(user=request.user, chat=idea.related_idea_message_participant)
        return Response({"chat_uuid": chat.chat_uuid}, status=status.HTTP_200_OK)


class GetHaveIJoinedIdeaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, url_slug):
        print("checking whether I joined")
        idea = verify_idea(url_slug)
        if not idea:
            print("There is no idea with the url slug " + url_slug)
            return Response(
                {"message": "Idea not found"}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            chat = MessageParticipants.objects.get(related_idea=idea.id)
            participant = Participant.objects.filter(user=request.user, chat=chat)
            if participant.exists():
                return Response(
                    {"chat_uuid": chat.chat_uuid, "has_joined": True},
                    status=status.HTTP_200_OK,
                )
            else:
                return Response({"has_joined": False}, status=status.HTTP_200_OK)
        except MessageParticipants.DoesNotExist:
            return Response(
                {"message": "Group chat not found"}, status=status.HTTP_404_NOT_FOUND
            )


class SetIdeaSharedView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, url_slug):
        try:
            idea = Idea.objects.get(url_slug=url_slug)
        except Idea.DoesNotExist:
            raise NotFound(detail="Idea not found.", code=status.HTTP_404_NOT_FOUND)
        save_content_shared(request, idea)
        return Response(status=status.HTTP_201_CREATED)
