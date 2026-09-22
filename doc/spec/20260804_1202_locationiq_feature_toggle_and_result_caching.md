# LocationIQ Autocomplete: Feature Toggle + Result Caching

**Status**: IMPLEMENTED (2026-08-04). See *Deviations from the proposal* for the three points where
the implementation differs from what is described below.
**Type**: Backend + Frontend — adds a rollback switch for the `poc-locationIQ_for_autocomplete`
branch and replaces its short-lived result cache with a bounded, LRU-evicted 24h/48h cache.
**Date and time created**: 2026-08-04 12:02
**Related**:
- `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` — the queue/rendezvous design
  this builds on. The Redis key contract there is extended, not replaced.
- `doc/spec/20260623_1000_locationiq_autocomplete_migration.md` — original POC spec.
- `doc/spec/20260611_1200_nominatim_autocomplete_request_monitoring.md` — the request tracking that
  measures whether this cache is working.

---


> **Naming note (2026-08-18)**: settings that are properties of the proxy layer rather than of
> LocationIQ were renamed from `LOCATIONIQ_*` to `LOCATION_PROXY_*` after PR review —
> `PENDING_CAP`, `SENTINEL_TTL_S`, `STALE_PENDING_S`, `RECLAIM_LOCK_S`, `RESULT_TTL_S`,
> `MAX_CACHE_AGE_S`, `NEGATIVE_TTL_S`, `CACHE_MAX_ENTRIES`, `STATS_TTL_S`, `IP_RATE_STRICT`,
> `IP_RATE_LOOSE`. This document keeps the original names as written. Provider-specific settings
> (`LOCATIONIQ_API_KEY`, `_AUTOCOMPLETE_URL`, `_TIMEOUT`, `_MAX_RATE`, `_DAILY_BUDGET`) and the
> Redis key constants in `location/queue.py` are unchanged.

## Problem Statement

Two gaps remain on `poc-locationIQ_for_autocomplete` before it can be merged to `master`:

**1. There is no way to turn it off.** The branch replaces a direct browser → Nominatim call with a
backend proxy (`/api/location_autocomplete/`), a Celery queue, a Redis rendezvous, and a polling
frontend. That is a lot of new machinery on the critical path of every search bar, project form,
and filter in the app. If anything misbehaves in production — LocationIQ quota exhausted, the
`lookup` worker not deployed, polling behaving badly on mobile — the only remedy today is a
revert-and-redeploy.

**2. The cache is too short-lived to do its job.** `LOCATIONIQ_RESULT_TTL_S` is 300 seconds. That
was sized as a *dedup window* for the queue design, not as a cost-control cache. LocationIQ is a
paid, quota-limited provider, and autocomplete traffic is extremely repetitive: every user typing
"berlin" generates the same four prefix queries (`ber`, `berl`, `berli`, `berlin`), and popular
places recur across users all day. A 5-minute TTL throws that away. There is also no bound on how
many entries the cache can hold — the same Redis instance also serves the Celery broker and the
Django Channels layer for chat, so an unbounded cache is a shared-infrastructure risk.

---

## Part 1 — Feature Toggle

### Toggle definition

| | |
|---|---|
| **Name** | `LOCATIONIQ_AUTOCOMPLETE` |
| **Production** | `False` |
| **Staging** | `True` |
| **Development** | `True` |
| **Migration** | `feature_toggles/migrations/0006_add_locationiq_autocomplete_toggle.py` |

Same shape as `EVENT_CALENDAR_FEATURE` (`migrations/0005`): a `RunPython` data migration with
`get_or_create` forward and a `filter(...).delete()` reverse. Prod stays off until the POC is
validated on staging.

### What the toggle switches

It gates the **whole new path**, not just the provider. Off means the app behaves exactly like
`master` does today.

```
ON  → browser → GET /api/location_autocomplete/
                → Redis result cache (24h)
                → Celery `lookup` queue (2/s)
                → LocationIQ, Nominatim fallback

OFF → browser → nominatim.openstreetmap.org/search   (direct, as on master)
      browser → POST /api/nominatim_request_count/   (fire-and-forget tracking)
```

**Why the whole path and not just the provider inside the proxy.** A provider-only toggle would
leave every request still flowing through the proxy, which means all autocomplete traffic for the
entire user base leaves from a single server IP. OSM's Nominatim usage policy caps that at 1
request/second *per application*. A "safe" off-state that quietly violates that policy risks the
production IP being blocked — which would take down not just autocomplete but also the
`/lookup` geometry calls in `location.utility.get_location()` and
`fetch_and_create_location_translations`. Routing users back to their own browsers, as on `master`,
distributes that load the way OSM expects.

### Backend changes

`feature_toggles/utility.py` currently only serves toggles to the frontend; no backend code reads a
toggle yet. Add a thin helper so backend callers don't each have to work out their environment:

```python
# feature_toggles/utility.py
def is_feature_enabled_for_current_environment(feature_name: str, default: bool = False) -> bool:
    """Resolve the running environment from settings and delegate to is_feature_enabled()."""
    return is_feature_enabled(feature_name, settings.ENVIRONMENT, default)
```

This requires exposing the environment as a Django setting. `env("ENVIRONMENT")` is read inline for
Celery SSL but never assigned — and it cannot be reused directly, for two reasons: its values are
`development | test | production` while toggles are stored per `development | staging | production`,
and the staging slot runs the same artifact (and the same `ENVIRONMENT`) as production, so a
backend toggle read on staging would resolve against the production column. Hence a separate,
independently overridable setting:

```python
# settings.py
_raw_toggle_environment = env("FEATURE_TOGGLE_ENVIRONMENT") or env("ENVIRONMENT", "development")
FEATURE_TOGGLE_ENVIRONMENT = (
    "development" if _raw_toggle_environment == "test" else _raw_toggle_environment
)
```

**Deployment action required**: set `FEATURE_TOGGLE_ENVIRONMENT=staging` on the staging slot
(`climate-backend-appservice` / `slot2`, per
`.github/workflows/master_climate-backend-appservice(slot2).yml`). Without it, staging reads the
production toggle column and the POC cannot be validated there.

**It must be marked as a deployment slot setting** ("slot setting" / sticky) in Azure. A plain app
setting travels with the app on a slot swap, so `FEATURE_TOGGLE_ENVIRONMENT=staging` would ride
into production on the next swap and production would start reading the *staging* column — turning
LocationIQ on in production, which is the one outcome this toggle exists to prevent. Sticky
settings stay attached to the slot and survive the swap correctly.

Note the frontend has no equivalent hazard: `detectEnvironmentFromHost()` resolves staging from the
request host (`climateconnect-frontend-slot2`), so it re-resolves itself after a swap. The backend
can't do that — a toggle read inside a Celery task has no request to inspect — which is why it
needs a static setting, and therefore why the setting has to be slot-scoped by hand.

Settings load warns (`RuntimeWarning`) if the value isn't one of the three valid columns.
`is_feature_enabled` rejects an unknown environment by returning the caller's default, and it does
so *before* its 5-minute cache — so a typo (`Staging`, `prod`, a stray space) costs a log line on
every toggle read and never memoizes. The symptom, every toggle resolving to its default, is
indistinguishable from "the toggle is simply off", which is a legitimate state, so nothing would
point at the env var. One line at boot instead.

The check itself lives in `_try_locationiq()` rather than in the view, because that single point
covers every path that could spend quota — the Celery task, the broker-down inline fetch, and the
abandoned-sentinel reclaim — without any of them having to remember to ask:

- **Toggle ON** — unchanged behaviour (cache → sentinel → Celery → 202/200).
- **Toggle OFF** — `_try_locationiq` returns immediately without an HTTP call, so `_fetch_results`
  falls through to `_try_nominatim`. The endpoint still answers, still cached, still rate-limited.

The endpoint deliberately keeps working when the toggle is off, because browsers hold cached JS
bundles: a user who loaded the page before the flip will keep calling the proxy for the rest of
their session. Returning `[]` or a 404 would silently break autocomplete for them. Serving
Nominatim-only is correct for that decaying population — see *Risks* for the volume caveat.

Implementation note: the toggle check is cheap (5-minute local cache in `is_feature_enabled`), but
it must be resilient — if the DB is unreachable, `is_feature_enabled` already returns the default.
Pass `default=False`, so a toggle-lookup failure degrades to the proven `master` path.

### Frontend changes

`LocationSearchBar.tsx` is a shared client component used from many pages, so the SSR helper
`getFeatureTogglesFromRequest` is not workable here (it would have to be added to every page that
renders a search bar). Use the client-side hook instead, the same way
`HubTabsNavigation.tsx:139` does:

```tsx
const { isEnabled, isLoading } = useFeatureToggles();
const useProxy = isEnabled("LOCATIONIQ_AUTOCOMPLETE", false);
```

Restructure the existing `useEffect` into two named branches, keeping the shared result handling:

| Function | Source | Notes |
|---|---|---|
| `processResponseData(rawData)` | already exists on the branch | Unchanged. Both paths funnel into it — filtering, `simple_name` building, redundancy removal stay in one place. |
| `fetchViaProxy()` | already exists on the branch | The current `fetchWithPolling` body, renamed. |
| `fetchDirectFromNominatim()` | restore from `master` | `axios.get("https://nominatim.openstreetmap.org/search?...")` with `getLocaleHeader(locale)` from `src/utils/locationUtils.ts`, followed by the fire-and-forget `POST /api/nominatim_request_count/`. |

Rules:

- Fallback value is `false` (= direct Nominatim). The unproven path must be opt-in.
- While `isLoading` is true, do not fire either request; keep the spinner. In practice toggles
  resolve at app mount and the search input has a 400ms debounce, so this branch is close to
  unreachable — but without it a very fast typist could get the wrong provider for one query.
- `useProxy` goes into the effect's dependency array alongside `searchValue`, `locale`, `hubUrl`.
- Both branches must respect the existing `active` cleanup flag so a stale in-flight response never
  overwrites newer options.

The old code path stays in the tree until the toggle is removed. That is deliberate duplication with
a defined end: see *Removing the toggle*.

### Flipping the toggle

**Clear the result cache whenever the toggle changes state.** Cache entries are provider-agnostic:
`_serve_cached` serves any stored result regardless of which provider produced it, and nothing in
the read path compares the stored `provider` against the current toggle state. So results fetched
from Nominatim while the toggle was off keep being served for up to `LOCATIONIQ_MAX_CACHE_AGE_S`
(48h) after it is switched on — and because the hottest query prefixes are the ones most likely to
be cached, the queries you most want to validate are exactly the ones that would *not* reach
LocationIQ. For the first two days after a flip both the provider breakdown in
`/api/nominatim_stats/` and the new `hits`/`misses` counters would describe the old world.

The flip is therefore two steps, not one:

```sh
# 1. flip the toggle (Django admin, or the FeatureToggle row directly)
# 2. drop the cached results and their LRU index
redis-cli --scan --pattern 'locationiq:lookup:*' | xargs -r redis-cli DEL
redis-cli DEL locationiq:lru
```

Do **not** use `FLUSHDB` — the same Redis instance is the Celery broker and the Channels layer for
chat. Pending sentinels share the `locationiq:lookup:` prefix and may be deleted along with the
results; that costs at most a handful of duplicate lookups for queries in flight at that second.
The day counters (`locationiq:stats:*`) are deliberately left alone, so the hit-rate series stays
continuous across the flip — just read it knowing the cache was emptied.

If the toggle ends up being flipped repeatedly rather than once, replace this manual step with
either a provider check in `_serve_cached` (treat a `provider` that doesn't match the current
toggle state as a miss) or a toggle-generation counter in the cache key. Neither is worth its cost
for a single validated rollout.

### Removing the toggle

The toggle is a POC gate, not permanent architecture. Once production has run with
`LOCATIONIQ_AUTOCOMPLETE = True` for two full weeks with no rollback, one PR should:

1. delete `fetchDirectFromNominatim()` and the `useFeatureToggles` call from `LocationSearchBar.tsx`;
2. delete the toggle read from `LocationAutocompleteView`;
3. add a migration removing the `LOCATIONIQ_AUTOCOMPLETE` row;
4. decide the fate of `POST /api/nominatim_request_count/`, which after removal has no caller
   (the backend logs providers itself via `log_autocomplete_request`).

---

## Part 2 — Result Caching

### Measured payload sizes

Taken against Nominatim with the exact parameters `location/queue.py` sends
(`addressdetails=1&polygon_geojson=1&polygon_threshold=0.001`):

| Query | Results | Full object | With `strip_geometry()` | Ratio |
|---|---|---|---|---|
| `Springfield` | 10 | **78.0 KB** | 7.0 KB | 11x |
| `Bad` | 7 | 36.1 KB | 6.2 KB | 6x |
| `Germany` | 1 | **114.6 KB** | 0.5 KB | 229x |
| `Berlin` | 1 | 7.8 KB | 0.5 KB | 16x |

**Decision: keep `strip_geometry()`; do not cache polygon coordinates.** The geometry is 85–99% of
the payload and autocomplete never renders it — it only renders names. A single country polygon is
114 KB on its own, so a cache that fills up with country and region queries would be hundreds of MB
in the same Redis instance that runs the Celery broker and the chat channel layer.

Everything else about the provider object is cached as-is: `importance` (the frontend filters on
it), `class`/`type` (banned-class filtering), `address` (name building), `osm_id`/`osm_type`,
`lat`/`lon`, `display_name`. The geometry *type* is kept and only `coordinates` is nulled — that
type is what the frontend branches on for Point-vs-area, and it is the marker
`location.utility._geometry_was_stripped()` uses to re-fetch the real polygon from
`/lookup` when a `Location` row is created for the first time. So the database still stores full
polygon fidelity; the round-trip happens once per never-before-seen location, not once per
keystroke.

*(Considered and rejected: dropping `polygon_geojson=1` upstream entirely. It would give the
smallest and fastest responses, but without any geojson we lose the Point-vs-area type that both
the frontend and `get_location()` branch on. Inferring it from `osm_type`/`osm_class` is a
behaviour change beyond this branch's scope.)*

### TTL: 24h sliding, 48h absolute cap

Each cache entry gets a 24h TTL. Every cache **hit** refreshes it back to 24h, but never past
`first_fetched_at + 48h`.

```
t=0h    fetch      → TTL 24h, first_fetched_at=0
t=20h   HIT        → TTL reset to 24h   (expires at t=44h)
t=43h   HIT        → TTL capped to 5h   (expires at t=48h, the hard cap)
t=48h   request    → key gone → re-fetch, first_fetched_at=48h
```

This makes both numbers meaningful: hot prefixes stay cached and cost nothing, while no answer is
ever served more than 48h after it was fetched — so a renamed place or a corrected boundary
self-heals within two days without manual cache clearing. The 48h ceiling also matches the
project-wide `DEFAULT_CACHE_TIMEOUT` already in `settings.py:441`.

Failures keep their existing short `LOCATIONIQ_NEGATIVE_TTL_S` (8s) and are **not** promoted to the
24h TTL — a provider outage must not be negative-cached for a day.

### Size cap: 1000 entries, LRU eviction

At ~7 KB per stripped entry, 1000 entries is ~7 MB — negligible for Redis, and every additional
entry is directly one fewer paid LocationIQ call. The requested 200–500 range is safe but leaves
value on the table: the key space is larger than it looks because each *keystroke prefix* is its own
key, normalized as `q|countrycodes|language`. 200 entries would realistically hold about one busy
hour of distinct prefixes.

| Entries | Typical (7 KB) | Pessimistic (20 KB) |
|---|---|---|
| 200 | 1.4 MB | 4 MB |
| 500 | 3.5 MB | 10 MB |
| **1000** | **7 MB** | **20 MB** |

Make it `LOCATIONIQ_CACHE_MAX_ENTRIES`, env-overridable, defaulting to 1000, so it can be dialled
down without a code change if the Redis tier turns out to be tighter than expected.

Eviction is **explicit**, via an LRU index — *not* Redis `maxmemory-policy allkeys-lru`, which is
instance-global and would happily evict Celery task messages and chat channel data too.

### Redis key contract (extends the queue design doc)

| Key | Shape | TTL | Purpose |
|---|---|---|---|
| `locationiq:lookup:<normalized_q>` | pending: `{"status":"pending","job_id","created_at"}` → done: `{"status":"done","results","provider","job_id","first_fetched_at"}` | pending: `SENTINEL_TTL_S` (20s); done: `RESULT_TTL_S` (24h) capped by `first_fetched_at + MAX_CACHE_AGE_S`; failure: `NEGATIVE_TTL_S` (8s) | **Changed**: `first_fetched_at` added, result TTL raised from 300s |
| `locationiq:pending_jobs` | sorted set, score = creation ts | self-pruned | Unchanged — backpressure accounting |
| `locationiq:reclaim:<normalized_q>` | NX lock | `RECLAIM_LOCK_S` (10s) | Unchanged |
| `locationiq:lru` | **new** sorted set, member = lookup key, score = last-access ts | none (bounded by trim) | LRU index for size-capped eviction |

Only *successful* results are indexed in `locationiq:lru`. Pending sentinels are already tracked in
`locationiq:pending_jobs`, and negative results are short-lived and must not consume a cache slot.

### Algorithm

**On store** (`_store_result` in `location/queue.py`) — real result only:

1. `first_fetched_at = now`
2. `SETEX key RESULT_TTL_S <payload>`
3. `ZADD locationiq:lru key now`
4. Trim: `card = ZCARD(...)`; if `card > MAX_ENTRIES`, take the oldest `card - MAX_ENTRIES` members
   via `ZRANGE(0, card - MAX_ENTRIES - 1)`, `DEL` those keys and `ZREM` them from the index —
   **except** for a victim whose key currently holds a pending sentinel, which is only `ZREM`ed
   (see *Eviction must not kill an in-flight lookup* below).

None of this is atomic. A race can at worst evict an entry a moment early, costing one extra
upstream fetch — cheap enough not to justify a Lua script. If the trim ever shows up as a hot spot
it can be moved into one.

**Eviction must not kill an in-flight lookup.** `locationiq:lookup:<q>` holds two different things
over its life — a pending sentinel first, the cached result second — but only results are indexed
in `locationiq:lru`. Combined with index drift that creates a sharp edge: when a cached entry
expires its index member survives with an old score, and if that query is searched again the *same
key* now holds a fresh sentinel while a stale, oldest-scored member points straight at it. A
plain oldest-first `DEL` would remove a live sentinel mid-lookup — pollers would find an empty key,
re-claim, and enqueue a second upstream fetch for a query already being fetched. So the trim reads
the victim before deleting it (`_holds_pending_sentinel`) and drops only the index member when the
key is pending. That is one extra `GET`, on the eviction path only, so it costs nothing on a normal
store. This is not a rare corner: once the index is at its cap every store evicts one member, and
drifted members are by construction the oldest ones.

**On read hit** (`LocationAutocompleteView.get`, `data["status"] == "done"`):

1. `age = now - first_fetched_at`. If `first_fetched_at` is missing (an entry written by the
   previous deploy), treat `age` as 0 and set it — those entries carry at most a 300s TTL anyway
   and drain away within minutes.
2. If `age >= MAX_CACHE_AGE_S`: `DEL` the key, `ZREM` from the index, and fall through to the
   normal cache-miss path. The TTL cap should already have expired it; this is a safety net against
   clock skew.
3. Otherwise `new_ttl = min(RESULT_TTL_S, MAX_CACHE_AGE_S - age)`; `EXPIRE key new_ttl`;
   `ZADD locationiq:lru key now` to refresh recency.
4. Return the results as today.

Steps 2 and 3 each go out as a single pipeline. Nothing here needs to be atomic — the commands are
independent and the trim never was — but this is the hottest endpoint in the app and there is no
reason to spend two or three round trips where one will do.

**All of these writes are best-effort.** A cache hit cannot be a pure read in this design: the
sliding TTL needs `EXPIRE`, LRU-by-*access* needs `ZADD`, and the delivery marker needs `SETEX`.
But none of them affect the response — they are maintenance, and the results are already in hand.
Redis can accept reads while refusing writes (at `maxmemory` under a `noeviction` policy, on a
read-only replica, mid-failover), which is exactly the pressure this cache is designed around given
the instance is shared with the Celery broker and the Channels layer. Letting a failed `EXPIRE`
turn a servable hit into a `500` would make the endpoint *less* available than it was before the
cache existed, so `refresh_cache_entry` swallows write failures and logs them. The one thing that
must never be swallowed — whether the entry is past `MAX_CACHE_AGE_S` — is decided from the payload
before any Redis call, so a failed `DEL` cannot turn "too old, re-fetch" into "serve it anyway".

Because `new_ttl` is capped by the remaining budget, the key expires on its own at exactly
`first_fetched_at + 48h` with no sweeper needed.

**Index drift.** Members can outlive their keys (a key expires; its sorted-set member does not).
This is bounded and benign: the trim keeps `ZCARD` at or below `MAX_ENTRIES`, `DEL` on a missing
key is a no-op, and stale members are evicted oldest-first — exactly the ones most likely already
expired. The only cost is that the live cache can be slightly smaller than the cap. A periodic
sweeper is explicitly *not* proposed; revisit only if measured hit rate lags the cap badly.

### Settings changes

```python
# settings.py — LocationIQ autocomplete
LOCATIONIQ_RESULT_TTL_S = int_env("LOCATIONIQ_RESULT_TTL_S", 24 * 3600)       # was 300
LOCATIONIQ_MAX_CACHE_AGE_S = int_env("LOCATIONIQ_MAX_CACHE_AGE_S", 48 * 3600) # new
LOCATIONIQ_CACHE_MAX_ENTRIES = int_env("LOCATIONIQ_CACHE_MAX_ENTRIES", 1000)  # new
LOCATIONIQ_STATS_TTL_S = 7 * 24 * 3600  # new — hit/miss counter retention
LOCATIONIQ_NEGATIVE_TTL_S = 8   # unchanged
```

`int_env()` is a small helper next to `env` in `settings.py`, not `int(env(...))`: a *declared but
empty* variable (`LOCATIONIQ_RESULT_TTL_S=` — a routine way for a deploy config to leave a key
unset) makes `int("")` raise at import time and takes the whole process down instead of falling
back to the default.

Settings load also warns (`RuntimeWarning`) when `LOCATIONIQ_MAX_CACHE_AGE_S <
LOCATIONIQ_RESULT_TTL_S`. That combination isn't fatal, but it silently makes the sliding TTL dead
— every hit's TTL is capped by the remaining age budget, so entries would just live
`MAX_CACHE_AGE_S` and the configured `RESULT_TTL_S` would never be reached. Easy to produce by
setting only one of the pair.

`LOCATIONIQ_LRU_KEY = "locationiq:lru"` is a module constant in `location/queue.py`, next to the
existing key-prefix constants.

### Cache hit-rate visibility

`NominatimRequestLog` only records *upstream* calls, so once this cache lands, the numbers in
`NominatimPeriodStats` will fall — which is the point, but it makes the cache's effect
indistinguishable from a traffic drop. Add two Redis counters, incremented on the request path and
surfaced by `NominatimStatsView`:

- `locationiq:stats:hits:<YYYY-MM-DD>` — `INCR` on every served-from-cache response, **except the
  poll that collects a freshly computed result**
- `locationiq:stats:misses:<YYYY-MM-DD>` — `INCR` once per lookup that actually goes upstream

A miss is counted at whichever point commits to spending the call, which is not always the sentinel
claim: after a successful `apply_async` (the queued task will fetch), or inside `_fetch_inline`,
which covers both the broker-down fallback and an abandoned-sentinel reclaim. The broker-down path
therefore counts exactly one miss even though it both claims and fetches, while a reclaim counts a
*second* miss for the same query — correct, because a reclaim really is a second upstream fetch for
a query whose first claim was already counted.

Only the `INCR` that creates a counter sets its TTL. Re-expiring on every write would add a round
trip per request on the hot path and turn the fixed 7-day retention into a sliding window that
keeps a busy day's counter alive indefinitely.

That exclusion matters more than it looks. A cold query is two requests — the claim (`202`) and the
poll that collects the answer (`200`) — and the collecting poll reads from the cache like any other
request. Counting it would make every cold lookup contribute one miss *and* one hit, putting a
floor of ~50% under `hit_rate` even for a cache that never serves a repeat query, which defeats the
purpose of measuring at all. A real result is therefore stored with `"delivered": false`, and the
first read consumes that marker instead of counting a hit (`was_undelivered()` +
`refresh_cache_entry`). The inline-fetch path passes `delivered=True` to `_store_result`, since it
returns the result itself and has no later poll to consume the marker.

Both with a 7-day TTL. Redis `INCR`, not a DB insert — this is the hot path, and
`log_autocomplete_request` already does one insert per *upstream* call, which is the expensive
event worth writing to Postgres.

---

## Acceptance Criteria

**Feature toggle**

1. Migration `0006` creates `LOCATIONIQ_AUTOCOMPLETE` with prod `False`, staging `True`, dev `True`,
   and its reverse deletes the row.
2. `GET /api/feature_toggles/?environment=staging` includes `LOCATIONIQ_AUTOCOMPLETE: true`.
3. With the toggle off, `LocationSearchBar` issues no request to `/api/location_autocomplete/`;
   it calls Nominatim directly and posts to `/api/nominatim_request_count/` — byte-for-byte the
   `master` behaviour.
4. With the toggle on, no direct browser call to `nominatim.openstreetmap.org` is made.
5. With the toggle off, `GET /api/location_autocomplete/` still returns usable results and never
   calls LocationIQ (assert `_try_locationiq` is not invoked).
6. When the feature-toggle lookup raises, the frontend falls back to the direct path and the backend
   to Nominatim-only. Neither surfaces an error to the user.

**Caching**

7. A successful lookup is cached with a TTL of 24h (±slack) and carries `first_fetched_at`.
8. A cache hit within the first 24h extends the key's TTL back to 24h.
9. A cache hit at age 47h sets a TTL of ~1h, not 24h; at age ≥48h the entry is discarded and
   re-fetched.
10. A failed lookup (`results is None`) is cached for 8s, is not added to `locationiq:lru`, and
    does not receive `first_fetched_at`.
11. Storing entry number `MAX_ENTRIES + 1` evicts the least-recently-*accessed* entry (not the
    least-recently-written) — the test must read an old entry to prove recency is refreshed on hit.
12. `ZCARD(locationiq:lru)` never exceeds `LOCATIONIQ_CACHE_MAX_ENTRIES` after a store.
13. No cached value contains polygon coordinates: for every non-Point geojson in a cached payload,
    `coordinates is None`.
14. Saving a location whose cached entry had stripped geometry still produces a `Location` row with
    a populated `multi_polygon` (existing `get_location` re-fetch path keeps working).
15. Cache hits do not create `NominatimRequestLog` rows; the hit/miss Redis counters move instead.
16. A cold lookup counts exactly **one miss and zero hits** across its claim and its collecting
    poll; the *next* request for the same query counts one hit. Four distinct cold queries against
    an empty cache must report `hits: 0`, not `hits: 4`.

Tests extend `backend/location/tests/test_queue.py`, which already has the Redis fixtures and
`_store_result` coverage. Frontend toggle branching gets a test alongside
`FeatureToggleProvider.test.tsx`.

---

## Deviations from the proposal

Three things changed while implementing. The sections above have been updated to describe what was
actually built; this records why.

1. **`FEATURE_TOGGLE_ENVIRONMENT` instead of reusing `ENVIRONMENT`.** The original plan assigned
   `ENVIRONMENT` as a Django setting and read toggles against it. That breaks on staging, which
   deploys the production artifact and so reports `ENVIRONMENT=production` — a backend toggle read
   there would have resolved against the production column, silently disabling LocationIQ on the
   one environment meant to validate it. Overloading `ENVIRONMENT` was also unsafe because Celery's
   SSL config keys off `ENVIRONMENT == "production"`. **Requires a deploy-config change on the
   staging slot** (see *Backend changes*).

2. **The toggle is checked in `_try_locationiq()`, not in the view.** One check covers the Celery
   task, the broker-down inline fetch, and the abandoned-sentinel reclaim. Putting it in the view
   would have left the other two paths able to spend quota. Acceptance criterion #5 was written as
   "assert `_try_locationiq` is not invoked"; the test asserts the property that actually matters —
   that no HTTP request goes to LocationIQ.

3. **No Redis pipeline around the store + index write.** Existing tests inspect `setex` call
   arguments directly, and the trim was always going to be non-atomic anyway, so a pipeline would
   have added mocking complexity for no correctness gain. Documented in *Algorithm*.

### Test-suite note (found during implementation)

Four modules use `TransactionTestCase`, which truncates every table when it finishes and does not
restore migration-seeded data. Any test that reads a feature toggle therefore cannot rely on the
row created by migration `0006` — depending on execution order it may have been wiped, and
`is_feature_enabled` would quietly return the default. Tests must create the toggle they depend on
(`location/tests/test_queue.py::_set_locationiq_toggle`). This applies to every future backend
toggle read, not just this one.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Toggle off, but stale browser bundles keep hitting the proxy → Nominatim traffic concentrated on one server IP, above OSM's 1 req/s policy | Population is small and decays within a session, and the strict per-IP limit (1/s) bounds it further. **Set `LOCATIONIQ_MAX_RATE = "1/s"` before the first production flip, not "if the toggle is left off for a while".** The backend's fail-safe default routes to Nominatim *from the server*, so an unplanned DB blip puts you in this state with no warning — see the row below. Note the rate is a code constant, not an env var, and `LOCATIONIQ_SENTINEL_TTL_S` / `LOCATIONIQ_STALE_PENDING_S` are derived from it, so changing it is a redeploy and a re-derivation, not a config tweak. |
| The two halves of "fail safe" point in opposite directions | The frontend's `isEnabled(..., false)` fails safe *away* from the server (browser → Nominatim, load spread over user IPs). The backend's `default=False` in `locationiq_autocomplete_enabled()` fails safe *into* `_try_nominatim`, i.e. server-IP-concentrated OSM traffic — the exact thing the whole-path toggle exists to prevent. This is the right default for quota (a toggle-read failure must never spend money), but it means a brief DB outage silently converts LocationIQ load into policy-risky OSM load. Mitigated by the rate cap above being in place *beforehand*. |
| Flipping the toggle on doesn't actually exercise LocationIQ, because Nominatim-sourced entries are still cached | Cache entries are provider-agnostic and live up to 48h. Clear `locationiq:lookup:*` and `locationiq:lru` as part of the flip — see *Flipping the toggle*. |
| 24h cache serves outdated place data | 48h absolute cap guarantees self-healing; `FLUSHDB`-free manual fix is `DEL locationiq:lookup:<key>`. Autocomplete data changes on the scale of months. |
| Two code paths in `LocationSearchBar` diverge over time | Both funnel into the single shared `processResponseData`; removal is time-boxed to two weeks post-rollout (see *Removing the toggle*). |
| Cache eats into the Redis instance shared with the Celery broker and Channels | Hard entry cap plus stripped payloads bound it at ~7 MB; `LOCATIONIQ_CACHE_MAX_ENTRIES` is env-tunable without a deploy of new code. |
| Backend toggle read adds a DB query to a hot endpoint | `is_feature_enabled` caches for 5 minutes and swallows DB errors, returning the default. |

---

## Open Questions / Follow-ups

1. ~~**Should `countrycodes` stay in the cache key?**~~ **Resolved: yes, kept.** It is in
   `_normalize_query` today, and only the `perth` hub sets it (`HUB_COUNTRY_RESTRICTIONS`), so it
   costs almost no key duplication. Revisit only if many more hubs get country restrictions, at
   which point it becomes a visible fragmentation source.
2. **Cache warming.** With a 48h ceiling, the top ~50 queries could be refreshed by a nightly Celery
   Beat task so users never pay for the first miss. Cheap to add later; not proposed now — measure
   the hit rate from the new counters first.
3. **`/api/nominatim_request_count/` after toggle removal** has no caller left. Decide then whether
   to delete the endpoint and `NominatimTrackThrottle`.

---

## Documentation Updated

- `doc/environment-variables.md` — `LOCATIONIQ_RESULT_TTL_S`, `LOCATIONIQ_MAX_CACHE_AGE_S`,
  `LOCATIONIQ_CACHE_MAX_ENTRIES`, `FEATURE_TOGGLE_ENVIRONMENT`.
- `doc/api-documentation.md` — `/api/location_autocomplete/` behaviour under each toggle state and
  its caching; the `cache` block in the `/api/nominatim_stats/` response.
- `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` — Redis key contract table
  (`first_fetched_at`, `locationiq:lru`, `locationiq:stats:*`, new sliding result TTL) + Log entry.
- `doc/architecture.md` — location autocomplete integration point.

---

## Files Changed

**Backend**
- `climateconnect_main/settings.py` — `FEATURE_TOGGLE_ENVIRONMENT`; result TTL 300s → 24h;
  `LOCATIONIQ_MAX_CACHE_AGE_S`, `LOCATIONIQ_CACHE_MAX_ENTRIES`, `LOCATIONIQ_STATS_TTL_S`
- `feature_toggles/utility.py` — `is_feature_enabled_for_current_environment()`
- `feature_toggles/migrations/0006_add_locationiq_autocomplete_toggle.py`
- `location/queue.py` — toggle gate in `_try_locationiq`; `_index_and_trim`, `refresh_cache_entry`,
  `record_cache_hit`/`record_cache_miss`, `get_cache_stats`; `first_fetched_at` in `_store_result`
- `location/location_views.py` — `_serve_cached` (sliding TTL + hit counting + 48h drop-through),
  miss counting on sentinel claim, `cache` block in `NominatimStatsView`
- `location/tests/test_queue.py` — 24 new tests

**Frontend**
- `src/components/search/LocationSearchBar.tsx` — `fetchViaProxy` / `fetchDirectFromNominatim`
  split behind the toggle, both funnelling into the shared `processResponseData`
- `src/components/search/LocationSearchBar.test.tsx` — new, 4 tests

## Log

- **2026-08-10 (code review)** — Seven fixes from the review in
  `review_20260810_feature_toggle_and_cache.md`, none of which changed the design:
  1. LRU eviction no longer `DEL`s a key that currently holds a pending sentinel — index drift plus
     the shared sentinel/result key made it possible to kill an in-flight lookup and cause a
     duplicate upstream fetch (see *Eviction must not kill an in-flight lookup*).
  2. Documented that flipping the toggle requires clearing the result cache, since entries are
     provider-agnostic and would otherwise hide LocationIQ for two days after the flip (new
     *Flipping the toggle* section).
  3. `_fetch_inline` counts its own miss, so a reclaimed lookup is no longer invisible in the stats;
     the claim-time count moved to after a successful `apply_async` so the broker-down path still
     counts exactly one.
  4. `_incr_stat` sets the counter TTL only on the `INCR` that creates the key, and
     `refresh_cache_entry` batches its writes into one pipeline — two fewer round trips per cache
     hit on the hottest endpoint.
  5. Settings-load `RuntimeWarning` when `LOCATIONIQ_MAX_CACHE_AGE_S < LOCATIONIQ_RESULT_TTL_S`,
     which silently disables the sliding TTL.
  6. The three env-configurable cache settings read through a new `int_env()` helper, so a declared
     but empty variable falls back to the default instead of crashing at import.
  7. The frontend's Nominatim tracking POST fires *before* the `active` check again, matching
     `master`: superseded in-flight requests really did hit Nominatim, and skipping them
     under-reported the upstream volume this migration is judged on.

  8. `refresh_cache_entry`'s writes are best-effort, and the age-ceiling decision is taken from the
     payload before any Redis call. A cache hit is necessarily a read *plus* maintenance writes, so
     a Redis that serves reads but refuses writes (maxmemory + noeviction, read-only replica) would
     otherwise have turned every servable hit into a 500 — less available than before the cache
     existed.
  9. Settings load also warns on an invalid `FEATURE_TOGGLE_ENVIRONMENT`, which otherwise fails as
     "every toggle reads as its default", is indistinguishable from a legitimately-off toggle, and
     re-logs on every read because `is_feature_enabled` rejects it before its cache.

  Also documented, not a code change: `FEATURE_TOGGLE_ENVIRONMENT` must be an Azure **deployment
  slot setting**, or `staging` rides into production on the next slot swap and production reads the
  staging toggle column — enabling LocationIQ in production, the one thing this toggle exists to
  prevent.

  Reviewed and deliberately left alone: the `delivered` marker is at-most-once under concurrent
  first-readers (it undercounts rather than inflates `hit_rate`, and a CAS on the hot path costs
  more than the accuracy is worth — now documented on `was_undelivered`), and the `isLoading` guard
  in `LocationSearchBar`. Backend: 176 `location` tests pass, 6 new. Frontend: 4 tests pass.
- **2026-08-10 (found in manual testing)** — The hit/miss counters double-counted cold lookups: the
  `202`-poll that collects a freshly computed result was being recorded as a cache hit, so four cold
  queries against an empty cache reported `hits: 4, misses: 4` and `hit_rate` had a hard floor of
  ~0.5 — a cache saving nothing would have looked 50% effective. Fixed with a `"delivered": false`
  marker consumed by the first read (`was_undelivered()`, `_store_result(delivered=…)`), so `hits`
  now means only genuinely saved upstream calls. Cost is one extra `SETEX` per cold lookup, on the
  delivery path only. Also caught during the same session, both environmental rather than code:
  two `-Q lookup` workers running with different `.backend_env` generations (see the *Stale worker*
  section of `manual_testing_guide_feature_toggle_and_cache.md`), and the fact that
  `FEATURE_TOGGLE_ENVIRONMENT` must be set on the staging slot.
- **2026-08-04 (implementation)** — Built as specified apart from three points, recorded in
  *Deviations from the proposal*: a separate `FEATURE_TOGGLE_ENVIRONMENT` setting (staging would
  otherwise have read the production toggle column), the toggle check placed in `_try_locationiq`
  so all three quota-spending paths are covered by one check, and no Redis pipeline. Backend:
  917 tests, 2 pre-existing failures unrelated to this work (`TestTimeSlotField` hardcodes
  `2026-08-01` start times that are now in the past). Frontend: 699 tests pass; the 2 failing
  suites are devlink module-resolution errors that predate this change.
- **2026-08-04 12:02** — Spec created. Four decisions resolved up front: full-path toggle (not
  provider-only), 24h sliding TTL with 48h absolute cap, keep `strip_geometry()`, 1000-entry
  env-configurable LRU cap. `countrycodes` confirmed to stay in the cache key; hit/miss counters
  confirmed in scope.
