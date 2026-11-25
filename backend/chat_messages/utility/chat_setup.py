# Python imports
# Logging
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

# Django/Django REST imports
from django.contrib.auth.models import User
from django.db.models import Count, QuerySet
from django.utils.translation import gettext as _

from chat_messages.models import MessageParticipants, MessageReceiver, Participant
from climateconnect_api.models import Notification, Role, UserNotification, UserProfile
from ideas.models.ideas import Idea

logger = logging.getLogger(__name__)


def get_or_create_private_chat(
    initiator: User,
    chatting_partner_user: User,
    created_by: Optional[User] = None,
) -> MessageParticipants:
    """Return existing 1:1 private chat for two users, or create one.

    Private chat definition matches StartPrivateChat:
    - exactly two active participants,
    - no group name,
    - no related idea.
    """
    chats_with_creator = Participant.objects.filter(
        user=initiator, is_active=True
    ).values_list("chat", flat=True)
    chats_with_both_users = Participant.objects.filter(
        user=chatting_partner_user,
        chat__in=chats_with_creator,
        is_active=True,
    ).values_list("chat", flat=True)

    private_chat_with_both_users = MessageParticipants.objects.annotate(
        num_participants=Count("participant_participants")
    ).filter(
        id__in=chats_with_both_users,
        num_participants=2,
        related_idea=None,
        name="",
    )

    if private_chat_with_both_users.exists():
        return private_chat_with_both_users[0]

    private_chat = MessageParticipants.objects.create(
        chat_uuid=str(uuid.uuid4()),
        created_by=created_by or initiator,
    )
    basic_role = Role.objects.get(role_type=Role.READ_ONLY_TYPE)
    Participant.objects.create(user=initiator, chat=private_chat, role=basic_role)
    Participant.objects.create(
        user=chatting_partner_user,
        chat=private_chat,
        role=basic_role,
    )
    return private_chat


def set_read(messages, user, is_private_message):
    if not messages:
        return None
    unread_receivers = MessageReceiver.objects.filter(
        message__in=messages, receiver=user, read_at=None
    )
    for receiver in unread_receivers:
        receiver.read_at = datetime.now()
        receiver.save()
    # Here we are assuming that all messages passed to this function are from the same chat
    message_notifications = Notification.objects.filter(
        chat=messages[0].message_participant
    )
    if message_notifications.exists():
        try:
            unread_user_notification = UserNotification.objects.get(
                notification__in=message_notifications, read_at=None, user=user
            )
            user_notification = unread_user_notification
            user_notification.read_at = datetime.now()
            user_notification.save()
        except UserNotification.DoesNotExist:
            logger.error("there is no user notification for " + user.first_name)


def create_private_or_group_chat(
    creator: User,
    group_chat_name: str,
    participants: Optional[QuerySet] = None,
    related_idea: Optional[Idea] = None,
) -> MessageParticipants:
    # filter().first() because some databases contain several roles per type
    creator_role = Role.objects.filter(role_type=Role.ALL_TYPE).first()
    member_role = Role.objects.filter(role_type=Role.READ_ONLY_TYPE).first()
    if creator_role is None or member_role is None:
        raise Role.DoesNotExist(
            "Chat roles are not configured (need ALL_TYPE and READ_ONLY_TYPE roles)"
        )
    chat = MessageParticipants.objects.create(
        chat_uuid=uuid.uuid4(), name=group_chat_name, created_by=creator
    )
    if related_idea:
        chat.related_idea = related_idea
        chat.is_public = True
        chat.save()
    # Adding creator to the group chat.
    Participant.objects.create(user=creator, chat=chat, role=creator_role)
    logger.info(f"NewChat: Creator {creator.id} added to chat {chat.id}")
    if participants:
        for participant in participants:
            Participant.objects.create(user=participant, chat=chat, role=member_role)
            logger.info(
                f"NewChat: Participant {participant.id} added to chat {chat.id}"
            )
    return chat


def check_can_start_chat(user_profile: UserProfile) -> bool:
    if user_profile.restricted_profile:
        print("forbidden because user profile is restricted")
        return "User profile restricted"
    # Users with special permissions aren't restricted
    if user_profile.user.has_perm("chat_messages.create_unlimited_messageparticipants"):
        return True
    # You can only start up to 4 chats within a 180 minute timeframe
    cooldown_minutes_for_starting_chats = 180
    max_new_chats_per_timeframe = 4

    cutoff_date = datetime.now() - timedelta(
        minutes=cooldown_minutes_for_starting_chats
    )
    # Find all chats started by the user after cutoff date (aka in the last 3 hours)
    affected_chats = MessageParticipants.objects.filter(
        created_by=user_profile.user, created_at__gte=cutoff_date
    ).order_by("-created_at")
    if affected_chats.count() >= max_new_chats_per_timeframe:
        minutes_since_last_chat = (
            datetime.now() - affected_chats[0].created_at.replace(tzinfo=None)
        ).total_seconds() / 60
        print("too many chats started: " + str(affected_chats.count()))
        return _(
            "Currently you can only contact %(max_chats_per_timeframe)d new people within %(hours)d hours. You can start a new chat in %(minutes)d minutes."
        ) % {
            "max_chats_per_timeframe": max_new_chats_per_timeframe,
            "hours": cooldown_minutes_for_starting_chats / 60,
            "minutes": cooldown_minutes_for_starting_chats - minutes_since_last_chat,
        }

    return True
