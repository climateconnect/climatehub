from rest_framework.exceptions import ValidationError

from chat_messages.models import Participant
from climateconnect_api.models import Role
from organization.models import Organization, OrganizationMember

ORIGIN_TYPE_ORGANIZATION = "organization"
ORIGIN_TYPE_EVENT_REGISTRATION = "event_registration"

ORG_ADMIN_ROLE_TYPES = [Role.ALL_TYPE, Role.READ_WRITE_TYPE]

# Request fields by which a client can ask for an origin context.
ORIGIN_SLUG_FIELDS = ("origin_organization_url_slug", "origin_project_url_slug")


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
        role__role_type__in=ORG_ADMIN_ROLE_TYPES,
    ).exists()
    if not has_admin_in_chat:
        raise ValidationError("Invalid origin: organization does not match this chat.")
    return ORIGIN_TYPE_ORGANIZATION, organization.id


def add_organization_admins_to_chat(organization_id, chat):
    """
    Make every organization admin an active participant of the chat so they are
    notified and can reply. Idempotent; existing active participants are untouched.
    """
    admin_user_ids = OrganizationMember.objects.filter(
        organization_id=organization_id,
        role__role_type__in=ORG_ADMIN_ROLE_TYPES,
    ).values_list("user", flat=True)
    chat_role = Role.objects.filter(role_type=Role.READ_WRITE_TYPE).first()
    for user_id in admin_user_ids:
        participant, created = Participant.objects.get_or_create(
            chat=chat, user_id=user_id, defaults={"role": chat_role}
        )
        if not created and not participant.is_active:
            participant.is_active = True
            participant.role = chat_role
            participant.save()
