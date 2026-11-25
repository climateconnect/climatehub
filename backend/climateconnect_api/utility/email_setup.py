import json
import logging
from datetime import datetime, timedelta
from typing import List

from django.contrib.auth.models import User
from climateconnect_api.models import UserNotification, UserProfile
from climateconnect_api.models.notification import EmailNotification
from hubs.models import Hub
from climateconnect_api.utility.translation import get_user_lang_code, get_user_lang_url
from django.conf import settings
from mailjet_rest import Client
from user_agents import parse as parse_user_agent

logger = logging.getLogger(__name__)


class _ConsoleResponse:
    """The parts of a Mailjet API response that our code reads."""

    text = ""

    def __init__(self, status_code):
        self.status_code = status_code

    def json(self):
        return {"Data": [{"ID": 0}]}


class _ConsoleEndpoint:
    def __init__(self, name):
        self.name = name

    def get(self, id=None, **kwargs):
        return self._print("GET", id, None, 200)

    def create(self, data=None, id=None, **kwargs):
        # Mailjet answers 201 Created, except the Send API, which answers 200.
        return self._print("POST", id, data, 200 if self.name == "send" else 201)

    def _print(self, method, id, data, status_code):
        data = json.loads(json.dumps(data, default=str))
        for message in (data or {}).get("Messages", []):
            for attachment in message.get("Attachments", []):
                attachment["Base64Content"] = "<omitted>"
        print(f"[Mailjet console] {method} {self.name} {id or ''}".rstrip())
        if data:
            print(json.dumps(data, indent=2, ensure_ascii=False))
        return _ConsoleResponse(status_code)


class ConsoleMailjetClient:
    """
    Stand-in for mailjet_rest.Client when no Mailjet API keys are configured,
    e.g. in local development: prints every API call (including the emails'
    template variables, such as activation links) instead of sending it.
    """

    def __getattr__(self, name):
        return _ConsoleEndpoint(name)


def _mailjet_client(**kwargs):
    if settings.MJ_APIKEY_PUBLIC and settings.MJ_APIKEY_PRIVATE:
        return Client(
            auth=(settings.MJ_APIKEY_PUBLIC, settings.MJ_APIKEY_PRIVATE), **kwargs
        )
    # mailjet-rest rejects empty credentials when the client is created.
    logger.warning(
        "MJ_APIKEY_PUBLIC/MJ_APIKEY_PRIVATE not set: Mailjet API calls are printed "
        "to the console instead of being sent"
    )
    return ConsoleMailjetClient()


mailjet_send_api = _mailjet_client(version="v3.1")
mailjet_api = _mailjet_client()


def get_formatted_user_agent_info(user_agent_string):
    """
    Parse user agent string and return formatted browser and OS information.

    Args:
        user_agent_string: Raw user agent string from HTTP headers

    Returns:
        Dictionary with formatted browser and OS info, or None if parsing fails
    """
    if not user_agent_string:
        return None

    try:
        user_agent = parse_user_agent(user_agent_string)

        # Build browser info
        browser_name = user_agent.browser.family
        browser_version = user_agent.browser.version_string
        browser_info = (
            f"{browser_name} {browser_version}" if browser_version else browser_name
        )

        # Build OS info
        os_name = user_agent.os.family
        os_version = user_agent.os.version_string
        os_info = f"{os_name} {os_version}" if os_version else os_name

        # Build device info
        device_info = None
        if user_agent.is_mobile:
            device_type = "Mobile"
            if user_agent.device.family and user_agent.device.family != "Other":
                device_info = f"{device_type} - {user_agent.device.family}"
            else:
                device_info = device_type
        elif user_agent.is_tablet:
            device_type = "Tablet"
            if user_agent.device.family and user_agent.device.family != "Other":
                device_info = f"{device_type} - {user_agent.device.family}"
            else:
                device_info = device_type
        elif user_agent.is_pc:
            device_info = "Desktop"
        elif user_agent.is_bot:
            device_info = "Bot"

        return {
            "browser": browser_info,
            "os": os_info,
            "device": device_info,
            "raw": user_agent_string,
        }
    except Exception as e:
        logger.warning(f"Failed to parse user agent: {e}")
        return None


def get_template_id(template_key, lang_code):
    if not lang_code == "en":
        return getattr(settings, template_key + "_" + lang_code.upper())
    else:
        return getattr(settings, template_key)


def check_send_email_notification(user):
    three_hours_ago = datetime.now() - timedelta(hours=3)
    recent_email_notification = EmailNotification.objects.filter(
        user=user, created_at__gte=three_hours_ago
    )
    return not recent_email_notification.exists()


FROM_NAMES_BY_LANGUAGE = {
    "en": "ClimateHub Network",
    "de": "ClimateHub Netzwerk",
}


def get_email_data(hub_url, lang_code="en"):
    from_name = FROM_NAMES_BY_LANGUAGE.get(lang_code, FROM_NAMES_BY_LANGUAGE["en"])
    email_data = {
        "from_email": settings.CLIMATE_CONNECT_SUPPORT_EMAIL,
        "from_name": from_name,
    }
    if hub_url:
        try:
            hub = Hub.objects.get(url_slug=hub_url)
        except Hub.DoesNotExist:
            return email_data
        if hub.from_email:
            email_data["from_email"] = hub.from_email
        if hub.email_sender_name:
            email_data["from_name"] = hub.email_sender_name
    return email_data


def send_email(
    user,
    variables,
    template_key,
    subjects_by_language,
    should_send_email_setting,
    notification,
    hub_url=None,
    attachments=None,
):
    # if not check_send_email_notification(user):
    #    return
    if should_send_email_setting:
        try:
            user_profile = UserProfile.objects.get(user=user)
            # short circuit if the user has changed his settings to not
            # receive emails on this topic
            if not getattr(user_profile, should_send_email_setting):
                return
        except UserProfile.DoesNotExist:
            print("there is no user profile (send_email)")
    lang_code = get_user_lang_code(user)
    subject = subjects_by_language[lang_code]
    template_id = get_template_id(template_key=template_key, lang_code=lang_code)

    email_data = get_email_data(hub_url, lang_code=lang_code)
    data = {
        "Messages": [
            {
                "From": {
                    "Email": email_data[
                        "from_email"
                    ],  # from_email if from_email else settings.CLIMATE_CONNECT_SUPPORT_EMAIL,
                    "Name": email_data[
                        "from_name"
                    ],  # from_name if from_name else "ClimateHub Network",
                },
                "To": [
                    {
                        "Email": user.email,
                        "Name": user.first_name + " " + user.last_name,
                    }
                ],
                "TemplateID": int(template_id),
                "TemplateLanguage": True,
                "Variables": variables,
                "Subject": subject,
                "TemplateErrorReporting": {
                    "Email": "harald.walker@climateconnect.earth",
                    "Name": "Harald Walker",
                },
            }
        ]
    }

    if attachments:
        data["Messages"][0]["Attachments"] = attachments

    try:
        mail = mailjet_send_api.send.create(data=data)

        if notification:
            EmailNotification.objects.create(
                user=user, created_at=datetime.now(), notification=notification
            )

        return mail
    except Exception as ex:
        logger.error("%s: Error sending email: %s" % (send_email.__name__, ex))


def get_user_verification_url(verification_key, lang_url, hub=None):
    # TODO: Set expire time for user verification
    verification_key_str = str(verification_key).replace("-", "%2D")
    url = "%s%s/activate/%s" % (settings.FRONTEND_URL, lang_url, verification_key_str)
    if hub:
        url += f"?hub={hub}"

    return url


def get_new_email_verification_url(verification_key, lang_url):
    # TODO: Set expire time for new email verification
    verification_key_str = str(verification_key).replace("-", "%2D")
    url = "%s%s/activate_email/%s" % (
        settings.FRONTEND_URL,
        lang_url,
        verification_key_str,
    )

    return url


def get_reset_password_url(verification_key, lang_url, hub_url=None):
    # TODO: Set expire time for new email verification
    verification_key_str = str(verification_key).replace("-", "%2D")
    url = "%s%s/reset_password/%s%s" % (
        settings.FRONTEND_URL,
        lang_url,
        verification_key_str,
        f"?hub={hub_url}" if hub_url else "",
    )

    return url


def send_user_verification_email(user, verification_key, hub_url=None):
    lang_url = get_user_lang_url(get_user_lang_code(user))
    url = get_user_verification_url(verification_key, lang_url, hub_url)

    subjects_by_language = {
        "en": "Welcome to the ClimateHub Network! Verify your email address",
        "de": "Willkommen beim ClimateHub Netzwerk! Verifiziere deine E-Mail-Adresse!",
    }

    variables = {"FirstName": user.first_name, "url": url}
    send_email(
        user=user,
        variables=variables,
        template_key="EMAIL_VERIFICATION_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
        hub_url=hub_url,
    )


def send_new_email_verification(user, new_email, verification_key):
    lang_url = get_user_lang_url(get_user_lang_code(user))
    url = get_new_email_verification_url(verification_key, lang_url)

    subjects_by_language = {
        "en": "Verify your new email address",
        "de": "Bestätige deine neue E-Mail Adresse",
    }

    variables = {"FirstName": user.first_name, "url": url, "NewMail": new_email}
    send_email(
        user=user,
        variables=variables,
        template_key="NEW_EMAIL_VERIFICATION_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
    )


def send_password_link(user, password_reset_key, hub_url=None):
    lang_url = get_user_lang_url(get_user_lang_code(user))
    url = get_reset_password_url(password_reset_key, lang_url, hub_url)

    subjects_by_language = {
        "en": "Reset your password",
        "de": "Setze dein Passwort zurück",
    }

    variables = {"FirstName": user.first_name, "url": url}
    send_email(
        user=user,
        variables=variables,
        template_key="RESET_PASSWORD_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
        hub_url=hub_url,
    )


def send_feedback_email(email, message, send_response, user_agent=None, path=None):
    # Parse user agent to get readable browser and OS info
    user_agent_info = get_formatted_user_agent_info(user_agent) if user_agent else None

    # Build template variables with parsed info
    variables = {
        "text": str(message),
        "sendReply": str(send_response),
        "email": str(email if email else ""),
        "path": str(path if path else ""),
    }

    # Add parsed user agent info if available
    if user_agent_info:
        variables["browser"] = user_agent_info["browser"]
        variables["os"] = user_agent_info["os"]
        variables["device"] = user_agent_info["device"] or ""
        variables["userAgent"] = user_agent_info["raw"]  # Keep raw for debugging
    else:
        variables["userAgent"] = str(user_agent if user_agent else "")

    data = {
        "Messages": [
            {
                "From": {
                    "Email": settings.CLIMATE_CONNECT_SUPPORT_EMAIL,
                    "Name": "ClimateHub Network",
                },
                "To": [
                    {
                        "Email": "feedback@climatehub.org",
                        "Name": "ClimateHub Network",
                    }
                ],
                "TemplateID": int(settings.FEEDBACK_TEMPLATE_ID),
                "TemplateLanguage": True,
                "Subject": "ClimateHub Network User Feedback",
                "Variables": variables,
            }
        ]
    }

    try:
        mailjet_send_api.send.create(data=data)
    except Exception as ex:
        print(
            "%s: Error sending email: %s" % (send_user_verification_email.__name__, ex)
        )


def register_newsletter_contact(email_address):
    old_contact = mailjet_api.contact.get(email_address)
    if old_contact.status_code == 404:
        contact_id = create_contact(email_address)
    if old_contact.status_code == 200:
        result = old_contact.json()
        contact_id = result["Data"][0]["ID"]
    add_contact_to_list(contact_id, settings.MAILJET_NEWSLETTER_LIST_ID)


def create_contact(email_address):
    data = {"IsExcludedFromCampaigns": "true", "Email": email_address}
    new_contact = mailjet_api.contact.create(data=data)
    result = new_contact.json()
    return result["Data"][0]["ID"]


def add_contact_to_list(contact_id, list_id):
    data = {"ContactID": contact_id, "ListID": list_id}
    result = mailjet_api.listrecipient.create(data=data)
    if not result.status_code == 201:
        logger.error(result.status_code)
        logger.error(
            "Could not add contact " + str(contact_id) + " to list " + str(list_id)
        )
    return True


def unregister_newsletter_contact(email_address):
    contact = mailjet_api.contact.get(email_address)
    if contact.status_code == 200:
        result = contact.json()
        contact_id = result["Data"][0]["ID"]
        remove_contact_from_list(contact_id, settings.MAILJET_NEWSLETTER_LIST_ID)
    else:
        logging.error(contact.status_code)


def remove_contact_from_list(contact_id, list_id):
    data = {"ContactsLists": [{"Action": "remove", "ListID": list_id}]}
    mailjet_api.contact_managecontactslists.create(id=contact_id, data=data)


# sends an email to our own engineering email for testing purposes
def send_test_mail_to_engineering_email(subject, text_body):
    data = {
        "Messages": [
            {
                "From": {
                    "Email": settings.CLIMATE_CONNECT_SUPPORT_EMAIL,
                    "Name": "ClimateHub",
                },
                "To": [
                    {
                        "Email": "engineering@climatehub.org",
                        "Name": f"Engineering",
                    }
                ],
                "Subject": subject,
                "HTMLPart": text_body,
            }
        ]
    }

    try:
        mail = mailjet_send_api.send.create(data=data)
    except Exception as ex:
        logger.error(f"EmailFailure: Exception sending email -> {ex}")

    if mail.status_code != 200:
        logger.error(f"EmailFailure: Error sending email -> {mail.text}")


def send_email_reminder_for_unread_notifications(
    user: User, user_notifications: List[UserNotification]
):
    total_notifications = user_notifications.count()
    language_code = get_user_lang_code(user=user)
    subject_by_language = {
        "en": f"You have {total_notifications} unread {'messages' if total_notifications > 1 else 'message'}",
        "de": f"Du hast {total_notifications} ungelesene {'Nachrichten' if total_notifications > 1 else 'Nachricht'}",
    }
    subject = subject_by_language.get(language_code, "en")
    website_link_by_language = {
        "en": "https://climatehub.org/inbox",
        "de": "https://climatehub.org/de/inbox",
    }
    website_link = website_link_by_language.get(language_code, "en")
    email_text_by_language = {
        "en": f"<p>Dear {user.first_name},</p><p>You have {total_notifications} unread {'messages' if total_notifications > 1 else 'message'} from other climate protectors. Please respond to the people who reached out. <br />We can only effectively fight the climate crisis if we work together and exchange knowledge.</p> <p><b><a href={website_link}>Click here</a> to check your inbox.</b></p><p>See you soon,</p><p>your team of the ClimateHub Network</p>",  # NOQA
        "de": f"<p>Hallo {user.first_name},</p><p>Du hast {total_notifications} ungelesene {'Nachrichten' if total_notifications > 1 else 'Nachricht'} von anderen Klimaschützer*innen. Bitte beantworte die Nachrichten.<br />Nur gemeinsam und durch Zusammenarbeit und Wissensaustausch können wir das 1,5 Grad Ziel erreichen.</p><p><b><a href={website_link}>Klicke hier</a>, um deinen Posteingang anzusehen.</b></p><p>Bis bald,</p><p>Dein Team vom ClimateHub Netzwerk</p>",  # NOQA
    }
    email_text = email_text_by_language.get(language_code, "en")
    from_name = FROM_NAMES_BY_LANGUAGE.get(language_code, FROM_NAMES_BY_LANGUAGE["en"])
    data = {
        "Messages": [
            {
                "From": {
                    "Email": settings.CLIMATE_CONNECT_SUPPORT_EMAIL,
                    "Name": from_name,
                },
                "To": [
                    {"Email": user.email, "Name": f"{user.first_name} {user.last_name}"}
                ],
                "Subject": subject,
                "HTMLPart": email_text,
            }
        ]
    }

    try:
        mail = mailjet_send_api.send.create(data=data)
    except Exception as ex:
        logger.error(f"EmailFailure: Exception sending email -> {ex}")

    if mail.status_code != 200:
        logger.error(f"EmailFailure: Error sending email -> {mail.text}")
