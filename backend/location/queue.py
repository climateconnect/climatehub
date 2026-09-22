"""
The Redis rendezvous contract for autocomplete lookups.

Three parties meet on these keys and must agree on them exactly:
LocationAutocompleteView (location_views.py), the fetch_autocomplete Celery
task (tasks.py), and the result cache (cache.py). They live in their own
module so that agreement is a single import rather than a convention, and so
none of those three has to import either of the others just to name a key.

See doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md for the
full contract (key lifecycle, HTTP protocol, failure modes).

The `locationiq:` key prefixes are historical. They are a live Redis
namespace, so renaming them would orphan every cached entry and in-flight
sentinel on deploy — not worth it for a cosmetic change. The *settings* that
tune this layer are provider-neutral (LOCATION_PROXY_*).
"""

from django_redis import get_redis_connection

# Terminal state (a cached result) and transient state (a pending sentinel)
# share one key per query — which is what makes the rendezvous work, and why
# eviction has to check what a key currently holds. See cache._index_and_trim.
LOCATIONIQ_LOOKUP_KEY_PREFIX = "locationiq:lookup:"
# Sorted set of in-flight lookups, score = claim time. Bounds concurrent
# upstream work (LOCATION_PROXY_PENDING_CAP) and ages out abandoned sentinels.
LOCATIONIQ_PENDING_JOBS_KEY = "locationiq:pending_jobs"
# Short-lived NX lock held while one request takes over an abandoned pending
# sentinel, so concurrent pollers don't all fetch the same query at once.
LOCATIONIQ_RECLAIM_KEY_PREFIX = "locationiq:reclaim:"
# LRU index over cached results: member = lookup key, score = last access time.
# Only successful results are indexed — pending sentinels are already tracked
# in LOCATIONIQ_PENDING_JOBS_KEY, and negative-cached failures live for a few
# seconds and must not consume a cache slot.
LOCATIONIQ_LRU_KEY = "locationiq:lru"
# Per-day cache effectiveness counters. Redis INCRs rather than DB rows: this
# is the hot path, and AutocompleteRequestLog already records the expensive
# event (an actual upstream call) in Postgres.
LOCATIONIQ_STATS_HITS_KEY_PREFIX = "locationiq:stats:hits:"
LOCATIONIQ_STATS_MISSES_KEY_PREFIX = "locationiq:stats:misses:"


def get_redis_conn():
    return get_redis_connection("default")
