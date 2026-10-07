from rest_framework.exceptions import ValidationError

from chat_messages.models import Participant
from climateconnect_api.models import Role
from organization.models import Project, ProjectMember

ORIGIN_TYPE_PROJECT = "project"
ORIGIN_TYPE_EVENT_REGISTRATION = "event_registration"


def resolve_project_origin(user, chat, project_url_slug):
    """
    Validate a client-requested project context for a chat message and resolve it
    to an (origin_type, origin_id) tuple. Never trusts a raw origin_id from the client.

    Raises ValidationError if the project doesn't exist or none of the other active
    participants of the chat is an admin of the project.
    """
    try:
        project = Project.objects.get(url_slug=project_url_slug)
    except Project.DoesNotExist:
        raise ValidationError("Invalid origin: project not found.")

    other_participant_ids = Participant.objects.filter(
        chat=chat, is_active=True
    ).exclude(user=user)
    has_admin_in_chat = ProjectMember.objects.filter(
        project=project,
        user__in=other_participant_ids.values("user"),
        role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
    ).exists()
    if not has_admin_in_chat:
        raise ValidationError("Invalid origin: project does not match this chat.")
    return ORIGIN_TYPE_PROJECT, project.id
