import json
import logging
import time
import uuid

import requests
from django.conf import settings
from django_ratelimit.core import is_ratelimited
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from location.cache import (
    get_cache_stats,
    lookup_key,
    normalize_query,
    record_cache_hit,
    record_cache_miss,
    refresh_cache_entry,
    store_result,
    was_undelivered,
)
from location.models import (
    AutocompletePeriodStats,
)
from location.models import (
    Location as LocationModel,
)
from location.providers import fetch_results, strip_geometry
from location.queue import (
    LOCATIONIQ_PENDING_JOBS_KEY,
    LOCATIONIQ_RECLAIM_KEY_PREFIX,
    get_redis_conn,
)
from location.serializers import LocationStubSerializer
from location.tasks import fetch_autocomplete, log_autocomplete_request
from location.utility import (
    _get_newest_location_by_osm_composite,
    _get_newest_location_by_osm_id_and_type,
    _get_newest_location_by_place_id,
    _osm_type_char,
    format_location,
    get_location,
)

logger = logging.getLogger("django")


class AutocompleteTrackThrottle(AnonRateThrottle):
    rate = "60/min"


class GetLocationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        osm_id = request.data.get("osm_id")
        osm_type = request.data.get("osm_type")
        osm_class = request.data.get("osm_class")
        place_id = request.data.get("place_id")

        location = None

        # OSM composite key has precedence over place_id.
        if osm_id is not None and osm_type is not None and osm_class:
            location = _get_newest_location_by_osm_composite(
                osm_id, osm_type, osm_class
            )

        if location is None and osm_id is not None and osm_type is not None:
            # Backward-compatible fallback when osm_class is not available yet.
            location = _get_newest_location_by_osm_id_and_type(osm_id, osm_type)

        if location is None and place_id is not None:
            logger.warning(
                "Using deprecated place_id lookup in /api/get_location/. place_id=%s",
                place_id,
            )
            location = _get_newest_location_by_place_id(place_id)

        if location is not None:
            # Prefetch translations to avoid N+1 queries in the locale-aware serializer
            location = LocationModel.objects.prefetch_related(
                "translate_location__language"
            ).get(pk=location.pk)
            serializer = LocationStubSerializer(location, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        osm_type_char = _osm_type_char(osm_type)
        if osm_id is None or not osm_type_char:
            return Response(
                {
                    "message": "Required parameters missing: either (osm_id and osm_type) or place_id"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.LOCATION_SERVICE_BASE_URL:
            logger.error(
                "LOCATION_SERVICE_BASE_URL is not configured, cannot look up osm_id=%s",
                osm_id,
            )
            return Response(
                {"message": "Upstream location service is unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        url_root = settings.LOCATION_SERVICE_BASE_URL + "/lookup?osm_ids="
        osm_id_param = osm_type_char + str(osm_id)
        params = "&format=json&addressdetails=1&polygon_geojson=1&accept-language=en-US,en;q=0.9&polygon_threshold=0.001"
        url = url_root + osm_id_param + params
        headers = {
            "User-Agent": settings.CUSTOM_USER_AGENT,
        }

        try:
            response = requests.get(url, headers=headers, timeout=5)
        except requests.RequestException as exc:
            logger.error(
                "Error calling location service for url %s: %s", url, exc, exc_info=True
            )
            return Response(
                {"message": "Upstream location service is unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        if response.status_code != 200:
            logger.warning(
                "Location service returned non-200 status for url %s: %s",
                url,
                response.status_code,
            )
            return Response(
                {
                    "message": "Upstream location service returned an error.",
                    "upstream_status": response.status_code,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        try:
            data = json.loads(response.text)
        except ValueError:
            logger.error(
                "Invalid JSON from location service for url %s", url, exc_info=True
            )
            return Response(
                {"message": "Invalid response from upstream location service."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        if not isinstance(data, list) or not data:
            logger.info(
                "Location not found in upstream service for osm_id=%s, osm_type=%s",
                osm_id,
                osm_type_char,
            )
            return Response(
                {"message": "Location not found for the given identifiers."},
                status=status.HTTP_404_NOT_FOUND,
            )
        location_object = data[0]
        location = get_location(format_location(location_object, False))
        location = LocationModel.objects.prefetch_related(
            "translate_location__language"
        ).get(pk=location.pk)
        serializer = LocationStubSerializer(location, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Autocomplete request tracking (log + Celery aggregation)
# ---------------------------------------------------------------------------


class TrackAutocompleteRequestView(APIView):
    """
    POST /api/autocomplete_request_count/

    Called fire-and-forget by the frontend every time it fires a Nominatim
    autocomplete request *from the browser* — i.e. while the
    LOCATIONIQ_AUTOCOMPLETE toggle is off. Requests the backend makes itself
    are logged where they happen, so this endpoint only ever records
    "nominatim".

    Simply logs the request — aggregation into AutocompletePeriodStats is
    handled by a periodic Celery task.
    """

    permission_classes = [AllowAny]
    throttle_classes = [AutocompleteTrackThrottle]

    def post(self, request):
        log_autocomplete_request("nominatim")
        return Response(status=status.HTTP_204_NO_CONTENT)


def _too_many_requests_response():
    response = Response(
        {"detail": "Too many requests. Please try again later."},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )
    response["Retry-After"] = "1"
    return response


def _service_busy_response():
    """
    Backpressure: too many distinct lookups are already in flight.

    Carries Retry-After for the same reason the 429 above does — a 503 without
    one leaves a non-browser client to invent its own backoff, and the honest
    answer here is "very soon". The cap drains as in-flight lookups resolve,
    which takes about a second at LOCATIONIQ_MAX_RATE, so 1 is not optimistic.
    """
    response = Response(
        {"detail": "Service busy, please retry."},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
    response["Retry-After"] = "1"
    return response


class LocationAutocompleteView(APIView):
    """
    GET /api/location_autocomplete/

    Proxied, rate-limited, non-blocking autocomplete endpoint backed by
    LocationIQ with a Nominatim fallback. A cache miss claims a Redis
    sentinel, enqueues a Celery task (rate-limited to LOCATIONIQ_MAX_RATE,
    routed to its own queue/worker), and returns 202 — the frontend polls
    this same endpoint until the result is ready. See
    doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md for the
    full design (Redis key contract, HTTP contract, gap fixes).
    """

    permission_classes = [AllowAny]

    def _fetch_inline(self, redis_conn, key, job_id, q, countrycodes, accept_language):
        """
        Do the upstream fetch in the request itself and write the terminal
        state, exactly as the Celery task would have. Used when no task is
        going to do it — broker unreachable at enqueue time, or an abandoned
        sentinel being reclaimed.
        """
        # A miss is "one lookup that had to go upstream", so it is counted at
        # whichever point actually spends the call. Reclaiming an abandoned
        # sentinel fetches a second time for a query whose first claim was
        # already counted, and both calls are real — the count should say two.
        record_cache_miss(redis_conn)
        results, provider = fetch_results(q, countrycodes, accept_language)
        # delivered=True: unlike the Celery path, this request returns the
        # result itself, so there is no later poll to consume the marker.
        store_result(redis_conn, key, job_id, results, provider, delivered=True)
        redis_conn.zrem(LOCATIONIQ_PENDING_JOBS_KEY, key)
        if results is not None:
            log_autocomplete_request(provider)
        # Same payload shape as the cached path — geometry stripped.
        return Response(strip_geometry(results) or [], status=status.HTTP_200_OK)

    def _serve_cached(self, redis_conn, key, data, now):
        """
        Turn a terminal cache entry into a response, applying the sliding TTL.

        Returns None when the entry has aged past LOCATION_PROXY_MAX_CACHE_AGE_S
        and was dropped — the caller then falls through to the normal
        cache-miss path and re-fetches.
        """
        results = data.get("results")
        if results is None:
            # Negative-cached failure (seconds-long TTL, not in the LRU index).
            # Serve empty as before, but don't slide its TTL and don't count it
            # as a hit — nothing useful was cached.
            return Response([], status=status.HTTP_200_OK)

        # Must be read before refresh_cache_entry, which consumes the marker.
        delivering = was_undelivered(data)

        if not refresh_cache_entry(redis_conn, key, data, now):
            return None

        if not delivering:
            record_cache_hit(redis_conn)
        # Otherwise this is the poll collecting the result its own lookup just
        # produced — the tail of the miss already counted when the sentinel was
        # claimed, not a saved upstream call. Counting it would put a floor of
        # ~50% under hit_rate even for a cache that never serves a repeat query.

        return Response(results, status=status.HTTP_200_OK)

    def _reclaim_if_abandoned(
        self, redis_conn, key, normalized_q, sentinel, now, q, countrycodes, language
    ):
        """
        Take over a pending sentinel that no task is going to resolve.

        `apply_async` succeeding only means the message reached the broker —
        not that anything consumed it. If the `lookup` worker is down, not
        deployed, or the message was lost, the sentinel just sits there: every
        poller gets a 202, the frontend gives up, and the next request for the
        same query gets another 202 until the sentinel TTL runs out. Nothing
        in the design notices, because from Redis' point of view the job is
        simply still in flight.

        So once a sentinel is older than the worst case a *healthy* queue can
        produce, we assume it was abandoned and fetch inline instead. Returns
        None when the sentinel is still plausibly in flight, or when another
        request already holds the reclaim lock (that one is doing the work;
        this one should keep polling).
        """
        created_at = sentinel.get("created_at")
        if created_at is None:
            # Sentinel written before this field existed — can't age it, and
            # it will expire on its own shortly. Leave it alone.
            return None
        if (now - created_at) <= settings.LOCATION_PROXY_STALE_PENDING_S:
            return None

        lock_key = f"{LOCATIONIQ_RECLAIM_KEY_PREFIX}{normalized_q}"
        if not redis_conn.set(
            lock_key, "1", nx=True, ex=settings.LOCATION_PROXY_RECLAIM_LOCK_S
        ):
            return None

        logger.warning(
            "Reclaiming abandoned LocationIQ lookup for %r after %.1fs — no "
            "task resolved it. Is the 'lookup' queue worker running?",
            q,
            now - created_at,
        )
        # A fresh job_id: if the original task ever does run, its
        # compare-before-write sees a different id and won't clobber this.
        return self._fetch_inline(
            redis_conn, key, uuid.uuid4().hex, q, countrycodes, language
        )

    def get(self, request):
        # Loose blanket limit on all traffic (including cheap status polls)
        # — a backstop against a buggy/runaway polling client, not the real
        # quota protection.
        if is_ratelimited(
            request,
            group="location-autocomplete-any",
            key="ip",
            rate=settings.LOCATION_PROXY_IP_RATE_LOOSE,
            increment=True,
        ):
            return _too_many_requests_response()

        q = request.query_params.get("q", "").strip()
        if not (3 <= len(q) <= 200):
            return Response([], status=status.HTTP_200_OK)

        countrycodes = request.query_params.get("countrycodes", "")
        accept_language = request.META.get("HTTP_ACCEPT_LANGUAGE", "en-US,en;q=0.9")

        redis_conn = get_redis_conn()
        normalized_q = normalize_query(q, countrycodes, accept_language)
        key = lookup_key(normalized_q)
        now = time.time()

        raw = redis_conn.get(key)
        if raw:
            data = json.loads(raw)
            if data["status"] == "done":
                cached = self._serve_cached(redis_conn, key, data, now)
                if cached is not None:
                    return cached
                # Aged past the 48h ceiling and dropped — fall through and
                # re-fetch it as if it had never been cached.
            else:
                # Someone else's (or our own earlier poll's) lookup is already
                # in flight for this query — cheap check, doesn't count against
                # the strict per-IP limit below, and doesn't create a duplicate
                # task. Unless nothing is actually working on it any more:
                reclaimed = self._reclaim_if_abandoned(
                    redis_conn,
                    key,
                    normalized_q,
                    data,
                    now,
                    q,
                    countrycodes,
                    accept_language,
                )
                if reclaimed is not None:
                    return reclaimed
                return Response({"status": "pending"}, status=status.HTTP_202_ACCEPTED)

        # Strict limit — only applies to genuinely creating new, expensive work.
        if is_ratelimited(
            request,
            group="location-autocomplete-new",
            key="ip",
            rate=settings.LOCATION_PROXY_IP_RATE_STRICT,
            increment=True,
        ):
            return _too_many_requests_response()

        redis_conn.zremrangebyscore(
            LOCATIONIQ_PENDING_JOBS_KEY,
            "-inf",
            now - settings.LOCATION_PROXY_SENTINEL_TTL_S,
        )
        if (
            redis_conn.zcard(LOCATIONIQ_PENDING_JOBS_KEY)
            >= settings.LOCATION_PROXY_PENDING_CAP
        ):
            return _service_busy_response()

        job_id = uuid.uuid4().hex
        created = redis_conn.set(
            key,
            # created_at is what lets a later request tell "still queued" from
            # "nothing is coming" — see _reclaim_if_abandoned.
            json.dumps({"status": "pending", "job_id": job_id, "created_at": now}),
            nx=True,
            ex=settings.LOCATION_PROXY_SENTINEL_TTL_S,
        )
        if not created:
            # Lost the race to a concurrent identical request — fall into
            # whatever state it left behind.
            return Response({"status": "pending"}, status=status.HTTP_202_ACCEPTED)

        redis_conn.zadd(LOCATIONIQ_PENDING_JOBS_KEY, {key: now})
        try:
            fetch_autocomplete.apply_async(
                args=[key, job_id, q, countrycodes, accept_language]
            )
        except Exception:
            logger.exception(
                "Celery broker unavailable for LocationIQ autocomplete, "
                "falling back to direct fetch"
            )
            # _fetch_inline counts its own miss — don't count one here too, the
            # broker-down path still only spends a single upstream call.
            return self._fetch_inline(
                redis_conn, key, job_id, q, countrycodes, accept_language
            )

        # The task is queued, so an upstream call is going to happen. Counted
        # here, once, rather than on every poll that follows.
        record_cache_miss(redis_conn)
        return Response({"status": "pending"}, status=status.HTTP_202_ACCEPTED)


class AutocompleteStatsView(APIView):
    """
    GET /api/autocomplete_stats/

    Returns persistent day/week/month autocomplete request stats.

    Stats are stored per (period, provider), so every period reports a
    per-provider breakdown alongside the combined totals. `total_requests`
    and `avg_req_per_second` are summed across providers;
    `peak_req_per_second` is the max, since it means "most requests seen in
    one second" and summing two providers' peaks would invent a burst that
    never happened.

    Without query params: returns the current day, week, and month.

    With ``?period_type=<type>&limit=<N>``: returns up to N *periods* (not
    rows) for the given period type, most recent first.

    Requires Django staff / admin access.
    """

    permission_classes = [IsAdminUser]

    VALID_PERIOD_TYPES = {"day", "week", "month"}

    @staticmethod
    def _serialize_period(period_key, rows):
        """Combine one period's per-provider rows into a single entry."""
        return {
            "period_key": period_key,
            "total_requests": sum(r.total_requests for r in rows),
            "avg_req_per_second": round(sum(r.avg_req_per_second for r in rows), 5),
            "peak_req_per_second": max(r.peak_req_per_second for r in rows),
            "providers": {
                r.provider: {
                    "total_requests": r.total_requests,
                    "avg_req_per_second": round(r.avg_req_per_second, 5),
                    "peak_req_per_second": r.peak_req_per_second,
                }
                for r in rows
            },
        }

    @staticmethod
    def _cache_stats():
        """
        Redis-backed cache counters, best effort — a Redis hiccup must not take
        down the whole stats page, which is otherwise served from Postgres.
        """
        try:
            return get_cache_stats()
        except Exception as exc:
            logger.warning("Could not read autocomplete cache stats: %s", exc)
            return None

    def get(self, request):
        try:
            period_type = request.query_params.get("period_type")

            raw_limit = request.query_params.get("limit", "1")
            try:
                limit = min(int(raw_limit), 365)
            except (ValueError, TypeError):
                return Response(
                    {"detail": "Invalid 'limit' parameter — must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if period_type:
                if period_type not in self.VALID_PERIOD_TYPES:
                    return Response(
                        {
                            "detail": (
                                f"Invalid period_type '{period_type}'. "
                                f"Must be one of: {', '.join(sorted(self.VALID_PERIOD_TYPES))}"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # `limit` counts periods, not rows — there is one row per
                # provider per period, so slicing rows directly would return
                # roughly half as many days as asked for.
                period_keys = list(
                    AutocompletePeriodStats.objects.filter(period_type=period_type)
                    .values_list("period_key", flat=True)
                    .distinct()
                    .order_by("-period_key")[:limit]
                )
                rows_by_period = {}
                for row in AutocompletePeriodStats.objects.filter(
                    period_type=period_type, period_key__in=period_keys
                ):
                    rows_by_period.setdefault(row.period_key, []).append(row)

                return Response(
                    {
                        "period_type": period_type,
                        "periods": [
                            self._serialize_period(pk, rows_by_period[pk])
                            for pk in period_keys
                        ],
                    }
                )

            # Default: return the latest day, week, and month, plus the
            # autocomplete cache's own hit/miss counters. Without those, a
            # working result cache and a drop in traffic look identical here,
            # since only upstream calls reach AutocompletePeriodStats.
            result = {"cache": self._cache_stats()}
            for pt in ("day", "week", "month"):
                latest_key = (
                    AutocompletePeriodStats.objects.filter(period_type=pt)
                    .order_by("-period_key")
                    .values_list("period_key", flat=True)
                    .first()
                )
                if latest_key:
                    rows = list(
                        AutocompletePeriodStats.objects.filter(
                            period_type=pt, period_key=latest_key
                        )
                    )
                    result[pt] = self._serialize_period(latest_key, rows)
                else:
                    result[pt] = None

            return Response(result)

        except Exception as exc:
            logger.error(
                "Failed to retrieve autocomplete stats from database: %s",
                exc,
                exc_info=True,
            )
            return Response(
                {"detail": "Stats temporarily unavailable."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
