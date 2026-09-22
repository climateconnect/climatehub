"""
Upstream geocoding providers for autocomplete.

Everything that knows *which* external service is called and how to read its
response lives here: the LocationIQ call, the Nominatim fallback, the toggle
and quota guards that decide whether LocationIQ is used at all, and the
geometry stripping applied to whatever comes back.

Nothing in here touches Redis — see `location.cache` for the result cache and
`location.queue` for the lookup rendezvous key contract.
"""

import logging
from datetime import datetime, timezone

import requests
from django.conf import settings

logger = logging.getLogger("django")


def locationiq_autocomplete_enabled():
    """
    Whether the LocationIQ autocomplete path is switched on for this backend.

    When the LOCATIONIQ_AUTOCOMPLETE toggle is off the frontend calls Nominatim
    directly from the browser, so the proxy only ever sees requests from
    clients still running a cached JS bundle. Those keep working — they just
    get the Nominatim fallback instead of consuming paid LocationIQ quota.

    Defaults to False: if the toggle can't be read at all, degrade to the
    behaviour that was proven on master.

    **Flipping this toggle requires clearing the result cache.** Cache entries
    are provider-agnostic — `_serve_cached` returns any stored result whatever
    produced it — so entries fetched from Nominatim while the toggle was off go
    on being served for up to LOCATION_PROXY_MAX_CACHE_AGE_S after it is turned
    on. The hottest query prefixes are the most likely to be cached, so those
    are exactly the ones that would *not* reach LocationIQ, and both the
    provider mix in AutocompleteStatsView and the new hit-rate counters would
    misreport the first two days after a flip. See "Flipping the toggle" in
    doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md.
    """
    # Imported lazily so this module stays importable during app loading.
    from feature_toggles.utility import is_feature_enabled_for_current_environment

    return is_feature_enabled_for_current_environment(
        "LOCATIONIQ_AUTOCOMPLETE", default=False
    )


def _locationiq_daily_budget_exceeded():
    """
    IP-agnostic backstop: caps total LocationIQ calls per day regardless of
    who's sending them, independent of the per-second/per-IP rate limits.
    No-op unless LOCATIONIQ_DAILY_BUDGET is configured.
    """
    if not settings.LOCATIONIQ_DAILY_BUDGET:
        return False

    from location.models import AutocompletePeriodStats

    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_today = (
        AutocompletePeriodStats.objects.filter(
            period_type="day", period_key=today_key, provider="locationiq"
        )
        .values_list("total_requests", flat=True)
        .first()
    ) or 0
    return total_today >= settings.LOCATIONIQ_DAILY_BUDGET


def _try_locationiq(q, countrycodes, accept_language):
    if not locationiq_autocomplete_enabled():
        logger.debug(
            "LOCATIONIQ_AUTOCOMPLETE is off, serving %r from Nominatim instead", q
        )
        return None, None
    if not settings.LOCATIONIQ_API_KEY:
        return None, None
    if _locationiq_daily_budget_exceeded():
        logger.warning(
            "LocationIQ daily budget (%s) exceeded, skipping to Nominatim",
            settings.LOCATIONIQ_DAILY_BUDGET,
        )
        return None, None
    params = {
        "key": settings.LOCATIONIQ_API_KEY,
        "q": q,
        "limit": 10,
        "accept-language": accept_language,
        "format": "json",
        "addressdetails": 1,
        "polygon_geojson": 1,
        "polygon_threshold": 0.001,
    }
    if countrycodes:
        params["countrycodes"] = countrycodes
    try:
        resp = requests.get(
            settings.LOCATIONIQ_AUTOCOMPLETE_URL,
            params=params,
            timeout=settings.LOCATIONIQ_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            # A valid-but-empty list is a real "no matches" result, not a
            # failure — only a non-list (or unexpected-status) body should
            # fall through to the Nominatim fallback.
            if isinstance(data, list):
                return data, "locationiq"
        elif resp.status_code == 404:
            # LocationIQ's /autocomplete returns 404 (not 200 + []) when a
            # query has zero matches — also a real "no matches" result, not
            # a provider failure worth falling back to Nominatim for.
            return [], "locationiq"
        logger.warning(
            "LocationIQ returned status %d for query '%s'", resp.status_code, q
        )
    except requests.RequestException as exc:
        logger.warning("LocationIQ request failed for query '%s': %s", q, exc)
    return None, None


def _try_nominatim(q, countrycodes, accept_language):
    if not settings.LOCATION_SERVICE_BASE_URL:
        logger.warning(
            "LOCATION_SERVICE_BASE_URL is not configured, skipping Nominatim fallback"
        )
        return None, None

    url = settings.LOCATION_SERVICE_BASE_URL + "/search"
    params = {
        "q": q,
        "format": "json",
        "addressdetails": 1,
        "polygon_geojson": 1,
        "polygon_threshold": 0.001,
    }
    if countrycodes:
        params["countrycodes"] = countrycodes
    headers = {
        "User-Agent": settings.CUSTOM_USER_AGENT,
        "Accept-Language": accept_language,
    }
    try:
        resp = requests.get(
            url, params=params, headers=headers, timeout=settings.NOMINATIM_TIMEOUT
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                return data, "nominatim"
        logger.warning(
            "Nominatim fallback returned status %d for query '%s'",
            resp.status_code,
            q,
        )
    except requests.RequestException as exc:
        logger.warning("Nominatim fallback failed for query '%s': %s", q, exc)
    return None, None


def fetch_results(q, countrycodes, accept_language):
    """
    Resolve one autocomplete query upstream: LocationIQ first, Nominatim as
    fallback. Returns (results, provider), or (None, None) when both failed.

    An empty list is a real answer ("no matches") and is *not* retried on the
    other provider — only a genuine failure falls through.
    """
    results, provider = _try_locationiq(q, countrycodes, accept_language)
    if results is None:
        results, provider = _try_nominatim(q, countrycodes, accept_language)
    return results, provider


def strip_geometry(results):
    """
    Drop bulky polygon coordinates from autocomplete results before they are
    cached and returned.

    We request `polygon_geojson=1` because the geometry is what ends up in
    Location.multi_polygon — but a single country/region polygon at
    polygon_threshold=0.001 can be megabytes, and autocomplete never *shows*
    the geometry, it only shows names. Caching those payloads in Redis (which
    is also the Celery broker and the Channels layer) is what makes this
    expensive.

    So we keep the geometry *type* and drop only the coordinates:

        {"type": "MultiPolygon", "coordinates": [[...huge...]]}
        ->  {"type": "MultiPolygon", "coordinates": None}

    The type is what the frontend needs (it drives Point-vs-area handling),
    and it is also the marker the backend uses later: when a location is
    saved for the first time, `location.utility.get_location()` sees the
    missing coordinates and re-fetches the real geometry from the provider by
    osm_id/osm_type, so the DB still gets the full polygon.

    Point geometries are left untouched — they are two floats, and keeping
    them avoids a pointless upstream lookup for the most common case.
    """
    if not results:
        return results

    stripped = []
    for entry in results:
        geojson = entry.get("geojson") if isinstance(entry, dict) else None
        if isinstance(geojson, dict) and geojson.get("type") != "Point":
            entry = {**entry, "geojson": {**geojson, "coordinates": None}}
        stripped.append(entry)
    return stripped
