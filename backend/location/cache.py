"""
Redis result cache for autocomplete lookups.

Owns everything about a *stored* result: the cache key, the sliding TTL and
its absolute age ceiling, the LRU index that bounds how many queries are kept,
the delivery marker that keeps hit-rate honest, and the per-day hit/miss
counters.

Reads the Redis key names from `location.queue` (the shared rendezvous
contract) and `strip_geometry` from `location.providers`; nothing here knows
which upstream service produced a result.
"""

import json
import logging
import time
from datetime import datetime, timedelta, timezone

from django.conf import settings

from location.providers import strip_geometry
from location.queue import (
    LOCATIONIQ_LOOKUP_KEY_PREFIX,
    LOCATIONIQ_LRU_KEY,
    LOCATIONIQ_STATS_HITS_KEY_PREFIX,
    LOCATIONIQ_STATS_MISSES_KEY_PREFIX,
    get_redis_conn,
)

logger = logging.getLogger("django")


# ---------------------------------------------------------------------------
# Cache keys
# ---------------------------------------------------------------------------


def _primary_language(accept_language):
    """
    Reduce an Accept-Language header to its primary tag ("de-DE,de;q=0.9" ->
    "de").

    Only the primary tag goes into the cache key: the full header varies per
    browser, so keying on it would shatter the cache into near-duplicates,
    while ignoring language entirely would serve German display names to
    English users (and vice versa) for the whole RESULT_TTL_S.
    """
    if not accept_language:
        return ""
    return accept_language.split(",")[0].split(";")[0].split("-")[0].strip().lower()


def normalize_query(q, countrycodes, accept_language=""):
    """
    Build the cache-key body for one lookup. Everything that changes the
    *answer* has to be in here, and nothing that doesn't.
    """
    return (
        f"{q.strip().lower()}"
        f"|{countrycodes.strip().lower()}"
        f"|{_primary_language(accept_language)}"
    )


def lookup_key(normalized_q):
    """Full Redis key for a normalized query."""
    return f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}{normalized_q}"


def _decode(value):
    return value.decode() if isinstance(value, bytes) else value


# ---------------------------------------------------------------------------
# LRU index
# ---------------------------------------------------------------------------


def _index_and_trim(redis_conn, key, now):
    """
    Record `key` as the most recently used cache entry and evict the oldest
    ones once the index exceeds LOCATION_PROXY_CACHE_MAX_ENTRIES.

    The trim is not atomic with the write above it. A race there can at worst
    evict an entry a moment early, which costs one extra upstream fetch — not
    worth a Lua script to prevent.

    Members can also outlive their keys (a key expires; its sorted-set member
    does not). That is bounded and harmless: the trim keeps ZCARD at or below
    the cap, DEL on a missing key is a no-op, and eviction is oldest-first —
    exactly the members most likely to be expired already. The only cost is
    that the live cache can be slightly smaller than the configured cap.

    That drift does have one sharp edge, which is why eviction checks the value
    before deleting it. A lookup key holds two different things over its life:
    a pending sentinel first, then the cached result. Only results are indexed
    here, but when a cached entry expires its index member stays behind with an
    old score — and if that query is searched again, the *same key* now holds a
    fresh pending sentinel while a stale, very-low-scored member points at it.
    Evicting oldest-first would then DEL a live sentinel out from under an
    in-flight lookup: pollers would see an empty key, re-claim, and enqueue a
    second upstream fetch for a query already being fetched. So a victim whose
    key currently holds a sentinel is dropped from the index only.
    """
    redis_conn.zadd(LOCATIONIQ_LRU_KEY, {key: now})

    max_entries = settings.LOCATION_PROXY_CACHE_MAX_ENTRIES
    if not max_entries:
        return

    overflow = redis_conn.zcard(LOCATIONIQ_LRU_KEY) - max_entries
    if overflow <= 0:
        return

    for victim in redis_conn.zrange(LOCATIONIQ_LRU_KEY, 0, overflow - 1):
        victim_key = _decode(victim)
        if _holds_pending_sentinel(redis_conn, victim_key):
            # Stale index member pointing at a resurrected key. Drop the member
            # so the cap still makes progress, but leave the sentinel alone.
            redis_conn.zrem(LOCATIONIQ_LRU_KEY, victim_key)
            continue
        redis_conn.delete(victim_key)
        redis_conn.zrem(LOCATIONIQ_LRU_KEY, victim_key)


def _holds_pending_sentinel(redis_conn, key):
    """
    True if `key` currently holds an in-flight lookup rather than a result.

    One extra GET, and only on the eviction path, so it costs nothing on a
    normal store. A key that has gone missing or holds something unparseable is
    treated as evictable — DEL on it is a no-op anyway.
    """
    try:
        raw = redis_conn.get(key)
        return bool(raw) and json.loads(raw).get("status") == "pending"
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Reading and refreshing cached results
# ---------------------------------------------------------------------------


def refresh_cache_entry(redis_conn, key, data, now):
    """
    Apply the sliding TTL on a cache hit. Returns False when the entry has
    outlived LOCATION_PROXY_MAX_CACHE_AGE_S and must be re-fetched.

    The refreshed TTL is capped by the entry's remaining age budget, so the key
    expires on its own exactly LOCATION_PROXY_MAX_CACHE_AGE_S after it was first
    fetched. The explicit age check below is a safety net for clock skew.

    Also consumes the `delivered` marker: the first read of a freshly stored
    result is the tail of the lookup that produced it, not a cache hit. See
    was_undelivered() and store_result.

    Only ever called for successful results — a negative-cached failure must
    keep its few-second TTL rather than being promoted to a day.

    The writes go out in one pipeline. There is nothing to make atomic here —
    the ops are independent and the trim was never atomic either — but this is
    the hottest endpoint in the app, so it is worth one round trip instead of
    two or three.

    **Every write here is best-effort.** A cache hit cannot be a pure read in
    this design — the sliding TTL needs EXPIRE, LRU-by-*access* needs ZADD, the
    delivery marker needs SETEX — but none of those affect the response: they
    are cache maintenance, and the results are already in hand. Redis can
    accept reads while refusing writes (at `maxmemory` under a `noeviction`
    policy, on a read-only replica, mid-failover), and that is precisely the
    situation this cache is designed around, since the same instance carries
    the Celery broker and the Channels layer. Letting a failed EXPIRE turn a
    servable hit into a 500 would make the endpoint *less* available than it
    was before the cache existed. So the writes are wrapped, and the one thing
    that must never be swallowed — whether the entry is past its age ceiling —
    is decided from the payload alone, before any Redis call.
    """
    first_fetched_at = data.get("first_fetched_at")
    too_old = (
        first_fetched_at is not None
        and (now - first_fetched_at) >= settings.LOCATION_PROXY_MAX_CACHE_AGE_S
    )
    # Both of these change the stored value, so they need a rewrite rather
    # than a bare EXPIRE.
    needs_rewrite = data.get("delivered") is False
    data["delivered"] = True

    try:
        if too_old:
            pipe = redis_conn.pipeline()
            pipe.delete(key)
            pipe.zrem(LOCATIONIQ_LRU_KEY, key)
            pipe.execute()
        elif first_fetched_at is None:
            # Written by a deploy that predates this field. Adopt now as its
            # birth and persist that, so later hits age from a stable point
            # rather than resetting the 48h budget on every request.
            data["first_fetched_at"] = now
            redis_conn.setex(
                key, settings.LOCATION_PROXY_RESULT_TTL_S, json.dumps(data)
            )
            _index_and_trim(redis_conn, key, now)
        else:
            new_ttl = int(
                min(
                    settings.LOCATION_PROXY_RESULT_TTL_S,
                    settings.LOCATION_PROXY_MAX_CACHE_AGE_S - (now - first_fetched_at),
                )
            )
            pipe = redis_conn.pipeline()
            if needs_rewrite:
                pipe.setex(key, max(new_ttl, 1), json.dumps(data))
            elif new_ttl > 0:
                pipe.expire(key, new_ttl)
            # Refresh recency so the trim measures last *access*, not last write.
            pipe.zadd(LOCATIONIQ_LRU_KEY, {key: now})
            pipe.execute()
    except Exception:
        # Worst case the entry keeps its previous TTL and is re-fetched sooner,
        # or an unconsumed delivery marker costs one uncounted hit. Both are
        # cheaper than failing the request.
        logger.warning(
            "Could not refresh autocomplete cache entry %s; serving it anyway",
            key,
            exc_info=True,
        )

    return not too_old


def was_undelivered(data):
    """
    True if nothing has read this cached result yet.

    Must be called *before* refresh_cache_entry, which consumes the marker.
    Entries written before the marker existed have no `delivered` key and count
    as already delivered — the safe default, since treating an old entry as a
    fresh delivery would silently drop a real hit.

    Consumption is at-most-once, not exactly-once: the read here and the
    rewrite in refresh_cache_entry are not atomic, so two pollers arriving
    together on a freshly stored result both see False and neither counts a
    hit. That is deliberate. It undercounts (one genuinely saved upstream call
    goes unrecorded) rather than overcounts, which is the right direction for a
    metric whose whole purpose is to prove the cache is worth its complexity —
    and a CAS or Lua script to make it exact would cost more, on the hot path,
    than the accuracy is worth. Do not "fix" this by moving the marker read
    into refresh_cache_entry: that reintroduces the ~50% hit_rate floor this
    marker exists to remove.
    """
    return data.get("delivered") is False


# ---------------------------------------------------------------------------
# Writing results
# ---------------------------------------------------------------------------


def store_result(redis_conn, key, job_id, results, provider, delivered=False):
    """
    Write the terminal state for an autocomplete lookup key.

    A real result (including a legitimately empty list) is cached for
    LOCATION_PROXY_RESULT_TTL_S and enters the LRU index. A failure (results is
    None — both providers down, or a task that crashed) only gets
    LOCATION_PROXY_NEGATIVE_TTL_S and is deliberately left out of the index, so a
    transient outage self-corrects within seconds instead of being served as
    an empty answer for the full positive-cache lifetime and occupying a cache
    slot while it does. See Gap #7 in the design doc.

    `delivered` says whether the caller is handing this result straight back to
    a user. The Celery task isn't (it writes the result for a *later* poll to
    collect, so the default is False); the inline fetch is, and passes True.
    It only affects the hit/miss counters — see was_undelivered().
    """
    is_real_result = results is not None
    ttl = (
        settings.LOCATION_PROXY_RESULT_TTL_S
        if is_real_result
        else settings.LOCATION_PROXY_NEGATIVE_TTL_S
    )
    now = time.time()
    payload = {
        "status": "done",
        "results": strip_geometry(results),
        "provider": provider,
        "job_id": job_id,
    }
    if is_real_result:
        # Anchors the 48h ceiling. Absent on failures, which never slide.
        payload["first_fetched_at"] = now
        payload["delivered"] = delivered

    redis_conn.setex(key, ttl, json.dumps(payload))

    if is_real_result:
        _index_and_trim(redis_conn, key, now)


# ---------------------------------------------------------------------------
# Hit / miss counters
# ---------------------------------------------------------------------------


def _day_key(prefix, moment=None):
    moment = moment or datetime.now(timezone.utc)
    return f"{prefix}{moment.strftime('%Y-%m-%d')}"


def _incr_stat(redis_conn, prefix):
    """
    Bump a per-day counter. Never lets a metrics failure break a user-facing
    request — same principle as log_autocomplete_request.

    Only the increment that *creates* the key sets its TTL. Re-expiring on
    every write would cost a second round trip per request on the hot path, and
    would turn the documented 7-day retention into a sliding window that keeps
    a busy day's counter alive indefinitely.
    """
    key = _day_key(prefix)
    try:
        if redis_conn.incr(key) == 1:
            redis_conn.expire(key, settings.LOCATION_PROXY_STATS_TTL_S)
    except Exception as exc:
        logger.warning(
            "Failed to increment autocomplete cache counter %s: %s", key, exc
        )


def record_cache_hit(redis_conn):
    _incr_stat(redis_conn, LOCATIONIQ_STATS_HITS_KEY_PREFIX)


def record_cache_miss(redis_conn):
    _incr_stat(redis_conn, LOCATIONIQ_STATS_MISSES_KEY_PREFIX)


def get_cache_stats(days=7):
    """
    Per-day cache hit/miss counts, newest first.

    Once results are cached for a day, AutocompletePeriodStats necessarily
    falls — that is the point, but it makes a working cache indistinguishable
    from a drop in traffic. These counters are what tells the two apart.
    """
    redis_conn = get_redis_conn()
    today = datetime.now(timezone.utc)
    stats = []
    for offset in range(days):
        moment = today - timedelta(days=offset)
        hits = int(
            _decode(redis_conn.get(_day_key(LOCATIONIQ_STATS_HITS_KEY_PREFIX, moment)))
            or 0
        )
        misses = int(
            _decode(
                redis_conn.get(_day_key(LOCATIONIQ_STATS_MISSES_KEY_PREFIX, moment))
            )
            or 0
        )
        total = hits + misses
        stats.append(
            {
                "day": moment.strftime("%Y-%m-%d"),
                "hits": hits,
                "misses": misses,
                "hit_rate": round(hits / total, 4) if total else None,
            }
        )
    return stats
