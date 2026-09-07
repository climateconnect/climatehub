import urllib.parse
import zoneinfo

from dateutil.parser import parse as dateutil_parse
from dateutil.relativedelta import relativedelta
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.utils import translation as dj_translation
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.renderers import BaseRenderer, BrowsableAPIRenderer, JSONRenderer
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from hubs.models.hub import Hub
from organization.models import Project
from organization.models.type import ProjectTypesChoices
from organization.utility.ical_feed import (
    build_feed_calendar,
    build_feed_url,
    canonicalize_query,
    resolve_lang_code,
    sign_feed_token,
    verify_feed_token,
)
from organization.utility.project import apply_hub_filter
from organization.utility.sector import sanitize_sector_inputs


class EventFeedThrottle(ScopedRateThrottle):
    scope = "event_feed"

    def get_ident(self, request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")


class ICalRenderer(BaseRenderer):
    media_type = "text/calendar"
    format = "ics"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class EventCalendarFeedView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [EventFeedThrottle]
    renderer_classes = [ICalRenderer, JSONRenderer, BrowsableAPIRenderer]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            return HttpResponse("Missing token", status=403)

        params = {k: v for k, v in request.query_params.items() if k != "token"}
        canonical = canonicalize_query(params)

        if not verify_feed_token(canonical, token):
            return HttpResponse("Invalid or expired token", status=403)

        lang_code = resolve_lang_code(request)

        queryset = Project.objects.filter(
            is_draft=False,
            is_active=True,
            project_type=ProjectTypesChoices.event,
            start_date__isnull=False,
        ).select_related("loc", "language")

        hub_slug = request.query_params.get("hub")
        hub = None
        if hub_slug:
            hub = Hub.objects.filter(url_slug=hub_slug).first()
            queryset = apply_hub_filter(queryset, hub_slug)

        if "sectors" in request.query_params:
            sector_names, err = sanitize_sector_inputs(request.query_params["sectors"])
            if not err:
                queryset = queryset.filter(
                    Q(project_sector_mapping__sector__name__in=sector_names)
                    | Q(
                        project_sector_mapping__sector__relates_to_sector__name__in=sector_names
                    )
                )

        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(translation_project__name_translation__icontains=search)
            )

        date_param = request.query_params.get("date")
        tz_name = request.query_params.get("tz")
        now = timezone.now()

        if date_param:
            try:
                lower = dateutil_parse(date_param)
                if tz_name:
                    try:
                        tz = zoneinfo.ZoneInfo(tz_name)
                        lower = lower.replace(tzinfo=tz)
                    except (zoneinfo.ZoneInfo.KeyError, ValueError):
                        pass
                if lower.tzinfo is None:
                    lower = (
                        timezone.make_aware(lower)
                        if timezone.is_naive(lower)
                        else lower
                    )
                queryset = queryset.filter(start_date__gte=lower)
            except (ValueError, OverflowError):
                pass
        else:
            queryset = queryset.filter(
                start_date__gte=now, start_date__lte=now + relativedelta(months=12)
            )

        queryset = queryset.distinct().order_by("start_date")

        filter_parts = []
        if hub_slug:
            filter_parts.append(f"hub={hub_slug}")
        if search:
            filter_parts.append(f"search={search}")
        if "sectors" in request.query_params:
            filter_parts.append(f"sectors={request.query_params['sectors']}")
        if date_param:
            filter_parts.append(f"date={date_param}")
        filters_summary = "; ".join(filter_parts) if filter_parts else ""

        with dj_translation.override(lang_code):
            cal = build_feed_calendar(
                queryset, lang_code, hub=hub, filters_summary=filters_summary
            )

        response = HttpResponse(
            cal.to_ical(), content_type="text/calendar; charset=utf-8"
        )
        response["Cache-Control"] = "public, max-age=3600"
        return response


class EventFeedTokenView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [EventFeedThrottle]

    def post(self, request):
        params = {}
        for key in ("hub", "sectors", "search", "date", "tz", "lang"):
            val = request.data.get(key)
            if val is not None and val != "":
                params[key] = str(val)

        canonical = canonicalize_query(params)
        token = sign_feed_token(canonical)

        feed_params = {**params, "token": token}
        feed_qs = urllib.parse.urlencode(sorted(feed_params.items()))
        url = build_feed_url(feed_qs, hub_slug=params.get("hub"))

        return JsonResponse({"url": url})
