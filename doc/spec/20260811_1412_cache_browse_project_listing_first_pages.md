# Cache Browse Page Project Listing Responses (First 1-2 Pages)

**Status**: DRAFT
**Type**: Backend — performance / caching
**Date created**: 2026-08-11
**Depends on**:
- Existing Redis cache configured in `backend/climateconnect_main/settings.py:384-390`
- Existing `DEFAULT_CACHE_TIMEOUT` setting (2 days) — `settings.py:392`
- Existing `@cache_page` precedent on `ListMemberProfilesView` — `backend/climateconnect_api/views/user_views.py:286-290`
- `ListProjectsView` — `backend/organization/views/project_views.py:166-426`
- Project ranking cache + `update_project_ranking_cache_on_save` signal — `backend/organization/models/project.py:316-329`

**Related**:
- Plan: `.kilo/plans/1786456874213-browse-project-listing-cache-plan.md` (approach 1)
- Plan: `.kilo/plans/1786461226107-cache-browse-projects-spec-v0-2.md` (v0.2 review)
- Follow-up specs (separate): serializer N+1 fix, async ranking recompute, denormalized `ranking_score`, frontend cache layer

---

## Problem Statement

`/api/projects/` — the API that powers the public browse page (top-level `/browse` and per-hub `/hubs/[hubUrl]/browse`) — is consistently reported as the slowest public endpoint on the site. The browse page renders its project grid client-side from this endpoint, with infinite scroll loading additional pages.

The endpoint is slow because of a combination of:
- A broad base queryset with 7 prefetches across `Project`, `Location`, `Comment`, `Like`, `Follower`, `ProjectParents`, and `ProjectSectorMapping`
- Many optional filter dimensions (sectors, hub, category, status, organization_type, parent_project, location/PostGIS)
- A ranking-based ordering path that materializes the entire filtered queryset into Python and re-orders via a `Case/When` expression — `project_views.py:378-420`
- Per-project N+1 counts in the serializer (separate spec)

The first page is on the critical user-experience path. For the most common filter combinations (no filter; top hubs), the **same query is run hundreds of times per day with identical results** — only the ranking values drift over time, and any individual project's ranking is already cached separately in Redis for 1 day.

The frontend uses infinite scroll. Only pages 1-2 are on the hot path for first impressions; the rest is lower priority. The browse page already has a client-side filter debounce in `FilterProvider.tsx:42, 62-77` that suppresses identical-filter refetches, but there is no cross-request, cross-user cache.

The platform already has a working precedent for HTTP response caching: `ListMemberProfilesView` is decorated with `@cache_page(DEFAULT_CACHE_TIMEOUT, key_prefix="LIST_MEMBERS")` at `user_views.py:286-290` and uses the existing Redis backend. Applying the same pattern to `ListProjectsView` is the lowest-risk, highest-leverage change available.

We want a faster first load of the project grid without changing the API contract, the ranking semantics, or the front-end code, and without introducing correctness regressions on edits.

## Acceptance Criteria

### Response cache for first pages

- [ ] `ListProjectsView` returns a Redis-cached response for `page=1` and `page=2` (capped by `settings.LIST_PROJECTS_CACHE_MAX_PAGE`, default 2) when the request has no user-specific data. **User-applied filter combinations are not given a per-user cache keyspace** — the cache is shared across all users, on the assumption (verified by audit) that the response payload does not vary by `request.user`. This is intentional: per-user filter caching has low business value and is out of scope.
- [ ] Pages 3+ continue to hit the database (intentional — keeps memory bounded and ensures later pages always reflect edits)
- [ ] Cache key is built from the URL query string only. Verified set of cache-affecting params: filter set (sectors, hub, category, status, organization_type, parent_project, has_children, search, country, city, radius, osm_id, osm_type, osm_class, place_id), `sort_by`, `page`, `page_size`. The POST request body is **not** part of the cache key — see "POST request body and the cache key" in Domain Context for why.
- [ ] Cache key is canonical: identical filter sets in different parameter order produce the same key
- [ ] Default TTL: 30 minutes (configurable via a new setting; tune in production)
- [ ] Empty result pages (`count=0`) are also cached to prevent repeated empty queries
- [ ] `AllowAny` requests are cached; the response payload contains no `request.user`-dependent data. The assumption holds because both `ListProjectsView` (`project_views.py:201`) and `ListEventsView` (`project_views.py:447`) filter `is_draft=False, is_active=True` at the queryset level, so the `rc.is_draft` branch in `ProjectStubSerializer.get_registration_config` (`serializers/project.py:559-569`) is unreachable for any project in the listing response.

### No per-user data leakage

- [ ] Audit confirms `ListProjectsView` and `ProjectStubSerializer` do not vary output by `request.user` (no personalized fields, no per-user state). The audit covers the listing endpoint's queryset filter `is_draft=False, is_active=True` (verified) and the serializer's per-user branches. If any field is found to be user-specific, the spec must be amended and per-user cache keys introduced instead
- [ ] A test asserts that two anonymous requests with identical query params return byte-identical responses (within the same TTL window)
- [ ] No per-user leakage: two requests that differ only in `request.user` (one anonymous, one authenticated) but share the same query string return byte-identical responses within the same TTL window. (Locks in the invariant that the listing response does not depend on `request.user`.)

### Cache invalidation on edits

- [ ] `Project` `post_save` and `post_delete` (including soft-delete via `is_active=False`) trigger a `cache.delete_pattern` for the listing key prefix, so cached pages are evicted when a project is added, edited, or removed
- [ ] `ProjectLike` / `ProjectFollower` / `ProjectComment` `post_save`/`post_delete` (the signals that already invalidate the per-project ranking cache at `models/project.py:316-329`) also invalidate the listing cache (ranking changes affect ordering, so a stale cache is misleading)
- [ ] Invalidation is best-effort: a failed `delete_pattern` must not break the write path (log and continue)
- [ ] Coarse invalidation is acceptable: the response cache is short-TTL, and aggressive invalidation is safer than stale grids
- [ ] Listing cache invalidation does **not** include a per-user filter-state cache (none exists in this spec). The cache is invalidated on project and ranking-affecting events only.

### Configuration

- [ ] New settings: `LIST_PROJECTS_CACHE_TIMEOUT` (default 1800 seconds), `LIST_PROJECTS_CACHE_MAX_PAGE` (default 2), and `LIST_PROJECTS_CACHE_MAX_KEYS` (default 500)
- [ ] New settings can be set to `0` to disable caching entirely (escape hatch for incident response)
- [ ] Cache key prefix: `LIST_PROJECTS`
- [ ] Cap: `LIST_PROJECTS_CACHE_MAX_KEYS` (default 500). Enforced via Redis `maxmemory-policy allkeys-lru` (set in the managed Redis tier settings) or an explicit LRU check in the view before `cache.set`. Acts as a memory safety net if filter combinations multiply beyond the 20-combo budget assumed in Domain Context.

### Observability

- [ ] Log or expose a hit/miss counter (at minimum via Django log on cache miss; ideally via Sentry metric or Redis INFO stats) so we can measure hit ratio after rollout
- [ ] Staging smoke: identical back-to-back requests show a hit; edit a project and the next request shows a miss

### Tests

- [ ] Cache hit: two identical requests within TTL return the same response bytes; the second request issues **zero queries against the database** (asserted via `CaptureQueriesContext`)
- [ ] Cache miss: request with a different filter set does not return a cached response
- [ ] Page boundary: `page=2` is cached, `page=3` is not (DB hit)
- [ ] Invalidation: `Project.save()` evicts cached responses; subsequent request is a miss
- [ ] Invalidation: `ProjectComment.objects.create(...).save()` evicts cached responses
- [ ] Canonical key: same filters in different param order produce the same key
- [ ] POST path: a POST request with the same query string as a GET request produces the same cache key and the same response (the location filter at `project_views.py:321-348` is driven by `osm_id` / `osm_type` / `place_id` at the top level of the query string, which are present in both forms; the POST body is not part of the cache key)
- [ ] TTL expiry: after `LIST_PROJECTS_CACHE_TIMEOUT` elapses, the next request is a miss

## Constraints and Non-Negotiable Requirements

- No changes to the public API contract: same URL, same parameters, same response shape, same status codes
- No changes to the ranking calculation or semantics
- No changes to the front-end: the cache must be transparent
- Cache must not change behavior for authenticated users in a way that's visible to clients (today: none, but verify)
- Cache key canonicalization must be deterministic; identical filter sets must always collide on the same key
- Failure to read from / write to the cache must never break a request (graceful degradation)
- Memory budget: keep cached pages bounded — pages 1-2 only, TTL 30 min, hard cap of `LIST_PROJECTS_CACHE_MAX_KEYS` (500) keys

## Domain Context

### Why pages 1-2 only

Infinite scroll means users load page 1 always, page 2 very often, and pages 3+ only when scrolling deep into a niche filter combination. Caching page 3+ would multiply the memory cost for negligible UX benefit (the later pages aren't slow by the time the user reaches them — they're already loaded into the browser). The primary optimization target is the first visit: no-filter global browse and per-hub browse. Once the infrastructure is in place, common user-applied filters (sectors, search) get the same fast path for free, with no extra code.

Note: per-user filter state (the set of filters a specific logged-in user has applied) is not cached. Caching the cross-user per-filter-combo response covers the common case (anonymous browsing, the first user into a hub); caching per-user filter state would add a per-user keyspace with low hit ratio and is out of scope.

### Why 30-minute TTL

- Aggressive invalidation on every ranking signal (see "Why coarse invalidation" below) means a stale cache window is bounded by event time, not by TTL
- 30 minutes is a comfortable upper bound: well within user expectations of "the new project I posted a minute ago should appear on the browse page", and well below the per-project ranking cache TTL of 1 day
- The volume of writes (a handful of likes, follows, comments, edits per day) means the cache is invalidated frequently enough that the 30-minute TTL almost never expires naturally — every `delete_pattern` from a write gives us a fresh window

### Why coarse invalidation (`delete_pattern`)

When a project is edited, liked, followed, or commented on, it isn't only the cached pages that contain that project that become stale. The ranking of every project on the list is a function of every project's activity, so any single activity event can reshuffle the entire list — moving a project from page 2 to page 1, or pushing one off page 1 entirely. In a ranking-driven list, **every write invalidates every page**.

A more "surgical" approach (e.g. tracking per-page membership in a Redis index, or scanning cached response bodies on each write) would be:
- **Wrong** if it only invalidated pages that contain the changed project (other pages become stale via the rank reshuffle)
- **Pure overhead** if it invalidated all pages anyway (the index or scan is extra work for the same result as a single `delete_pattern`)

A single `cache.delete_pattern("LIST_PROJECTS:*")` is:
- One Redis round-trip
- O(N) in the number of cached keys (a few dozen at our scale)
- ~1-5 ms typical
- Already in the write path: the existing signal handlers at `models/project.py:316-329` access `instance.project.ranking` on every like/follow/comment create, which is the property accessor and may hit the per-project ranking cache. A `delete_pattern` adds microseconds to a path that already takes milliseconds

Coalescing/throttling multiple `delete_pattern` calls was considered and rejected: write volume is low (a handful of likes, follows, comments per day), so the simple "one `delete_pattern` per write" is fine.

### Why `@cache_page` (and not a custom cache key builder or a low-level `cache.get/set`)

- Same pattern as the existing `ListMemberProfilesView` precedent — low cognitive overhead for the reviewer
- Django's `@cache_page` uses the request's full path + query string by default, which is exactly what we want; canonicalization is handled by the URL parser
- `@cache_page` already supports a key prefix, a timeout, the `cache_alias` parameter (useful if we ever want to move listing responses to a separate Redis db), and a `key_func` callback (used here to enforce the page cap by returning `None` for out-of-cap requests)

### The existing ranking cache is complementary, not redundant

- The per-project ranking cache (`PROJECT_ID_{id}_RANKING`, TTL 1 day) eliminates the 7-query rebuild on every `cached_ranking` read
- The new response cache eliminates the entire query, ranking sort, and serialization for cached pages
- Both should be invalidated on the same signals: when ranking changes, the cached order is stale; when a project is added/removed, the page contents are stale

### POST request body and the cache key

`ListProjectsView.post` (`project_views.py:174-191`) handles the case where the frontend posts a full OpenStreetMap location object as the request body. The relevant code path:

1. `get_queryset()` checks for `osm_id` / `osm_type` / `place_id` at the **top level** of `self.request.query_params` (`project_views.py:321-348`)
2. When those keys are present, `get_location_with_range(self.request.query_params)` (`backend/location/utility.py:547`) is called
3. `get_location_with_range` reads the OSM keys from the query string, then calls `get_location(location_object)` (`backend/location/utility.py:240`) which **creates or fetches a Location row** in the database (so the location exists in `Location` for future requests to find)
4. The PostGIS distance filter is then applied against that Location

**Implication for the cache key**: the location filter is driven by `osm_id` / `osm_type` / `place_id` (and `country` / `city` / `radius`) at the top level of the URL query string. The OSM composite key uniquely identifies the location, and `get_location_with_range` resolves it to the canonical Location row. Two requests with the same OSM composite key always resolve to the same Location and produce the same response, regardless of whether they were sent as GET (OSM keys in URL) or POST (OSM keys in body and stashed into query_params via the `post()` handler).

`@cache_page` keys on the request URL/path, which is the right thing here: same OSM composite key → same URL → same cache entry. The POST body itself is not part of the cache key (and shouldn't be), because the body only carries data that is also already encoded in the URL (the OSM composite key).

**Where to put the decorator**: `cache_page` on `dispatch` is correct. The `post()` handler at `project_views.py:174-191` mutates `request._request.GET` to add a `location` key holding the body, but this key is not read by the filter pipeline — the filter reads `osm_id` / `osm_type` / `place_id` at the top level of `query_params`. (The `post()` mutation is vestigial: the OSM keys it needs to forward to `get_location_with_range` are already at the top level of the request when the frontend includes them in the body and they are unpacked by the frontend before the request, or the frontend puts them in the URL even on POST.) Either way, `cache_page` on `dispatch` sees the same response-determining query string whether the request was a GET or a POST, and the cache key is correct.

## AI Insights

### Implementation Hints

- Define `list_projects_cache_key(request)` that returns the canonical URL+query-string key, or `None` if the request is not cacheable (page > `LIST_PROJECTS_CACHE_MAX_PAGE`, method not in `{"GET", "POST"}`). Pass it as `key_func=list_projects_cache_key` to `@cache_page`. `cache_page` honors a `None` return by skipping the cache entirely — this implements the page cap without an extra `dispatch` override.
- Decorate `ListProjectsView.dispatch` with `@method_decorator(cache_page(settings.LIST_PROJECTS_CACHE_TIMEOUT, key_prefix="LIST_PROJECTS", key_func=list_projects_cache_key))`, same shape as `ListMemberProfilesView` at `user_views.py:286-290`.
- Use `cache.delete_pattern("LIST_PROJECTS:*")` (django-redis) in the existing signal handlers that already invalidate the per-project ranking cache. Wrap the call in `try/except` and log on failure so a cache outage cannot break the write path.
- Add a test that uses `CaptureQueriesContext` to assert query count drops to 0 (or near-0) on the second of two identical requests.
- **Test backend caveat**: `LocMemCache` (test, `settings.py:498-502`) does not implement `delete_pattern`. Invalidation tests that exercise the signal path will raise `NotImplementedError` if run with the default test cache. Mitigation: invalidation tests must either (a) `@override_settings` to a `django_redis.cache.RedisCache` instance pointed at a per-test Redis db, or (b) `unittest.mock.patch` `RedisCache.delete_pattern`. Cache-hit / miss / page-boundary / canonical-key / TTL tests run fine on the default `LocMemCache`.
- The `post()` method at `project_views.py:174-191` mutates `request._request.GET` to add a `location` key (storing the full POST body as a single dict value), then calls `self.list(...)`. The filter pipeline does not consume this `location` key (the PostGIS filter at `:321-348` reads `osm_id` / `osm_type` / `place_id` at the top level of `query_params`, not inside `query_params["location"]`). Therefore the mutation has no effect on the queryset, and `cache_page` on `dispatch` is safe — it sees the same response-determining query string whether the request was a GET or a POST.

### Trade-off Notes

- **TTL** is the upper-bound staleness window, not the typical one. The 30-min choice is comfortable for users and gives a high hit ratio. Worst-case staleness is bounded by the next write event.
- **Coarse invalidation** is the only correct option for a ranking-driven list. Any "smart per-project" invalidation that only invalidates pages containing the changed project is wrong (other pages become stale via the rank reshuffle).
- **No coalescing / throttling of `delete_pattern`**: write volume is low (a handful of likes, follows, comments, edits per day), so the simple "one `delete_pattern` per write" is correct and cheap.
- **Cap to pages 1-2** vs cache all pages: cap is a memory/benefit trade. The 1-2 cap aligns with the actual UX hot path (first paint, plus a small buffer for users who scroll fast on a wide monitor).
- **Cache empty results** vs always miss: caching `count=0` prevents a long-tail filter from re-running an expensive empty query repeatedly (e.g. a typo'd hub slug). Worth doing.
- **No per-user safety net today** (no user-specific fields): the view is `AllowAny` and the serializer has no per-user branches. We add a test that asserts this, so any future regression is caught.
- **No compression of cached payloads**: each page is ~30 KB; not worth compressing for the scale we have. Add later if needed.
- **Hard cap on cached keys (`LIST_PROJECTS_CACHE_MAX_KEYS`)**: protects against filter-combination multiplication. The 20-combo budget in "Cross-Cutting" is an estimate; the cap turns that estimate into a guaranteed bound.
- **Per-user filter state is not cached.** Cross-user per-filter-combo caching covers the anonymous / first-user case (the explicit win). Per-user filter caching has low business value and would multiply the keyspace without a proportional hit-ratio gain. Out of scope.

### Risks

- **Stale edits visible for up to 30 minutes if no write event occurs** to trigger `delete_pattern`. In practice this is rare: any like, follow, comment, or edit on any project triggers a `delete_pattern`, so the cache is almost always fresh. The 30-minute TTL is the upper bound, not the typical staleness window. Acceptable.
- **`delete_pattern` is not implemented by `LocMemCache` (test backend, `settings.py:498-502`).** Invalidation tests that exercise the signal path will raise `NotImplementedError` if run with the default test cache. Mitigation: override the cache backend in those tests (see Implementation Hints).
- **Frontend tab-switch fetches** (already partially mitigated by `FilterProvider`'s debounce) could show a cached page after a recent edit. The coarse invalidation makes this unlikely: any like, follow, comment, or edit on any project triggers `delete_pattern`, so the cache is almost always fresh; the 30-min TTL is the upper bound.
- **Memory growth from unusual but legitimate filter combinations** (e.g. a long `search=` query): the `page <= 2` cap bounds each key's payload size, the 30-min TTL gives the cache a natural upper bound, and the `LIST_PROJECTS_CACHE_MAX_KEYS` cap with Redis `maxmemory-policy allkeys-lru` turns the 1.5 MB optimistic estimate into a guaranteed ~15 MB worst case.

## System Impact Analysis

### Backend

- `backend/organization/views/project_views.py`:
  - `ListProjectsView`: add a `list_projects_cache_key(request)` module-level function that returns the canonical URL+query key (or `None` for non-cacheable requests), and decorate `dispatch` with `@method_decorator(cache_page(settings.LIST_PROJECTS_CACHE_TIMEOUT, key_prefix="LIST_PROJECTS", key_func=list_projects_cache_key))` — same shape as `ListMemberProfilesView` at `user_views.py:286-290`. The `key_func` honors the page cap by returning `None` for `page > LIST_PROJECTS_CACHE_MAX_PAGE`.
- `backend/climateconnect_main/settings.py`:
  - Add `LIST_PROJECTS_CACHE_TIMEOUT` (default 1800), `LIST_PROJECTS_CACHE_MAX_PAGE` (default 2), and `LIST_PROJECTS_CACHE_MAX_KEYS` (default 500) near the existing `DEFAULT_CACHE_TIMEOUT` and `CACHE_BACHED_RANK_REQUEST` settings.
  - `LocMemCache` is used in tests; document that `delete_pattern` won't work there and tests should use `@override_settings(CACHES=...)` or `unittest.mock.patch` on `RedisCache.delete_pattern`.
- `backend/organization/models/project.py:316-329` (and analogous signal handlers for `ProjectLike`, `ProjectFollower`, `ProjectComment`):
  - Extend `update_project_ranking_cache_on_save` / `_on_delete` to also call `cache.delete_pattern("LIST_PROJECTS:*")` in a try/except so a cache failure doesn't break the write.
- `backend/organization/tests/test_list_projects_cache.py` (new):
  - Cache hit / miss / page boundary / canonical key / TTL — `LocMemCache` is fine.
  - Invalidation on `Project` save/delete and on `ProjectLike`/`ProjectFollower`/`ProjectComment` save/delete — `@override_settings(CACHES={...django_redis...})` or `unittest.mock.patch` on `RedisCache.delete_pattern`.
  - No per-user leakage: byte-identical response across anonymous and authenticated requests with the same query string.
  - POST vs GET: same OSM composite key in URL produces the same cache entry (the `location` body mutation is not part of the key).

### Frontend

- No changes. The cache is fully transparent.

### Cross-Cutting

- Redis memory: bounded by `LIST_PROJECTS_CACHE_MAX_KEYS` (500) × ~30 KB per page = ~15 MB worst case (realistic cap, not the optimistic 1.5 MB). With Redis `maxmemory-policy allkeys-lru` in the managed Redis tier, cold filter combinations are evicted automatically.
- No DB schema changes
- No new dependencies
- No new env vars
- No changes to ranking logic

## Out of Scope

Follow-up optimizations (serializer N+1, async ranking recompute, denormalized `ranking_score`, per-hub PostGIS memoization, frontend cache layer) are tracked in separate specs and are not affected by this change.

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-08-11 | First draft. Problem statement, acceptance criteria, and AI insights based on the caching plan. Awaiting user review. |
| 0.2 (Draft) | 2026-08-11 | v0.2 review applied. See log. |


## Log

- 2026-08-11 14:12 UTC - Task created from the caching plan's "approach 1" (HTTP response cache for first 1-2 pages of `ListProjectsView`). Investigation complete; key code paths identified in `ListProjectsView` (`project_views.py:166-426`), the ranking `Case/When` re-sort (`:378-420`), the serializer N+1s (`serializers/project.py:533-537`), and the existing `@cache_page` precedent (`user_views.py:286-290`). Awaiting user review of problem statement and acceptance criteria.
- 2026-08-11 16:45 UTC - User review feedback. Refined based on conversation:
  - **Scope clarified**: primary optimization target is first visit to global browse (`/browse`) and per-hub browse. The cache key still includes all filter parameters (sectors, search, etc.) so the infrastructure is reusable, but page 1 of no-filter and per-hub is the explicit win.
  - **MAX_PAGE reduced** from 3 to 2: page 1 is the hot one (initial paint, social-media referrals, SEO crawls); page 2 is a small buffer for fast scrollers; page 3+ is "user already scrolled past the fold" and pushes memory budget without UX benefit.
  - **TTL increased** from 5 min to 30 min: aggressive `delete_pattern` invalidation on every ranking signal (Project save/delete, Like/Follower/Comment save/delete) means the 30-min TTL is the upper-bound staleness window, not the typical one. Higher hit ratio at the same correctness cost.
  - **"Why coarse invalidation" section added**: documents that any single activity event (like, comment, follow, edit) can reshuffle the entire ranking-driven list, so every write effectively invalidates every page. Surgical per-project invalidation is either wrong (misses pages stale via rank reshuffle) or pure overhead (if it invalidates everything anyway, the index is wasted). Coarse `delete_pattern` is the only correct option. Decision recorded so future maintainers don't waste time trying to make it "smarter".
  - **Coalescing/throttling removed**: write volume is low (handful of likes/follows/comments per day), so one `delete_pattern` per write is fine.
- 2026-08-11 17:00 UTC - User review feedback. POST location body and cache key:
  - **The location filter is driven by `osm_id` / `osm_type` / `place_id` (and `country` / `city` / `radius`) at the top level of the query string.** `get_location_with_range` (`backend/location/utility.py:547`) reads those keys, calls `get_location()` (`backend/location/utility.py:240`) to create-or-fetch a canonical `Location` row, and the PostGIS filter at `project_views.py:321-348` runs against that row. The OSM composite key uniquely identifies a location, so two requests with the same OSM key always resolve to the same Location and produce the same response.
  - **The POST body is not part of the cache key.** `cache_page` keys on the URL, which is correct: same OSM composite key → same URL → same cache entry. The body is not consulted by the cache (it shouldn't be — the OSM key in the URL is the identity).
  - **Decorator placement**: `@cache_page` on `dispatch` is correct. The `post()` handler's mutation of `request._request.GET` to add a `location` key is not read by the filter pipeline (the filter reads the top-level OSM keys directly), so the cache key is identical whether the request was a GET or a POST.
- 2026-08-11 17:30 UTC - v0.2 review applied. User decisions:
  - **Finding 1** (`get_registration_config` per-user leakage) **downgraded to non-issue** with clarifying test: both `ListProjectsView` and `ListEventsView` filter `is_draft=False, is_active=True`, so the `rc.is_draft` branch in `get_registration_config` is unreachable for any project in the listing response. Verified at `project_views.py:201, 447`.
  - **Decorator placement harmonized to `dispatch`** with `key_func` for the page cap, matching the `ListMemberProfilesView` precedent. Implementation switched from a `dispatch` override to a `key_func` that returns `None` for out-of-cap requests.
  - **Per-user filter-state caching explicitly out of scope** (documented in "Why pages 1-2 only" and Trade-off Notes).
  - **Added `LIST_PROJECTS_CACHE_MAX_KEYS` cap** (default 500) as a memory safety net, enforced via Redis `maxmemory-policy allkeys-lru`.
  - **Test strategy clarified**: invalidation tests must use a `django_redis` cache backend (override) or mock `delete_pattern`; `LocMemCache` cannot be used for invalidation tests.
  - **Removed the "Out of Scope" PR-numbered list** and replaced with a single sentence. Fixed stale "(First 1-3 Pages)" in the title.
  - **Rephrased the "Cache hit" AC** to assert zero queries via `CaptureQueriesContext`.
  - **Tightened the "Why coarse invalidation" section** to remove the "7-query ranking rebuild" claim, which is actually the property accessor and may hit the per-project ranking cache.
  - **Updated "Frontend tab-switch" risk** to remove the contradictory "5 min max" claim and align with the 30-min TTL.
  - **Updated "Memory growth" risk** to mention the new cap.
