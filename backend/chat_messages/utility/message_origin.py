from rest_framework.exceptions import ValidationError

from chat_messages.models import Participant
from climateconnect_api.models import Role
from organization.models import (
    Organization,
    OrganizationMember,
    Project,
    ProjectMember,
)
from organization.models.members import MembershipRequests

ORIGIN_TYPE_ORGANIZATION = "organization"
ORIGIN_TYPE_PROJECT = "project"
ORIGIN_TYPE_EVENT_REGISTRATION = "event_registration"
ORIGIN_TYPE_MEMBERSHIP_REQUEST = "membership_request"

ADMIN_ROLE_TYPES = [Role.ALL_TYPE, Role.READ_WRITE_TYPE]

# Request fields by which a client can ask for an origin context.
ORIGIN_SLUG_FIELDS = (
    "origin_organization_url_slug",
    "origin_project_url_slug",
    "origin_membership_request_id",
)


def resolve_message_origin(user, chat, data):
    """
    Dispatch on whichever origin_*_url_slug is present in the request data.
    Returns (origin_type, origin_id), or ("", None) if none is requested.
    Raises ValidationError if more than one is set or the origin is invalid.
    """
    requested = [field for field in ORIGIN_SLUG_FIELDS if data.get(field)]
    if len(requested) > 1:
        raise ValidationError("Invalid origin: only one origin can be set.")
    if not requested:
        return "", None
    if requested[0] == "origin_organization_url_slug":
        return resolve_organization_origin(
            user, chat, data["origin_organization_url_slug"]
        )
    if requested[0] == "origin_project_url_slug":
        return resolve_project_origin(user, chat, data["origin_project_url_slug"])
    if requested[0] == "origin_membership_request_id":
        return resolve_membership_request_origin(
            user, chat, data["origin_membership_request_id"]
        )
    raise ValidationError("Invalid origin: unsupported origin type.")


def resolve_organization_origin(user, chat, organization_url_slug):
    """
    Validate a client-requested organization context for a chat message and resolve
    it to an (origin_type, origin_id) tuple. Never trusts a raw origin_id from the
    client.

    Raises ValidationError if the organization doesn't exist or none of the other
    active participants of the chat is an admin of the organization.
    """
    try:
        organization = Organization.objects.get(url_slug=organization_url_slug)
    except Organization.DoesNotExist:
        raise ValidationError("Invalid origin: organization not found.")

    other_participants = Participant.objects.filter(chat=chat, is_active=True).exclude(
        user=user
    )
    has_admin_in_chat = OrganizationMember.objects.filter(
        organization=organization,
        user__in=other_participants.values("user"),
        role__role_type__in=ADMIN_ROLE_TYPES,
    ).exists()
    if not has_admin_in_chat:
        raise ValidationError("Invalid origin: organization does not match this chat.")
    return ORIGIN_TYPE_ORGANIZATION, organization.id


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

    other_participants = Participant.objects.filter(chat=chat, is_active=True).exclude(
        user=user
    )
    has_admin_in_chat = ProjectMember.objects.filter(
        project=project,
        user__in=other_participants.values("user"),
        role__role_type__in=ADMIN_ROLE_TYPES,
    ).exists()
    if not has_admin_in_chat:
        raise ValidationError("Invalid origin: project does not match this chat.")
    return ORIGIN_TYPE_PROJECT, project.id


def resolve_membership_request_origin(user, chat, membership_request_id):
    """
    Validate a client-requested membership-request context for a chat message.
    The chat must be the request's response_chat and the sender an active
    participant of it. Never trusts a raw origin_id from the client.
    """
    try:
        membership_request = MembershipRequests.objects.get(id=membership_request_id)
    except (MembershipRequests.DoesNotExist, ValueError, TypeError):
        raise ValidationError("Invalid origin: membership request not found.")

    if membership_request.response_chat_id != chat.id:
        raise ValidationError(
            "Invalid origin: membership request does not match this chat."
        )
    if not Participant.objects.filter(chat=chat, user=user, is_active=True).exists():
        raise ValidationError("Invalid origin: not a participant of this chat.")
    return ORIGIN_TYPE_MEMBERSHIP_REQUEST, membership_request.id
