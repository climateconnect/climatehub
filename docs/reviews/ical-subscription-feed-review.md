# Code Review: iCal Subscription Feed

**Branch:** `ical-subscription-feed`
**Reviewed against:** `master`
**Date:** 2026-08-26
**Reviewer:** Kilo

---

## Summary

This branch adds an iCal subscription feed for hub event calendars, guarded by the `ICAL_SUBSCRIPTION_FEED_FEATURE` toggle. The feed is secured with HMAC-SHA256 signed tokens that are bound to the user's filter parameters, making them tamper-proof and expiring after one year. The frontend shows a "Subscribe" button (behind the toggle) that opens a dialog with the feed URL, a copy button, and a Google Calendar deep link.

---

## Architecture

| Layer | Component | Path |
|-------|-----------|------|
| Backend (feed logic) | `ical_feed.py` | `backend/organization/utility/ical_feed.py` |
| Backend (views) | `event_calendar_feed_views.py` | `backend/organization/views/event_calendar_feed_views.py` |
| Backend (email reuse) | `email.py` (refactored) | `backend/organization/utility/email.py` |
| Backend (toggle migration) | `0007_add_ical_subscription_feed_toggle.py` | `backend/feature_toggles/migrations/` |
| Frontend (button) | `SubscribeToCalendarButton.tsx` | `frontend/src/components/eventCalendar/` |
| Frontend (integration) | `EventCalendarContent.tsx` | `frontend/src/components/eventCalendar/` |
| Frontend (proxy) | `event-feed-token.ts` | `frontend/pages/api/event-feed-token.ts` |
| Frontend (rewrites) | `next.config.js` | `frontend/next.config.js` |
| Tests | `test_event_calendar_feed.py` | `backend/organization/tests/` |

### Data Flow

1. User clicks "Subscribe" (only visible when `ICAL_SUBSCRIPTION_FEED_FEATURE` is enabled)
2. Frontend calls `POST /api/event-feed-token/` with hub/sectors/search/date/tz/lang
3. Backend canonicalizes params, signs them with HMAC-SHA256 + expiry, returns full feed URL
4. Frontend shows URL in dialog with copy + Google Calendar link
5. Calendar apps poll `GET /api/events/feed.ics?...&token=<signed_token>`
6. Backend validates token (signature + expiry), queries events, returns `.ics`

---

## Strengths

### 1. Security Model

- HMAC-SHA256 tokens are cryptographically bound to the canonicalized query params — any modification invalidates the token
- Tokens expire after 1 year (`365 * 24 * 3600` seconds)
- `hmac.compare_digest()` used for constant-time comparison
- Rate limiting via `ScopedRateThrottle` with XFF-aware client identification
- `canonicalize_query()` strips unknown keys, preventing injection of extra params

### 2. Code Reuse

- `build_vevent()` extracted from `email.py` into `ical_feed.py`, now shared between email attachments and the feed
- `PRODID` constant centralized
- `canonicalize_query()` used by both signing and verification

### 3. Test Coverage

- 471 lines of tests covering:
  - Token round-trip, expiry, tampering
  - Canonicalization stability (case normalization, sector dedup, key filtering)
  - Feed filtering (hub, sectors, search, date)
  - Exclusion rules (drafts, inactive, ideas)
  - i18n (en vs de content)
  - Full token → feed roundtrip
  - Calendar metadata (PRODID, X-WR-CALNAME, X-WR-CALDESC, SEQUENCE, etc.)

### 4. Feature Toggle

- Toggle only gates the UI; the feed endpoint is always on (correct — external calendar apps don't know about toggles)
- Migration correctly placed in `feature_toggles` app
- Default state: dev/staging active, production inactive

### 5. Frontend UX

- Two variants: `button` (in filter bar) and `icon` (compact, in header)
- Copy-to-clipboard with fallback for older browsers
- Google Calendar deep link with proper `cid` encoding
- Note about Google's 12–24h refresh lag

---

## Issues

### [BUG RISK] Fragile string manipulation in `email.py`

**File:** `backend/organization/utility/email.py`

The refactored `generate_event_ics_attachment` inserts field answers into the description via string replacement:

```python
event["description"] = existing_desc.replace(
    f"{url_cta}\n{event_url}",
    f"{field_answers_text}\n\n{url_cta}\n{event_url}",
)
```

**Problem:** If `build_vevent()` ever changes the URL CTA text or formatting, this silently breaks — the replacement becomes a no-op and field answers disappear from emails.

**Recommendation:** Pass `field_answers_text` as an optional parameter to `build_vevent()`:

```python
def build_vevent(project, lang_code: str, extra_description: str = "") -> IcalEvent:
    ...
    if extra_description:
        description_parts.append(extra_description.strip())
    ...
```

This makes the data flow explicit and eliminates the coupling.

---

### [MAINTAINABILITY] URL construction bypasses Django URL resolution

**File:** `backend/organization/views/event_calendar_feed_views.py`

`EventFeedTokenView` manually builds feed URLs with f-strings:

```python
url = f"{frontend_url}/hubs/{hub_obj.url_slug}/events/feed.ics?{feed_qs}"
```

**Problem:** If URL patterns change (e.g., the rewrite path or Django URL conf), this breaks silently.

**Recommendation:** Use Django's URL resolution:

```python
from django.urls import reverse

feed_path = reverse("organization:events-feed-ics")
url = f"{frontend_url}{feed_path}?{feed_qs}"
```

For hub-scoped URLs, consider a helper that builds the path from the hub's URL structure rather than hardcoding the pattern.

---

### [STYLE] Inconsistent import placement

**File:** `backend/organization/utility/ical_feed.py`

`base64` and `get_supported_language_variant` are imported inside function bodies:

```python
def sign_feed_token(...):
    import base64
    ...

def resolve_lang_code(...):
    from django.utils.translation import get_supported_language_variant
    ...
```

**Recommendation:** Move to module level for clarity and to avoid repeated import overhead.

---

### [DISCREPANCY] Migration path in diff stat

The `git diff master --stat` output shows:
```
backend/organization/migrations/0007_add_ical_subscription_feed_toggle.py      |  36 ++
```

But the file actually lives in `backend/feature_toggles/migrations/0007_add_ical_subscription_feed_toggle.py`. The content is correct for the `feature_toggles` app, but the stat is misleading. Worth verifying the commit history is clean and the file was intentionally placed in `feature_toggles`.

---

## Minor Notes

- `build_vevent` now conditionally adds `dtend` only when `project.end_date` exists — an improvement over the original email code which required both dates
- `resolve_lang_code` falls back to `"en"` — correct default
- `Cache-Control: public, max-age=3600` aligns with `X-PUBLISHED-TTL:PT1H`
- `ICalRenderer` returns raw bytes from `cal.to_ical()` — works correctly
- The `test_ics_attachment.py` change updates the expected `prodid` from `"-//Climate Connect//EN"` to `"-//Climate Hub Network//EN"` — this is a branding change that affects all existing ICS email attachments, not just the feed

---

## Verdict

**Approve with minor changes.** The architecture is sound, security model is solid, and test coverage is comprehensive. The two actionable items are:

1. Refactor `email.py` to pass `field_answers_text` explicitly to `build_vevent()` instead of string replacement
2. Use Django URL resolution in `EventFeedTokenView` instead of hardcoded paths

These are not blockers — the code works as written — but addressing them will prevent future bugs.
