# iCal Subscription Feed for Event Calendar

**Status**: DRAFT
**Type**: Backend + Frontend — feature
**Date created**: 2026-08-10
**Depends on**:
- Existing event calendar pages (see [20260805_0840_sub_hub_support_for_event_calendar.md](./20260805_0840_sub_hub_support_for_event_calendar.md))
- Per-event iCal download (see [20260611_1131_calendar_links_on_event_page.md](./20260611_1131_calendar_links_on_event_page.md))
- Event registration email iCal attachment (backend `generate_event_ics_attachment` in `backend/organization/utility/email.py`)

---


## Problem Statement

We already offer a per-event `.ical` download on event project pages (and `.ics` attachments on event registration emails). The next step users naturally ask for is a **subscription feed** — a single URL a user can hand to Apple Calendar / Google Calendar / Outlook that auto-updates as new events are added, instead of downloading a new file for every event.

The most valuable scope is per-hub, and the feed should reflect the same filters the user has active on the hub's event calendar (search text, topic, date). A global feed and per-organisation feeds are explicitly out of scope for v1.

This spec defines the first version of that feed: signed, read-only, hub-scoped, with the user's current filter set embedded in the URL. It is **anonymous** (no login required to subscribe) so it can be shared and so that feeds survive if a user deletes their account.

## Resolved Decisions

### From v0.3 review (2026-08-10)

1. **Auth model: anonymous signed-token URL.** No user account, no feed-management UI. The token makes the URL unforgeable; rate limiting is a defensive floor.
2. **Past events: included within the requested window.** Cheap today, gives subscribers context on first sync.
3. **Future window:** no upper cap when the user has set an explicit `date` (events from `<date>` onwards, indefinitely — matches the calendar page's "jump to date" semantics). When no `date` is set, the default lower bound is `now()` and the upper bound is `now() + 12 months`. The 12-month cap only applies to the default-no-date case.
4. **Date as lower bound:** `date` present → `start_date >= <date>`; `date` absent → `start_date >= now()`.
5. **Content per VEVENT:** same field mapping as the per-event download, but the feed is **locale-aware via a new `lang` query param** the frontend always sends. The endpoint also honors `Accept-Language` and falls back to `settings.LANGUAGE_CODE` for direct calendar-app requests that don't carry the param.
6. **Rate limiting: `20/hour` per IP.** Defensive floor; not a sizing concern.
7. **Where it runs: Django generates, Next.js is the public face.** Calendar apps hit the Next.js URL (e.g. `https://climateconnect.earth/events/feed.ics?...`). Next.js forwards the request to Django, which verifies the token and generates the iCal.
8. **UI: subscribe button on hub event calendars only** (`/hubs/[hubUrl]/events`, `/hubs/[hubUrl]/[subHub]/events`). No button on `/events` for v1. Per-organisation feed is a follow-up.

### From v0.4 review (Archie's questions, 2026-08-10)

9. **UID scheme: reuse the existing `{project_id}@climatehub.org`.** Do NOT introduce a new UID format. Any user who already imported a per-event ical and later subscribes to the feed will see each event exactly once, not twice.
10. **`lang` validation: silent fallback to `LANGUAGE_CODE`** on unknown values. No 400 — misconfigured clients should still get a feed.
11. **`lang` always sent** in the canonical query, even when the user is on the default `en` UI. Clearer for auditing; the token is unaffected.
12. **Key rotation: single `ICAL_FEED_SIGNING_KEY` for v1.** Rotating the key invalidates every existing subscription; the recovery action is to re-announce and ask users to re-subscribe via the dialog. Documented in the runbook. v2 may support `ICAL_FEED_SIGNING_KEYS` (list, any match accepted) for a grace-period rotation.
13. **PRODID: update to `-//Climate Hub Network//EN`** to match the current org name. Both the per-event iCal (`email.py:858` and `:960`) and the new feed endpoint will use this value. The per-event ical has barely been used, so updating it now is fine.
14. **Pass-through: `next.config.js` rewrite** (one rewrite covers all three URL shapes). No file-based route. No Nginx concern (Azure App Service, no gateway in front).
15. **IP detection: read `X-Forwarded-For` first, fall back to `REMOTE_ADDR`.** Azure App Service sets `X-Forwarded-For`; the existing auth app uses `REMOTE_ADDR` directly (a pre-existing gap, not introduced by this spec, but our throttle must use the correct IP to actually work as a per-client limit).

## Acceptance Criteria

### Feed endpoint (Django)

- [ ] Public URL: `https://climateconnect.earth/events/feed.ics?...` (Next.js route, forwards to Django)
- [ ] Direct Django URL: `GET /api/events/feed.ics/` returning RFC 5545 with `Content-Type: text/calendar; charset=utf-8`
- [ ] Query parameters:
  - `hub` — optional URL slug (location / custom / sector / sub-hub composite). Scope restricted via `apply_hub_filter`.
  - `sectors` — optional comma-separated sector original names; reuses `sanitize_sector_inputs`.
  - `search` — optional free text; same `name` + translated-name search as `ListEventsView`.
  - `date` — optional `YYYY-MM-DD`. When present: `start_date >= <date>` (no upper cap). When absent: `start_date >= now() AND start_date <= now() + 12 months`.
  - `tz` — optional IANA timezone for `date` interpretation. Defaults to server tz; the frontend always sends browser tz.
  - `lang` — optional locale code (`"en"`, `"de"`). When present: SUMMARY/DESCRIPTION/LOCATION use that locale. When absent: fall back to `Accept-Language`, then `settings.LANGUAGE_CODE`.
  - `token` — required HMAC signature (see Signing).
- [ ] Exclusion: `is_draft=False`, `is_active=True`, `project_type=event`, `start_date__isnull=False`
- [ ] Each VEVENT matches the per-event download byte-for-byte (modulo locale); UID scheme `{project_id}@climatehub.org` (reused from the per-event ical to avoid duplicate-event artifacts for users who already imported a per-event ical); `SEQUENCE` + `LAST-MODIFIED` populated
- [ ] PRODID: `-//Climate Hub Network//EN` (matches the current org name; also applied to the existing per-event iCal PRODID in `email.py:858` and `:960` as part of the `build_vevent` extraction)
- [ ] X-WR-CALNAME = `Climate Connect — <hub name or "All hub events">`; X-WR-CALDESC = filter summary
- [ ] DTSTAMP regenerated per request; events sorted by DTSTART ascending
- [ ] RFC 5545 line folding + CRLF (delegated to `icalendar`)
- [ ] `Cache-Control: public, max-age=3600` (1 hour) on the response
- [ ] `X-PUBLISHED-TTL:PT1H` and `REFRESH-INTERVAL;VALUE=DURATION:PT1H` in the feed body
- [ ] DRF throttling: `20/hour` per IP, 429 on exceed
- [ ] Endpoint not behind `EVENT_CALENDAR_FEATURE`

### Signing

- [ ] Token = `base64url(HMAC-SHA256(key, canonical_query)) + "." + expiry_unix`; default expiry 1 year
- [ ] Secret = new setting `ICAL_FEED_SIGNING_KEY` (env var); do NOT reuse `SECRET_KEY`
- [ ] Pure functions `sign_feed_token` / `verify_feed_token` / `canonicalize_query` in `backend/organization/utility/ical_feed.py`
- [ ] Canonical query: URL-encoded, key-sorted, normalized values, `token` excluded
- [ ] Verification rejects any extra/unknown query params (so a token signed for `?hub=berlin` can't be reused as `?hub=berlin&sectors=...`)

### Next.js pass-through (option B — `next.config.js` rewrite)

- [ ] Add a single `rewrites()` block to `frontend/next.config.js` covering all three URL shapes:
  - `source: "/events/feed.ics"` → `destination: "<DJANGO_BACKEND_URL>/api/events/feed.ics/"`
  - `source: "/hubs/:hubUrl/events/feed.ics"` → `destination: "<DJANGO_BACKEND_URL>/api/events/feed.ics/"`
  - `source: "/hubs/:hubUrl/:subHub/events/feed.ics"` → `destination: "<DJANGO_BACKEND_URL>/api/events/feed.ics/"`
- [ ] The rewrite is a server-side proxy; the calendar app sees the Next.js URL (consistent with all our other endpoints, subdomains, locale prefix, redirects), and the request lands in Django without a Node-side fetch hop
- [ ] No file-based Next.js route for `feed.ics` (the rewrite replaces it)
- [ ] Hub context (`hub` query param) is set by the calendar app at the time the URL is built (the dialog always embeds it); the rewrite doesn't need to inject it
- [ ] No iCal generation in Node
- [ ] Note: production is Azure App Service with no gateway in front, so there is no Nginx `proxy_pass` to configure. The rewrite handles the pass-through entirely within Next.js's Node server.

### Subscribe UI (frontend)

- [ ] "Subscribe" button on `/hubs/[hubUrl]/events` and `/hubs/[hubUrl]/[subHub]/events` only (NOT on `/events`)
- [ ] Gated by `EVENT_CALENDAR_FEATURE`
- [ ] Dialog shows:
  - Feed URL (read-only text with Copy button) — always visible so users can subscribe with any client
  - "Open in Google Calendar" button (`https://calendar.google.com/calendar/render?cid=<urlencoded feed url>`)
  - Short instructions for Apple Calendar / Outlook ("Subscribe to calendar → paste URL")
  - A note about Google Calendar's 12–24h refresh lag so users on Google know what to expect
- [ ] URL built client-side from the current hub + sectors + search + date + lang + tz (browser tz, current UI locale); signed via `POST /api/event-feed-token/` (Next.js → Django) — see "Token issuance" below
- [ ] Reopening the dialog rebuilds the URL with the current filter state
- [ ] Visible in both desktop and mobile filter layouts
- [ ] No login, no user account, no feed-management UI

### Token issuance

- [ ] `POST /api/event-feed-token/` (Django, called by `frontend/pages/api/event-feed-token.ts`)
- [ ] Accepts JSON body: `{ hub?, sectors?, search?, date?, tz?, lang? }`
- [ ] Returns `{ url: "<absolute or relative signed feed URL>" }` — the absolute form (with `FRONTEND_URL` prefix) is preferred so the URL works whether the user copies it on a different device or shares it
- [ ] Not behind `IsAuthenticated`; same throttle as the feed itself
- [ ] Signing uses the canonical query (without `token`), embeds the user's `lang`, sets a 1-year expiry

### Tests

- [ ] `TestEventCalendarFeed` (Django):
  - 200 + `text/calendar` content type for valid signed request
  - 403 on missing / invalid / expired token / extra query params
  - 200 with empty calendar on invalid hub (auth check is independent of result)
  - Filters narrow correctly (hub, sectors, search, date)
  - Default window: `start_date >= now()` (past excluded) and `start_date <= now() + 12 months` (future cap)
  - With `date=<past>`: includes past events since that date, no upper cap
  - With `date=<future>`: no upper cap, returns all matching from that date
  - `lang=en` vs `lang=de` produces different SUMMARY/DESCRIPTION content; `lang` absent falls back to `Accept-Language` then `LANGUAGE_CODE`
  - 12-month cap absent when `date` is present
  - Exclusion rules (drafts, inactive, non-event, null start_date)
  - UID + field mapping
  - PRODID, X-WR-CALNAME, X-WR-CALDESC populated
  - DTSTAMP varies between requests
- [ ] `TestEventFeedToken` (pure): round-trip; expired rejected; tampered rejected; canonical query stable; extra params rejected on verify
- [ ] Frontend dialog smoke test: URL contains right params + token; copy works; Google Calendar `cid=` link correct
- [ ] Next.js pass-through test: forwards query string verbatim; preserves response headers; surfaces Django's 403 as 403

## Constraints and Non-Negotiable Requirements

- RFC 5545 compliance; validate in Apple Calendar, Google Calendar, Outlook desktop
- No login required to subscribe
- URLs are forever-stable; token expiry 1 year
- CRLF line endings preserved
- Backend generates iCal; Next.js is a thin pass-through
- Reuse `apply_hub_filter` + `sanitize_sector_inputs`
- No breaking changes to existing endpoints (`ListEventsView`, `EventCalendarCountsView`, per-event `.ical`)
- Feature toggle shared with calendar page (UI only); endpoint is always on
- v1 scope: hub event calendars only; no global feed; no per-organisation feed (follow-up)
- i18n: en + de for UI text; feed content locale driven by `lang` param

## Domain Context

### Refresh & throttling — actual client behavior

| Client | Default refresh | Configurable? |
|---|---|---|
| **Google Calendar** | Every 12–24h (often 8–9h observed) | No — no user or publisher setting changes this |
| **Apple Calendar (macOS/iOS)** | ~1 hour by default | Yes: 5min / 15min / hourly / daily / weekly / never |
| **Outlook (classic desktop)** | Every 1–3h, with a ~1h floor | Honors `X-PUBLISHED-TTL` / `REFRESH-INTERVAL` |
| **Outlook on the web / new Outlook** | Several hours, up to 24h worst case | No |
| **Thunderbird / iOS Shortcuts** | Varies, typically hours | Varies |

Worst-case realistic steady state per IP, with subscribers on all three major platforms: ~3 requests/hour. A user who set Apple to "every 5 minutes" = 12 req/hour. Even with several NAT'd users on the same IP, the per-IP load is trivial.

**RFC 7986 §7 (Security Considerations)** explicitly addresses this:
> "In most cases, updating a public calendar once per day would suffice."
> "The 'REFRESH-INTERVAL' property could be used by an attacker to make a client carry out rapid requests to the server hosting the calendar by specifying a very short duration (e.g., one second). This could lead to resource consumption on the client or server and to denial-of-service attacks against the server."

**Implication**: the throttle is a **defensive floor against misbehaving or malicious clients**, not a sizing constraint. `20/hour` per IP is more than enough headroom.

### Past events and client behavior

- **Apple Calendar**: strict parser (line-folding/CRLF must be correct); past events hidden in agenda view but still in feed
- **Google Calendar**: past events stripped from visible agenda but present in feed XML
- **Outlook desktop**: shows past events in a "past" section

Past-event visibility is client-controlled. We always include what matches the filter; clients decide what to show. In v1, past events are only included in the feed when the user has set an explicit `date` in the past — otherwise the default `now()` lower bound excludes them.

### Why "Django generates, Next.js forwards" (not "Django directly")

You raised: "How do we handle the traffic then? Isn't Next.js then still proxying?" — yes, and that's the point. The decision is **where the iCal is generated** (Django), not where the URL is hosted (Next.js). Reasons:

- All our other endpoints sit behind Next.js (locale prefix, subdomain redirects, auth cookie handling). The feed URL should too.
- A calendar app user typing `https://berlin.climateconnect.earth/events/feed.ics?hub=berlin&...` should work without us publishing a separate Django URL per hub subdomain.
- The existing `next.config.js` redirect chain (Potsdam shortcuts, climatehub.org redirects, etc.) continues to work.
- Django is the system of record and already has the per-event `build_vevent` helper, the event filtering, and the locale machinery.

The cost is one extra HTTP hop per refresh, which is negligible (and Nginx can cache the response for 1 hour anyway).

### Why Django (not Next.js) for iCal generation

- System of record for events
- Per-event iCal generator already lives in `backend/organization/utility/email.py` (`generate_event_ics_attachment`) using the Python `icalendar` library — extract the inner builder as `build_vevent(project, lang_code) -> icalendar.Event`
- Location-independent: same body regardless of how the request arrived
- Cacheable: a Django response with `Cache-Control: public, max-age=3600` works through any CDN; a Node SSR response is harder to cache correctly

### Locale in the feed

The current per-event `.ical` download route `frontend/pages/calendar/[projectId_dot_ical].tsx` locale-switches by URL prefix (`/de/projects/{slug}.ical`). The feed cannot use that approach because the calendar-app URL has no locale prefix (the URL is whatever the user copied). Instead:

- The frontend always sends `lang=<current UI locale>` when generating the token
- The feed endpoint reads `lang` from the query string
- Falls back to `Accept-Language` header (so a direct fetch from a German-locale browser still gets German)
- Falls back to `settings.LANGUAGE_CODE`
- `build_vevent` already takes `lang_code`; it calls `get_project_name(obj, lang_code)`, `get_project_short_description(obj, lang_code)`, and applies the same `is_online → "Online"` LOCATION rule

The X-WR-CALDESC is also localized (hub name in the active locale).

### Filter parity with the calendar page

| Calendar page param | Feed param | Backend mapping |
|---|---|---|
| `hub` (in URL path) | `hub` (in query) | `apply_hub_filter` (handles sub-hub composite slugs) |
| `sectors` | `sectors` | `sanitize_sector_inputs` + sector Q filter |
| `search` | `search` | DRF SearchFilter on name + translated name |
| `date` (jump-to-date) | `date` | `start_date >= <date as offset-aware ISO>`; no upper cap |
| (default) | (default) | `start_date >= now() AND start_date <= now() + 12 months` |
| (browser tz) | `tz` | IANA tz for `date` interpretation |
| (UI locale) | `lang` | locale for SUMMARY/DESCRIPTION/LOCATION/X-WR-CALDESC |
| — | `token` | HMAC over canonical query |

### Canonical query for signing

URL-encoded, key-sorted, normalized values, `token` excluded. Same logical filter set always produces the same token. Normalization: `sectors` lowercased + de-duplicated; `date` in `YYYY-MM-DD`; `hub` lowercased; `lang` lowercased; `search` trimmed.

## AI Insights

### Implementation Hints

**Backend (`event_calendar_feed` app)**
- Reuse `apply_hub_filter` and `sanitize_sector_inputs` exactly
- `EventCalendarFeedView(APIView)` in `backend/organization/views/project_views.py`
  - `get(request)`: parse `lang`/`tz`/`date`/`hub`/`sectors`/`search`/`token`; verify token; build queryset; construct `Calendar()`; return `HttpResponse(cal.to_ical(), content_type="text/calendar; charset=utf-8")` with `Cache-Control: public, max-age=3600`
  - `throttle_classes = [EventFeedThrottle]`
- `EventFeedTokenView(APIView)` in the same file: `post(request)` accepts JSON, canonicalizes, signs, returns `{ url: f"{FRONTEND_URL}/events/feed.ics?{...}&token=..." }`
- Extract `build_vevent(project, lang_code) -> icalendar.Event` from `email.py:generate_event_ics_attachment`. Add `SEQUENCE` (from a model field that increments on edit, or use `project.updated_at`-based hash) and `LAST-MODIFIED` (from `project.updated_at`).
- `icalendar.Calendar` needs `X-WR-CALNAME`, `X-WR-CALDESC`, `X-PUBLISHED-TTL`, `REFRESH-INTERVAL`, `PRODID`, `VERSION:2.0`, `METHOD:PUBLISH` set on the Calendar object; the helper handles this.
- Throttling: `ScopedRateThrottle` scope `event_feed`, rate `20/hour`. Apply on both `EventCalendarFeedView` and `EventFeedTokenView`.
- New setting `ICAL_FEED_SIGNING_KEY`

**Signing helper** (`backend/organization/utility/ical_feed.py`)
- `sign_feed_token(canonical_query, expiry) -> str`
- `verify_feed_token(canonical_query, token) -> bool` — uses `hmac.compare_digest`, checks expiry, returns False on any failure
- `canonicalize_query(params: dict) -> str` — sort keys, normalize values, URL-encode

**Next.js pass-through**
- `frontend/pages/events/feed.ics.ts` (file name: `feed.ics` — Next.js will serve it at `/events/feed.ics`)
  - `getServerSideProps` reads the query, calls Django `GET {DJANGO_BACKEND_URL}/api/events/feed.ics/?{querystring}` server-to-server, returns Django's response (status, body, headers)
  - Or: use Next.js rewrites in `next.config.js` to map `/events/feed.ics` directly to Django. **Recommendation:** use the rewrite — it avoids a Node-side fetch hop, is more transparent, and works with any caching layer in front of Next.js. The trade-off: harder to read the route as a real file. Either is fine; pick one during implementation.
- Hub routes: same file repeated under `pages/hubs/[hubUrl]/events/feed.ics.ts` and `pages/hubs/[hubUrl]/[subHub]/events/feed.ics.ts` if going the file-based route; or hub-prefixed rewrites in `next.config.js` if going the rewrite route. The hub context is encoded in the `hub` query param the URL already carries, so no reconstruction is needed.

**Frontend Subscribe dialog**
- New `frontend/src/components/eventCalendar/SubscribeToCalendarButton.tsx` using `GenericDialog` (same pattern as `AddToCalendarDialog`)
- `frontend/pages/api/event-feed-token.ts` (Next.js API route) — thin CORS shim that forwards to Django `POST /api/event-feed-token/` and returns `{ url }`
- Place button after Reset in the filter panel on both desktop and mobile layouts
- Dialog reads current `search`/`sectors`/`hub`/`date` from the calendar URL + browser `tz` + current UI locale, calls `POST /api/event-feed-token/`, displays the returned URL
- Copy button uses `navigator.clipboard.writeText` (already used elsewhere in the codebase for share links)
- Google Calendar button: `<a href="https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url)}" target="_blank" rel="noopener">`
- Locale note about Google 12–24h lag in the dialog body (separate text key)

**Texts** (new `frontend/public/texts/getEventCalendarTexts.ts` or extend `getHubTexts.ts`):
- `subscribe_to_calendar_button` — "Subscribe" / "Abonnieren"
- `subscribe_dialog_title` — "Subscribe to event calendar" / "Event-Kalender abonnieren"
- `subscribe_dialog_instructions` — instructions for Apple/Outlook
- `subscribe_open_in_google` — "Open in Google Calendar" / "In Google Kalender öffnen"
- `subscribe_copy_url` — "Copy URL" / "URL kopieren"
- `subscribe_copied` — "Copied!" / "Kopiert!"
- `subscribe_google_lag_note` — "Note: Google Calendar refreshes subscribed feeds every 12–24 hours, so new events may take up to a day to appear." (DE equivalent)

### Trade-off Notes

- **Anonymous vs login-required**: anonymous keeps the door open for users who want to subscribe before signing up, avoids building a "my feeds" management UI, and survives account deletion. A login-required personal feed can be layered on later as a separate endpoint.
- **12-month upper cap (default case only)**: bounds payload size when no date is set. The cap does NOT apply when the user has set a date — that case returns everything from `<date>` onwards, matching the calendar page's "jump to date" semantics.
- **Locale via `lang` param (not URL prefix)**: the feed URL has no locale prefix (it's whatever the user copied). Passing the locale in the query keeps the URL self-contained and matches RFC 5545 (no locale-in-path assumption). Fallback to `Accept-Language` keeps direct calendar-app requests working in the user's preferred language.
- **Next.js pass-through vs direct Django URL**: pass-through keeps the URL consistent with all our other endpoints (subdomains, locale prefix, redirects). One extra HTTP hop is acceptable; Nginx can cache the response.
- **Django as source of signing key**: mirrored key in Next.js is faster but doubles secret surface area. Django is the single source of truth; Next.js is a thin shim.
- **1-year token expiry**: long enough for normal re-subscribe cadence, short enough that leaked URLs self-heal.
- **`X-PUBLISHED-TTL:PT1H` + `REFRESH-INTERVAL:PT1H`**: matches Apple Calendar's default; Outlook honors them; Google ignores them. Setting both ensures uniform behavior across compliant clients.
- **Hub-only v1**: hub calendars are where users develop ongoing interest; the global page is a discovery surface. The same endpoint powers per-organisation feeds later (just `?organisation=<slug>`).
- **No sub-hub complications**: sub-hub pages pass a composite hub slug (`perth_zerowaste`) to `apply_hub_filter`, which already handles it. The feed URL embeds the composite slug and the feed works without special-casing.
- **No CDN caching for now**: the `Cache-Control: public, max-age=3600` header is enough for the first version. If traffic grows we can layer a CDN in front. The 1-year token expiry means even an aggressive cache (with `stale-while-revalidate`) stays correct within a day of any edit.

## System Impact Analysis

### Backend
- `organization/views/project_views.py`: new `EventCalendarFeedView(APIView)`, new `EventFeedTokenView(APIView)`
- `organization/utility/ical_feed.py` (new): signing helpers + `build_vevent` extraction
- `organization/utility/email.py`: refactor `generate_event_ics_attachment` to call `build_vevent`; also update PRODID from `-//Climate Connect//EN` to `-//Climate Hub Network//EN` in both `generate_event_ics_attachment` (line 858) and `generate_timeslot_ics_attachments` (line 960)
- `organization/urls.py`: 2 new routes — `events/feed.ics/`, `event-feed-token/`
- `climateconnect_main/settings.py`: `ICAL_FEED_SIGNING_KEY`; throttle rate `event_feed = 20/hour`; ensure `FRONTEND_URL` is available for the absolute feed URL
- `organization/tests/test_event_calendar_view.py`: `TestEventCalendarFeed`, `TestEventFeedToken`, locale tests

### Next.js
- **Option A — file route:** `frontend/pages/events/feed.ics.ts` (pass-through to Django); hub variants under `pages/hubs/[hubUrl]/events/feed.ics.ts` and `pages/hubs/[hubUrl]/[subHub]/events/feed.ics.ts` (thin re-exports)
- **Option B — next.config.js rewrite:** one rewrite rule per public path mapping to Django's `/api/events/feed.ics/`
- `pages/api/event-feed-token.ts` (new): thin shim → Django `POST /api/event-feed-token/`
- `next.config.js`: add the rewrite rules (Option B) or leave alone (Option A)

### Frontend
- `src/components/eventCalendar/SubscribeToCalendarButton.tsx` (new)
- `src/components/eventCalendar/EventCalendarContent.tsx`: add button to filter panel (both desktop and mobile layouts)
- `public/texts/getEventCalendarTexts.ts` (new) or extend `getHubTexts.ts`: 7 new text keys
- `src/components/eventCalendar/SubscribeToCalendarButton.test.tsx` (new): smoke test

### Cross-Cutting
- No changes to `ListEventsView`, `EventCalendarCountsView`, per-event `.ical` Next.js route, `ProjectStubSerializer`
- `EVENT_CALENDAR_FEATURE` toggle gates the UI only; the feed endpoint is always on
- `Cache-Control: public, max-age=3600` on the feed response; `X-PUBLISHED-TTL:PT1H` and `REFRESH-INTERVAL:PT1H` in body
- Subdomain support is automatic via the Next.js rewrite (no per-subdomain config; calendar app uses the subdomain it subscribed from)
- i18n: en + de UI strings; feed content locale driven by `lang` param
- Production is Azure App Service with no gateway in front, so there is no Nginx or other reverse proxy to configure. The Next.js rewrite handles the pass-through entirely within Next.js's Node server.

### Risks & Notes
- **UID reuse**: VEVENTs use the same `{project_id}@climatehub.org` UID as the per-event ical. Users who already imported a per-event ical will not see duplicate events when they later subscribe to the feed.
- **PRODID cleanup**: both per-event iCal and the feed use `-//Climate Hub Network//EN` (matches the current org name; replaces the old `-//Climate Connect//EN` in `email.py:858` and `:960`).
- **IP detection for throttling**: Azure App Service sets `X-Forwarded-For`. The feed throttle must read the first entry of `X-Forwarded-For` with fallback to `REMOTE_ADDR` — otherwise the throttle will be per-Azure-instance (effectively per-app), not per-real-client. The existing `auth_app/views.py` and `climateconnect_api/views/user_views.py` use `REMOTE_ADDR` directly (a pre-existing gap, out of scope to fix here, but worth noting as a follow-up for the IP-based analytics there).
- **Key rotation**: rotating `ICAL_FEED_SIGNING_KEY` invalidates every existing subscription (all 1-year tokens verify against the new key only). Recovery: re-announce, users re-subscribe. v2 may support `ICAL_FEED_SIGNING_KEYS` (list, any match accepted) for a one-version grace period.
- **Default rolling window excludes past events**; explicit `date=<past>` is the escape hatch.
- **UID stability on edit**: keep `project_id`-based UID; add `SEQUENCE` (derived from `int(project.updated_at.timestamp())` — monotonic in practice, sufficient for client change detection, not strictly RFC 5545 §3.8.7.4 compliant) and `LAST-MODIFIED` (from `project.updated_at`).
- **Recurring events**: out of scope here; `icalendar` library supports `RRULE` natively, will work once model + serializer expose the rule.
- **Google Calendar refresh lag** (12–24h) is a hard client-side limit; documented in the dialog.
- **`FRONTEND_URL`** must be set in Django settings so the absolute feed URL works for sharing.
- **`lang` validation**: unknown values fall back silently to `LANGUAGE_CODE` (no 400). The frontend always sends `lang` (even on `en` UI), so direct calendar-app fetches without `lang` get `Accept-Language` then `LANGUAGE_CODE`.
- **Per-IP throttle realism**: the actual per-client limit is only as good as Azure's `X-Forwarded-For` accuracy. A misbehaving client behind a corporate proxy could share a throttle bucket with everyone else in that company. The 20/hour ceiling is conservative enough that this is acceptable; if it ever bites, bump to 60/hour.

## Follow-ups (out of scope for v1)

- **Per-organisation feed**: same endpoint, just an additional `?organisation=<slug>` filter param. The subscribe button could appear on organisation event listings.
- **Global feed** (`/events`): same endpoint, no `hub` param. Could be added when there's user demand.
- **Personal feed (login-required)**: a separate endpoint, requires auth, can include user-specific signals (registered events, followed organizations).
- **Recurring events (RRULE)**: the existing `RecurringEvent` research spec covers this; the feed will pick it up automatically once the model + serializer expose the rule.
- **Nginx-side caching**: layer a CDN in front of the feed endpoint with a short TTL once traffic justifies it.
- **Fix IP detection in `auth_app` and `climateconnect_api`**: same `X-Forwarded-For` fix the feed uses; out of scope for this spec but a known gap.
- **Multi-key signing** (`ICAL_FEED_SIGNING_KEYS` list): support graceful key rotation by accepting any key in the list; one-version grace period.
- **Recurring events (RRULE)**: the existing `RecurringEvent` research spec covers this; the feed will pick it up automatically once the model + serializer expose the rule.
Archie recommended B).

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-08-10 | First-initial spec. Anonymous signed-token model, 12-month rolling default, per-hub and global, filter parity with calendar page. |
| 0.2 (Draft) | 2026-08-10 | Replaced 60/min throttle with 20/hour + RFC 7986 rationale. Added `X-PUBLISHED-TTL:PT1H` and `REFRESH-INTERVAL:PT1H` and a real client-interval table. |
| 0.3 (Draft) | 2026-08-10 | Locked in review answers. (1) Anonymous confirmed. (2) Past events confirmed. (3) 12-month cap now explicitly **only applies when no `date` is set**; with `date` set there's no upper cap. (5) New `lang` query param for feed locale; falls back to `Accept-Language` then `LANGUAGE_CODE`. (7) Django generates, Next.js forwards — explicit pass-through architecture; calendar apps hit the Next.js URL. (8) Hub event calendars only for v1; global + per-org feeds are follow-ups. Added follow-ups section. |
| 0.4 (Draft) | 2026-08-10 | Archie review answers locked in. (9) UID reuses existing `{id}@climatehub.org` — no UID format change. (10) `lang` unknown values fall back silently. (11) `lang` always sent in canonical query. (12) Single signing key for v1; rotation documented as runbook item; v2 may support multi-key. (13) PRODID updated to `-//Climate Hub Network//EN` for both feed AND existing per-event iCal (cleanup as part of `build_vevent` extraction). (14) Pass-through is `next.config.js` rewrite (Option B), single rewrite covers all three URL shapes. (15) IP detection must use `X-Forwarded-For` first (Azure App Service) — pre-existing gap in `auth_app`/`user_views` flagged as a follow-up. Dropped the Nginx and "lang 400" risks; added PRODID cleanup, key rotation, and IP-detection to Risks. |


## Log

- 2026-08-10 10:46 UTC - Task created. Initial brainstorm + first-initial spec (v0.1): anonymous signed-token model, 12-month rolling default, Django generation, per-hub + global scope, filter parity with calendar page. Awaiting user review of problem statement and open questions.
- 2026-08-10 ~11:00 UTC - User raised: "how often do calendar apps refresh a feed?" Replaced the placeholder 60/min throttle with `20/hour` per IP, added `X-PUBLISHED-TTL:PT1H` and `REFRESH-INTERVAL:PT1H` to the feed body, and documented the real client interval table (Google 12–24h, Apple ~1h, Outlook 1–3h). Spec bumped to v0.2.
- 2026-08-10 11:15 UTC - User answered the 8 open questions. Key consequences locked in: (a) 12-month upper cap **only applies when no `date` is set** — with `date` set, no upper cap; (b) new `lang` query param for feed locale (falls back to `Accept-Language` then `LANGUAGE_CODE`); (c) **Django generates, Next.js forwards** — calendar apps hit the Next.js URL, which proxies to Django; (d) Subscribe button on **hub event calendars only** for v1, no global button; per-organisation and personal feeds deferred to follow-ups. Spec bumped to v0.3.
- 2026-08-10 11:27 UTC - User approved v0.3. Handing off to **Archie** for system impact analysis review. Key items for Archie to confirm or extend: (1) file-based Next.js pass-through route vs `next.config.js` rewrite; (2) throttling interactions with existing per-IP rate limits; (3) how the pass-through interacts with Nginx caching in front of Next.js; (4) any concerns about adding a new `ICAL_FEED_SIGNING_KEY` env var and how it should be provisioned across environments.

- 2026-08-10 11:35 UTC - Archie returned system impact analysis. Key findings:
  - **Option B (next.config.js rewrite) recommended** over file-based pass-through; no precedent for rewrites today (file is redirects-only), but a single rewrite covers all three URL shapes (`/events/feed.ics`, `/hubs/[hubUrl]/events/feed.ics`, `/hubs/[hubUrl]/[subHub]/events/feed.ics`) and avoids the Node → Django HTTP hop.
  - **`get_language_from_request`** (Django) should be used for the Accept-Language fallback, not a re-implementation.
  - **`translation.override(lang_code)`** (not `activate`) should scope the language activation to the request, to avoid thread-leak under async workers.
  - **`get_hub_name(hub, lang_code)` helper** needed (no existing helper) to localize `X-WR-CALDESC`.
  - **Texts go in `getHubTexts.ts` (extension)**, not a new file — they share the existing hub page text map.
  - **Env var locations**: add `ICAL_FEED_SIGNING_KEY` to `backend/.backend_env` (no default; empty breaks signing) and document in `backend/local-env-setup.md:11`. No `.env.example` exists in the repo. No Azure App Service config in the repo.
  - **No Nginx config in repo** — deployment runbook item: confirm production Nginx doesn't apply LF→CRLF transforms, and that `NUM_PROXIES` is set for IP-based throttling.
  - **6 open questions surfaced** for the user before implementation can start: (1) UID scheme reuse, (2) `lang` validation, (3) `lang` always sent, (4) key rotation policy, (5) PRODID, (6) pass-through approach (Archie recommended B).

- 2026-08-10 11:45 UTC - User answered all 6 of Archie's open questions. Decisions applied: keep existing UID; silent `lang` fallback; `lang` always sent; single signing key for v1 (explained the per-event vs feed security model difference); PRODID updated to `-//Climate Hub Network//EN` for both per-event and feed; pass-through is `next.config.js` rewrite. User added context: production is Azure App Service with no gateway in front (so no Nginx, no `NUM_PROXIES` concern at the proxy layer, but Azure does set `X-Forwarded-For` which we must read for IP throttling to work). Spec bumped to v0.4. Ready to hand off to Code mode for implementation.
