# LocationIQ Autocomplete with Nominatim Fallback

**Status**: DRAFT
**Type**: Full-stack — backend proxy + frontend integration
**Date and time created**: 2026-06-23 10:00

---

## Problem Statement

We currently use Nominatim (OpenStreetMap) for location autocomplete, called directly from the user's browser. Nominatim's free tier is limited (1 req/s, no SLA) and we have no control over rate limits or availability. We want to migrate to **LocationIQ** as the primary autocomplete provider — it offers better performance, a proper API key, and a managed service. LocationIQ's Autocomplete API returns results in a format nearly identical to Nominatim, making migration low-risk.

**Goal**: Proof of concept — switch autocomplete to LocationIQ (proxied through backend to keep the API token server-side), with the existing Nominatim implementation preserved as an automatic fallback if LocationIQ fails.

---

## Core Requirements

### 1. LocationIQ as Primary Provider

- All autocomplete requests go through a **new backend proxy endpoint** (`/api/location_autocomplete/`)
- Backend calls LocationIQ API using the project's API key (never exposed to the browser)
- If LocationIQ returns an error or times out, backend automatically falls back to Nominatim `/search`
- Response format is pass-through (LocationIQ and Nominatim return near-identical JSON)

### 2. Fallback to Nominatim

- If LocationIQ fails (timeout, error, empty key), backend calls Nominatim `/search` as fallback
- Fallback is transparent to the frontend — same endpoint, same response format
- Existing Nominatim `User-Agent` header requirement is preserved in fallback path

### 3. Request Reduction (Quota Protection)

| Control | Value | Where |
|---------|-------|-------|
| Minimum characters before first request | 3 | Frontend guard + backend guard |
| Debounce delay after each keystroke | 100ms | Frontend (currently 1000ms) |
| Per-user rate limit | 30 requests/minute | Backend DRF throttle |

### 4. Preserve Existing Implementation

- `POST /api/nominatim_request_count/` — unchanged, continues to work
- `GET /api/nominatim_stats/` — unchanged
- `GetLocationView` (`/api/get_location/`) — unchanged (uses Nominatim `/lookup`, not `/search`)
- `NominatimRequestLog` / `NominatimPeriodStats` models — extended with `provider` field, not replaced

---

## Data Model Changes

### Extend: `NominatimRequestLog` and `NominatimPeriodStats`

Add a `provider` field to both models to distinguish LocationIQ vs Nominatim requests in tracking:

```python
PROVIDER_CHOICES = [
    ("nominatim", "Nominatim"),
    ("locationiq", "LocationIQ"),
]

# On both models:
provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default="nominatim")
```

Update `NominatimPeriodStats.unique_together` to include `provider`:
```python
unique_together = [("period_type", "period_key", "provider")]
```

This lets us track and compare usage per provider without new models.

---

## API Design

### New Endpoint: `GET /api/location_autocomplete/`

**Permission**: `AllowAny`
**Throttle**: `location_autocomplete` scope (30/min per user/IP)

**Query params**:

| Param | Required | Description |
|-------|----------|-------------|
| `q` | yes | Search query (min 3 chars) |
| `countrycodes` | no | ISO 3166-1 alpha-2 code(s), comma-separated |
| `accept-language` | no | Preferred locale (default: from `Accept-Language` header) |

**Response**: Array of location objects (pass-through from upstream provider). Format matches Nominatim `/search` response.

**Error responses**:
- `400` — `q` shorter than 3 characters
- `502` — Both LocationIQ and Nominatim failed

### Internal Flow

```
GET /api/location_autocomplete/?q=berlin
  -> len(q) < 3? -> return []
  -> DRF throttle check -> 429 if exceeded
  -> Try LocationIQ: GET https://us1.locationiq.com/v1/autocomplete?key=...&q=berlin&...
    -> 200 + valid data? -> track("locationiq") -> return data
    -> Error/timeout? -> log warning, continue to fallback
  -> Try Nominatim: GET https://nominatim.openstreetmap.org/search?q=berlin&...
    -> 200 + valid data? -> track("nominatim") -> return data
    -> Error/timeout? -> return 502
```

---

## File Changes

### Backend

| File | Change |
|------|--------|
| `backend/climateconnect_main/settings.py` | Add `LOCATIONIQ_API_KEY`, `LOCATIONIQ_AUTOCOMPLETE_URL`, `LOCATIONIQ_TIMEOUT`; add throttle rate `"location_autocomplete": "30/min"` to `REST_FRAMEWORK` |
| `backend/location/models.py` | Add `provider` field to `NominatimRequestLog` and `NominatimPeriodStats`; update `unique_together` |
| `backend/location/location_views.py` | Add `LocationAutocompleteView` (LocationIQ primary + Nominatim fallback); refactor `_increment_nominatim_counters` to accept `provider` arg |
| `backend/location/urls.py` | Add `location_autocomplete/` route |
| `backend/location/migrations/` | New migration for `provider` field |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/components/search/LocationSearchBar.tsx` | Replace direct Nominatim call with `GET /api/location_autocomplete/`; reduce debounce 1000ms->100ms; add 3-char minimum guard; remove fire-and-forget tracking call |

### Files NOT Changed

- `frontend/public/lib/locationOperations.ts` — `parseLocation()`, `getDisplayLocationFromLocation()` work unchanged (LocationIQ response format matches Nominatim)
- `backend/location/location_views.py` — `GetLocationView`, `TrackNominatimRequestView`, `NominatimStatsView` all unchanged
- `backend/location/models.py` — `Location`, `LocationTranslation` models unchanged

---

## Settings

```python
# backend/climateconnect_main/settings.py (add after line 361)

LOCATIONIQ_API_KEY = env("LOCATIONIQ_API_KEY", "")
LOCATIONIQ_AUTOCOMPLETE_URL = "https://us1.locationiq.com/v1/autocomplete"
LOCATIONIQ_TIMEOUT = 3  # seconds

# In REST_FRAMEWORK settings, add:
"DEFAULT_THROTTLE_RATES": {
    "location_autocomplete": "30/min",
}
```

Environment variable (add to `.backend_env`):
```
LOCATIONIQ_API_KEY=pk.************************
```

The empty-string default for `LOCATIONIQ_API_KEY` means the feature degrades gracefully to Nominatim-only if the key isn't configured.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LocationIQ response format differs from Nominatim | Broken autocomplete | Log raw upstream responses at DEBUG level; test with real queries before deploying |
| Added backend hop increases latency | Slower autocomplete UX | 3s timeout + 100ms debounce + 3-char minimum drastically reduce total request count |
| LocationIQ quota exhaustion | Service disruption | DRF throttle (30/min/user) + 3-char minimum + 100ms debounce; fallback to Nominatim |
| API key committed to repo | Security concern | Key is in env var, not hardcoded. `.backend_env` should be in `.gitignore` |

---

## Acceptance Criteria

- [ ] `GET /api/location_autocomplete/?q=berlin` returns LocationIQ results
- [ ] When LocationIQ is down/unavailable, same endpoint returns Nominatim results (fallback)
- [ ] Requests with `q` shorter than 3 characters return empty array
- [ ] DRF throttle limits to 30 requests/min per user/IP
- [ ] Frontend debounce reduced from 1000ms to 100ms
- [ ] Frontend sends requests to `/api/location_autocomplete/` instead of Nominatim directly
- [ ] Frontend does not fire requests for queries shorter than 3 characters
- [ ] `POST /api/nominatim_request_count/` continues to work (backward compat)
- [ ] `GET /api/nominatim_stats/` continues to work (backward compat)
- [ ] `provider` field on tracking models distinguishes LocationIQ vs Nominatim requests
- [ ] `LOCATIONIQ_API_KEY` env var is configurable (empty = fallback to Nominatim only)
- [ ] Existing autocomplete functionality (result filtering, display names, selection) works unchanged
- [ ] `make format` passes; existing tests pass

---

## Test Cases

| Scenario | Expected |
|----------|----------|
| `GET /api/location_autocomplete/?q=ber` (3 chars) | Returns results from LocationIQ |
| `GET /api/location_autocomplete/?q=be` (2 chars) | Returns empty array `[]` |
| LocationIQ returns error/timeout | Falls back to Nominatim, returns Nominatim results |
| Both providers fail | Returns 502 with error message |
| `LOCATIONIQ_API_KEY` is empty | Skips LocationIQ, goes straight to Nominatim |
| 31st request in 1 minute | Returns 429 (throttle) |
| Frontend typing "berlin" | Single request after 100ms debounce (not 6 requests per keystroke) |
| Frontend typing "be" then "ber" | No request for "be", request fires for "ber" |
| Country restriction (hub: perth) | `countrycodes=gb` passed to upstream provider |
| Tracking shows correct provider | `NominatimPeriodStats` has separate rows for `provider=locationiq` and `provider=nominatim` |

---

## Dependency Notes

- **No new pip dependencies** — uses existing `requests` library for HTTP calls
- **No new frontend dependencies** — uses existing `apiRequest` and lodash `debounce`
- **No Celery dependency** for this feature
- **No Redis dependency** for this feature (beyond existing usage)
- **Backward compatible** — all existing endpoints and models unchanged

---

## Log

- 2026-06-23 10:00 — Spec created.
