import base64
import html as html_module
import logging
import re

from icalendar import Calendar, Event as IcalEvent

from organization.utility.project import get_project_name
from organization.utility.organization import get_organization_name
from location.utility import get_translated_location_name

from climateconnect_api.utility.email_setup import send_email
from climateconnect_api.utility.translation import get_user_lang_code, get_user_lang_url
from climateconnect_api.utility.timezone_utils import (
    format_datetime_localized,
    get_event_display_timezone,
)
from django.conf import settings
from mailjet_rest import Client

logger = logging.getLogger(__name__)

mailjet = Client(
    auth=(settings.MJ_APIKEY_PUBLIC, settings.MJ_APIKEY_PRIVATE), version="v3.1"
)


def linkify_mentions(content):
    pattern = re.compile(
        r"(@@@__(?P<url_slug>[^\^]*)\^\^__(?P<display>[^\@]*)@@@\^\^\^)"
    )
    matches = re.findall(pattern, content)

    for m in matches:
        whole, _, display = m[0], m[1], m[2]
        content = content.replace(whole, "@" + display)
    return content


def send_project_comment_reply_email(
    user, project, comment, sender, notification, hub_url=None
):
    lang_code = get_user_lang_code(user)
    subjects_by_language = {
        "en": "Someone replied to your comment",
        "de": "Jemand hat auf deinen Kommentar geantwortet",
    }
    base_url = settings.FRONTEND_URL
    hub_query = ("?hub=" + hub_url) if hub_url else ""
    url_ending = "/projects/" + project.url_slug + hub_query + "#comments"
    variables = {
        "FirstName": user.first_name,
        "CommenterName": sender.first_name + " " + sender.last_name,
        "CommentText": linkify_mentions(comment),
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
        "ProjectName": project.name,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="PROJECT_COMMENT_REPLY_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_reply_to_your_comment",
        notification=notification,
        hub_url=hub_url,
    )


def send_project_comment_email(
    user, project, comment, sender, notification, hub_url=None
):
    lang_code = get_user_lang_code(user)
    subjects_by_language = {
        "en": "Somebody left a comment on your project {}".format(project.name),
        "de": "Jemand hat dein Projekt {} kommentiert".format(project.name),
    }
    base_url = settings.FRONTEND_URL
    hub_query = ("?hub=" + hub_url) if hub_url else ""
    url_ending = "/projects/" + project.url_slug + hub_query + "#comments"
    variables = {
        "ProjectName": project.name,
        "CommentText": linkify_mentions(comment),
        "FirstName": user.first_name,
        "CommenterName": sender.first_name + " " + sender.last_name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="PROJECT_COMMENT_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_comment_on_your_project",
        notification=notification,
        hub_url=hub_url,
    )


def send_idea_comment_email(user, idea, comment, sender, notification, hub_url=None):
    lang_code = get_user_lang_code(user)
    subjects_by_language = {
        "en": "Somebody left a comment on your idea '{}'".format(idea.name),
        "de": "Jemand hat einen Kommentar zu deiner Idee '{}' auf hinterlassen.".format(
            idea.name
        ),
    }
    base_url = settings.FRONTEND_URL
    url_ending = (
        "/hubs/" + idea.hub_shared_in.url_slug + "?idea=" + idea.url_slug + "#ideas"
    )

    variables = {
        "IdeaName": idea.name,
        "CommentText": linkify_mentions(comment),
        "FirstName": user.first_name,
        "CommenterName": sender.first_name + " " + sender.last_name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="IDEA_COMMENT_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_comment_on_your_idea",
        notification=notification,
    )


# @entity_type: either "project" or "idea"
# @entity: the idea or project object (depending on entity_type)
def send_mention_email(
    user, entity_type, entity, comment, sender, notification, hub_url=None
):
    lang_code = get_user_lang_code(user)
    subjects_by_language = {
        "en": "Somebody mentioned you in a comment",
        "de": "Jemand hat dich in einem Kommentar erwähnt",
    }

    base_url = settings.FRONTEND_URL
    variables = {
        "CommentText": linkify_mentions(comment),
        "FirstName": user.first_name,
        "CommenterName": sender.first_name + " " + sender.last_name,
    }
    if entity_type == "project":
        variables["ProjectName"] = entity.name
        hub_query = ("?hub=" + hub_url) if hub_url else ""
        url_ending = "/projects/" + entity.url_slug + hub_query + "#comments"
        template_key = "PROJECT_MENTION_TEMPLATE_ID"
    if entity_type == "idea":
        variables["IdeaName"] = entity.name
        url_ending = (
            "/hubs/"
            + entity.hub_shared_in.url_slug
            + "?idea="
            + entity.url_slug
            + "#ideas"
        )
        template_key = "IDEA_MENTION_TEMPLATE_ID"
    variables["url"] = base_url + get_user_lang_url(lang_code) + url_ending

    send_email(
        user=user,
        variables=variables,
        template_key=template_key,
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_mention",
        notification=notification,
        hub_url=hub_url,
    )


def send_idea_comment_reply_email(
    user, idea, comment, sender, notification, hub_url=None
):
    lang_code = get_user_lang_code(user)
    subjects_by_language = {
        "en": "Someone replied to your comment",
        "de": "Jemand hat auf deinen Kommentar geantwortet.",
    }

    base_url = settings.FRONTEND_URL
    url_ending = (
        "/hubs/" + idea.hub_shared_in.url_slug + "?idea=" + idea.url_slug + "#ideas"
    )

    variables = {
        "FirstName": user.first_name,
        "CommenterName": sender.first_name + " " + sender.last_name,
        "CommentText": linkify_mentions(comment),
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
        "IdeaName": idea.name,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="IDEA_COMMENT_REPLY_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_reply_to_your_comment",
        notification=notification,
    )


def send_project_follower_email(user, project_follower, notification, hub_url=None):
    lang_code = get_user_lang_code(user)
    follower_name = (
        project_follower.user.first_name + " " + project_follower.user.last_name
    )
    subjects_by_language = {
        "en": "{} now follows your project".format(follower_name),
        "de": "{} folgt jetzt deinem Projekt".format(follower_name),
    }

    base_url = settings.FRONTEND_URL
    url_ending = (
        "/projects/" + project_follower.project.url_slug + "?show_followers=true"
    )
    if hub_url:
        url_ending = url_ending + "&hub=" + hub_url

    variables = {
        "FollowerName": follower_name,
        "FirstName": user.first_name,
        "ProjectName": project_follower.project.name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="PROJECT_FOLLOWER_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_new_project_follower",
        notification=notification,
        hub_url=hub_url,
    )


def send_organization_follower_email(
    user, organization_follower, notification, hub_url=None
):
    lang_code = get_user_lang_code(user)

    organization_name = get_organization_name(
        organization_follower.organization, lang_code
    )

    following_user_full_name = (
        organization_follower.user.first_name
        + " "
        + organization_follower.user.last_name
    )

    subjects_by_language = {
        "en": "{} now follows {}".format(following_user_full_name, organization_name),
        "de": "{} folgt jetzt {}".format(following_user_full_name, organization_name),
    }

    base_url = settings.FRONTEND_URL
    url_ending = (
        "/organizations/"
        + organization_follower.organization.url_slug
        + "?show_followers=true"
    )

    if hub_url:
        url_ending = url_ending + "&hub=" + hub_url

    variables = {
        "RecipientFirstName": user.first_name,
        "FollowingUserFullName": following_user_full_name,
        "OrganizationName": organization_name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="ORGANIZATION_FOLLOWER_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_new_organization_follower",
        notification=notification,
        hub_url=hub_url,
    )


def send_org_project_published_email(
    user, org_project_published, notification, hub_url=None
):
    lang_code = get_user_lang_code(user)

    organization_name = get_organization_name(
        org_project_published.organization, lang_code
    )
    project_name = get_project_name(org_project_published.project, lang_code)

    subjects_by_language = {
        "en": "New climate project from {}: {}".format(organization_name, project_name),
        "de": "Neues Klimaprojekt von {} : {}".format(organization_name, project_name),
    }

    base_url = settings.FRONTEND_URL
    url_ending = "/projects/" + org_project_published.project.url_slug
    if hub_url:
        url_ending = url_ending + "?hub=" + hub_url

    variables = {
        "FirstName": user.first_name,
        "OrganizationName": organization_name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
        "ProjectName": project_name,
    }

    send_email(
        user=user,
        variables=variables,
        template_key="ORG_PUBLISHED_NEW_PROJECT_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_new_project_from_followed_org",
        notification=notification,
        hub_url=hub_url,
    )


def send_project_like_email(user, project_like, notification, hub_url=None):
    lang_code = get_user_lang_code(user)
    liking_user_name = project_like.user.first_name + " " + project_like.user.last_name
    subjects_by_language = {
        "en": "{} liked your project".format(liking_user_name),
        "de": "{} gefällt dein Projekt".format(liking_user_name),
    }

    base_url = settings.FRONTEND_URL
    url_ending = "/projects/" + project_like.project.url_slug + "?show_likes=true"
    if hub_url:
        url_ending = url_ending + "&hub=" + hub_url

    variables = {
        "LikingUserName": liking_user_name,
        "FirstName": user.first_name,
        "ProjectName": project_like.project.name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="PROJECT_LIKE_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_new_project_like",
        notification=notification,
        hub_url=hub_url,
    )


def send_join_project_request_email(user, request, requester, notification, hub_url):
    lang_code = get_user_lang_code(user)
    requester_name = requester.first_name + " " + requester.last_name
    subjects_by_language = {
        "en": "{} requested to join your project".format(requester_name),
        "de": "{} möchte bei deinem Project mitmachen".format(requester_name),
    }

    base_url = settings.FRONTEND_URL
    url_ending = (
        "/projects/" + request.target_project.url_slug + "?show_join_requests=true"
    )
    if hub_url:
        url_ending = url_ending + "&hub=" + hub_url

    variables = {
        "RequesterName": requester_name,
        "FirstName": user.first_name,
        "ProjectName": request.target_project.name,
        "url": base_url + get_user_lang_url(lang_code) + url_ending,
    }
    send_email(
        user=user,
        variables=variables,
        template_key="PROJECT_JOIN_REQUEST_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="email_on_join_request",
        notification=notification,
        hub_url=hub_url,
    )


def get_organiser_name(project, lang_code: str) -> str:
    """
    Return the display name of the project organiser in the requested language.

    Resolution order:
      1. Organisation name (localised via ``get_organization_name``) if the owner
         is an organisation.
      2. ``UserProfile.name`` (full name) if a user owner has a profile.
         User names are not translatable, so lang_code has no effect here.
      3. ``User.username`` as a final fallback.
      4. Empty string when no owner row exists.
    """
    project_parent = project.project_parent.first()
    if not project_parent:
        return ""
    if project_parent.parent_organization:
        return get_organization_name(project_parent.parent_organization, lang_code)
    if project_parent.parent_user:
        try:
            profile_name = project_parent.parent_user.user_profile.name
            return profile_name if profile_name else project_parent.parent_user.username
        except AttributeError:
            return project_parent.parent_user.username
    return ""


def get_location_name(project, lang_code=None) -> str:
    """
    Return a human-readable location string for an event.

    Returns ``"Online"`` for online events, the translated location name when
    a location row exists and *lang_code* is provided, or ``Location.name`` as
    a fallback.  Returns an empty string when neither applies.

    Expects ``location.translate_location__language`` to be pre-fetched (via
    ``prefetch_related("loc__translate_location__language")``) to avoid N+1
    queries when *lang_code* is passed.
    """
    if project.is_online:
        return "Online"
    if project.loc:
        if lang_code:
            return get_translated_location_name(project.loc, lang_code)
        return project.loc.name
    return ""


def send_organizer_message_to_guest(user, project, subject: str, message: str):
    """
    Send an organiser-composed plain-text message to a single event guest.

    Delegates to ``send_email()`` using the ``EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID``
    Mailjet template (EN) or ``EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID_DE`` (DE),
    selected automatically based on the recipient's language preference.

    **Mailjet template variables**:
        - ``FirstName``         — recipient's first name (falls back to username)
        - ``EventTitle``        — event name localised to recipient's language
        - ``EventUrl``          — language-aware link to the event page
        - ``OrganiserName``     — localised organisation name, or organiser's name
        - ``OrganizerSubject``  — the subject entered by the organiser
        - ``OrganizerMessage``  — the plain-text body entered by the organiser

    The email envelope subject is set directly to the organiser's ``subject``
    — no wrapping platform prefix is applied.

    **Required env variables**:
        ``EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID``    — Mailjet template ID (EN)
        ``EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID_DE`` — Mailjet template ID (DE)

    Args:
        user:    Django ``User`` instance.  Fetch with
                 ``select_related("user_profile__location")`` to avoid N+1.
        project: ``Project`` instance.  Fetch with
                 ``select_related("loc", "language")`` and the organiser/
                 translation prefetch chain (same as the confirmation email).
        subject: Organiser-provided subject string.
        message: Organiser-provided plain-text body.
    """
    lang_code = get_user_lang_code(user)

    variables = {
        "FirstName": user.first_name or user.username,
        "EventTitle": get_project_name(project, lang_code),
        "EventUrl": (
            settings.FRONTEND_URL
            + get_user_lang_url(lang_code)
            + "/projects/"
            + project.url_slug
        ),
        "OrganiserName": get_organiser_name(project, lang_code),
        "OrganizerSubject": subject,
        "OrganizerMessage": message,
    }

    # The envelope subject is the organiser-provided subject directly.
    subjects_by_language = {"en": subject, "de": subject}

    send_email(
        user=user,
        variables=variables,
        template_key="EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
    )


def send_guest_cancellation_notification(user, project, admin_message: str):
    """
    Send a cancellation notification email to a guest whose registration was
    cancelled by an event organiser or team admin.

    Called synchronously from ``AdminCancelRegistrationView`` — single recipient,
    no Celery task needed.  Mirrors the ``send_organizer_message_to_guest`` pattern.

    **Mailjet template variables**:
        - ``FirstName``       — recipient's first name (falls back to username)
        - ``EventTitle``      — event name localised to recipient's language
        - ``EventUrl``        — language-aware link to the event page
        - ``OrganiserName``   — localised organisation name or organiser's display name
        - ``OrganizerMessage`` — the plain-text message body provided by the admin

    The email envelope subject is auto-generated in the recipient's language
    (e.g. "Your registration for [Event Name] has been cancelled") — it is never
    organiser-authored.

    **Required env variables** (configured in ``climateconnect_main/settings.py``):
        ``ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID``    — Mailjet template ID (EN)
        ``ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID_DE`` — Mailjet template ID (DE)

    Args:
        user:          Django ``User`` instance.  Fetch with
                       ``select_related("user_profile__location")`` to avoid N+1.
        project:       ``Project`` instance.  Fetch with
                       ``select_related("loc", "language")`` and the organiser/
                       translation prefetch chain (same as the confirmation email).
        admin_message: Admin-provided plain-text message body.
    """
    lang_code = get_user_lang_code(user)
    event_title = get_project_name(project, lang_code)

    subjects_by_language = {
        "en": f"Your registration for {get_project_name(project, 'en')} has been cancelled",
        "de": f"Deine Anmeldung für {get_project_name(project, 'de')} wurde storniert",
    }

    variables = {
        "FirstName": user.first_name or user.username,
        "EventTitle": event_title,
        "EventUrl": (
            settings.FRONTEND_URL
            + get_user_lang_url(lang_code)
            + "/projects/"
            + project.url_slug
        ),
        "OrganiserName": get_organiser_name(project, lang_code),
        "OrganizerMessage": admin_message,
    }

    send_email(
        user=user,
        variables=variables,
        template_key="ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
    )


_DE_DAYS = {
    "Mon": "Mo",
    "Tue": "Di",
    "Wed": "Mi",
    "Thu": "Do",
    "Fri": "Fr",
    "Sat": "Sa",
    "Sun": "So",
}
_DE_MONTHS_SHORT = {
    1: "Jan",
    2: "Feb",
    3: "Mär",
    4: "Apr",
    5: "Mai",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Okt",
    11: "Nov",
    12: "Dez",
}


def _format_time_range_localized(start, end, lang_code, tz):
    """
    Format a start/end datetime pair as a localised time-range string.

    Both datetimes are converted to ``tz`` before formatting so that
    timezone-aware output is produced regardless of the stored timezone.

    English: "Mon, Jan 1, 10:00 – 12:00 (CET)"
    German:  "Mo, 1. Jan, 10:00 – 12:00 Uhr (MEZ)"
    """
    from climateconnect_api.utility.timezone_utils import _DE_TZ_ABBREVS

    start = start.astimezone(tz)
    end = end.astimezone(tz)
    start_day_en = start.strftime("%a")
    start_month = start.month
    start_day_num = start.day
    start_time = start.strftime("%H:%M")
    end_time = end.strftime("%H:%M")
    tz_abbrev = start.strftime("%Z")

    if lang_code == "de":
        de_abbrev = _DE_TZ_ABBREVS.get(tz_abbrev, tz_abbrev)
        day_str = _DE_DAYS.get(start_day_en, start_day_en)
        month_str = _DE_MONTHS_SHORT.get(start_month, start.strftime("%b"))
        return f"{day_str}, {start_day_num}. {month_str}, {start_time} – {end_time} Uhr ({de_abbrev})"

    month_str = start.strftime("%b")
    return f"{start_day_en}, {month_str} {start_day_num}, {start_time} – {end_time} ({tz_abbrev})"


_FIELD_CELL_STYLE = (
    "padding: 4px 0px 8px; color: #55575d; vertical-align: top; width: 50%"
)


def _build_field_answers_html(registration, lang_code, tz):
    """
    Build an HTML snippet of the guest's registration field answers for the
    confirmation email.

    Returns an HTML string with a styled table of answers, or an empty string
    if no answers have non-null values.

    Args:
        registration: EventRegistration instance with prefetched field_answers,
            field, value_option, and field.options.
        lang_code: User's language code ("en" or "de").
        tz: The :class:`~zoneinfo.ZoneInfo` timezone to display times in.

    Returns:
        str: HTML snippet or empty string.
    """
    from organization.models.registration_field import RegistrationFieldType

    answers_by_field = {}
    for answer in registration.field_answers.all():
        # Skip answers with no value
        if (
            answer.value_boolean is None
            and answer.value_option is None
            and answer.value_number is None
            and answer.value_text is None
        ):
            continue
        # For checkboxes, only include checked ones
        if answer.field.field_type == RegistrationFieldType.CHECKBOX:
            if answer.value_boolean is not True:
                continue
        answers_by_field[answer.field] = answer

    if not answers_by_field:
        return ""

    # Sort by field order
    sorted_fields = sorted(answers_by_field.keys(), key=lambda f: f.order)

    heading = (
        "Your registration answers:" if lang_code == "en" else "Deine Anmeldeantworten:"
    )

    rows = []
    for field in sorted_fields:
        answer = answers_by_field[field]
        field_type = field.field_type

        if field_type == RegistrationFieldType.CHECKBOX:
            description = (field.settings or {}).get("description", "")
            # Strip HTML tags for plain text
            plain_desc = re.sub(r"<[^>]+>", "", description).strip()
            rows.append(
                f'<tr><td style="{_FIELD_CELL_STYLE}">{html_module.escape(plain_desc)}</td>'
                f'<td style="{_FIELD_CELL_STYLE}">✓</td></tr>'
            )

        elif field_type == RegistrationFieldType.OPTION_SELECT:
            field_title = (field.settings or {}).get("title", "")
            option = answer.value_option
            answer_text = option.title if option else ""
            rows.append(
                f'<tr><td style="{_FIELD_CELL_STYLE}">{html_module.escape(field_title)}</td>'
                f'<td style="{_FIELD_CELL_STYLE}">{html_module.escape(answer_text)}</td></tr>'
            )

        elif field_type == RegistrationFieldType.INVENTORY:
            field_title = (field.settings or {}).get("title", "")
            option = answer.value_option
            option_title = option.title if option else ""
            quantity = answer.value_number or 0
            answer_text = f"{option_title} × {quantity}"
            rows.append(
                f'<tr><td style="{_FIELD_CELL_STYLE}">{html_module.escape(field_title)}</td>'
                f'<td style="{_FIELD_CELL_STYLE}">{html_module.escape(answer_text)}</td></tr>'
            )

        elif field_type == RegistrationFieldType.TIME_SLOT_SELECT:
            field_title = (field.settings or {}).get("title", "")
            option = answer.value_option
            if option and option.start_time and option.end_time:
                answer_text = _format_time_range_localized(
                    option.start_time, option.end_time, lang_code, tz
                )
            elif option:
                answer_text = option.title
            else:
                answer_text = ""
            rows.append(
                f'<tr><td style="{_FIELD_CELL_STYLE}">{html_module.escape(field_title)}</td>'
                f'<td style="{_FIELD_CELL_STYLE}">{html_module.escape(answer_text)}</td></tr>'
            )

        elif field_type == RegistrationFieldType.TEXT:
            field_title = (field.settings or {}).get("title", "")
            value = answer.value_text or ""
            escaped_value = html_module.escape(value).replace("\n", "<br>")
            display_value = escaped_value if value else "\u2014"
            rows.append(
                f'<tr><td style="{_FIELD_CELL_STYLE}">{html_module.escape(field_title)}</td>'
                f'<td style="{_FIELD_CELL_STYLE}">{display_value}</td></tr>'
            )

    if not rows:
        return ""

    return (
        f'<div style="margin-top: 20px; margin-bottom: 20px">'
        f'<p style="font-weight: bold; margin-bottom: 10px; color: #55575d;">{heading}</p>'
        f'<table style="width: 100%; border-collapse: collapse;">'
        f'{"".join(rows)}'
        f"</table>"
        f"</div>"
    )


def _build_field_answers_text(registration, lang_code, tz):
    """
    Build a plain-text snippet of the guest's registration field answers.

    Returns a string with bullet-point lines, or an empty string if no answers
    have non-null values.  Uses the same answer-reading logic as
    ``_build_field_answers_html`` but outputs plain text suitable for the
    iCalendar DESCRIPTION field.

    Args:
        registration: EventRegistration instance with prefetched field_answers,
            field, value_option, and field.options.
        lang_code: User's language code ("en" or "de").
        tz: The :class:`~zoneinfo.ZoneInfo` timezone to display times in.

    Returns:
        str: Plain-text bullet-point lines or empty string.
    """
    from organization.models.registration_field import RegistrationFieldType

    answers_by_field = {}
    for answer in registration.field_answers.all():
        if (
            answer.value_boolean is None
            and answer.value_option is None
            and answer.value_number is None
            and answer.value_text is None
        ):
            continue
        if answer.field.field_type == RegistrationFieldType.CHECKBOX:
            if answer.value_boolean is not True:
                continue
        answers_by_field[answer.field] = answer

    if not answers_by_field:
        return ""

    sorted_fields = sorted(answers_by_field.keys(), key=lambda f: f.order)

    heading = (
        "Your registration answers:" if lang_code == "en" else "Deine Anmeldeantworten:"
    )

    lines = [heading]
    for field in sorted_fields:
        answer = answers_by_field[field]
        field_type = field.field_type

        if field_type == RegistrationFieldType.CHECKBOX:
            description = (field.settings or {}).get("description", "")
            plain_desc = re.sub(r"<[^>]+>", "", description).strip()
            lines.append(f"\u2022 {plain_desc}: \u2713")

        elif field_type == RegistrationFieldType.OPTION_SELECT:
            field_title = (field.settings or {}).get("title", "")
            option = answer.value_option
            answer_text = option.title if option else ""
            lines.append(f"\u2022 {field_title}: {answer_text}")

        elif field_type == RegistrationFieldType.INVENTORY:
            field_title = (field.settings or {}).get("title", "")
            option = answer.value_option
            option_title = option.title if option else ""
            quantity = answer.value_number or 0
            lines.append(f"\u2022 {field_title}: {option_title} \u00d7 {quantity}")

        elif field_type == RegistrationFieldType.TIME_SLOT_SELECT:
            field_title = (field.settings or {}).get("title", "")
            option = answer.value_option
            if option and option.start_time and option.end_time:
                answer_text = _format_time_range_localized(
                    option.start_time, option.end_time, lang_code, tz
                )
            elif option:
                answer_text = option.title
            else:
                answer_text = ""
            lines.append(f"\u2022 {field_title}: {answer_text}")

        elif field_type == RegistrationFieldType.TEXT:
            field_title = (field.settings or {}).get("title", "")
            value = answer.value_text or "\u2014"
            lines.append(f"\u2022 {field_title}: {value}")

    if len(lines) == 1:
        return ""

    return "\n".join(lines)


def generate_event_ics_attachment(project, lang_code, registration=None, tz=None):
    """
    Generate a Mailjet-compatible .ics attachment dict for an event.

    Returns a dict ready to be included in the Mailjet ``Attachments`` list,
    or ``None`` if the event has no ``start_date`` or ``end_date``.

    Args:
        project: ``Project`` instance.
        lang_code: User's language code ("en" or "de").
        registration: Optional ``EventRegistration`` instance.  When provided,
            the guest's registration field answers (especially timeslots) are
            appended to the iCalendar DESCRIPTION so they appear in the
            calendar entry.
        tz: Timezone for localised time formatting in field answers.
    """
    if not project.start_date or not project.end_date:
        return None

    from organization.utility.ical_feed import PRODID, build_vevent

    extra_desc = ""
    if registration and tz:
        extra_desc = _build_field_answers_text(registration, lang_code, tz) or ""

    cal = Calendar()
    cal.add("prodid", PRODID)
    cal.add("version", "2.0")
    cal.add("method", "PUBLISH")

    event = build_vevent(project, lang_code, extra_description=extra_desc)

    cal.add_component(event)

    ics_bytes = cal.to_ical()
    ics_base64 = base64.b64encode(ics_bytes).decode("ascii")

    return {
        "ContentType": "text/calendar; method=PUBLISH; charset=utf-8",
        "Filename": f"{project.url_slug}.ics",
        "Base64Content": ics_base64,
    }


def generate_timeslot_ics_attachments(project, lang_code, registration):
    """
    Generate a separate .ics attachment for each timeslot field answer.

    Each timeslot the guest selected during registration becomes its own
    calendar entry so that guests can add individual sessions to their
    calendar independently of the overall event.

    Returns a list of Mailjet attachment dicts (may be empty if the
    registration has no timeslot answers).

    Args:
        project: ``Project`` instance.
        lang_code: User's language code ("en" or "de").
        registration: ``EventRegistration`` instance with prefetched
            ``field_answers__field``, ``field_answers__value_option``.
    """
    from organization.models.registration_field import RegistrationFieldType

    event_url = (
        settings.FRONTEND_URL
        + get_user_lang_url(lang_code)
        + "/projects/"
        + project.url_slug
    )
    ical_url = project.website if (project.is_online and project.website) else event_url

    url_cta = (
        "Visit the following link to see event details or change your registration:"
        if lang_code == "en"
        else "Besuche folgenden Link, um die Details der Veranstaltung zu sehen"
        " oder deine Anmeldung zu ändern:"
    )
    description = f"{url_cta}\n{event_url}"

    summary_prefix = "My timeslot at" if lang_code == "en" else "Mein Zeitfester bei"
    event_name = get_project_name(project, lang_code)

    attachments = []
    timeslot_seq = 0
    for answer in registration.field_answers.all():
        if answer.field.field_type != RegistrationFieldType.TIME_SLOT_SELECT:
            continue
        option = answer.value_option
        if not option or not option.start_time or not option.end_time:
            continue

        timeslot_seq += 1

        from organization.utility.ical_feed import PRODID

        cal = Calendar()
        cal.add("prodid", PRODID)
        cal.add("version", "2.0")
        cal.add("method", "PUBLISH")

        ical_event = IcalEvent()
        ical_event.add("uid", f"{registration.id}_{answer.field.id}@climatehub.org")
        ical_event.add("summary", f"{summary_prefix} {event_name}")
        ical_event.add("dtstart", option.start_time)
        ical_event.add("dtend", option.end_time)
        ical_event.add("description", description)
        ical_event.add("url", ical_url)

        cal.add_component(ical_event)

        ics_bytes = cal.to_ical()
        ics_base64 = base64.b64encode(ics_bytes).decode("ascii")

        attachments.append(
            {
                "ContentType": "text/calendar; method=PUBLISH; charset=utf-8",
                "Filename": f"{project.url_slug}_timeslot_{timeslot_seq}.ics",
                "Base64Content": ics_base64,
            }
        )

    return attachments


def send_event_registration_confirmation_to_user(user, project, registration):
    """
    Send a registration confirmation email to a user who just registered for an event.

    Uses the shared ``send_email()`` helper with a Mailjet template, consistent with
    all other transactional emails in this module.

    **Mailjet template variables** (define these in both the EN and DE templates):
        - ``FirstName``         — user's first name (falls back to username if blank)
        - ``EventTitle``        — display name of the event (localised for the user's language)
        - ``EventUrl``          — full, language-aware URL to the event page
        - ``StartDate``         — localised start date with resolved timezone
        - ``OrganiserName``     — localised organisation name, or user's full name / username
        - ``LocationName``      — ``"Online"`` / location name / empty string
        - ``FieldAnswersHtml``  — pre-rendered HTML of the guest's custom field answers
          (empty string if no custom fields or no answers)

    **Required env variables**:
        ``EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID``    — Mailjet template ID (EN)
        ``EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID_DE`` — Mailjet template ID (DE)

    Args:
        user: Django ``User`` instance. Must be fetched with
            ``select_related("user_profile__location")``.
        project: ``Project`` instance. Must be fetched with
            ``select_related("loc", "language")`` and
            ``prefetch_related(
                "translation_project__language",
                "loc__translate_location__language",
                "project_parent__parent_organization__language",
                "project_parent__parent_organization__translation_org__language",
                "project_parent__parent_user__user_profile",
            )``.
        registration: ``EventRegistration`` instance. Must be fetched with
            ``prefetch_related("field_answers__field", "field_answers__value_option")``.
    """
    lang_code = get_user_lang_code(user)
    display_tz = get_event_display_timezone(user, project)
    start_date_str = format_datetime_localized(
        project.start_date, lang_code, display_tz
    )

    subjects_by_language = {
        "en": f"You're registered for {get_project_name(project, 'en')}!",
        "de": f"Du bist für {get_project_name(project, 'de')} angemeldet!",
    }

    field_answers_html = _build_field_answers_html(registration, lang_code, display_tz)

    variables = {
        "FirstName": user.first_name or user.username,
        "EventTitle": get_project_name(project, lang_code),
        "EventUrl": (
            settings.FRONTEND_URL
            + get_user_lang_url(lang_code)
            + "/projects/"
            + project.url_slug
        ),
        "StartDate": start_date_str,
        "OrganiserName": get_organiser_name(project, lang_code),
        "LocationName": get_location_name(project, lang_code),
        "FieldAnswersHtml": field_answers_html,
    }

    attachments = []
    ics_attachment = generate_event_ics_attachment(
        project, lang_code, registration=registration, tz=display_tz
    )
    if ics_attachment:
        attachments.append(ics_attachment)
    attachments.extend(
        generate_timeslot_ics_attachments(project, lang_code, registration)
    )

    send_email(
        user=user,
        variables=variables,
        template_key="EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
        attachments=attachments if attachments else None,
    )


def send_admin_event_notification(admin_user, project, guest_user, change_type: str):
    """
    Send a single admin notification email when a member registers or self-cancels.

    Called once per admin from the ``notify_admins_of_registration_change`` Celery
    task.  All email copy (subject, body, CTA label) is generated here in the
    admin's preferred language — the Mailjet template is a styled wrapper only.

    **Mailjet template variables**:
        - ``AdminFirstName``    — admin's first name (falls back to username)
        - ``Subject``           — localised subject (also used as envelope subject)
        - ``Body``              — localised body text
        - ``EventTitle``        — event name localised for the admin's language
        - ``EventUrl``          — language-aware URL to the event page
        - ``RegistrationsUrl``  — direct link to the event's Registrations tab
        - ``CtaLabel``          — localised CTA button label

    **Required env variables**:
        ``ADMIN_REGISTRATION_NOTIFICATION_TEMPLATE_ID``    — Mailjet template ID (EN)
        ``ADMIN_REGISTRATION_NOTIFICATION_TEMPLATE_ID_DE`` — Mailjet template ID (DE)

    Args:
        admin_user:  Django ``User`` instance of the admin recipient.
        project:     ``Project`` instance.  Fetch with
                     ``select_related("loc", "language")`` and the organiser/
                     translation prefetch chain to avoid N+1.
        guest_user:  Django ``User`` instance of the member who registered or cancelled.
        change_type: ``"registered"`` or ``"cancelled"``.
    """
    lang_code = get_user_lang_code(admin_user)
    event_title = get_project_name(project, lang_code)
    guest_name = (
        f"{guest_user.first_name} {guest_user.last_name}".strip() or guest_user.username
    )

    if change_type == "registered":
        subjects_by_language = {
            "en": f"{guest_name} registered for {get_project_name(project, 'en')}",
            "de": f"{guest_name} hat sich für {get_project_name(project, 'de')} angemeldet",
        }
        bodies_by_language = {
            "en": (
                f"{guest_name} has just registered for \"{get_project_name(project, 'en')}\". "
                "View the updated registrations list."
            ),
            "de": (
                f"{guest_name} hat sich soeben für \"{get_project_name(project, 'de')}\" angemeldet. "
                "Sieh dir die aktualisierte Anmeldeliste an."
            ),
        }
    else:  # "cancelled"
        subjects_by_language = {
            "en": f"{guest_name} cancelled their registration for {get_project_name(project, 'en')}",
            "de": f"{guest_name} hat seine/ihre Anmeldung für {get_project_name(project, 'de')} storniert",
        }
        bodies_by_language = {
            "en": (
                f"{guest_name} has just cancelled their registration for \"{get_project_name(project, 'en')}\". "
                "View the updated registrations list."
            ),
            "de": (
                f"{guest_name} hat soeben seine/ihre Anmeldung für \"{get_project_name(project, 'de')}\" storniert. "
                "Sieh dir die aktualisierte Anmeldeliste an."
            ),
        }

    cta_labels_by_language = {
        "en": "View registrations",
        "de": "Anmeldeliste ansehen",
    }

    event_url = (
        settings.FRONTEND_URL
        + get_user_lang_url(lang_code)
        + "/projects/"
        + project.url_slug
    )
    registrations_url = event_url + "?#registrations"

    variables = {
        "AdminFirstName": admin_user.first_name or admin_user.username,
        "Subject": subjects_by_language[lang_code],
        "Body": bodies_by_language[lang_code],
        "EventTitle": event_title,
        "EventUrl": event_url,
        "RegistrationsUrl": registrations_url,
        "CtaLabel": cta_labels_by_language[lang_code],
    }

    send_email(
        user=admin_user,
        variables=variables,
        template_key="ADMIN_REGISTRATION_NOTIFICATION_TEMPLATE_ID",
        subjects_by_language=subjects_by_language,
        should_send_email_setting="",
        notification=None,
    )
