from asgiref.sync import async_to_sync
from organization.serializers.project import ProjectNotificationSerializer
from organization.serializers.organization import OrganizationNotificationSerializer
from channels.layers import get_channel_layer
from chat_messages.models import Participant
from chat_messages.utility.email import (
    send_group_chat_message_notification_email,
    send_private_chat_message_notification_email,
)
from organization.utility.project import get_common_related_hub

from climateconnect_api.serializers.user import UserProfileStubSerializer
from climateconnect_api.models.notification import Notification, UserNotification
from climateconnect_api.models.user import UserProfile
from django.contrib.auth.models import User
from django.db.models.query_utils import Q
from ideas.models.comment import IdeaComment
from ideas.models.support import IdeaSupporter
from ideas.serializers.comment import IdeaCommentSerializer
from organization.models.content import ProjectComment
from organization.models.members import OrganizationMember, ProjectMember
from organization.serializers.content import ProjectCommentSerializer
from organization.utility.email import (
    send_idea_comment_email,
    send_idea_comment_reply_email,
    send_organization_follower_email,
    send_project_comment_email,
    send_project_comment_reply_email,
    send_project_follower_email,
)

channel_layer = get_channel_layer()


@async_to_sync
async def send_out_live_notification(user_id):
    await channel_layer.group_send("user-" + str(user_id), {"type": "notification"})


def create_follower_notification(
    notif_type_number,  # Integer value of the notification type
    follower,  # follower e.g project or org
    follower_entity,  # entity being followed e.g. org or project
    follower_user_id,  # user id of the follower
):
    notification_values = get_notification_values(notif_type_number)

    lookup_up_field_input_notifications = {
        notification_values["look_up_follower_type_field_name"]: follower
    }
    notification = Notification.objects.create(
        notification_type=notif_type_number, **lookup_up_field_input_notifications
    )

    look_up_field_input_team = {
        notification_values["look_up_entitiy_type_field_name"]: follower_entity
    }

    team_members_of_entity = (
        notification_values["member_type_model"]
        .objects.filter(**look_up_field_input_team)
        .values("user")
    )

    for member in team_members_of_entity:
        if not member["user"] == follower_user_id:
            user = User.objects.filter(id=member["user"])[0]
            common_hub_url = get_common_related_hub(user, follower_entity)
            create_user_notification(user, notification)
            create_follower_email(
                user,
                notification_values["look_up_entitiy_type_field_name"],
                follower,
                notification,
                common_hub_url,
            )


def create_follower_email(
    user, obj_field_name, follower_type, notification, hub_url=None
):
    if obj_field_name == "organization":
        send_organization_follower_email(user, follower_type, notification, hub_url)
    elif obj_field_name == "project":
        send_project_follower_email(user, follower_type, notification, hub_url)


def create_user_notification(user, notification):
    # TODO: root cause why this filtering is failing
    # on the creation of Project Approval notifications

    old_notification_object = None
    try:
        old_notification_object = UserNotification.objects.filter(
            user=user, notification=notification
        )
    except Exception:
        print(
            f"User notification filter and \
        creation failed. [user={user}, notification={notification}"
        )
        return

    if not old_notification_object.exists():
        UserNotification.objects.create(user=user, notification=notification)
    else:
        if old_notification_object[0].read_at is not None:
            old_notification = old_notification_object[0]
            old_notification.read_at = None
            old_notification.save()


def create_email_notification(receiver, chat, message_content, sender, notification):
    sender_name = sender.first_name + " " + sender.last_name
    number_of_participants = Participant.objects.filter(
        chat=chat, is_active=True
    ).count()
    is_group_chat = (number_of_participants > 2) | (len(chat.name) > 0)
    if is_group_chat:
        send_group_chat_message_notification_email(
            receiver,
            message_content,
            chat.chat_uuid,
            sender_name,
            chat.name,
            notification,
        )
        return

    send_private_chat_message_notification_email(
        receiver, message_content, chat.chat_uuid, sender_name, notification
    )


# The users in @user_url_slugs_to_ignore were already notified about this comment
# and should therefore not be notified again
def send_comment_notification(
    is_reply,
    notification_type,
    comment,
    sender,
    comment_model,
    comment_object_name,
    object_commented_on,
    user_url_slugs_to_ignore,
):
    notification = Notification.objects.create(notification_type=notification_type)
    setattr(notification, comment_object_name, comment)
    notification.save()
    users_notification_sent = []
    users_to_ignore = UserProfile.objects.filter(
        url_slug__in=user_url_slugs_to_ignore
    ).values("user")
    ids_to_ignore = list(map((lambda u: u["user"]), users_to_ignore))
    if is_reply:
        comments_in_thread = (
            comment_model.objects.filter(
                Q(id=comment.parent_comment.id)
                | Q(parent_comment=comment.parent_comment.id)
            )
            .order_by("author_user")
            .distinct("author_user")
            .values("author_user")
        )
        for thread_comment in comments_in_thread:
            if (
                not thread_comment["author_user"] == sender.id
                and thread_comment["author_user"] not in ids_to_ignore
            ):
                user = User.objects.filter(id=thread_comment["author_user"])[0]
                create_user_notification(user, notification)
                # send_out_live_notification(user.id)
                common_hub_url = get_common_related_hub(user, object_commented_on)
                send_comment_email_notification(
                    user=user,
                    notification_type_id=notification_type,
                    object_commented_on=object_commented_on,
                    comment=comment,
                    sender=sender,
                    notification=notification,
                    hub_url=common_hub_url,
                )
                users_notification_sent.append(user.id)
    team = []
    if comment_model == ProjectComment:
        team = ProjectMember.objects.filter(project=object_commented_on).values("user")
    if comment_model == IdeaComment:
        queryset = IdeaSupporter.objects.filter(idea=object_commented_on).values("user")
        team = list(queryset)
        if len(queryset.filter(user=object_commented_on.user)) < 1:
            team.append(object_commented_on.user.id)

    for member in team:
        if (
            not member["user"] == sender.id
            and member["user"] not in users_notification_sent
            and member["user"] not in ids_to_ignore
        ):
            user = User.objects.filter(id=member["user"])[0]
            create_user_notification(user, notification)
            # send_out_live_notification(user.id)
            common_hub_url = get_common_related_hub(user, object_commented_on)
            send_comment_email_notification(
                user=user,
                notification_type_id=notification_type,
                object_commented_on=object_commented_on,
                comment=comment,
                sender=sender,
                notification=notification,
                hub_url=common_hub_url,
            )
    return notification


def send_comment_email_notification(
    user,
    notification_type_id,
    object_commented_on,
    comment,
    sender,
    notification,
    hub_url=None,
):
    properties_by_type = {
        "project_comment": {
            "send_email_function": send_project_comment_email,
            "serializer": ProjectCommentSerializer,
        },
        "reply_to_project_comment": {
            "send_email_function": send_project_comment_reply_email,
            "serializer": ProjectCommentSerializer,
        },
        "idea_comment": {
            "send_email_function": send_idea_comment_email,
            "serializer": IdeaCommentSerializer,
        },
        "reply_to_idea_comment": {
            "send_email_function": send_idea_comment_reply_email,
            "serializer": IdeaCommentSerializer,
        },
    }
    # Get notificatoin_type (e.g. "project_comment") from the notification type id (e.g. 2). These can be found in the Notification model
    notification_type = [
        v
        for i, v in enumerate(Notification.NOTIFICATION_TYPES)
        if v[0] == notification_type_id
    ][0][1]
    type_props = properties_by_type[notification_type]
    comment_serializer = type_props["serializer"](comment)
    type_props["send_email_function"](
        user,
        object_commented_on,
        comment_serializer.data["content"],
        sender,
        notification,
        hub_url=hub_url,
    )


def get_following_user(user):
    follower_user = UserProfile.objects.filter(user=user)
    serializer = UserProfileStubSerializer(follower_user[0])
    return serializer.data


def get_organization_info(organization):
    serializer = OrganizationNotificationSerializer(organization)
    return serializer.data


def get_project_info(project):
    serializer = ProjectNotificationSerializer(project)
    return serializer.data


def get_notification_values(notif_type_number):
    if notif_type_number == Notification.PROJECT_FOLLOWER:
        return {
            "look_up_follower_type_field_name": "project_follower",
            "look_up_entitiy_type_field_name": "project",
            "member_type_model": ProjectMember,
        }
    if notif_type_number == Notification.ORGANIZATION_FOLLOWER:
        return {
            "look_up_follower_type_field_name": "organization_follower",
            "look_up_entitiy_type_field_name": "organization",
            "member_type_model": OrganizationMember,
        }
