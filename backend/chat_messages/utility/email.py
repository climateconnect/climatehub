import logging

from climateconnect_api.utility.email_setup import send_email
from climateconnect_api.utility.translation import get_user_lang_code, get_user_lang_url
from django.conf import settings
from mailjet_rest import Client

logger = logging.getLogger(__name__)

mailjet = Client(
    auth=(settings.MJ_APIKEY_PUBLIC, settings.MJ_APIKEY_PRIVATE), version="v3.1"
)


def send_private_chat_message_notification_email(
    user, message_content, chat_uuid, sender_name, notification
):
    lang_url = get_user_lang_url(get_user_lang_code(user))
    chat_url = settings.FRONTEND_URL + lang_url + "/chat/" + str(chat_uuid)

    subjects_by_language = {
        "en": "You received a private message from {}".format(sender_name),
        "de": "Du hast eine Privatnachricht von {} bekommen".format(sender_name),
    }

    message_preview = message_content
    if len(message_content) > 50:
        message_preview = message_content[0:50] + "..."

    variables = {
        "FirstName": user.first_name,
        "SenderName": sender_name,
        "Message": message_preview,
        "url": chat_url,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="PRIVATE_MESSAGE_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_private_chat_message",
        notification=notification,
    )


def send_group_chat_message_notification_email(
    user, message_content, chat_uuid, sender_name, chat_title, notification
):
    lang_url = get_user_lang_url(get_user_lang_code(user))
    chat_url = settings.FRONTEND_URL + lang_url + "/chat/" + str(chat_uuid)

    subjects_by_language = {
        "en": "{} sent a message in the group '{}'".format(sender_name, chat_title),
        "de": "{} hat eine Nachricht in der Gruppe '{}' geschrieben".format(
            sender_name, chat_title
        ),
    }

    message_preview = message_content
    if len(message_content) > 50:
        message_preview = message_content[0:50] + "..."

    variables = {
        "FirstName": user.first_name,
        "SenderName": sender_name,
        "GroupName": chat_title,
        "Message": message_preview,
        "url": chat_url,
    }

    send_email(
        user=user,
        variables=variables,
        template_key="GROUP_MESSAGE_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_group_chat_message",
        notification=notification,
    )
