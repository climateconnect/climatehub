import json
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests
from celery import shared_task
from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone as tz

from climateconnect_api.models.language import Language
from location.cache import store_result
from location.providers import fetch_results
from location.queue import LOCATIONIQ_PENDING_JOBS_KEY, get_redis_conn
from location.utility import format_location_name

logger = logging.getLogger(__name__)


def log_autocomplete_request(provider="nominatim") -> None:
    """
    Record that one autocomplete request went out to `provider`.

    One row per request, nothing else — aggregate_autocomplete_stats() rolls
    these up into AutocompletePeriodStats every 10 minutes. Deliberately kept to
    a single INSERT so nothing expensive (counting, cleanup, upserts) sits on
    the request path.

    Tracking failures are logged and swallowed: never fail a user-facing
    request because a metrics row couldn't be written.
    """
    from location.models import AutocompleteRequestLog

    try:
        AutocompleteRequestLog.objects.create(
            minute_key=int(time.time()) // 60,
            provider=provider,
        )
    except Exception as exc:
        logger.warning("Failed to log %s autocomplete request: %s", provider, exc)


@shared_task(rate_limit=settings.LOCATIONIQ_MAX_RATE)
def fetch_autocomplete(key, job_id, q, countrycodes, accept_language):
    """
    Fetch LocationIQ (with Nominatim fallback) results for one autocomplete
    lookup and write them back into the shared Redis rendezvous key that
    LocationAutocompleteView polls. Rate-limited to LOCATIONIQ_MAX_RATE and
    routed to its own queue/worker (see CELERY_TASK_ROUTES in settings) so
    this is the only thing calling LocationIQ, at the intended global rate.

    No retries: fetch_results already exhausts both providers internally,
    so a Celery-level retry would just repeat that same double-provider
    attempt at extra quota cost for no benefit on a time-sensitive request.
    """
    redis_conn = get_redis_conn()
    try:
        results, provider = fetch_results(q, countrycodes, accept_language)
    except Exception:
        logger.exception("fetch_autocomplete failed unexpectedly for %r", q)
        results, provider = None, None

    current = redis_conn.get(key)
    if current and json.loads(current).get("job_id") != job_id:
        # A newer sentinel generation already superseded this one (its TTL
        # expired mid-flight and a fresh lookup was started) — don't clobber
        # the newer job's data with this stale result.
        return

    store_result(redis_conn, key, job_id, results, provider)
    redis_conn.zrem(LOCATIONIQ_PENDING_JOBS_KEY, key)
    if results is not None:
        log_autocomplete_request(provider)


@shared_task(bind=True, max_retries=5, rate_limit="1/s")
def fetch_and_create_location_translations(self, loc_id):
    # Lazy import to avoid Circular Import
    from location.models import Location, LocationTranslation

    try:
        instance = Location.objects.get(pk=loc_id)
    except Location.DoesNotExist:
        logger.error(
            f"location with ID {loc_id} does not exist anymore. Aborting task."
        )
        return

    if not instance.osm_id or not instance.osm_type:
        logger.debug(
            f"Location {loc_id} has no osm_id or osm_type. Skipping translation."
        )
        return

    languages = Language.objects.all()
    for language in languages:
        locale = language.language_code
        params = {
            "osm_ids": f"{instance.osm_type[0].upper()}{instance.osm_id}",
            "format": "json",
            "extratags": 1,
            "addressdetails": 1,
            "accept-language": locale,
        }

        headers = {"User-Agent": settings.CUSTOM_USER_AGENT}

        translation_data = {}

        try:
            response = requests.get(
                settings.NOMINATIM_LOOKUP_URL,
                params=params,
                headers=headers,
                timeout=20,
            )
            response.raise_for_status()
            data = response.json()

            if not data or not data[0]:
                logger.debug(
                    f"No Nominatim-Data found for location_id: {loc_id} ({locale})."
                )
                continue

            nominatim_result = data[0]
            address = nominatim_result.get("address", {})
            translation_data["city_translation"] = (
                address.get("city") or address.get("town") or address.get("village")
            )
            translation_data["state_translation"] = address.get("state")
            translation_data["country_translation"] = address.get("country")

        except requests.exceptions.RequestException as e:
            logger.error(
                f"error while retrieving translation data from nominatim for location id {instance.id}: {e}"
            )
            raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))

        formatted_name = format_location_name(nominatim_result).get("name")
        translation_data["name_translation"] = formatted_name or instance.name

        try:
            with transaction.atomic():
                LocationTranslation.objects.create(
                    location=instance,
                    language_id=language.id,
                    name_translation=translation_data["name_translation"],
                    city_translation=translation_data["city_translation"],
                    state_translation=translation_data["state_translation"],
                    country_translation=translation_data["country_translation"],
                )
                logger.info(f"Translation created for {instance.pk} in {locale}.")
        except IntegrityError as e:
            logger.debug(
                f"Translation for ID {loc_id} and {language.id} already exists: {e}"
            )
            continue
        except Exception as e:
            logger.error(
                f"unknown error while saving translation for {instance.pk}/{language.id}: {e}"
            )
            continue


def _get_period_keys_for_dt(dt):
    """
    Return [(period_type, period_key, period_start_dt), ...] for the given
    datetime — one entry each for day, ISO week, and calendar month.
    """
    day_key = dt.strftime("%Y-%m-%d")
    day_start = dt.replace(hour=0, minute=0, second=0, microsecond=0)

    iso_year, iso_week, _ = dt.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    week_start_dt = datetime.strptime(f"{iso_year}-W{iso_week:02d}-1", "%G-W%V-%u")
    week_start_dt = week_start_dt.replace(tzinfo=timezone.utc)

    month_key = dt.strftime("%Y-%m")
    month_start = dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    return [
        ("day", day_key, day_start),
        ("week", week_key, week_start_dt),
        ("month", month_key, month_start),
    ]


@shared_task
def aggregate_autocomplete_stats():
    """
    Read unprocessed AutocompleteRequestLog rows, compute day/week/month
    aggregates **per provider**, upsert into AutocompletePeriodStats, and mark
    rows as processed. Rows older than 7 days are cleaned up.

    peak_req_per_second is the highest number of requests that arrived within
    a single second — per provider, which is what makes it usable for
    watching LocationIQ's 2 req/s ceiling.

    Scheduled to run every 10 minutes via Celery Beat.
    """
    from location.models import AutocompletePeriodStats, AutocompleteRequestLog

    with transaction.atomic():
        logs = list(
            AutocompleteRequestLog.objects.select_for_update(skip_locked=True)
            .filter(processed=False)
            .order_by("id")
        )
        if not logs:
            AutocompleteRequestLog.objects.filter(
                created_at__lt=tz.now() - timedelta(days=7)
            ).delete()
            return

        max_id = logs[-1].id

    now = tz.now()

    period_buckets = defaultdict(
        lambda: {"count": 0, "second_counts": defaultdict(int)}
    )

    for log in logs:
        log_dt = log.created_at
        if log_dt.tzinfo is None:
            log_dt = log_dt.replace(tzinfo=timezone.utc)

        second_key = log_dt.replace(microsecond=0)

        for period_type, period_key, period_start in _get_period_keys_for_dt(log_dt):
            bucket = period_buckets[(period_type, period_key, log.provider)]
            bucket["count"] += 1
            bucket["second_counts"][second_key] += 1
            bucket["period_start"] = period_start

    for (period_type, period_key, provider), bucket in period_buckets.items():
        total = bucket["count"]
        if total == 0:
            continue

        peak_per_second = (
            max(bucket["second_counts"].values()) if bucket["second_counts"] else 1
        )

        period_start_dt = bucket["period_start"]
        elapsed = max((now - period_start_dt).total_seconds(), 1.0)
        avg_rate = total / elapsed

        obj, created = AutocompletePeriodStats.objects.get_or_create(
            period_type=period_type,
            period_key=period_key,
            provider=provider,
            defaults={
                "total_requests": total,
                "avg_req_per_second": avg_rate,
                "peak_req_per_second": peak_per_second,
            },
        )
        if not created:
            obj.total_requests += total
            obj.peak_req_per_second = max(obj.peak_req_per_second, peak_per_second)
            obj.avg_req_per_second = obj.total_requests / elapsed
            obj.save()

    AutocompleteRequestLog.objects.filter(id__lte=max_id, processed=False).update(
        processed=True
    )

    deleted_count, _ = AutocompleteRequestLog.objects.filter(
        created_at__lt=now - timedelta(days=7)
    ).delete()
    logger.info(
        "Aggregated %d autocomplete log rows into %d period stats, cleaned up %d old rows.",
        len(logs),
        len(period_buckets),
        deleted_count,
    )
