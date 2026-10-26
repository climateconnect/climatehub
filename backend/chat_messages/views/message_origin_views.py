from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from chat_messages.models import Participant
from climateconnect_api.models import Role
from organization.models import Project, ProjectMember
from organization.models.event_registration import EventRegistration


class EventRegistrationOriginView(APIView):
    """Resolve event context for event-registration-origin chat messages."""

    permission_classes = [IsAuthenticated]

    def get(self, request, registration_id):
        try:
            registration = EventRegistration.objects.select_related(
                "registration_config__project"
            ).get(id=registration_id)
        except EventRegistration.DoesNotExist:
            return Response(
                {"message": "Registration not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        project = registration.registration_config.project

        is_chat_participant = Participant.objects.filter(
            user=request.user,
            is_active=True,
            chat__participant_message__origin_type="event_registration",
            chat__participant_message__origin_id=registration_id,
        ).exists()

        is_project_admin = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()

        if not (is_chat_participant or is_project_admin):
            return Response(
                {
                    "message": (
                        "You do not have permission to access this registration origin."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {
                "event_name": project.name,
                "event_url_slug": project.url_slug,
            },
            status=status.HTTP_200_OK,
        )


class ProjectOriginView(APIView):
    """Resolve project context for project-origin chat messages (issue #2296)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found."}, status=status.HTTP_404_NOT_FOUND
            )

        is_chat_participant = Participant.objects.filter(
            user=request.user,
            is_active=True,
            chat__participant_message__origin_type="project",
            chat__participant_message__origin_id=project_id,
        ).exists()
        is_project_admin = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()
        if not (is_chat_participant or is_project_admin):
            return Response(
                {
                    "message": "You do not have permission to access this project origin."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {
                "project_name": project.name,
                "project_url_slug": project.url_slug,
                "project_type": project.project_type,
            },
            status=status.HTTP_200_OK,
        )
