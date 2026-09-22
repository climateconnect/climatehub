# LocationIQ Autocomplete: Rate-Limited Queue Design (Celery + Redis Rendezvous)

**Status**: PROPOSED — not yet implemented. Recommended replacement for the custom in-process
worker/queue introduced in `backend/location/queue.py` on `poc-locationIQ_for_autocomplete`
(commit `fcc0e955`, "refactor rate limits, add queue for incoming requests").
**Type**: Backend — replaces a hand-rolled thread/registry queue with a Celery-backed, non-blocking
design.
**Date and time created**: 2026-07-20 14:00
**Related**:
- `review.md` (repo root) — the full code review this design grew out of; see findings #1 and #3
  for the problems being solved here.
- `doc/spec/20260623_1000_locationiq_autocomplete_migration.md` — original POC spec. Its rate-limit
  section (DRF throttle, no Redis) was superseded by the `fcc0e955` refactor and is further
  superseded by this doc.

---


> **Naming note (2026-08-18)**: settings that are properties of the proxy layer rather than of
> LocationIQ were renamed from `LOCATIONIQ_*` to `LOCATION_PROXY_*` after PR review —
> `PENDING_CAP`, `SENTINEL_TTL_S`, `STALE_PENDING_S`, `RECLAIM_LOCK_S`, `RESULT_TTL_S`,
> `MAX_CACHE_AGE_S`, `NEGATIVE_TTL_S`, `CACHE_MAX_ENTRIES`, `STATS_TTL_S`, `IP_RATE_STRICT`,
> `IP_RATE_LOOSE`. This document keeps the original names as written. Provider-specific settings
> (`LOCATIONIQ_API_KEY`, `_AUTOCOMPLETE_URL`, `_TIMEOUT`, `_MAX_RATE`, `_DAILY_BUDGET`) and the
> Redis key constants in `location/queue.py` are unchanged.

## Problem Statement

The current `queue.py` design runs its drain-loop worker thread inside `LocationConfig.ready()`,
which executes once per web process. In production (`gunicorn -w 4`), that means 4 independent
worker threads compete on the same Redis queue with no coordination, so:

- the intended 2 req/s cap to LocationIQ isn't actually enforced (can overshoot ~4x);
- cross-process request signaling silently falls back to the full 10s timeout for most requests,
  because the waiter registry (`_request_registry`, `threading.Event`) is per-process memory;
- the single-threaded worker loop is also a throughput cliff — one slow upstream call (up to ~8s)
  stalls every other queued item behind it.

Full analysis of both problems is in `review.md`, findings #1 and #3.

## Options Considered

Four coordination strategies were compared to solve `review.md` finding #1:

| Option | Summary | Why not chosen alone |
|---|---|---|
| A — dedicated worker process | `manage.py run_location_queue_worker` as its own container | New deployable unit; solved better by Celery's existing queue routing (see below) |
| B — Redis leader lock | Elect one web process as drainer via a renewed lock | More custom concurrency code than a dedicated process, for no real benefit |
| D — synchronous Redis rate gate | No queue at all, just a `SET NX PX` gate acquired inline per request | Simple and correct at any process count, but no ordering guarantee — a sustained-arrival pattern can structurally disadvantage one waiter (see `review.md` for the worked example); fixing that means hand-rolling a fair ticket system, which is more custom code than just using Celery |
| **C — Celery task queue** | Reuse existing Celery infra + native `rate_limit`; this doc | **Chosen** — proven infra already used in this exact codebase (`location/tasks.py`'s `fetch_and_create_location_translations` uses `rate_limit="1/s"` for the same class of problem) |

This doc describes a refined version of Option C — merging non-blocking
202+poll delivery, plain-Redis rendezvous, `SET NX` dedup sentinel, dedicated Celery queue with
fixes for gaps neither original version closed (backpressure, TTL/queue-depth consistency, task
failure safety net, broker-down fallback, and the interaction between polling and the per-IP rate
limit).

---

## Design Summary

One Redis key per normalized query acts as both the "is this ready yet" cache and the
deduplication lock. On a cache miss, the view atomically claims the key as a pending sentinel,
enqueues a Celery task (rate-limited to 2/s, running on a dedicated queue/worker so it doesn't
compete with the rest of the app's Celery workload), and returns `202`. The frontend polls the same
endpoint; once the task finishes, it writes the real result into the same key, and subsequent
polls (or fresh identical queries) get a `200` immediately.

No `CELERY_RESULT_BACKEND` is needed — the rendezvous is a plain Redis key the task writes into
directly, not Celery's own result machinery.

---

## Redis Key Contract

| Key | Shape | TTL | Purpose |
|---|---|---|---|
| `locationiq:lookup:<normalized_q>` | `{"status": "pending", "job_id": "<uuid>"}` then overwritten with `{"status": "done", "results": [...] \| null, "provider": "locationiq" \| "nominatim" \| null, "job_id": "<uuid>", "first_fetched_at": <unix ts, real results only>}` | `SENTINEL_TTL_S` (≈20s) while pending; on completion refreshed to `RESULT_TTL_S` (24h, **sliding** — reset on every hit, capped at `first_fetched_at + MAX_CACHE_AGE_S`) **for a real result** or `NEGATIVE_TTL_S` (≈8s) **for a failure** (`results is None`) — see Gap #7 | Single rendezvous point: cache, dedup lock, and result delivery in one key |
| `locationiq:pending_jobs` (sorted set) | member = lookup key, score = creation timestamp | n/a (self-pruned by score on every access) | Backpressure accounting — counts distinct in-flight jobs without needing precise increment/decrement bookkeeping |
| `locationiq:lru` (sorted set) | member = lookup key, score = **last access** timestamp | n/a (bounded by trim on every store) | Size cap — evicts the least recently read entry once the index exceeds `LOCATIONIQ_CACHE_MAX_ENTRIES`. Successful results only |
| `locationiq:stats:{hits,misses}:<YYYY-MM-DD>` | integer counter | 7 days | Cache effectiveness, surfaced by `NominatimStatsView`. `NominatimPeriodStats` counts only upstream calls, so without these a working cache is indistinguishable from a traffic drop |

`normalized_q` is `_normalize_query(q, countrycodes, accept_language)` — lowercased,
whitespace-stripped, `"{q}|{countrycodes}|{primary_language}"`.

**The language tag is load-bearing.** Provider results are localized (`display_name`,
`address.country`), so keying without it lets the first German searcher pin German names for every
English user for the full `RESULT_TTL_S`, and vice versa — on a bilingual site that happens
constantly. Only the *primary* tag is used (`de-DE,de;q=0.9` -> `de`): the full header varies per
browser and would shatter the cache into near-duplicates.

**Cached results carry geometry types, not geometry.** `strip_geometry()` replaces each non-Point
`geojson.coordinates` with `null` before the payload is stored. Autocomplete only ever displays
names, but `polygon_geojson=1` responses can run to megabytes per country/region, and this Redis
instance is also the Celery broker and the Channels layer — caching them is what makes the feature
expensive. Keeping the geometry *type* preserves the frontend's Point-vs-area handling and doubles
as the marker `location.utility.get_location()` uses: when it creates a `Location` it has never seen
before and finds coordinates missing, it re-fetches the real polygon from the provider by
osm_id/osm_type, so **the database still stores full-fidelity geometry**. That lookup only happens on
first creation of a given location (existing ones resolve from the DB by OSM composite key), and a
failed lookup degrades to a point at lat/lon rather than blocking the user's save.

## HTTP API Contract

`GET /api/location_autocomplete/?q=...&countrycodes=...`

| Condition | Status | Body |
|---|---|---|
| `q` < 3 or > 200 chars | 200 | `[]` |
| Loose per-IP limit (10/s, all traffic) exceeded | 429 | `{"detail": "Too many requests."}` |
| Lookup key holds a `"done"` result | 200 | `results` array (possibly empty) |
| Lookup key holds a `"pending"` sentinel (someone else's or your own earlier poll) | 202 | `{"status": "pending"}` |
| No key exists, strict per-IP limit (1/s, new jobs only) exceeded | 429 | `{"detail": "Too many requests."}` |
| No key exists, backpressure cap reached | 503 | `{"detail": "Service busy, please retry."}` |
| No key exists, sentinel created, Celery broker unreachable | 200 | direct-fetch fallback result (see Gap #4 below) |
| No key exists, sentinel created, task enqueued successfully | 202 | `{"status": "pending"}` |

Frontend handling of the non-200/202 statuses is specified under "Frontend Changes" — in short,
`429`/`503` are transient "back off and retry / leave the last results as-is" signals, never
surfaced to the user as an error.

The two per-IP limits are separate `django_ratelimit` buckets (`group=` keeps their counters
independent) — see "Closing the Remaining Gaps" #5 for why polling needs to be exempt from the
strict one.

---

## Request Flow

**View (`LocationAutocompleteView.get`)**:

```python
if is_ratelimited(request, key="ip", rate="10/s", group="autocomplete-any", increment=True):
    return Response({"detail": "Too many requests."}, status=429)

q = request.query_params.get("q", "").strip()
if not (3 <= len(q) <= 200):
    return Response([], status=200)

normalized_q = _normalize_query(q, countrycodes, accept_language)
key = f"locationiq:lookup:{normalized_q}"
redis_conn = get_redis_conn()

raw = redis_conn.get(key)
if raw:
    data = json.loads(raw)
    if data["status"] == "done":
        return Response(data["results"] or [], status=200)
    return Response({"status": "pending"}, status=202)  # cheap poll, no strict rate-limit check

if is_ratelimited(request, key="ip", rate="1/s", group="autocomplete-new", increment=True):
    return Response({"detail": "Too many requests."}, status=429)

redis_conn.zremrangebyscore("locationiq:pending_jobs", "-inf", time.time() - SENTINEL_TTL_S)
if redis_conn.zcard("locationiq:pending_jobs") >= PENDING_CAP:
    return Response({"detail": "Service busy, please retry."}, status=503)

job_id = uuid.uuid4().hex
created = redis_conn.set(
    key, json.dumps({"status": "pending", "job_id": job_id}), nx=True, ex=SENTINEL_TTL_S
)
if created:
    redis_conn.zadd("locationiq:pending_jobs", {key: time.time()})
    try:
        fetch_autocomplete.apply_async(args=[key, job_id, q, countrycodes, accept_language])
    except Exception:
        logger.exception("Celery broker unavailable, falling back to direct fetch")
        results, provider = _fetch_results(q, countrycodes, accept_language)
        _store_result(redis_conn, key, job_id, results, provider)  # shared writer, see below
        redis_conn.zrem("locationiq:pending_jobs", key)            # don't leak the backpressure slot
        if results is not None:
            log_autocomplete_request(provider)
        return Response(results or [], status=200)

return Response({"status": "pending"}, status=202)
```

Both the task and this broker-down branch write the terminal state through one shared helper, so the
success-vs-failure TTL rule (Gap #7) lives in exactly one place:

```python
def _store_result(redis_conn, key, job_id, results, provider):
    ttl = RESULT_TTL_S if results is not None else NEGATIVE_TTL_S
    redis_conn.setex(key, ttl, json.dumps(
        {"status": "done", "results": results, "provider": provider, "job_id": job_id}
    ))
```

**Task (`location/tasks.py`)**:

```python
@shared_task(rate_limit="2/s")
def fetch_autocomplete(key, job_id, q, countrycodes, accept_language):
    redis_conn = get_redis_conn()
    try:
        results, provider = _fetch_results(q, countrycodes, accept_language)
    except Exception:
        logger.exception("fetch_autocomplete failed unexpectedly for %r", q)
        results, provider = None, None

    current = redis_conn.get(key)
    if current and json.loads(current).get("job_id") != job_id:
        return  # superseded by a newer generation; don't clobber it

    _store_result(redis_conn, key, job_id, results, provider)  # short TTL on failure (Gap #7)
    redis_conn.zrem("locationiq:pending_jobs", key)
    if results is not None:
        log_autocomplete_request(provider)
```

`_store_result` (shown above under the view) applies `RESULT_TTL_S` to a real result but only
`NEGATIVE_TTL_S` to a failure (`results is None`), so a transient double-provider outage — or a
crashed task, which lands here with `results = None` too — self-corrects within seconds instead of
being cached as an empty answer for the full 5 minutes (Gap #7).

No retries (`bind=True, max_retries=...`) — unlike `fetch_and_create_location_translations`, this
task's own `_fetch_results` already exhausts both providers internally; a Celery-level retry would
just repeat that same double-provider attempt at extra quota cost for no real benefit on a
user-facing, time-sensitive request.

---

## Backend Changes

- `location/tasks.py`: add `fetch_autocomplete` as above, plus
  `log_autocomplete_request(provider)` — a single `NominatimRequestLog` INSERT per upstream call.
  Aggregation into `NominatimPeriodStats` is left to the existing `aggregate_nominatim_stats` Beat
  task (see "Request Tracking" below).
- `climateconnect_main/settings.py`:
  - `CELERY_TASK_ROUTES = {"location.tasks.fetch_autocomplete": {"queue": "lookup"}}`
  - `LOCATIONIQ_PENDING_CAP = 16`
  - `LOCATIONIQ_SENTINEL_TTL_S = 20`
  - `LOCATIONIQ_RESULT_TTL_S = 300` — positive cache lifetime (unchanged from the current branch's
    `RESULT_TTL_S`).
  - `LOCATIONIQ_NEGATIVE_TTL_S = 8` — short cache lifetime for a failed lookup, so a transient
    outage isn't cached as an empty result (Gap #7).
  - `LOCATIONIQ_DAILY_BUDGET` (see Gap #6) — configurable, defaults to whatever LocationIQ's actual
    plan allows with headroom.
  - Celery broker fail-fast: set a short broker connection timeout (e.g.
    `broker_transport_options={"socket_connect_timeout": 2, "socket_timeout": 2}` /
    `broker_connection_retry_on_startup=False`) so the broker-down branch's `apply_async()` raises
    within ~2s instead of blocking the request while Celery retries the connection. Without this the
    "broker unreachable → direct fetch" fallback (Gap #4) can hang rather than fail fast.
- `docker-compose.yml`: new `celery-lookup` service, same image as the existing `celery` service,
  different command:
  ```yaml
  celery-lookup:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    command: pdm run celery -A climateconnect_main worker -Q lookup -c 4 -l INFO
    env_file:
      - ./backend/.backend_env
    depends_on:
      - db
      - redis
      - backend
    volumes:
      - ./backend:/app
      - backend-venv:/app/.venv
  ```
  `-c 4`, not `-c 1` — concurrency and `rate_limit` do different jobs (see Gap discussion in
  `review.md` finding #1/#3); `-c 1` alone would reintroduce the single-slow-task-blocks-everyone
  throughput cliff this design is meant to fix. The existing `celery` service is unaffected since it
  only consumes its default queue, not `lookup`.

  **This is still exactly one worker process** — one `celery-lookup:` service definition, no
  `replicas:`/`scale:`. `-c 4` is Celery's *internal* concurrency pool within that single process
  (comparable to `gunicorn --threads 4` on one worker), not multiple independent processes the way
  `gunicorn -w 4` is on the `backend` service — that distinction is the entire point of this
  redesign, so it's worth being explicit: the single worker process owns the one connection to the
  broker and the one rate-limiter state for `fetch_autocomplete`, and decides centrally — before
  ever handing a task to one of the 4 execution slots — whether a new call may start yet.
  Regardless of `-c`, the aggregate *start* rate stays capped at exactly `LOCATIONIQ_MAX_RATE`;
  concurrency only controls how many already-approved calls can be in flight at once. Scaling this
  service's replica count (e.g. `docker compose up --scale celery-lookup=N`) would reproduce the
  original multi-process bug — N independent workers each enforcing their own 2/s cap — so don't.
- `queue.py`: the worker-thread/registry machinery (`start_worker`, `_queue_worker`,
  `_request_registry`, `RequestState`) is deleted entirely; `_fetch_results`, `_try_locationiq`,
  `_try_nominatim`, `_normalize_query`, `get_redis_conn` are kept (moved into `location/tasks.py`
  or left in `queue.py` as shared helpers, whichever keeps imports cleanest).
- `location/apps.py`: the `start_worker()` call in `ready()` and the `SKIP_WORKER_COMMANDS`
  machinery built to support it are removed — no in-process worker to start anymore.

## Frontend Changes

`LocationSearchBar.tsx`:

- Keep the 3-char minimum guard and add a real debounce (~300-500ms) before the *first* request for
  a new value (closes `review.md` finding #2).
- On `202`, poll the same URL until the result is ready, using a **fast-first, then backing-off**
  schedule rather than a flat ≥1s interval — e.g. first re-poll at ~250ms, then ~500ms, then ~1s,
  capped at a max total wait (~8-10s) before giving up and clearing the loading state. Rationale:
  in the common uncontended case the result is ready in ~150ms, so a flat 1s first poll would make
  every search feel ~1s slower than it needs to; a short first poll keeps the happy path snappy
  while the backoff keeps a genuinely queued request from polling aggressively. Pending-polls don't
  consume the strict per-IP budget (see Gap #5), and even the fastest schedule here stays well
  under the loose 10/s limit.
- On `429` (either rate-limit bucket) or `503` (backpressure), treat it as transient: keep the
  previously shown options, don't surface an error to the user, and either stop for this keystroke
  or retry once after a short backoff (~1s). These are "busy, try again" signals, not failures.
- Extend the existing `active`-flag cleanup pattern to cancel an in-flight *poll loop* (not just a
  single request) when `searchValue` changes or the component unmounts.
- Optional, non-load-bearing: a client-side cap on real enqueues per rolling window (the
  colleague's "3-5 enqueues / 2-3s" idea) as a defense-in-depth UX safeguard. This is **not** a
  security control — any client bypassing the frontend (curl, script, botnet) is unaffected by it;
  the real protections are the server-side rate limits and backpressure cap above.

---

## Closing the Remaining Gaps

1. **Sentinel TTL vs. worst-case queue wait.** With `PENDING_CAP=16` and `rate_limit=2/s`, the
   last-admitted job waits up to ~8s just to start, plus up to ~8s worst-case fetch time
   (`LOCATIONIQ_TIMEOUT=3s` + `NOMINATIM_TIMEOUT=5s`) — up to ~16s total. `SENTINEL_TTL_S=20`
   comfortably covers that. **Keep these three constants (`PENDING_CAP`, the task's `rate_limit`,
   `SENTINEL_TTL_S`) consistent with this formula whenever any one of them is tuned** —
   `sentinel_ttl ≳ (pending_cap / rate_limit) + max_fetch_time + margin`. If the sentinel expires
   before a queued job completes, a second sentinel can be created for the same query (temporarily
   breaking dedup) and a stale write can race a fresher one — mitigated by the `job_id` check
   (Gap #3), but the formula should hold in the first place rather than relying on that as the only
   defense.
2. **Task crashes without writing a terminal state.** The top-level `try/except` in
   `fetch_autocomplete` guarantees *some* write to the lookup key even on a totally unexpected
   exception — pollers get a fast `{"status": "done", "results": null}` instead of waiting out the
   full sentinel TTL.
3. **Stale writes across sentinel generations.** The `job_id` compare-before-write in the task
   means a task from a superseded generation can't clobber a newer one's data — cheap, no locking.
4a. **Sentinel abandoned with no task behind it.** `apply_async()` succeeding only means the broker
   accepted the message — not that anything consumed it. If the `lookup` worker is down, never
   deployed, or the message is lost, the sentinel sits there: every poller gets `202`, the frontend
   gives up, and the next request for the same query gets another `202` until the sentinel TTL runs
   out. Nothing notices, because from Redis' point of view the job is still in flight. The sentinel
   therefore carries `created_at`, and once it is older than `LOCATIONIQ_STALE_PENDING_S` (default
   16s — the worst case a *healthy* queue can produce: `PENDING_CAP / rate` of queue wait plus both
   provider timeouts) a request takes it over and fetches inline under a short `SET NX` reclaim lock,
   writing the terminal state under a **new** `job_id` so the original task's compare-before-write
   (Gap #3) can't clobber it. This turns "autocomplete returns nothing, forever" into "the first
   searcher waits, everyone after that gets it from cache". Lowering the threshold recovers faster
   but risks duplicate upstream calls whenever the queue is legitimately backed up.

4. **Broker unreachable at enqueue time.** `apply_async()` is wrapped in `try/except`; on failure,
   the view does `_fetch_results()` synchronously inline for that one request and writes the result
   directly, mirroring the resilience the current branch's `enqueue_request` already has for
   "Redis unavailable."
5. **Polling and the per-IP rate limit.** The strict 1 req/s limit only applies on the branch that
   creates a *new* sentinel (a real, expensive enqueue) — checking on an existing pending job is a
   cheap Redis `GET` and doesn't consume that budget, which also means the frontend's own polling
   can never rate-limit itself. A separate, looser blanket limit (10 req/s, all paths) still guards
   against a buggy/runaway polling client hammering Redis.
6. **Daily/monthly LocationIQ quota exhaustion.** The check lives inside `_try_locationiq` (the one
   place that actually calls LocationIQ), right after the existing empty-API-key guard: read today's
   `NominatimPeriodStats` row for `provider=locationiq` and, once `total_requests` crosses
   `LOCATIONIQ_DAILY_BUDGET`, return `(None, None)` immediately so `_fetch_results` falls through to
   Nominatim for the rest of the day. Putting it here (not in the view or task body) means every
   path that could hit LocationIQ — the queued task *and* the broker-down direct-fetch fallback — is
   covered by the same guard. IP-agnostic, so it also backstops the IPv6-address-rotation bypass
   noted in `review.md`'s security discussion, where per-IP limits alone don't protect the shared
   budget from a small number of technically compliant clients. (Reading the row per call is cheap;
   if it ever shows up in profiling, cache the "over budget" boolean in Redis with a short TTL.)
7. **Failure/crash cached as an empty result ("negative caching").** A terminal write happens even
   when both providers fail (`results is None`) or the task crashes — otherwise pollers would hang
   until `SENTINEL_TTL_S`. But writing that `results: null` state under the full `RESULT_TTL_S`
   (300s) would make the view serve an immediate empty `200` for that query for 5 minutes, long
   after the providers recover. `_store_result` therefore uses `NEGATIVE_TTL_S` (~8s) whenever
   `results is None`, and only a real result gets the full 300s. This keeps the crash-safety net
   (Gap #2) and the both-providers-down case from poisoning the cache: a failed query is retried a
   few seconds later rather than stuck empty. Note this is distinct from a *legitimately empty*
   result — once the empty-list-is-success fix lands (see Risks table), a real "no matches" response
   is `results: []` (not `None`), so it correctly gets the full 300s positive cache; only genuine
   errors get the short TTL.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `celery-lookup` scaled to >1 replica in the future silently multiplies the effective rate (same class of issue as the original multi-process bug, just relocated) | One-line comment on the service definition and near the task decorator noting this is a hard single-replica assumption; revisit with a distributed rate limiter if this service is ever scaled |
| Empty-but-valid provider response currently treated as failure, forcing unnecessary fallback calls (`review.md` low/nits) | Fix alongside this work — `isinstance(data, list)` instead of `isinstance(data, list) and data` in `_try_locationiq`/`_try_nominatim` |
| A backend/proxy layer in front of Django may have its own idle/read timeout | Largely defused by this design vs. a blocking design — no single request is held open for more than a Redis round-trip, so proxy timeouts are much less of a concern here than they were for the blocking `.get()` alternative considered earlier |
| Reused `_fetch_results`/provider logic must stay behind a stable import path once moved out of `queue.py` | Land the move and the queue rewrite in the same change, update all call sites (`location_views.py`, tests) together |

---

## Acceptance Criteria

- [ ] `queue.py`'s worker-thread/registry machinery is removed; no code path starts a background
      thread from `AppConfig.ready()`.
- [ ] `fetch_autocomplete` runs on a dedicated `lookup` queue/worker, concurrency > 1, `rate_limit="2/s"`.
- [ ] A cache hit (existing `"done"` key) returns `200` with no Celery dispatch.
- [ ] A cache miss creates exactly one sentinel/task per distinct query, even under concurrent
      identical requests (dedup via `SET NX`).
- [ ] Polling a pending job never trips the strict per-IP limit; a genuinely new query does.
- [ ] Exceeding `LOCATIONIQ_PENDING_CAP` distinct in-flight queries returns `503`, not an unbounded
      queue.
- [ ] A task that raises unexpectedly still resolves its lookup key to a terminal `"done"` state.
- [ ] A failed lookup (both providers down, or a crashed task) is cached only for `NEGATIVE_TTL_S`,
      not `RESULT_TTL_S` — a retry a few seconds later actually re-attempts instead of getting a
      stuck empty result.
- [ ] The broker-down direct-fetch fallback removes its `pending_jobs` entry (no leaked backpressure
      slot) and writes its terminal state through the same `_store_result` TTL rule as the task.
- [ ] Broker unavailability at enqueue time still returns a real result (direct-fetch fallback)
      within ~2s, not an error and not a hang (broker connection timeout configured).
- [ ] Today's `NominatimPeriodStats` `provider=locationiq` total is checked inside `_try_locationiq`
      (covering both the queued task and the direct-fetch fallback) once `LOCATIONIQ_DAILY_BUDGET`
      is configured.
- [ ] Frontend: 3-char guard + debounce on first request; polls on `202` with a fast-first/backoff
      schedule; treats `429`/`503` as transient (no user-facing error); cancels its poll loop on
      unmount/query change; gives up gracefully after its own max-wait.

## Open Questions / Follow-ups

- What should `LOCATIONIQ_DAILY_BUDGET` actually be set to? Depends on the specific LocationIQ plan
  — needs a real number from whoever manages that account.
- Should `pending_jobs` depth, task latency, and the 202→give-up rate be surfaced as metrics/alerts?
  Not required for a first cut given current traffic (~100 req/day), but worth adding before this
  is relied on under materially higher load.
- Confirm nothing in front of Django (load balancer/reverse proxy) has an idle timeout that would
  matter here — likely a non-issue given no single request is held open, but unverified since no
  such config exists in this repo.

## Request Tracking (added 2026-08-03)

`master` refactored request tracking while this branch was in flight: `NominatimRequestLog` is now
one row per request with a `processed` flag, and a Beat task (`aggregate_nominatim_stats`, every
10 min) rolls those rows into `NominatimPeriodStats`. This design adopts that model rather than the
synchronous per-request upsert the branch originally carried:

- `log_autocomplete_request(provider)` writes one row per **upstream** call — so the counters track
  actual provider quota consumption, not incoming HTTP requests (cache hits and deduped queries
  cost nothing and are correctly invisible). `LOCATIONIQ_DAILY_BUDGET` reads the same rows, so the
  budget is likewise measured in upstream calls.
- `aggregate_nominatim_stats` buckets by `(period_type, period_key, provider)`, giving one
  `NominatimPeriodStats` row per provider per period.
- `peak_req_per_second` keeps master's meaning — the highest number of requests that arrived within
  a single second — now counted **per provider**, which is what makes it usable for watching
  LocationIQ's 2 req/s ceiling. (Nominatim fallback traffic in the same second must not inflate the
  LocationIQ figure.)

Known limitation, inherited from master: a second's requests that straddle two aggregation batches
are counted in separate runs, so a peak can be under-reported in that rare case.

## Log

- 2026-08-04 — Result caching reworked and the whole path put behind a feature toggle, in
  `doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md`. Changes that land in
  *this* doc's contract: `RESULT_TTL_S` raised from 300s to 24h and made sliding with a 48h
  ceiling (`first_fetched_at` added to the payload), plus two new keys — `locationiq:lru` for the
  LRU size cap and the per-day `locationiq:stats:*` hit/miss counters. The 300s TTL was sized as a
  dedup window for this design, not as the cost-control cache LocationIQ's paid quota needs.
- 2026-08-03 — Added Gap #4a (abandoned-sentinel reclaim) so a missing/dead `lookup` consumer
  degrades to inline fetches instead of a silent total outage; `NominatimStatsView` provider
  breakdown; `doc/api-documentation.md`, `doc/environment-variables.md`, `doc/architecture.md` and
  `doc/domain-entities.md` updated for the new endpoint, env vars, queue and models.
- 2026-08-03 — Cache-key and payload fixes: `accept_language`'s primary tag added to
  `_normalize_query` (cross-locale cache poisoning); `strip_geometry()` drops polygon coordinates
  before caching, with `get_location()` re-fetching full geometry on first save so the DB is
  unaffected; `NominatimStatsView` now reports a per-provider breakdown and counts `limit` in
  periods rather than rows.
- 2026-08-03 — Tracking rewired onto master's log+aggregate design after merging master:
  `_increment_counters`/`_get_current_period_keys` deleted from `location_views.py`,
  `log_autocomplete_request` added to `tasks.py`, `aggregate_nominatim_stats` made provider-aware.
  Fixes a silent bug where the branch's float rate (`count/60.0`) was being written into master's
  integer `peak_req_per_second` and rounding to 0. Migration `0021` rebased onto
  `0020_refactor_nominatim_tracking` and reduced to the `provider` field only.
- 2026-07-20 14:00 — Doc created, synthesizing the queue-design discussion from `review.md`'s
  finding #1/#3 threads (blocking vs. non-blocking delivery, Celery vs. hand-rolled worker,
  colleague's rendezvous-and-poll proposal, and the backpressure/TTL/fairness gaps identified while
  fusing the two).
- 2026-07-20 — Review pass fixes folded in: added Gap #7 (negative-caching bug — failures/crashes
  were cached as empty results for the full 5-minute `RESULT_TTL_S`; now use a short `NEGATIVE_TTL_S`
  via a shared `_store_result` writer). Smaller gaps: broker-down fallback now `zrem`s its
  `pending_jobs` slot; fast-first/backoff frontend poll schedule to avoid a ~1s happy-path latency
  regression; explicit frontend `429`/`503` handling; daily-budget check pinned to `_try_locationiq`
  so both task and fallback paths are covered; broker connection-timeout note so the fallback fails
  fast instead of hanging.
