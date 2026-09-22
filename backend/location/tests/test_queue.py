import datetime as dt
import json
import time
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from redis import exceptions as redis_exceptions
from rest_framework import status
from rest_framework.test import APIClient

from feature_toggles.models import FeatureToggle
from location.cache import (
    get_cache_stats,
    normalize_query,
    record_cache_hit,
    record_cache_miss,
    refresh_cache_entry,
    store_result,
    was_undelivered,
)
from location.providers import (
    _locationiq_daily_budget_exceeded,
    _try_locationiq,
    fetch_results,
    locationiq_autocomplete_enabled,
    strip_geometry,
)
from location.queue import (
    LOCATIONIQ_LOOKUP_KEY_PREFIX,
    LOCATIONIQ_LRU_KEY,
    LOCATIONIQ_PENDING_JOBS_KEY,
    LOCATIONIQ_STATS_HITS_KEY_PREFIX,
    LOCATIONIQ_STATS_MISSES_KEY_PREFIX,
)
from location.tasks import fetch_autocomplete


class TestNormalizeQuery(TestCase):
    def test_basic(self):
        self.assertEqual(normalize_query("Berlin", "de"), "berlin|de|")

    def test_empty_countrycodes(self):
        self.assertEqual(normalize_query("Berlin", ""), "berlin||")

    def test_strips_whitespace(self):
        self.assertEqual(normalize_query("  Berlin  ", "  DE  "), "berlin|de|")

    def test_case_insensitive(self):
        self.assertEqual(normalize_query("BERLIN", "DE"), "berlin|de|")

    def test_language_is_part_of_the_key(self):
        # Provider results are localized, so an English and a German lookup
        # for the same query must not share a cache entry.
        self.assertNotEqual(
            normalize_query("Berlin", "", "en-US,en;q=0.9"),
            normalize_query("Berlin", "", "de-DE,de;q=0.9"),
        )

    def test_only_the_primary_language_tag_is_used(self):
        # Otherwise every browser's slightly different Accept-Language header
        # would get its own cache entry.
        self.assertEqual(
            normalize_query("Berlin", "", "de-DE,de;q=0.9,en;q=0.8"),
            normalize_query("Berlin", "", "de-AT,de;q=0.7"),
        )
        self.assertEqual(normalize_query("Berlin", "", "DE"), "berlin||de")


class TestStripGeometry(TestCase):
    def test_polygon_coordinates_are_dropped_but_type_kept(self):
        results = [
            {
                "display_name": "Germany",
                "importance": 0.9,
                "geojson": {"type": "MultiPolygon", "coordinates": [[[[1, 2]]]]},
            }
        ]

        stripped = strip_geometry(results)

        self.assertEqual(stripped[0]["geojson"]["type"], "MultiPolygon")
        self.assertIsNone(stripped[0]["geojson"]["coordinates"])
        # Everything the frontend actually renders survives untouched.
        self.assertEqual(stripped[0]["display_name"], "Germany")
        self.assertEqual(stripped[0]["importance"], 0.9)

    def test_points_are_left_alone(self):
        # Two floats — cheap to cache, and keeping them avoids a pointless
        # upstream geometry lookup on save for the most common case.
        results = [{"geojson": {"type": "Point", "coordinates": [13.4, 52.5]}}]

        self.assertEqual(strip_geometry(results), results)

    def test_does_not_mutate_the_input(self):
        results = [{"geojson": {"type": "Polygon", "coordinates": [[[1, 2]]]}}]

        strip_geometry(results)

        self.assertEqual(results[0]["geojson"]["coordinates"], [[[1, 2]]])

    def test_handles_missing_and_empty_geojson(self):
        self.assertEqual(strip_geometry([]), [])
        self.assertIsNone(strip_geometry(None))
        self.assertEqual(
            strip_geometry([{"display_name": "x"}]), [{"display_name": "x"}]
        )


def _make_mock_redis():
    """
    Single-process, in-memory stand-in for the LocationIQ rendezvous. Only
    implements the redis-py surface this design actually uses (string
    get/set/setex/delete and the pending_jobs sorted set).
    """
    store = {}
    zsets = {}
    ttls = {}

    def _to_score(value):
        if isinstance(value, str):
            if value.lstrip("+") in ("inf", "Inf", "INF") and value.startswith("-"):
                return float("-inf")
            if value in ("+inf", "inf", "+Inf", "INF"):
                return float("inf")
            if value == "-inf":
                return float("-inf")
            return float(value)
        return float(value)

    def _get(key):
        val = store.get(key)
        if val is None:
            return None
        return val.encode() if isinstance(val, str) else val

    def _set(key, value, nx=False, ex=None):
        if nx and key in store:
            return False
        store[key] = value
        return True

    def _setex(key, ttl, value):
        store[key] = value
        ttls[key] = ttl
        return True

    def _delete(key):
        store.pop(key, None)
        ttls.pop(key, None)

    def _zadd(key, mapping):
        zsets.setdefault(key, {}).update(mapping)

    def _zcard(key):
        return len(zsets.get(key, {}))

    def _zrem(key, member):
        zsets.get(key, {}).pop(member, None)

    def _zremrangebyscore(key, min_score, max_score):
        members = zsets.get(key, {})
        lo, hi = _to_score(min_score), _to_score(max_score)
        for member in [m for m, s in members.items() if lo <= s <= hi]:
            members.pop(member, None)

    def _zrange(key, start, stop):
        ordered = sorted(zsets.get(key, {}).items(), key=lambda item: item[1])
        members = [m for m, _ in ordered]
        # Redis' stop index is inclusive, and -1 means "to the end".
        return members[start:] if stop == -1 else members[start : stop + 1]

    def _expire(key, ttl):
        ttls[key] = ttl
        return key in store

    def _incr(key):
        store[key] = str(int(store.get(key, 0)) + 1)
        return int(store[key])

    redis = MagicMock()
    redis.get = MagicMock(side_effect=_get)
    redis.set = MagicMock(side_effect=_set)
    redis.setex = MagicMock(side_effect=_setex)
    redis.delete = MagicMock(side_effect=_delete)
    redis.expire = MagicMock(side_effect=_expire)
    redis.incr = MagicMock(side_effect=_incr)
    redis.zadd = MagicMock(side_effect=_zadd)
    redis.zcard = MagicMock(side_effect=_zcard)
    redis.zrem = MagicMock(side_effect=_zrem)
    redis.zrange = MagicMock(side_effect=_zrange)
    redis.zremrangebyscore = MagicMock(side_effect=_zremrangebyscore)

    def _pipeline(*_args, **_kwargs):
        """
        A pipeline that applies each command immediately instead of buffering
        until execute(). Ordering and final state are identical for the
        independent writes this code pipelines, and reusing the same command
        mocks means assertions like `mock_redis.expire.assert_not_called()`
        keep working whether the caller pipelines or not.
        """
        pipe = MagicMock()
        for name in ("get", "set", "setex", "delete", "expire", "incr"):
            setattr(pipe, name, getattr(redis, name))
        for name in ("zadd", "zcard", "zrem", "zrange", "zremrangebyscore"):
            setattr(pipe, name, getattr(redis, name))
        pipe.execute = MagicMock(return_value=[])
        return pipe

    redis.pipeline = MagicMock(side_effect=_pipeline)
    redis._store = store
    redis._zsets = zsets
    redis._ttls = ttls
    return redis


def _set_locationiq_toggle(active):
    """
    Put the LOCATIONIQ_AUTOCOMPLETE toggle into a known state.

    Migration 0006 seeds this row, but tests must not rely on that: a
    TransactionTestCase truncates every table when it finishes and does not
    restore migration data, so whichever test runs next would otherwise find
    the toggle missing and silently fall back to "disabled". The Django cache
    is cleared too, because is_feature_enabled memoizes for 5 minutes.
    """
    FeatureToggle.objects.update_or_create(
        name="LOCATIONIQ_AUTOCOMPLETE",
        defaults={"development_is_active": active},
    )
    cache.clear()


class TestTryLocationiq(TestCase):
    def setUp(self):
        # _try_locationiq consults the LOCATIONIQ_AUTOCOMPLETE toggle.
        _set_locationiq_toggle(True)

    def test_no_api_key_skips_locationiq(self):
        with override_settings(LOCATIONIQ_API_KEY=""):
            results, provider = _try_locationiq("berlin", "", "en")
        self.assertIsNone(results)
        self.assertIsNone(provider)

    @override_settings(LOCATIONIQ_API_KEY="test-key")
    @patch("location.providers.requests.get")
    def test_empty_result_list_is_success_not_failure(self, mock_get):
        # A valid 200 with an empty list is a real "no matches" answer, not
        # a failure — it must not trigger a Nominatim fallback attempt.
        mock_get.return_value = MagicMock(status_code=200, json=lambda: [])
        results, provider = _try_locationiq("asdkjasjdk", "", "en")
        self.assertEqual(results, [])
        self.assertEqual(provider, "locationiq")

    @override_settings(LOCATIONIQ_API_KEY="test-key")
    @patch("location.providers.requests.get")
    def test_404_is_success_not_failure(self, mock_get):
        # LocationIQ's /autocomplete returns 404 (not 200 + []) when a query
        # has zero matches — this is also a real "no matches" answer and
        # must not trigger a Nominatim fallback attempt.
        mock_get.return_value = MagicMock(status_code=404, json=lambda: {})
        results, provider = _try_locationiq("zzzqqqnonsenseplace", "", "en")
        self.assertEqual(results, [])
        self.assertEqual(provider, "locationiq")

    @override_settings(LOCATIONIQ_API_KEY="test-key")
    @patch("location.providers.requests.get")
    def test_non_list_body_is_a_failure(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: {"error": "bad"}
        )
        results, provider = _try_locationiq("berlin", "", "en")
        self.assertIsNone(results)
        self.assertIsNone(provider)

    @override_settings(LOCATIONIQ_API_KEY="test-key", LOCATIONIQ_DAILY_BUDGET=5)
    @patch("location.providers._locationiq_daily_budget_exceeded", return_value=True)
    @patch("location.providers.requests.get")
    def test_daily_budget_exceeded_skips_locationiq_entirely(
        self, mock_get, _mock_budget
    ):
        results, provider = _try_locationiq("berlin", "", "en")
        self.assertIsNone(results)
        self.assertIsNone(provider)
        mock_get.assert_not_called()


class TestLocationiqDailyBudget(TestCase):
    def _seed_today(self, total_requests):
        from location.models import AutocompletePeriodStats

        today_key = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        AutocompletePeriodStats.objects.create(
            period_type="day",
            period_key=today_key,
            provider="locationiq",
            total_requests=total_requests,
        )

    def test_not_configured_never_exceeded(self):
        with override_settings(LOCATIONIQ_DAILY_BUDGET=None):
            self.assertFalse(_locationiq_daily_budget_exceeded())

    @override_settings(LOCATIONIQ_DAILY_BUDGET=5)
    def test_below_budget_not_exceeded(self):
        self._seed_today(4)
        self.assertFalse(_locationiq_daily_budget_exceeded())

    @override_settings(LOCATIONIQ_DAILY_BUDGET=5)
    def test_at_budget_is_exceeded(self):
        self._seed_today(5)
        self.assertTrue(_locationiq_daily_budget_exceeded())

    @override_settings(LOCATIONIQ_DAILY_BUDGET=5)
    def test_no_rows_yet_not_exceeded(self):
        self.assertFalse(_locationiq_daily_budget_exceeded())


class TestStoreResult(TestCase):
    @override_settings(LOCATION_PROXY_RESULT_TTL_S=300, LOCATION_PROXY_NEGATIVE_TTL_S=8)
    def test_success_uses_positive_ttl(self):
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", [{"a": 1}], "locationiq")
        key, ttl, payload = mock_redis.setex.call_args[0]
        self.assertEqual(key, "key1")
        self.assertEqual(ttl, 300)
        stored = json.loads(payload)
        self.assertEqual(stored["status"], "done")
        self.assertEqual(stored["results"], [{"a": 1}])
        self.assertEqual(stored["provider"], "locationiq")
        self.assertEqual(stored["job_id"], "job1")
        # Anchors the absolute cache-age ceiling.
        self.assertAlmostEqual(stored["first_fetched_at"], time.time(), delta=5)

    @override_settings(LOCATION_PROXY_RESULT_TTL_S=300, LOCATION_PROXY_NEGATIVE_TTL_S=8)
    def test_empty_but_real_result_uses_positive_ttl(self):
        # Distinguishes a legitimate "no matches" ([]) from a failure (None).
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", [], "locationiq")
        _, ttl, _ = mock_redis.setex.call_args[0]
        self.assertEqual(ttl, 300)

    @override_settings(LOCATION_PROXY_RESULT_TTL_S=300, LOCATION_PROXY_NEGATIVE_TTL_S=8)
    def test_failure_uses_negative_ttl(self):
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", None, None)
        _, ttl, payload = mock_redis.setex.call_args[0]
        self.assertEqual(ttl, 8)
        self.assertIsNone(json.loads(payload)["results"])

    @override_settings(LOCATION_PROXY_RESULT_TTL_S=300, LOCATION_PROXY_NEGATIVE_TTL_S=8)
    def test_failure_is_not_indexed_and_has_no_age_anchor(self):
        # A negative-cached failure must not occupy one of the capped cache
        # slots, and must not be eligible for the sliding TTL.
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", None, None)
        self.assertNotIn("first_fetched_at", json.loads(mock_redis._store["key1"]))
        self.assertEqual(mock_redis._zsets.get(LOCATIONIQ_LRU_KEY, {}), {})

    def test_success_enters_the_lru_index(self):
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", [{"a": 1}], "locationiq")
        self.assertIn("key1", mock_redis._zsets[LOCATIONIQ_LRU_KEY])

    def test_result_starts_undelivered(self):
        # The Celery task writes for a *later* poll to collect, so the poll
        # that collects it is the tail of a miss, not a cache hit.
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", [{"a": 1}], "locationiq")
        self.assertFalse(json.loads(mock_redis._store["key1"])["delivered"])

    def test_inline_fetch_marks_the_result_delivered(self):
        # The inline path returns the result in the same response, so there is
        # no later poll to consume the marker.
        mock_redis = _make_mock_redis()
        store_result(
            mock_redis, "key1", "job1", [{"a": 1}], "locationiq", delivered=True
        )
        self.assertTrue(json.loads(mock_redis._store["key1"])["delivered"])

    def test_failure_carries_no_delivery_marker(self):
        mock_redis = _make_mock_redis()
        store_result(mock_redis, "key1", "job1", None, None)
        self.assertNotIn("delivered", json.loads(mock_redis._store["key1"]))


class TestCacheSizeCap(TestCase):
    @override_settings(LOCATION_PROXY_CACHE_MAX_ENTRIES=3)
    def test_oldest_entry_is_evicted_once_the_cap_is_exceeded(self):
        mock_redis = _make_mock_redis()
        for i in range(4):
            store_result(mock_redis, f"key{i}", "job", [{"i": i}], "locationiq")
            time.sleep(0.01)  # keep LRU scores distinct

        self.assertEqual(mock_redis.zcard(LOCATIONIQ_LRU_KEY), 3)
        self.assertNotIn("key0", mock_redis._store)
        self.assertNotIn("key0", mock_redis._zsets[LOCATIONIQ_LRU_KEY])
        self.assertIn("key3", mock_redis._store)

    @override_settings(
        LOCATION_PROXY_CACHE_MAX_ENTRIES=3, LOCATION_PROXY_MAX_CACHE_AGE_S=48 * 3600
    )
    def test_eviction_uses_last_access_not_last_write(self):
        # The whole point of refreshing recency on a hit: a query that is read
        # constantly must survive even though it was written first.
        mock_redis = _make_mock_redis()
        for i in range(3):
            store_result(mock_redis, f"key{i}", "job", [{"i": i}], "locationiq")
            time.sleep(0.01)

        # Read the oldest entry, so it becomes the most recently used.
        data = json.loads(mock_redis._store["key0"])
        refresh_cache_entry(mock_redis, "key0", data, time.time())

        store_result(mock_redis, "key3", "job", [{"i": 3}], "locationiq")

        self.assertIn("key0", mock_redis._store)
        self.assertNotIn("key1", mock_redis._store)

    @override_settings(LOCATION_PROXY_CACHE_MAX_ENTRIES=5)
    def test_index_never_exceeds_the_cap(self):
        mock_redis = _make_mock_redis()
        for i in range(20):
            store_result(mock_redis, f"key{i}", "job", [{"i": i}], "locationiq")
            self.assertLessEqual(mock_redis.zcard(LOCATIONIQ_LRU_KEY), 5)

    @override_settings(LOCATION_PROXY_CACHE_MAX_ENTRIES=2)
    def test_eviction_never_deletes_a_live_pending_sentinel(self):
        """
        A lookup key holds a sentinel first and a result later, but only
        results are indexed. When a cached entry expires its index member stays
        behind; if that query is then searched again the same key holds a fresh
        sentinel while a stale, oldest-scored member still points at it.
        Evicting it would kill an in-flight lookup and cause a duplicate
        upstream fetch.
        """
        mock_redis = _make_mock_redis()
        stale_key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        # The result expired (key gone) but its index member survived.
        mock_redis._zsets[LOCATIONIQ_LRU_KEY] = {stale_key: time.time() - 10_000}
        # The query was searched again, so the key now holds a pending sentinel.
        mock_redis._store[stale_key] = json.dumps(
            {"status": "pending", "job_id": "j", "created_at": time.time()}
        )

        for i in range(2):
            store_result(mock_redis, f"other{i}", "job", [{"i": i}], "locationiq")

        # Evicted from the index (so the cap still makes progress) but the
        # in-flight sentinel itself is untouched.
        self.assertNotIn(stale_key, mock_redis._zsets[LOCATIONIQ_LRU_KEY])
        self.assertIn(stale_key, mock_redis._store)
        self.assertEqual(json.loads(mock_redis._store[stale_key])["status"], "pending")

    @override_settings(LOCATION_PROXY_CACHE_MAX_ENTRIES=2)
    def test_eviction_still_deletes_a_cached_result(self):
        # The guard above must not make eviction a no-op for real entries.
        mock_redis = _make_mock_redis()
        for i in range(3):
            store_result(mock_redis, f"key{i}", "job", [{"i": i}], "locationiq")
            time.sleep(0.01)

        self.assertNotIn("key0", mock_redis._store)
        self.assertEqual(mock_redis.zcard(LOCATIONIQ_LRU_KEY), 2)


@override_settings(
    LOCATION_PROXY_RESULT_TTL_S=24 * 3600, LOCATION_PROXY_MAX_CACHE_AGE_S=48 * 3600
)
class TestRefreshCacheEntry(TestCase):
    def _entry(self, first_fetched_at):
        return {
            "status": "done",
            "results": [{"a": 1}],
            "provider": "locationiq",
            "job_id": "j",
            "first_fetched_at": first_fetched_at,
        }

    def test_hit_inside_the_first_day_resets_the_full_ttl(self):
        mock_redis = _make_mock_redis()
        now = time.time()
        data = self._entry(now - 20 * 3600)

        self.assertTrue(refresh_cache_entry(mock_redis, "key1", data, now))

        self.assertEqual(mock_redis._ttls["key1"], 24 * 3600)

    def test_hit_near_the_ceiling_is_capped_by_the_remaining_budget(self):
        # At 47h old, the entry may only live one more hour — not another day.
        mock_redis = _make_mock_redis()
        now = time.time()
        data = self._entry(now - 47 * 3600)

        self.assertTrue(refresh_cache_entry(mock_redis, "key1", data, now))

        self.assertAlmostEqual(mock_redis._ttls["key1"], 3600, delta=5)

    def test_entry_past_the_ceiling_is_dropped_and_reported_as_a_miss(self):
        mock_redis = _make_mock_redis()
        now = time.time()
        mock_redis._store["key1"] = json.dumps(self._entry(now - 49 * 3600))
        mock_redis._zsets[LOCATIONIQ_LRU_KEY] = {"key1": now - 49 * 3600}
        data = self._entry(now - 49 * 3600)

        self.assertFalse(refresh_cache_entry(mock_redis, "key1", data, now))

        self.assertNotIn("key1", mock_redis._store)
        self.assertNotIn("key1", mock_redis._zsets[LOCATIONIQ_LRU_KEY])

    def test_hit_refreshes_lru_recency(self):
        mock_redis = _make_mock_redis()
        now = time.time()
        mock_redis._zsets[LOCATIONIQ_LRU_KEY] = {"key1": now - 20 * 3600}

        refresh_cache_entry(mock_redis, "key1", self._entry(now - 20 * 3600), now)

        self.assertAlmostEqual(
            mock_redis._zsets[LOCATIONIQ_LRU_KEY]["key1"], now, delta=1
        )

    def test_first_read_consumes_the_delivery_marker_and_persists_it(self):
        mock_redis = _make_mock_redis()
        now = time.time()
        data = {**self._entry(now - 3600), "delivered": False}
        mock_redis._store["key1"] = json.dumps(data)

        self.assertTrue(was_undelivered(data))
        refresh_cache_entry(mock_redis, "key1", data, now)

        # Persisted, so the *next* request is a genuine hit.
        self.assertTrue(json.loads(mock_redis._store["key1"])["delivered"])
        self.assertFalse(was_undelivered(json.loads(mock_redis._store["key1"])))

    def test_consuming_the_marker_still_respects_the_age_ceiling(self):
        # The rewrite must not hand a 24h TTL to an entry that only has an
        # hour of its 48h budget left.
        mock_redis = _make_mock_redis()
        now = time.time()
        data = {**self._entry(now - 47 * 3600), "delivered": False}

        refresh_cache_entry(mock_redis, "key1", data, now)

        self.assertAlmostEqual(mock_redis._ttls["key1"], 3600, delta=5)

    def test_write_failure_still_serves_the_entry(self):
        """
        Redis can accept reads while refusing writes — at maxmemory under a
        noeviction policy, on a read-only replica, mid-failover. The TTL slide
        and the LRU touch are maintenance, not part of the answer, so a hit
        that is already in hand must still be served rather than 500ing.
        """
        mock_redis = _make_mock_redis()
        oom = redis_exceptions.ResponseError("OOM command not allowed")
        mock_redis.pipeline.side_effect = oom
        mock_redis.setex.side_effect = oom
        now = time.time()

        self.assertTrue(
            refresh_cache_entry(mock_redis, "key1", self._entry(now - 3600), now)
        )

    def test_write_failure_does_not_resurrect_an_entry_past_the_ceiling(self):
        # The age decision comes from the payload, not from Redis, so a failed
        # DEL must not turn "too old, re-fetch" into "serve it anyway".
        mock_redis = _make_mock_redis()
        mock_redis.pipeline.side_effect = redis_exceptions.ResponseError("OOM")
        now = time.time()

        self.assertFalse(
            refresh_cache_entry(mock_redis, "key1", self._entry(now - 49 * 3600), now)
        )

    def test_entry_predating_the_marker_counts_as_delivered(self):
        # Treating an old entry as a fresh delivery would silently drop a hit.
        self.assertFalse(was_undelivered(self._entry(time.time())))

    def test_entry_without_an_age_anchor_adopts_now_and_persists_it(self):
        # Written by the deploy that predates first_fetched_at. It must not
        # reset its 48h budget on every subsequent hit.
        mock_redis = _make_mock_redis()
        now = time.time()
        data = {"status": "done", "results": [{"a": 1}], "provider": "x", "job_id": "j"}

        self.assertTrue(refresh_cache_entry(mock_redis, "key1", data, now))

        self.assertEqual(json.loads(mock_redis._store["key1"])["first_fetched_at"], now)


class TestCacheCounters(TestCase):
    def test_hits_and_misses_are_counted_per_day(self):
        mock_redis = _make_mock_redis()
        record_cache_hit(mock_redis)
        record_cache_hit(mock_redis)
        record_cache_miss(mock_redis)

        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_HITS_KEY_PREFIX}{today}"]), 2
        )
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_MISSES_KEY_PREFIX}{today}"]), 1
        )

    def test_only_the_first_increment_of_the_day_sets_the_ttl(self):
        # Re-expiring on every hit would cost a round trip per request and turn
        # the fixed 7-day retention into a sliding one.
        mock_redis = _make_mock_redis()
        for _ in range(5):
            record_cache_hit(mock_redis)

        self.assertEqual(mock_redis.expire.call_count, 1)
        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_HITS_KEY_PREFIX}{today}"]), 5
        )

    def test_counter_failure_never_breaks_the_request(self):
        broken = MagicMock()
        broken.incr.side_effect = RuntimeError("redis is down")
        record_cache_hit(broken)  # must not raise

    @patch("location.cache.get_redis_conn")
    def test_get_cache_stats_reports_hit_rate(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        for _ in range(3):
            record_cache_hit(mock_redis)
        record_cache_miss(mock_redis)

        today = get_cache_stats(days=2)[0]

        self.assertEqual(today["hits"], 3)
        self.assertEqual(today["misses"], 1)
        self.assertEqual(today["hit_rate"], 0.75)

    @patch("location.cache.get_redis_conn")
    def test_get_cache_stats_hit_rate_is_none_without_traffic(self, mock_conn):
        mock_conn.return_value = _make_mock_redis()
        self.assertIsNone(get_cache_stats(days=1)[0]["hit_rate"])


class TestLocationiqFeatureToggle(TestCase):
    """
    The kill switch. With LOCATIONIQ_AUTOCOMPLETE off the proxy keeps working
    for clients on a stale JS bundle, but must never spend LocationIQ quota.
    """

    def setUp(self):
        cache.clear()  # is_feature_enabled memoizes for 5 minutes

    def tearDown(self):
        # The DB row is rolled back with the test transaction, but the toggle
        # cache is not — leaving a stale False behind would disable LocationIQ
        # for every test that runs after this class.
        cache.clear()

    def _set_toggle(self, active):
        _set_locationiq_toggle(active)

    @override_settings(LOCATIONIQ_API_KEY="test-key")
    @patch("location.providers.requests.get")
    def test_toggle_off_never_calls_locationiq(self, mock_get):
        self._set_toggle(False)

        results, provider = _try_locationiq("berlin", "", "en")

        self.assertIsNone(results)
        self.assertIsNone(provider)
        mock_get.assert_not_called()

    @override_settings(LOCATIONIQ_API_KEY="test-key")
    @patch("location.providers.requests.get")
    def test_toggle_on_calls_locationiq(self, mock_get):
        self._set_toggle(True)
        mock_get.return_value = MagicMock(status_code=200, json=lambda: [{"a": 1}])

        results, provider = _try_locationiq("berlin", "", "en")

        self.assertEqual(provider, "locationiq")
        self.assertEqual(results, [{"a": 1}])
        mock_get.assert_called_once()

    @override_settings(LOCATIONIQ_API_KEY="test-key")
    @patch("location.providers._try_nominatim", return_value=([{"n": 1}], "nominatim"))
    @patch("location.providers.requests.get")
    def test_toggle_off_still_serves_results_via_nominatim(
        self, mock_get, _mock_nominatim
    ):
        self._set_toggle(False)

        results, provider = fetch_results("berlin", "", "en")

        self.assertEqual(provider, "nominatim")
        self.assertEqual(results, [{"n": 1}])
        mock_get.assert_not_called()

    def test_missing_toggle_row_defaults_to_off(self):
        # A toggle lookup that finds nothing must degrade to master's path,
        # not silently enable the unproven one.
        FeatureToggle.objects.filter(name="LOCATIONIQ_AUTOCOMPLETE").delete()
        cache.clear()
        self.assertFalse(locationiq_autocomplete_enabled())


class TestFetchAutocompleteTask(TestCase):
    @patch("location.tasks.log_autocomplete_request")
    @patch("location.tasks.fetch_results")
    @patch("location.tasks.get_redis_conn")
    def test_success_stores_result_and_clears_pending(
        self, mock_conn, mock_fetch, mock_log
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        mock_fetch.return_value = ([{"display_name": "Berlin"}], "locationiq")
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "job1"})
        mock_redis._zsets[LOCATIONIQ_PENDING_JOBS_KEY] = {key: time.time()}

        fetch_autocomplete.run(key, "job1", "Berlin", "", "en")

        stored = json.loads(mock_redis._store[key])
        self.assertEqual(stored["status"], "done")
        self.assertEqual(stored["results"], [{"display_name": "Berlin"}])
        self.assertNotIn(key, mock_redis._zsets.get(LOCATIONIQ_PENDING_JOBS_KEY, {}))
        mock_log.assert_called_once_with("locationiq")

    @patch("location.tasks.log_autocomplete_request")
    @patch("location.tasks.fetch_results")
    @patch("location.tasks.get_redis_conn")
    def test_superseded_generation_does_not_overwrite(
        self, mock_conn, mock_fetch, mock_log
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        mock_fetch.return_value = ([{"display_name": "Stale"}], "locationiq")
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        # A newer generation already overwrote the sentinel under a different job_id.
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "job2"})

        fetch_autocomplete.run(key, "job1", "Berlin", "", "en")

        self.assertEqual(
            json.loads(mock_redis._store[key]), {"status": "pending", "job_id": "job2"}
        )
        mock_log.assert_not_called()

    @patch("location.tasks.log_autocomplete_request")
    @patch("location.tasks.fetch_results", side_effect=RuntimeError("boom"))
    @patch("location.tasks.get_redis_conn")
    def test_unexpected_exception_still_resolves_to_terminal_state(
        self, mock_conn, _mock_fetch, mock_log
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "job1"})

        fetch_autocomplete.run(key, "job1", "Berlin", "", "en")

        stored = json.loads(mock_redis._store[key])
        self.assertEqual(stored["status"], "done")
        self.assertIsNone(stored["results"])
        mock_log.assert_not_called()


class TestLocationAutocompleteView(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("location:location-autocomplete")
        cache.clear()

    @override_settings(RATELIMIT_ENABLE=False)
    def test_short_query_returns_empty(self):
        response = self.client.get(self.url, {"q": "Be"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    @override_settings(RATELIMIT_ENABLE=False)
    def test_too_long_query_returns_empty(self):
        response = self.client.get(self.url, {"q": "b" * 201})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.get_redis_conn")
    def test_cache_hit_returns_200_with_results(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {
                "status": "done",
                "results": [{"display_name": "Berlin"}],
                "provider": "locationiq",
                "job_id": "j",
            }
        )
        response = self.client.get(self.url, {"q": "Berlin"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.get_redis_conn")
    def test_cache_hit_with_empty_results_returns_200_with_empty_list(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {"status": "done", "results": [], "provider": "locationiq", "job_id": "j"}
        )
        response = self.client.get(self.url, {"q": "Berlin"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    @override_settings(
        RATELIMIT_ENABLE=False,
        LOCATION_PROXY_RESULT_TTL_S=24 * 3600,
        LOCATION_PROXY_MAX_CACHE_AGE_S=48 * 3600,
    )
    @patch("location.location_views.get_redis_conn")
    def test_cache_hit_slides_the_ttl_and_counts_a_hit(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {
                "status": "done",
                "results": [{"display_name": "Berlin"}],
                "provider": "locationiq",
                "job_id": "j",
                "first_fetched_at": time.time() - 20 * 3600,
            }
        )

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_redis._ttls[key], 24 * 3600)
        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_HITS_KEY_PREFIX}{today}"]), 1
        )

    @override_settings(
        RATELIMIT_ENABLE=False,
        LOCATION_PROXY_RESULT_TTL_S=24 * 3600,
        LOCATION_PROXY_MAX_CACHE_AGE_S=48 * 3600,
    )
    @patch("location.location_views.get_redis_conn")
    def test_cache_hit_survives_a_read_only_redis(self, mock_conn):
        # Redis at maxmemory with noeviction still serves GETs but rejects
        # writes. The results are already in hand, so the TTL slide and the LRU
        # touch failing must not cost the user their autocomplete.
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {
                "status": "done",
                "results": [{"display_name": "Berlin"}],
                "provider": "locationiq",
                "job_id": "j",
                "first_fetched_at": time.time() - 3600,
            }
        )
        oom = redis_exceptions.ResponseError("OOM command not allowed")
        mock_redis.pipeline.side_effect = oom
        mock_redis.setex.side_effect = oom
        mock_redis.incr.side_effect = oom

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [{"display_name": "Berlin"}])

    @override_settings(
        RATELIMIT_ENABLE=False,
        LOCATION_PROXY_MAX_CACHE_AGE_S=48 * 3600,
    )
    @patch("location.location_views.fetch_autocomplete.apply_async")
    @patch("location.location_views.get_redis_conn")
    def test_entry_older_than_the_ceiling_is_refetched(
        self, mock_conn, mock_apply_async
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {
                "status": "done",
                "results": [{"display_name": "Stale Berlin"}],
                "provider": "locationiq",
                "job_id": "j",
                "first_fetched_at": time.time() - 49 * 3600,
            }
        )

        response = self.client.get(self.url, {"q": "Berlin"})

        # Dropped and treated as a miss: a fresh lookup is queued instead of
        # serving two-day-old data.
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_apply_async.assert_called_once()
        self.assertEqual(json.loads(mock_redis._store[key])["status"], "pending")

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.fetch_autocomplete.apply_async")
    @patch("location.location_views.get_redis_conn")
    def test_new_query_counts_a_miss(self, mock_conn, _mock_apply_async):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis

        self.client.get(self.url, {"q": "Berlin"})

        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_MISSES_KEY_PREFIX}{today}"]), 1
        )

    @override_settings(RATELIMIT_ENABLE=False, LOCATION_PROXY_MAX_CACHE_AGE_S=48 * 3600)
    @patch("location.location_views.fetch_autocomplete.apply_async")
    @patch("location.location_views.get_redis_conn")
    def test_cold_lookup_counts_one_miss_and_no_hit(self, mock_conn, _mock_apply):
        """
        A cold query is two requests: the claim (202) and the poll that
        collects the result (200). Only the claim is a miss, and the collecting
        poll must NOT be a hit — otherwise hit_rate never drops below ~50%,
        even for a cache that never serves a repeat query.
        """
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")

        # 1. cache empty -> claim + 202
        self.assertEqual(
            self.client.get(self.url, {"q": "Berlin"}).status_code,
            status.HTTP_202_ACCEPTED,
        )

        # 2. the worker finishes and writes the result
        store_result(mock_redis, key, "j", [{"display_name": "Berlin"}], "locationiq")

        # 3. the poll collects it -> 200, but this is the tail of the miss
        self.assertEqual(
            self.client.get(self.url, {"q": "Berlin"}).status_code, status.HTTP_200_OK
        )

        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_MISSES_KEY_PREFIX}{today}"]), 1
        )
        self.assertNotIn(
            f"{LOCATIONIQ_STATS_HITS_KEY_PREFIX}{today}", mock_redis._store
        )

        # 4. a genuinely repeated query IS a hit
        self.assertEqual(
            self.client.get(self.url, {"q": "Berlin"}).status_code, status.HTTP_200_OK
        )
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_HITS_KEY_PREFIX}{today}"]), 1
        )
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_MISSES_KEY_PREFIX}{today}"]), 1
        )

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.get_redis_conn")
    def test_negative_cached_failure_is_served_without_sliding_its_ttl(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {"status": "done", "results": None, "provider": None, "job_id": "j"}
        )

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])
        # An outage must expire in seconds, not be promoted to a day-long entry.
        mock_redis.expire.assert_not_called()
        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertNotIn(
            f"{LOCATIONIQ_STATS_HITS_KEY_PREFIX}{today}", mock_redis._store
        )

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.get_redis_conn")
    def test_pending_sentinel_returns_202(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "j"})
        response = self.client.get(self.url, {"q": "Berlin"})
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.fetch_autocomplete.apply_async")
    @patch("location.location_views.get_redis_conn")
    def test_new_query_creates_sentinel_and_dispatches_task(
        self, mock_conn, mock_apply_async
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_apply_async.assert_called_once()
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        self.assertIn(key, mock_redis._store)
        self.assertEqual(json.loads(mock_redis._store[key])["status"], "pending")
        self.assertIn(key, mock_redis._zsets.get(LOCATIONIQ_PENDING_JOBS_KEY, {}))

    @override_settings(RATELIMIT_ENABLE=False, LOCATION_PROXY_PENDING_CAP=1)
    @patch("location.location_views.fetch_autocomplete.apply_async")
    @patch("location.location_views.get_redis_conn")
    def test_backpressure_cap_returns_503(self, mock_conn, mock_apply_async):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        mock_redis._zsets[LOCATIONIQ_PENDING_JOBS_KEY] = {"some:other:key": time.time()}

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        mock_apply_async.assert_not_called()

    @override_settings(RATELIMIT_ENABLE=False)
    @patch("location.location_views.fetch_results")
    @patch(
        "location.location_views.fetch_autocomplete.apply_async",
        side_effect=Exception("broker down"),
    )
    @patch("location.location_views.get_redis_conn")
    def test_broker_unavailable_falls_back_to_direct_fetch(
        self, mock_conn, _mock_apply_async, mock_fetch
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        mock_fetch.return_value = ([{"display_name": "Berlin"}], "locationiq")

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        # Terminal state written directly, and the backpressure slot released
        # rather than leaked until sentinel-TTL pruning.
        self.assertEqual(json.loads(mock_redis._store[key])["status"], "done")
        self.assertNotIn(key, mock_redis._zsets.get(LOCATIONIQ_PENDING_JOBS_KEY, {}))
        # Exactly one upstream call happened, so exactly one miss — the claim
        # must not count one as well.
        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_MISSES_KEY_PREFIX}{today}"]), 1
        )

    @override_settings(RATELIMIT_ENABLE=False, LOCATION_PROXY_STALE_PENDING_S=16)
    @patch("location.location_views.fetch_results")
    @patch("location.location_views.get_redis_conn")
    def test_abandoned_sentinel_is_reclaimed_and_fetched_inline(
        self, mock_conn, mock_fetch
    ):
        # A sentinel older than the worst case a healthy queue can produce
        # means no task is coming (worker down / nothing consuming `lookup` /
        # message lost). Polling it forever would strand the query.
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        mock_fetch.return_value = ([{"display_name": "Berlin"}], "locationiq")
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {"status": "pending", "job_id": "lost", "created_at": time.time() - 30}
        )
        mock_redis._zsets[LOCATIONIQ_PENDING_JOBS_KEY] = {key: time.time() - 30}

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        stored = json.loads(mock_redis._store[key])
        self.assertEqual(stored["status"], "done")
        # New generation, so the original task can no longer clobber this.
        self.assertNotEqual(stored["job_id"], "lost")
        self.assertNotIn(key, mock_redis._zsets.get(LOCATIONIQ_PENDING_JOBS_KEY, {}))
        # A reclaim is a second real upstream call for this query (the first
        # was counted when the abandoned sentinel was originally claimed), so
        # it counts its own miss rather than being invisible in the stats.
        today = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(
            int(mock_redis._store[f"{LOCATIONIQ_STATS_MISSES_KEY_PREFIX}{today}"]), 1
        )

    @override_settings(RATELIMIT_ENABLE=False, LOCATION_PROXY_STALE_PENDING_S=16)
    @patch("location.location_views.fetch_results")
    @patch("location.location_views.get_redis_conn")
    def test_young_sentinel_is_left_alone(self, mock_conn, mock_fetch):
        # Still plausibly queued — must keep returning 202 rather than firing
        # a duplicate upstream call.
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps(
            {"status": "pending", "job_id": "j", "created_at": time.time() - 2}
        )

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_fetch.assert_not_called()

    @override_settings(RATELIMIT_ENABLE=False, LOCATION_PROXY_STALE_PENDING_S=16)
    @patch("location.location_views.fetch_results")
    @patch("location.location_views.get_redis_conn")
    def test_only_one_request_reclaims_a_given_query(self, mock_conn, mock_fetch):
        # Concurrent pollers must not all fetch the same query; the loser
        # keeps polling and picks up the winner's result.
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        mock_fetch.return_value = ([{"display_name": "Berlin"}], "locationiq")
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        stale = json.dumps(
            {"status": "pending", "job_id": "lost", "created_at": time.time() - 30}
        )
        mock_redis._store[key] = stale

        first = self.client.get(self.url, {"q": "Berlin"})
        # Put the sentinel back to simulate a second poller that read the key
        # before the winner finished writing.
        mock_redis._store[key] = stale
        second = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_202_ACCEPTED)
        mock_fetch.assert_called_once()

    @override_settings(RATELIMIT_ENABLE=False, LOCATION_PROXY_STALE_PENDING_S=16)
    @patch("location.location_views.fetch_results")
    @patch("location.location_views.get_redis_conn")
    def test_sentinel_without_created_at_is_not_reclaimed(self, mock_conn, mock_fetch):
        # Written before created_at existed (mid-deploy) — can't be aged, and
        # it expires on its own shortly.
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "j"})

        response = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_fetch.assert_not_called()

    @patch("location.location_views.get_redis_conn")
    def test_pending_poll_does_not_consume_strict_ip_limit(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "j"})

        with override_settings(
            LOCATION_PROXY_IP_RATE_STRICT="1/s", LOCATION_PROXY_IP_RATE_LOOSE="1000/s"
        ):
            for _ in range(5):
                response = self.client.get(self.url, {"q": "Berlin"})
                self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    @patch("location.location_views.fetch_autocomplete.apply_async")
    @patch("location.location_views.get_redis_conn")
    def test_strict_limit_blocks_second_new_query_same_second(
        self, mock_conn, _mock_apply_async
    ):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis

        with override_settings(
            LOCATION_PROXY_IP_RATE_STRICT="1/s", LOCATION_PROXY_IP_RATE_LOOSE="1000/s"
        ):
            first = self.client.get(self.url, {"q": "Berlin"})
            second = self.client.get(
                self.url, {"q": "Munich"}
            )  # distinct query, not a poll

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", second)

    @patch("location.location_views.get_redis_conn")
    def test_loose_limit_blocks_all_traffic_including_polls(self, mock_conn):
        mock_redis = _make_mock_redis()
        mock_conn.return_value = mock_redis
        key = f"{LOCATIONIQ_LOOKUP_KEY_PREFIX}berlin||en"
        mock_redis._store[key] = json.dumps({"status": "pending", "job_id": "j"})

        with override_settings(LOCATION_PROXY_IP_RATE_LOOSE="1/s"):
            first = self.client.get(self.url, {"q": "Berlin"})
            second = self.client.get(self.url, {"q": "Berlin"})

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
