# Hub Calendar Short Links (ICS redirect + subscribe modal)

**Status**: DRAFT
**Type**: Backend + Frontend — feature
**Date created**: 2026-09-14
**Depends on**:
- iCal Subscription Feed (see [20260810_1046_ical_subscription_feed.md](./20260810_1046_ical_subscription_feed.md))

---

## Problem Statement

The calendar subscription feed URL requires a signed token and multiple query parameters, making it unsuitable for sharing on hub landing pages, newsletters, or social media. We need two clean, short URLs for each hub's event calendar:

1. **ICS short link** — `https://climatehub.org/hubs/wuerzburg/events/feed.ics`
   For calendar-savvy users and newsletter taps. Accessing this URL redirects (301) to the full feed URL with default parameters (`hub`, `date=today`, `token`). The calendar client caches the redirect and all subsequent refreshes hit the full URL directly.

2. **Subscribe modal short link** — `https://climatehub.org/hubs/wuerzburg/events/feed`
   For everyone else, especially as a CTA on hub landing pages. Opens the hub's event calendar page with the subscribe modal pre-opened, so the user sees the calendar context, the hub name, and gets a clear explanation before subscribing. The modal shows the personalized feed URL (with the user's current filters).

Both links are short, stable, and shareable. The personalized subscribe flow (SubscribeToCalendarButton with user-selected filters and token) remains unchanged.

## User Stories

- As a hub operator, I want a short, stable URL for my hub's event calendar feed so I can share it in newsletters and on the hub landing page.
- As a user receiving a shared calendar link, I want tapping the link to immediately subscribe me to the hub's upcoming events in my calendar app, without any extra steps.
- As a user who doesn't know what an ICS feed is, I want clicking a "subscribe" link to show me the hub's events and a clear explanation of how to subscribe, so I can make an informed decision.
- As a hub operator placing a CTA on my landing page, I want a link that opens the calendar with the subscribe modal ready, so visitors see the hub context and subscribe flow in one step.

---

## Acceptance Criteria

### ICS short link (redirect)

- [ ] **AC-1**: `GET /hubs/{hubUrl}/events/feed.ics` (no query params) returns a **301 redirect** to the full feed URL
- [ ] **AC-2**: Redirect URL contains exactly three query params: `hub=<hubUrl>`, `date=<today YYYY-MM-DD>`, `token=<HMAC-signed>`
- [ ] **AC-3**: `GET /hubs/{hubUrl}/{subHub}/events/feed.ics` (no query params) returns a 302 redirect with `hub=<composite_slug>` (e.g. `perth_zerowaste`)
- [ ] **AC-4**: `GET /hubs/{hubUrl}/events/feed.ics?token=...` (with token) serves the feed directly — **no redirect**, existing behavior unchanged
- [ ] **AC-5**: `GET /events/feed.ics` (global, no hub) without token returns 403 — existing behavior unchanged
- [ ] **AC-6**: The redirect Location header uses the frontend-facing URL (via `build_feed_url`), not the Django API path

### ICS short link — token

- [ ] **AC-7**: Token is signed over the canonical query `date=<today>&hub=<hub_slug>` using the existing `sign_feed_token` / `canonicalize_query` functions
- [ ] **AC-8**: Following the redirect URL returns a valid RFC 5545 iCal feed (same as subscribing via the SubscribeToCalendarButton)

### Subscribe modal short link

- [ ] **AC-9**: `GET /hubs/{hubUrl}/events/feed` loads the hub event calendar page with the subscribe modal pre-opened
- [ ] **AC-10**: The page loads the same SSR data as `/hubs/{hubUrl}/events` (hub data, sectors, events, theme)
- [ ] **AC-11**: The subscribe modal opens automatically on mount and displays the personalized feed URL for the hub (default filters — no sectors, no search, date=today)
- [ ] **AC-12**: The modal shows the hub name in its title (e.g. "Subscribe to Würzburg — Events")
- [ ] **AC-13**: `GET /hubs/{hubUrl}/{subHub}/events/feed` works for sub-hubs
- [ ] **AC-14**: Navigating to `/hubs/{hubUrl}/events` (without `/feed`) does NOT open the modal — behavior unchanged

### Next.js

- [ ] **AC-15**: Rewrite for `/hubs/:hubUrl/events/feed.ics` injects `hub=:hubUrl` into the query string forwarded to Django
- [ ] **AC-16**: Rewrite for `/hubs/:hubUrl/:subHub/events/feed.ics` injects the composite hub slug (e.g. `:hubUrl_:subHub` or equivalent)
- [ ] **AC-17**: Rewrite for `/events/feed.ics` remains unchanged (no hub injection)
- [ ] **AC-18**: Existing full-URL requests (with token + hub in query) still work correctly despite the injected hub param (duplicate `hub` is harmless — Django `QueryDict.items()` returns the last value)
- [ ] **AC-19**: New page `pages/hubs/[hubUrl]/events/feed.tsx` reuses the hub events page SSR (`getHubEventsServerSideProps`) and passes an `autoOpenSubscribe` flag
- [ ] **AC-20**: New page `pages/hubs/[hubUrl]/[subHub]/events/feed.tsx` mirrors the sub-hub events page with the same flag

### Tests

- [ ] ICS short URL returns 302 with Location header containing `hub`, `date` (today), and `token`
- [ ] Following the ICS redirect returns valid iCal with correct `X-WR-CALNAME` for the hub
- [ ] Token in redirect verifies correctly against the canonical query
- [ ] ICS short URL with an explicit `token` param serves the feed directly (no redirect)
- [ ] Sub-hub ICS short URL redirects with composite hub slug
- [ ] Global ICS short URL (`/events/feed.ics`) without token returns 403
- [ ] Invalid hub slug in ICS short URL still redirects (feed returns empty calendar)
- [ ] Modal short URL loads the calendar page and opens the subscribe modal
- [ ] Modal short URL for sub-hub works correctly
- [ ] Regular events page (`/events`) does not open the modal

---

## Constraints

- No changes to existing token validation, feed generation, or the SubscribeToCalendarButton flow
- 301 (permanent) redirect — calendar clients cache the target URL and fetch it directly on subsequent refreshes. Re-subscribe if redirect logic changes.
- The ICS short URL and the full URL share the same path; the `token` param determines whether to redirect or serve
- Calendar clients (Apple Calendar, Google Calendar, Outlook) all follow 302 redirects and cache the target URL for subsequent refreshes
- The subscribe modal page reuses the existing hub events page — no duplicate page logic
- The `autoOpenSubscribe` flag must not affect SSR output (modal opens client-side only)

---

## Directional hints

### ICS redirect

The redirect logic is a small branch added to `EventCalendarFeedView.get()`: if `token` is absent and `hub` is present in the query params, generate a token for `hub + date=today`, build the full URL via `build_feed_url`, and return a 302. The Next.js rewrites need to be updated to inject the `hub` query param from the URL path — currently they don't, because the frontend always sets it explicitly.

The key subtlety is the **sub-hub composite slug**: the URL path has two segments (`/hubs/germany/frankfurt/events/feed.ics`) but the `hub` query param is a single composite value (`germany_frankfurt`). The Next.js rewrite destination must concatenate `:hubUrl` + `_` + `:subHub` — verify during implementation that Next.js supports this syntax.

### Subscribe modal page

The new `/feed` page is a thin wrapper around the existing hub events page. The SSR is identical (`getHubEventsServerSideProps`). The only difference is a prop or URL-derived flag (`autoOpenSubscribe`) that tells `EventCalendarContent` to open the `SubscribeToCalendarButton` dialog on mount. This keeps the page logic minimal and avoids duplicating any calendar or filter code.

---

## System impact

### Backend

- `backend/organization/views/event_calendar_feed_views.py`: `EventCalendarFeedView.get()` — add a redirect branch before token validation. If `token` is absent and `hub_slug` is present, generate a token for `hub + date=today`, build the full URL via `build_feed_url`, and return a 302. The existing 403 for global `/events/feed.ics` without a hub stays correct (no `hub_slug` → falls through to existing 403). `build_feed_url` already handles sub-hub path construction — no changes needed.

### Frontend — Next.js

- `frontend/next.config.js` (rewrites block): inject `hub=:hubUrl` (and `:hubUrl_:subHub` for sub-hubs) into the two hub feed rewrites. The `/events/feed.ics` rewrite is unchanged. Duplicate `hub` param for full-URL requests is harmless — `QueryDict.items()` returns the last value.
- `frontend/pages/hubs/[hubUrl]/events/feed.tsx` (new): thin wrapper around the existing events page, reuses `getHubEventsServerSideProps`, passes `autoOpenSubscribe` flag.
- `frontend/pages/hubs/[hubUrl]/[subHub]/events/feed.tsx` (new): mirrors the existing sub-hub re-export pattern.
- `frontend/src/components/eventCalendar/EventCalendarContent.tsx`: accept optional `autoOpenSubscribe?: boolean` prop. When true, `useEffect` opens the subscribe dialog on mount (no-op if `ICAL_SUBSCRIPTION_FEED_FEATURE` is off).

### Non-changes

- Models: none. Migrations: none. Dependencies: none.
- `EventFeedTokenView`: unchanged. `SubscribeToCalendarButton`: unchanged.
- Hub events page (direct route): unchanged. The new `/feed` page reuses it.
- `next.config.js` redirects (subdomain/Potsdam shortcuts): unchanged.
- `FEATURE_TOGGLE_EVENT_CALENDAR_FEATURE` still gates the page; the feed endpoint remains always on.

### Risks

- **Next.js param concatenation in rewrite destination** (`:hubUrl_:subHub`) is standard Next.js syntax but worth confirming with a quick dev-server curl during implementation. If unsupported, fallback: regex capture group or a separate endpoint.
- **Modal auto-open on refresh**: `useEffect` with empty deps fires once on mount; refreshing the page re-opens the dialog — this is likely desired (less surprising than it staying closed after refresh).
- **Locale prefix**: the new `/feed` pages inherit the existing locale-aware routing automatically.

---

## Log

- 2026-09-14 13:35 UTC — Task created. Brainstormed options: (1) direct tokenless feed endpoint, (2) page + modal. User proposed redirect approach for the ICS link — simpler, no backend feed changes needed, calendar clients cache the redirect target. Agreed on `date=today` as the start point for the redirected feed. Initial spec drafted with ICS redirect only.
- 2026-09-14 15:36 UTC — User decided on both approaches for maximal flexibility: ICS short link (redirect) AND subscribe modal short link (page with pre-opened modal). Spec updated to include both entry points.
- 2026-09-14 15:42 UTC — Archie system impact analysis complete. Verdict: small, low-risk change. Backend: one branch in `EventCalendarFeedView.get()` + reuse of existing `sign_feed_token`/`canonicalize_query`/`build_feed_url`. Frontend: two thin page wrappers + one `autoOpenSubscribe` prop on `EventCalendarContent`. No model changes, no migration, no new dependencies. Plan written.
