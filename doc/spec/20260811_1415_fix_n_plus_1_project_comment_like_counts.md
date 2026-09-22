# Fix N+1 Query For Project Comment And Like Counts On Browse Listing

**Status**: DRAFT
**Type**: Backend — performance / bugfix
**Date created**: 2026-08-11
**Depends on**:
- `ListProjectsView` — `backend/organization/views/project_views.py:166-426`
- `ProjectStubSerializer` — `backend/organization/serializers/project.py:416-571`
- `ProjectComment`, `ProjectLike` model relationships on `Project`

**Related**:
- Plan: `.kilo/plans/1786456874213-browse-project-listing-cache-plan.md` (approach 2)
- Companion spec: `20260811_1412_cache_browse_project_listing_first_pages.md` (HTTP response cache)
- Follow-ups (separate specs): async ranking recompute; denormalized `ranking_score`

---

## Problem Statement

`/api/projects/` (the browse page backend) returns `number_of_comments` and `number_of_likes` for every project. The current implementation calls `obj.project_comment.count()` and `obj.project_liked.count()` inside the serializer (`backend/organization/serializers/project.py:533-537`).

Because `ProjectComment` and `ProjectLike` are already `prefetch_related`-loaded in `ListProjectsView.get_queryset` (`project_views.py:203-223`), the prefetched data is fully available on each `Project` instance — but `.count()` on a prefetched related manager issues a fresh `SELECT COUNT(*)` against the database, **ignoring the prefetched rows**.

Net effect on a single page of 12 projects:
- 12 extra queries for comment counts
- 12 extra queries for like counts
- 24 round-trips to the database per page, every page, on top of the query that already loaded the full `ProjectComment` and `ProjectLike` rows.

The prefetched rows themselves are essentially dead weight today (only `.count()` is consumed by the serializer; nothing reads the rows). The fix is to either (a) annotate the counts in the queryset so they ship with the row, or (b) keep the prefetch and use its in-memory length.

This is the smallest, lowest-risk performance change in the browse-page caching plan, and it is a strict improvement regardless of whether the response cache is in place. On a cache miss the latency drops; on a cache hit the saved queries are still real savings for cold cache, log replay, and any code path that doesn't go through the new response cache (e.g. RSS feeds, sitemap, internal jobs).

## Acceptance Criteria

### Counts are returned correctly

- [ ] `ProjectStubSerializer.get_number_of_comments` returns the count of non-deleted `ProjectComment` rows attached to the project
- [ ] `ProjectStubSerializer.get_number_of_likes` returns the count of `ProjectLike` rows attached to the project
- [ ] Returned values match the previous behavior exactly (regression-safe)
- [ ] Soft-deleted comments are excluded (current behavior preserved)
- [ ] Ordering of comments in `get_number_of_comments` (newest first, prefetched with `select_related("comment_ptr")`) is not changed

### No N+1 in the queryset

- [ ] `ListProjectsView` issues a constant number of queries per request, independent of the page size (12 projects → same query count as 1 project, modulo the base + filter + ordering queries)
- [ ] `django.test.utils.captureOnCommitCallbacks` / `connection.queries` test asserts the comment-count and like-count queries are **not** present in the per-request query log
- [ ] Existing prefetch of `project_comment` and `project_liked` is preserved (or replaced — see "Approach" below — but not duplicated)

### Tests

- [ ] A `ListProjectsView` request for a page of 12 projects issues the same query count with and without the fix (i.e. the fix removes queries, doesn't add them)
- [ ] A project with 0 comments / 0 likes returns 0
- [ ] A project with N comments and M likes returns the correct integers in the response
- [ ] Existing tests for `ListProjectsView` (in `backend/organization/tests/test_project_views.py` or wherever they live) still pass without modification
- [ ] A test asserts that no `SELECT COUNT(*) ... FROM organization_projectcomment` and no `SELECT COUNT(*) ... FROM organization_projectlike` are present in the query log for a single page request (after the fix is in)

### Performance measurement

- [ ] Before/after measurement of `connection.queries` length and total request time for a page of 12 projects is captured in the PR description (or a follow-up comment)
- [ ] No regression in p50 latency for the same endpoint on staging

## Constraints and Non-Negotiable Requirements

- No change to the public API contract: same response shape, same field names, same field types
- No change to the response field values: counts are byte-identical to today's output
- No change to the existing prefetch structure for other serializer fields (e.g. `project_collaborator`, `project_parent`, `project_sector_mapping` — these are consumed by other fields and must keep working)
- The fix must be transparent to the serializer's other callers (e.g. `ProjectSuggestionSerializer`, any other class that inherits or uses these fields)
- No new dependencies
- No DB migration required

## Domain Context

### Why `.count()` ignores prefetch

`prefetch_related` populates the related manager's cache, but Python descriptor magic means `.count()` on a prefetched manager issues `SELECT COUNT(*)` regardless. The standard remedy is to use `.len()` on the cached queryset (works only with a `to_attr` that returns a list), or — the cleaner approach — annotate the count in the main queryset with `Count(...)`.

### Two valid approaches

**(a) Annotate in the queryset** (preferred)
- Add `.annotate(_number_of_comments=Count("project_comment", distinct=True), _number_of_likes=Count("project_liked"))` to the base queryset in `ListProjectsView.get_queryset`
- Serializer methods return `getattr(obj, "_number_of_comments", 0)` / `getattr(obj, "_number_of_likes", 0)`
- Pros: clean, no per-row Python work, works with any subclass that doesn't prefetch
- Cons: requires keeping a public/private attribute on the model instance (mitigated by the `_` prefix)
- Note: `distinct=True` is required if the annotation can multiply rows (e.g. through a M2M). `ProjectComment` and `ProjectLike` are direct FKs from `Project`, so `distinct=True` is unnecessary but harmless; include it defensively for future-proofing

**(b) Use the prefetched data with `to_attr` + `len()`**
- Change the `prefetch_related` to use `Prefetch("project_comment", queryset=..., to_attr="_prefetched_comments")` and similar for `project_liked`
- Serializer methods return `len(obj._prefetched_comments)` / `len(obj._prefetched_likes)`
- Pros: zero DB cost beyond the existing prefetch
- Cons: (1) changes the prefetch attribute name, which could break other consumers; (2) loads full rows when we only need the count, which is more memory and bandwidth than a `Count()` annotation; (3) the existing `select_related("comment_ptr")` in the prefetch is no longer used by anything if we only `.len()` it

**Recommendation: approach (a).** Cleaner, future-proof, and the memory/bandwidth of a `Count` annotation is trivial (a single int per row).

### Why we still need the prefetch (if we switch to annotation)

If we go with approach (a), the `prefetch_related("project_comment", ...)` and `prefetch_related("project_liked", ...)` in `ListProjectsView.get_queryset` become unused by the serializer. They should be removed to avoid loading rows we don't need. Verify with a search that no other code path on this queryset depends on them (e.g. a `ProjectSuggestionSerializer` that does read them).

If we go with approach (b), the prefetches stay (they become the source of truth for the counts).

### Side benefit

The annotation also sets us up for a future denormalized `ranking_score` column (separate spec): the same pattern of "annotate on the queryset, read in the serializer" composes naturally with the upcoming ranking-column change.

## AI Insights

### Implementation Hints

- Import `Count` from `django.db.models` (likely already imported in `project_views.py`; check)
- In `ListProjectsView.get_queryset`, add to the base queryset after the existing `prefetch_related(...)`:
  ```python
  .annotate(
      _number_of_comments=Count("project_comment", distinct=True),
      _number_of_likes=Count("project_liked"),
  )
  ```
- Remove the now-unused `prefetch_related("project_comment", ...)` and `prefetch_related("project_liked", ...)` clauses from the queryset (approach (a))
- In `ProjectStubSerializer`:
  - `get_number_of_comments(self, obj)` → `getattr(obj, "_number_of_comments", 0)` (fallback for other serializer call sites that don't annotate)
  - `get_number_of_likes(self, obj)` → `getattr(obj, "_number_of_likes", 0)`
- Document the `_` prefix in a comment so future maintainers know the attribute is set by the queryset, not the model

### Trade-off Notes

- **`distinct=True` on both annotations**: defensive — `ProjectComment` and `ProjectLike` are direct FKs today, so it's not strictly required, but if a future model change introduces a M2M through-table, the count would otherwise be wrong. Tiny CPU cost; worth the safety net
- **Fallback to `.count()` in the serializer**: keeps the serializer usable in contexts that don't annotate (e.g. direct model instance access, management commands). The `getattr(obj, "_number_of_comments", 0)` is `False`-safe; an `if not hasattr(obj, "_number_of_comments")` branch with a `.count()` is the alternative
- **Removing the now-unused prefetch**: do it. Loading full `ProjectComment` rows when we only need a count is wasted IO. The `select_related("comment_ptr")` in the prefetch was a hint that someone was iterating comments — verify nothing else reads them on this queryset
- **Don't touch the other prefetches** (`project_collaborator`, `project_parent`, `project_sector_mapping`, etc.) — those are still consumed by the serializer via `.all()` iterations

### Risks

- **`ProjectSuggestionSerializer` or other consumer** that iterates `obj.project_comment.all()` or `obj.project_liked.all()` would break if we remove the prefetch. Verify by searching for `project_comment` and `project_liked` usage outside `ProjectStubSerializer` in `serializers/project.py`
- **`Count` annotation + future GROUP BY** (if the queryset ever adds a `.values(...)` or `.values_list(...)`): annotations can interact unexpectedly. Not a concern today (the queryset returns full ORM objects), but worth a mental flag
- **`distinct=True` performance**: a `COUNT(DISTINCT)` is slightly more expensive than a `COUNT(*)`. For direct FK relationships the distinct is a no-op; Django's planner should optimize it. If profiling shows the distinct adds latency, drop it and rely on the FK being direct (and add a comment warning future maintainers)
- **Memory**: 2 ints per project on the queryset. Negligible.

## System Impact Analysis

### Backend

- `backend/organization/views/project_views.py:200-224`: add `.annotate(_number_of_comments=..., _number_of_likes=...)` after the `prefetch_related`; remove the now-unused `prefetch_related("project_comment", ...)` and `prefetch_related("project_liked", ...)` clauses (if approach (a))
- `backend/organization/serializers/project.py:533-537`: replace `.count()` calls with `getattr(obj, "_<attr>", 0)`; add a brief comment explaining the annotation
- Tests:
  - Add a `connection.queries`-based assertion in the existing `ListProjectsView` test (or a new test in `backend/organization/tests/test_project_views.py`)
  - Add a test that asserts the response shape and values are unchanged

### Frontend

- No changes. Response shape and values are identical.

### Cross-Cutting

- No DB schema changes
- No new dependencies
- No new env vars
- No API contract change
- Memory: 2 ints per project row (negligible)
- Latency: removes 24 queries per page on a cache miss; zero impact on a cache hit (companion spec)

## Out of Scope (Follow-up Specs)

- **Companion (this spec)**: HTTP response cache for first 1-3 pages — see `20260811_1412_cache_browse_project_listing_first_pages.md`
- **Future**: async ranking recompute in signals
- **Future**: denormalize a `ranking_score` column on `Project` to drop the `Case/When` re-sort
- **Future**: per-hub PostGIS `GISUnion` aggregate memoization
- **Future**: frontend cache layer

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-08-11 | First draft. Problem statement, acceptance criteria, and AI insights based on the caching plan's approach 2. Awaiting user review. |


## Log

- 2026-08-11 14:15 UTC - Task created from the caching plan's "approach 2" (annotate counts in the queryset, remove now-unused prefetches). Confirmed exact lines of the N+1 at `backend/organization/serializers/project.py:533-537` and the prefetch at `backend/organization/views/project_views.py:203-223`. Awaiting user review of problem statement and acceptance criteria.
