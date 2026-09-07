import base64
import hashlib
import hmac
import urllib.parse

from django.conf import settings
from django.utils.translation import get_supported_language_variant
from icalendar import Calendar, Event as IcalEvent

from organization.utility.email import get_location_name
from organization.utility.project import get_project_name, get_project_short_description
from climateconnect_api.utility.translation import get_user_lang_url

PRODID = "-//Climate Hub Network//EN"


def canonicalize_query(params: dict) -> str:
    allowed_keys = {"hub", "sectors", "search", "date", "tz", "lang"}
    filtered = {}
    for k, v in params.items():
        if k in allowed_keys and v is not None and v != "":
            filtered[k] = v

    normalized = {}
    for k, v in filtered.items():
        if k == "sectors":
            parts = [s.strip().lower() for s in str(v).split(",") if s.strip()]
            seen = []
            for p in parts:
                if p not in seen:
                    seen.append(p)
            normalized[k] = ",".join(seen)
        elif k == "hub":
            normalized[k] = str(v).lower()
        elif k == "lang":
            normalized[k] = str(v).lower()
        elif k == "search":
            normalized[k] = str(v).strip()
        else:
            normalized[k] = str(v)

    sorted_items = sorted(normalized.items())
    return urllib.parse.urlencode(sorted_items)


def sign_feed_token(canonical_query: str) -> str:
    key = settings.ICAL_FEED_SIGNING_KEY.encode("utf-8")
    message = canonical_query.encode("utf-8")
    sig = hmac.new(key, message, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")


def verify_feed_token(canonical_query: str, token: str) -> bool:
    if not token:
        return False

    key = settings.ICAL_FEED_SIGNING_KEY.encode("utf-8")
    message = canonical_query.encode("utf-8")
    expected = hmac.new(key, message, hashlib.sha256).digest()

    padding = 4 - len(token) % 4
    if padding != 4:
        token += "=" * padding
    try:
        provided = base64.urlsafe_b64decode(token)
    except Exception:
        return False

    return hmac.compare_digest(expected, provided)


def build_vevent(project, lang_code: str, extra_description: str = "") -> IcalEvent:
    event = IcalEvent()
    event.add("uid", f"{project.id}@climatehub.org")
    event.add("summary", get_project_name(project, lang_code))
    event.add("dtstart", project.start_date)
    if project.end_date:
        event.add("dtend", project.end_date)

    location = get_location_name(project, lang_code)
    if location:
        event.add("location", location)

    event_url = (
        settings.FRONTEND_URL
        + get_user_lang_url(lang_code)
        + "/projects/"
        + project.url_slug
    )

    description_parts = []
    short_desc = get_project_short_description(project, lang_code)
    if short_desc:
        description_parts.append(short_desc.strip())
    if extra_description:
        description_parts.append(extra_description.strip())

    url_cta = (
        "Visit the following link to see event details or change your registration:"
        if lang_code == "en"
        else "Besuche folgenden Link, um die Details der Veranstaltung zu sehen"
        " oder deine Anmeldung zu ändern:"
    )
    description_parts.append(f"{url_cta}\n{event_url}")
    event.add("description", "\n\n".join(description_parts))

    ical_url = project.website if (project.is_online and project.website) else event_url
    event.add("url", ical_url)

    event.add("dtstamp", project.updated_at)
    event.add("sequence", int(project.updated_at.timestamp()))
    event.add("last-modified", project.updated_at)

    return event


def get_hub_name(hub, lang_code: str) -> str:
    if lang_code and lang_code != "en":
        translation_obj = hub.translate_hub.filter(
            language__language_code=lang_code
        ).first()
        if translation_obj and translation_obj.name_translation:
            return translation_obj.name_translation
    return hub.name


def build_feed_calendar(events, lang_code: str, hub=None, filters_summary=""):
    cal = Calendar()
    cal.add("prodid", PRODID)
    cal.add("version", "2.0")
    cal.add("method", "PUBLISH")
    cal.add("x-published-ttl", "PT1H")
    cal.add("refresh-interval;value=duration", "PT1H")

    if hub:
        cal_name = f"Climate Hub {get_hub_name(hub, lang_code)} \u2014 Events"
    else:
        cal_name = "Climate Hub \u2014 Events"
    cal.add("x-wr-calname", cal_name)

    if filters_summary:
        cal.add("x-wr-caldesc", filters_summary)

    for project in events:
        vevent = build_vevent(project, lang_code)
        cal.add_component(vevent)

    return cal


def resolve_lang_code(request) -> str:
    lang = request.query_params.get("lang")
    if lang:
        return lang.lower()

    accept = request.META.get("HTTP_ACCEPT_LANGUAGE", "")
    if accept:
        try:
            return get_supported_language_variant(
                accept.split(",")[0].split(";")[0].strip()
            )
        except LookupError:
            pass

    return "en"


def build_feed_url(feed_qs: str, hub_slug: str = None) -> str:
    from django.conf import settings

    frontend_url = settings.FRONTEND_URL or ""
    if hub_slug:
        from hubs.models.hub import Hub

        hub_obj = Hub.objects.filter(url_slug=hub_slug).first()
        if hub_obj and hub_obj.parent_hub:
            path = f"/hubs/{hub_obj.parent_hub.url_slug}/{hub_obj.url_slug}/events/feed.ics"
        elif hub_obj:
            path = f"/hubs/{hub_obj.url_slug}/events/feed.ics"
        else:
            path = "/events/feed.ics"
    else:
        path = "/events/feed.ics"
    return f"{frontend_url}{path}?{feed_qs}"
