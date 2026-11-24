# Event Calendar Location Filter (place + radius)

**Status**: IMPLEMENTED (pending review)
**Type**: Backend + Frontend — feature
**Date created**: 2026-11-16
**Branch**: `event_calender_location_filter`
**Related**:
- Hub Calendar Short Links ([20260914_1335_hub_calendar_short_link.md](./20260914_1335_hub_calendar_short_link.md)) — subscribe modal / iCal feed
- LocationIQ autocomplete migration ([20260623_1000_locationiq_autocomplete_migration.md](./20260623_1000_locationiq_autocomplete_migration.md)) — `LocationSearchBar` provider routing

---

## Problem Statement

The global event calendar (`/events`) lists every event on the platform. Without a way to narrow by place it is much less useful than the ClimateHub event calendars (`/hubs/{hub}/events`), which are implicitly scoped to the hub's region.

The browse pages (projects, organizations, members) already offer a location filter: an autocomplete place search combined with a radius select (5–500 km). The event calendar should offer the same filter so users can find events near them.

### Correction to the issue's assumption

The issue says *"the backend should already support it as it is reusing the filtering logic from the browse page."* **This isn't the case.** The three event endpoints implement their own filter code and support only `search`, `sectors`, `hub`, and a date. None of them read `osm_id`/`osm_type`/`osm_class`/`place_id`/`radius`:

| Endpoint | View | Location support today |
|---|---|---|
| `GET /api/events/` | `ListEventsView` (`backend/organization/views/project_views.py`) | none |
| `GET /api/events/calendar/` | `EventCalendarCountsView` (same file) | none |
| `GET /api/events/feed.ics/` | `EventCalendarFeedView` (`backend/organization/views/event_calendar_feed_views.py`) | none |

The browse location logic lives inline in `ListProjectsView.get_queryset()` (the `osm_id`/`place_id` branch that calls `location.utility.get_location_with_range`). It has to be extracted and reused. The work is small, but this feature does need backend changes.

---

## User Stories

- As a visitor of the global event calendar, I want to pick a place (city, region, country) and a radius so I only see events near me.
- As a visitor, I want to see which place I've selected and remove it with one click.
- As a visitor, I want "Reset" to also clear the selected place and radius.
- As a visitor of a **custom hub's** event calendar, I want to narrow its events by place, since custom hubs aren't geographically scoped.
- As a visitor of a **location hub's** (ClimateHub's) event calendar, I don't want a location filter. The hub is already a place, so the control would be redundant and confusing.
- As a visitor sharing a filtered calendar link, I want the place and radius preserved in the URL so the recipient sees the same events.

---

## Acceptance Criteria

### Visibility / placement

- [ ] **AC-1**: On `/events` (global calendar), a location filter (place autocomplete + radius select) is shown in the left filter panel **below the date calendar and above the "Topics" filter**.
- [ ] **AC-2**: On `/hubs/{hub}/events` where the hub's `hub_type` is `"custom hub"`, the location filter is shown in the same position. *(prio 1)*
- [ ] **AC-3**: On `/hubs/{hub}/events` where the hub's `hub_type` is `"location hub"`, the location filter is **not** rendered.
- [ ] **AC-4**: On sub-hubs (`/hubs/{hub}/{subHub}/events`), the location filter is **not** rendered when the sub-hub itself **or its parent hub** is a location hub, because such a sub-hub is already geographically restricted by `apply_hub_filter` via its parent. Sector hubs, and sub-hubs where neither the sub-hub nor its parent is a location hub, **do** show the filter. See [Decisions §1](#decisions).
- [ ] **AC-5**: On narrow screens (`md` and below), the location filter appears in the full-screen mobile filter dialog in the same relative position (below the calendar, above Topics) and follows the dialog's staged-apply behaviour: changes take effect only on "Apply filters".

### Selecting a place

- [ ] **AC-6**: The place input reuses `LocationSearchBar` in `filterMode` (same autocomplete, provider routing, debounce, 3-character minimum, and postcode exclusion as the browse pages).
- [ ] **AC-7**: The radius select reuses the browse options from `public/data/radiusFilterOptions` (empty, 5, 10, 25, 50, 100, 250, 500 km). The default is empty, meaning "within the selected place's boundary" (radius 0, same as browse). No radius is preselected. See [Decisions §4](#decisions).
- [ ] **AC-8**: Selecting a place from the autocomplete options immediately (desktop) refetches the event list **and** the per-day counts that drive the calendar dots, both filtered by place + radius.
- [ ] **AC-9**: Changing the radius while a place is selected refetches list + counts. Changing the radius with no place selected does nothing (no request, not counted as an active filter). This matches browse.
- [ ] **AC-10**: Typing in the input without selecting an option does **not** filter.

### Showing / removing the selected place

- [ ] **AC-11**: When a place is selected, its name is shown in the input (as on browse), with a clear "×" button as an end adornment inside the input. The button has an accessible label, e.g. "Remove location". The same control is used on desktop and in the mobile dialog. No chip. See [Decisions §3](#decisions).
- [ ] **AC-12**: Removing the place clears the place and radius from state and URL, then refetches list + counts unfiltered by location.
- [ ] **AC-13**: The active filter count badge on the mobile filter button includes the location filter as **1** when a place is selected (radius doesn't add a second count).

### Reset

- [ ] **AC-14**: The desktop "Reset" button clears place and radius along with search, sectors, and date.
- [ ] **AC-15**: The mobile "Clear all" button clears the **draft** place and radius. They are applied on "Apply filters", consistent with the other draft fields.

### URL state / SSR

- [ ] **AC-16**: The selected place is written to the URL with the same parameter names as browse: `osm_id`, `osm_type`, `osm_class` (plus `place_id` only if already present for legacy links), and `radius` (km, without the `km` suffix). Existing `search`, `sectors`, `date` params are unchanged.
- [ ] **AC-17**: Loading `/events?osm_id=…&osm_type=…&osm_class=…&radius=25` (or the hub equivalent) server-side renders the **already filtered** first page of events and pre-fills the place input with the resolved place name. Resolve it via the existing `getLocationFilteredBy(ctx.query, locale)`.
- [ ] **AC-18**: If the location in the URL can't be resolved (unknown OSM id, upstream lookup failure), the page still renders without the location filter applied, and no 500 error occurs.
- [ ] **AC-19**: On any calendar page where the location filter is hidden (AC-3/AC-4), any location params in the URL are ignored (not applied server-side or client-side), since the control isn't shown.

### Backend

- [ ] **AC-20**: `GET /api/events/` accepts `osm_id`, `osm_type`, `osm_class`, `place_id`, `radius` with the **same semantics as `GET /api/projects/`**: same country restriction, same `multi_polygon`/`centre_point` `distance_lte` match, same `osm_class` fallback and deprecated `place_id` fallback.
- [ ] **AC-21**: `GET /api/events/` keeps ordering strictly by `start_date` when a location filter is applied. The `distance` ordering used on browse must **not** override chronological order.
- [ ] **AC-22**: `GET /api/events/calendar/` accepts the same location params and returns counts restricted accordingly.
- [ ] **AC-23**: Location params combine (AND) with `hub`, `sectors`, `search`, and the date filters.
- [ ] **AC-24**: Invalid or unresolvable location params return **400** with an error message (not 500). Location filtering is skipped entirely when none of the identifying params are present.
- [ ] **AC-25**: No duplicate events in list results and no double-counting in calendar counts when location and sector filters are combined (keep the existing `.distinct()`).
- [ ] **AC-26**: No N+1 queries introduced. The location resolution happens once per request.

### iCal subscription (in scope, see [Decisions §2](#decisions))

- [ ] **AC-27**: `SubscribeToCalendarButton` includes the selected location params (`osm_id`, `osm_type`, `osm_class`, `radius`) in the signed feed params, and `EventCalendarFeedView` applies the same location filter. Without this, a subscribed feed would silently contain more events than the user saw.
- [ ] **AC-27a**: On mobile, the subscribe button inside the filter dialog uses the **draft** location/radius, consistent with how it already uses `draftSectors`/`draftSelectedDay`.
- [ ] **AC-27b**: The feed's `filters_summary` (calendar description) mentions the location filter, e.g. `location=<display name>; radius=25km`.

### i18n

- [ ] **AC-28**: All new user-facing strings (input label e.g. "Location", radius label/aria-label, remove-place aria-label) have English and German texts. Reuse existing `filter_and_search` texts where possible.

### Docs

- [ ] **AC-29**: `doc/api-documentation.md` documents the new query params on `/api/events/`, `/api/events/calendar/` and `/api/events/feed.ics/`.

### Tests

Backend (`organization/tests/`):
- [ ] `/api/events/` with a city location filter returns only events whose `loc` is inside or near the city; events in another city/country are excluded.
- [ ] `/api/events/` with `radius` includes events within the radius and excludes those outside.
- [ ] `/api/events/` with location filter is still ordered by `start_date`.
- [ ] `/api/events/` with location + `sectors` returns each event once.
- [ ] `/api/events/` with location + `hub` (custom hub) applies both.
- [ ] `/api/events/calendar/` counts respect the location filter.
- [ ] Missing/invalid location params → 400, not 500. Upstream lookup is mocked (`requests.get` at `location.utility`).
- [ ] Existing browse project location tests still pass after the extraction refactor.
- [ ] Feed with signed location params returns only matching events, and the token signed over location params verifies.

Frontend (Jest):
- [ ] Location filter renders on global calendar, custom hub and sector hub. It doesn't render on a location hub or on a sub-hub whose parent is a location hub.
- [ ] Selecting a place adds `osm_*` params to the `/api/events/` and `/api/events/calendar/` requests and to the page URL.
- [ ] Changing radius without a place doesn't trigger a fetch.
- [ ] Remove-place control clears the place from state, request params, and URL.
- [ ] Reset clears the place. Mobile "Clear all" clears only the draft until "Apply".
- [ ] Active filter count includes location as 1.
- [ ] Initial location from SSR props pre-fills the input.

---

## Constraints

- **Reuse, don't duplicate.** The location queryset filter must be extracted into a shared helper used by both `ListProjectsView` and the event views, so browse and calendar can't drift.
- **Don't change browse behaviour.** The refactor of `ListProjectsView` must be behaviour-preserving, including its `distance` annotation/ordering, which is then overwritten by the ranking order.
- **No shared filter state with browse yet.** As the issue notes, the calendar and browse pages don't share filter state. This feature doesn't introduce a shared store. It uses the **same URL param names** so a later state-sharing step is straightforward. The calendar keeps its own local state in `EventCalendarContent`.
- Don't adopt `FilterProvider`/`FilterContext` for the calendar in this change. That's the later state-sharing refactor.
- `LocationSearchBar` and `radiusFilterOptions` are reused as-is. Changes to them must not alter browse behaviour.
- The upstream location lookup (`LOCATION_SERVICE_BASE_URL`) can be slow. Location resolution in `get_location_with_range` hits the DB first and only calls upstream for unseen places. No new caching is required, but there must not be **more than one** resolution per request.
- Feature remains behind the existing `EVENT_CALENDAR_FEATURE` toggle. No new toggle unless requested.

---

## Directional hints

### Backend

Extract the location branch from `ListProjectsView.get_queryset()` into a helper, e.g. in `organization/utility/project.py` next to `apply_hub_filter`:

```python
def apply_location_filter(queryset, query_params, *, annotate_distance=False):
    """Restrict projects to those in/near the location described by
    osm_id/osm_type/osm_class (or legacy place_id) + optional radius (km).
    No-op if no location identifier is present."""
```

- Guard with the same condition as browse: `("osm_id" in qp and "osm_type" in qp) or "place_id" in qp`.
- Browse calls it with `annotate_distance=True` (keeps current `.annotate(distance=…).order_by("distance")`). The event views call it without, then keep their own `order_by("start_date")`.
- `get_location_with_range` raises `django.core.exceptions.ValidationError`. Convert it to a DRF 400 in the event views (check what browse does today and match it). If browse currently 500s here, note it but don't fix it in this change unless trivial.
- `EventCalendarCountsView` and `EventCalendarFeedView` each build their own queryset. Call the helper after the hub filter in both.

### Frontend {#ui}

**State** (`EventCalendarContent.tsx`): add `location` (selected location object or `null`) and `radius` (string, e.g. `"25km"` or `""`) alongside `search`/`sectors`/`selectedDay`, plus `draftLocation`/`draftRadius` for the mobile dialog. Extend:
- `syncFiltersToUrl` / `readFiltersFromUrl`: write/read `osm_id`, `osm_type`, `osm_class`, `radius`. The place's *display name* comes from SSR (`initialLocation`), not the URL.
- `fetchCounts` and `EventCalendarEventList`'s fetch: append the location params when a place is selected. Pass `location`/`radius` down as props to `EventCalendarEventList`.
- `handleReset`, `handleResetDraft`, `handleApplyMobileFilters`, `activeFilterCount`, and the mobile-dialog snapshot effect.

A small shared helper (e.g. `locationToQueryParams(location, radius)` in `public/lib/locationOperations.ts`) avoids repeating the param-building in three places. It can later be reused by `encodeQueryParamsFromFilters`.

**Component**: build a small `EventCalendarLocationFilter` in `src/components/eventCalendar/` that composes `LocationSearchBar` (`filterMode`, `smallInput`) + `SelectField` with `getRadiusFilterOptions()`, styled like `LocationFilter` in `src/components/filter/Filters.tsx`. Reuse or extract that component instead if it can be decoupled from the browse `onChange(filter.key, …)` signature cheaply. The panel is 260 px wide, so stack place input and radius vertically, or put radius on a second row.

**Removing the place**: the browse page uses a `SelectedFilter` chip via `FilterContext`, which the calendar doesn't have. Instead, once a place is selected, show the place input as filled with an end `InputAdornment` containing an `IconButton` with a close icon (aria-label from texts). Clicking it clears place + radius. If `LocationSearchBar` doesn't support a custom end adornment, add an optional prop for it without changing browse behaviour. Use it on desktop and mobile.

**Placement**: in both the `LeftPanel` (desktop) and `MobileFilterDialogContent` (mobile), insert between `StyledDateCalendar` and the Topics `FormControl`.

**Visibility**: `EventCalendarContent` gets a `showLocationFilter` prop.
- `pages/events.tsx`: `true`.
- `pages/hubs/[hubUrl]/events/index.tsx` (and the sub-hub page re-exporting it): compute in `getHubEventsServerSideProps`:
  ```ts
  const isLocationHub = (h) => h?.hub_type === "location hub";
  const parentHub = hubs.find((h) => h.url_slug === parentHubUrl);
  const showLocationFilter = !isLocationHub(hubData) && !(subHub && isLocationHub(parentHub));
  ```
  `hub_type` is already returned as a display string by the hub serializer. Verify that the `getAllHubs` entries include `hub_type`; otherwise fetch the parent's hub data. Pass `showLocationFilter` as a prop, and use it to decide whether to resolve or apply location params server-side (AC-19).

**SSR** (`pages/events.tsx`, `getHubEventsServerSideProps`):
- Call `getLocationFilteredBy(ctx.query, locale)` (in parallel with existing fetches) only when the location filter is shown.
- If it resolves, forward `osm_id`/`osm_type`/`osm_class`/`radius` to the initial `/api/events/` request and pass `initialLocation` + `initialRadius` props.
- Wrap so a failed lookup yields `initialLocation: null` and an unfiltered first page (AC-18).

**iCal** (AC-27): add optional `location`/`radius` props to `SubscribeToCalendarButton` and include `osm_id`, `osm_type`, `osm_class`, `radius` in the params object it sends to `EventFeedTokenView`. The token is signed over the canonical query, but `canonicalize_query` and `EventFeedTokenView` only accept a whitelist of keys. The location keys must be added to it (now `FEED_PARAM_KEYS` in `organization/utility/ical_feed.py`). Existing tokens stay valid because their canonical form is unchanged. In the feed view, add the place name (from the resolved location) and radius to `filters_summary` (AC-27b).

---

## System impact

### Backend
- `backend/organization/utility/project.py`: new `apply_location_filter(...)` helper.
- `backend/organization/views/project_views.py`:
  - `ListProjectsView.get_queryset()`: replace inline location branch with the helper (behaviour-preserving).
  - `ListEventsView.get_queryset()`: apply helper. Keep `distinct().order_by("start_date")`.
  - `EventCalendarCountsView.get()`: apply helper.
- `backend/organization/views/event_calendar_feed_views.py`: `EventCalendarFeedView.get()` applies helper and extends `filters_summary`.
- `backend/organization/tests/`: new tests for event list/counts/feed location filtering.
- No model or migration changes.

### Frontend
- `frontend/src/components/eventCalendar/EventCalendarContent.tsx`: state, URL sync, reset, mobile draft, placement, `showLocationFilter` / `initialLocation` / `initialRadius` props.
- `frontend/src/components/eventCalendar/EventCalendarEventList.tsx`: accept and forward location params in the fetch. Refetch on change.
- `frontend/src/components/eventCalendar/EventCalendarLocationFilter.tsx` (new), or a reused/extracted `LocationFilter` from `filter/Filters.tsx`.
- `frontend/src/components/eventCalendar/SubscribeToCalendarButton.tsx`: location params.
- `frontend/src/components/search/LocationSearchBar.tsx`: optional end-adornment / clear prop, only if needed (no browse behaviour change).
- `frontend/pages/events.tsx`, `frontend/pages/hubs/[hubUrl]/events/index.tsx`: SSR location resolution + props.
- `frontend/public/lib/locationOperations.ts`: optional `locationToQueryParams` helper.
- `frontend/public/texts/*`: new EN/DE strings.
- Tests: `EventCalendarEventList.test.tsx` plus a new `EventCalendarContent` / location filter test.

### Docs
- `doc/api-documentation.md`: new params on event endpoints.

### Non-changes
- Browse pages (projects/organizations/members) behaviour and URL format.
- `/api/events/upcoming/` (hub landing page widget) is out of scope.
- No shared filter state between calendar and browse. That's a follow-up.
- Location hubs' event calendars look and behave exactly as today.

---

## Decisions

Agreed with the product owner on 2026-11-16:

1. **Visibility on sub-hubs and sector hubs:** the filter is hidden when the effective hub **or its parent** is a location hub. It is shown on the global calendar, custom hubs, sector hubs, and sub-hubs without a location-hub parent (AC-3, AC-4, AC-19).
2. **iCal feed:** in scope. The subscribe button exports the location filter, and the feed applies it (AC-27–AC-27b).
3. **Remove control:** an "×" end adornment inside the place input, not a chip (AC-11).
4. **Default radius:** browse parity. Empty, meaning within the place's boundary, with no preselected radius (AC-7).

---

## Implementation notes

What was built, and where it differs from the directional hints above:

**Backend**
- `organization/utility/project.py`: the location logic is split into `has_location_filter_params(query_params)`, `get_location_filter_data(query_params)` (resolves once, returns `None` when there are no params), and `apply_location_filter(queryset, location_data, *, annotate_distance=False)`. Splitting resolution from filtering lets the feed view reuse the resolved location name.
- `get_location_filter_data` first validates `radius` (`validate_radius_param`: finite, non-negative number) and raises DRF's `ValidationError` on `radius` (400) before any lookup. Lookup failures from `location.utility` are re-raised as `LocationLookupError`, a subclass of DRF's `ValidationError`, so every caller gets a 400. `_resolve_location_filter_or_400` (list + counts) and the feed view catch `LocationLookupError`, log it and replace it with a generic 400 (`"Location could not be resolved."` / `Invalid location`), so upstream URLs and response bodies aren't exposed.
- `location/utility.get_location_with_range` now also returns `name` (used in the feed's `filters_summary`).
- `ListProjectsView` (browse, `annotate_distance=True`) and `ListUpcomingEventsView` use the helper, with unchanged behaviour for valid input. `ListEventsView` and `EventCalendarCountsView` use it via `_resolve_location_filter_or_400`.
- Feed: `FEED_PARAM_KEYS` (in `ical_feed.py`) is the single whitelist for `canonicalize_query` and `EventFeedTokenView`, and now includes `osm_id`, `osm_type`, `osm_class`, `place_id` and `radius`. Changing a location param in a signed URL therefore invalidates the token.
- Tests: `organization/tests/test_event_calendar_location_filter.py`.

**Frontend**
- `public/lib/locationOperations.ts`: `isSelectedFilterLocation`, `locationToQueryParams`, `getInitialEventLocationFilter` (SSR, never throws), `shouldShowEventLocationFilter` (Decisions §1).
- `src/components/eventCalendar/EventCalendarLocationFilter.tsx`: a thin wrapper around the browse page's `LocationFilter` (now exported from `src/components/filter/Filters.tsx`), so the calendar looks exactly like browse: the place input with a joined, smaller radius box on the same row (100px on desktop, a third of the row in the mobile dialog), with icon labels. It adds the "×" end adornment. In the 260px desktop panel the place input shrinks, not the radius, so long place names are cut off with an ellipsis.
- `LocationSearchBar` and `LocationFilter` have a new optional `endAdornment` prop. Browse doesn't pass it.
- `EventCalendarContent`: `showLocationFilter` / `initialLocation` / `initialRadius` props. Location params are memoized by value (`useLocationParams`), so changing the radius with no place selected doesn't refetch. They're passed as `locationParams` to `EventCalendarEventList` and `SubscribeToCalendarButton` (the mobile dialog passes the draft params).
- Tests: `EventCalendarContent.test.tsx`, `public/lib/eventLocationFilter.test.ts`, plus new cases in `EventCalendarEventList.test.tsx`.

**Known pre-existing issues (not fixed here)**
- `GET /api/projects/` (browse) and `/api/events/upcoming/` return 400 when a location can't be resolved, but the body contains the raw upstream error, including the internal location-service URL or upstream response body. (An invalid `radius` there used to return 500; it now returns 400 on `radius` like the event endpoints.)
- `/api/events/` has a per-event N+1 in `ProjectStubSerializer` (comment/like counts, parents, collaborators: about 4 queries per event). It exists without the location filter too.

---

## Follow-ups (out of scope)

- Share filter state (location, sectors, search) between the event calendar and the browse pages, e.g. via `FilterProvider` or a shared URL convention. This change keeps param names identical to make that easier.
- Optionally show distance on event cards when a location filter is active.
