# Hub browse pages redirect to the global browse page for invalid hub slugs

**Status**: IMPLEMENTED - awaiting review
**Type**: Frontend - bug fix
**Date created**: 2026-09-28
**GitHub Issue**: [climatehub#2196](https://github.com/climateconnect/climatehub/issues/2196) - Bug: Hub browse page accepts invalid hub slugs and renders a broken page

**Depends on**:
- [frontend/public/lib/getHubBrowseTypeServerSideProps.ts](../../frontend/public/lib/getHubBrowseTypeServerSideProps.ts) - shared SSR helper for hub browse, members and organizations pages
- [frontend/pages/hubs/[hubUrl]/browse.tsx](../../frontend/pages/hubs/%5BhubUrl%5D/browse.tsx) - hub projects browse page (plus `members.tsx`, `organizations.tsx`)
- [frontend/pages/hubs/[hubUrl]/[subHub]/browse.tsx](../../frontend/pages/hubs/%5BhubUrl%5D/%5BsubHub%5D/browse.tsx) - sub-hub variants, re-export the parent pages
- [frontend/pages/hubs/[hubUrl]/index.tsx](../../frontend/pages/hubs/%5BhubUrl%5D/index.tsx) - hub landing page, redirects to `/browse` when there is no landing page component
- [frontend/public/lib/getHubData.ts](../../frontend/public/lib/getHubData.ts) - `getHubData` returns `null` on API error
- [frontend/public/lib/urlOperations.ts](../../frontend/public/lib/urlOperations.ts) - `getBrowsePathForType` maps `projects` / `members` / `organizations` to the global paths, `getHubBrowsePathForType` to the hub paths
- [frontend/public/lib/appLink.ts](../../frontend/public/lib/appLink.ts) - `appHref` adds the locale prefix to the redirect destination
- [backend/hubs/views/hub_views.py](../../backend/hubs/views/hub_views.py) - `HubAPIView` already returns 404, no change expected

---

## Problem Statement

Opening a hub browse page with a hub slug that does not exist renders a broken browse page. Reproduce with `https://climatehub.org/de/hubs/x/browse`: the page renders half-populated and the server logs errors.

**Decision**: an invalid hub slug redirects the visitor to the matching global page (`/browse`, `/members` or `/organizations`) in the same locale. When only the sub-hub segment is unknown and the parent hub exists (for example `/hubs/erlangen/nope/browse`), the visitor is redirected to the parent hub's page instead (`/hubs/erlangen/browse`). The issue allowed either a 404 or a redirect to the global browse page. The redirect is chosen because there is no custom 404 page, and the visitor still lands on useful content instead of a dead end.

### Root cause

- `getHubBrowseTypeServerSideProps` fires 8 requests in parallel (hub data, theme, linked hubs, sectors with `?hub=<slug>`, and others) and always returns `props`, even when `getHubData` returns `null`.
- The helper is used by `pages/hubs/[hubUrl]/browse.tsx`, `members.tsx` and `organizations.tsx`. The `[subHub]` variants re-export these pages, so `/hubs/x/y/browse` has the same bug.
- The backend is already correct: `HubAPIView` and `LinkedHubsAPIView` return 404 `Hub not found: <slug>`. `getHubData` catches the 404, logs it and returns `null`. This is the source of the server error logs.
- The landing page feeds the bug: `pages/hubs/[hubUrl]/index.tsx` redirects to `/hubs/<slug>/browse` whenever `hubData` has no `landing_page_component`, which includes `hubData === null`. So `/hubs/x` also lands on the broken page.

---

## User Stories

- As a visitor following a mistyped or outdated hub link, I want to land on the global browse page, so I can still find projects instead of seeing a broken page.
- As a visitor following a link to a sub-hub that does not exist, I want to land on the parent hub's browse page, so I stay in the hub I was looking for.
- As a visitor on a localized URL (for example `/de/...`), I want the redirect to keep my language.

---

## Acceptance Criteria

- [x] **AC-1**: `/hubs/<unknown>/browse` redirects to `/browse`. `/hubs/<unknown>/members` redirects to `/members`. `/hubs/<unknown>/organizations` redirects to `/organizations`.
- [x] **AC-2**: The redirect keeps the locale prefix, for example `/de/hubs/x/browse` redirects to `/de/browse`.
- [x] **AC-3**: A valid parent hub with an unknown sub-hub redirects to the same page type on the parent hub: `/hubs/erlangen/nope/browse` to `/hubs/erlangen/browse`, `/hubs/erlangen/nope/members` to `/hubs/erlangen/members`, `/hubs/erlangen/nope/organizations` to `/hubs/erlangen/organizations`. If the parent hub does not exist either (for example `/hubs/x/y/browse`), AC-1 applies and the visitor goes to the global page.
- [x] **AC-4**: The hub landing page `/hubs/<unknown>` redirects directly to the global `/browse`, not via `/hubs/<unknown>/browse` (one hop, no redirect chain).
- [x] **AC-5**: The redirect is temporary (HTTP 307, `permanent: false`), because a hub with that slug can be created later.
- [x] **AC-6**: The redirect destination does not carry `?hub=<invalid slug>`.
- [x] **AC-7**: Valid hubs and sub-hubs render exactly as today. A valid hub without `landing_page_component` still redirects from `/hubs/<slug>` to `/hubs/<slug>/browse`.
- [x] **AC-8**: No extra API round-trip on the happy path for valid hubs.
- [x] **AC-9**: New Jest unit tests pass, and `yarn lint` and `yarn format` are clean.

### Edge cases

| Case | Expected |
| --- | --- |
| `/hubs/x/browse` | 307 to `/browse` |
| `/hubs/x/members`, `/hubs/x/organizations` | 307 to `/members`, `/organizations` |
| `/de/hubs/x/browse` (locale prefix) | 307 to `/de/browse` |
| `/hubs/erlangen/nope/browse` (valid parent, unknown sub-hub) | 307 to `/hubs/erlangen/browse` |
| `/hubs/erlangen/nope/members` (valid parent, unknown sub-hub) | 307 to `/hubs/erlangen/members` |
| `/de/hubs/erlangen/nope/browse` | 307 to `/de/hubs/erlangen/browse` |
| `/hubs/x/y/browse` (unknown parent and sub-hub) | 307 to `/browse` |
| `/hubs/x` (landing page) | 307 straight to `/browse` |
| `/hubs/erlangen/browse` (valid hub) | Renders as today |
| Hub without `landing_page_component` | Still redirects to `/hubs/<slug>/browse` |
| `/hubs/x/browse?sectors=energy` | 307 to `/browse`. Query string is dropped (see Open questions) |
| `/hubs/x/browse#members` | Browser keeps the hash, lands on `/browse#members`. The global page's existing hash redirect then sends the visitor to `/members` |
| Hub API down or 5xx | `getHubData` returns `null`, so valid hubs also redirect to `/browse` during an outage (see Open questions) |

---

## Non-Goals

- A custom 404 page.
- Backend changes. The API already returns 404 for unknown hubs.
- Changing the hub events pages. They already return `{ notFound: true }` for unknown hubs.

---

## Constraints

- Frontend-only. No backend, API, serializer or migration changes.
- The page components receive the same props on success. No data contract change.
- Build the global destination with `appHref(getBrowsePathForType(internalType), { locale })`. Do not pass `hubUrl` to `appHref`, otherwise it appends `?hub=<invalid slug>`.
- Build the parent hub destination with `appHref(getHubBrowsePathForType(internalType, parentHubUrl), { locale })`. `appHref` never appends `?hub=` to `/hubs/...` routes.
- The parent hub lookup runs only when the sub-hub lookup failed, so valid hubs and sub-hubs get no extra request.

---

## Suggested Scope of Changes

### 1. `public/lib/getHubBrowseTypeServerSideProps.ts`

Add a guard directly after the existing `Promise.all`:

```ts
if (!hubData) {
  // Unknown sub-hub under an existing parent hub: stay in the parent hub.
  const parentHubData = subHub ? await getHubData(parentHubUrl, locale) : null;
  const destination = parentHubData
    ? getHubBrowsePathForType(internalType, parentHubUrl)
    : getBrowsePathForType(internalType);
  return {
    redirect: {
      destination: appHref(destination, { locale }),
      permanent: false,
    },
  };
}
```

- Keeping the check after `Promise.all` adds no latency for valid hubs. For invalid slugs the other 7 requests are wasted, which is acceptable on an error path.
- `hubUrl` is already the combined `parent_sub` slug for sub-hubs, and `parentHubUrl` holds the parent slug, so both values are already available in the helper.
- The extra `getHubData(parentHubUrl)` call only happens on the error path for sub-hub routes.
- Browse, members and organizations, plus their `[subHub]` re-exports, all get the fix through this one helper.

### 2. `pages/hubs/[hubUrl]/index.tsx`

In `getServerSideProps`, when `hubData` is `null`, redirect to `appHref("/browse", { locale })` (non-permanent) before the existing redirect. Hubs that exist but have no `landing_page_component` keep the current redirect to `/hubs/<slug>/browse`.

---

## Test Strategy

- Add a Jest unit test for `getHubBrowseTypeServerSideProps` next to `public/lib/hubOperations.test.ts`. Mock `getHubData` and the other fetchers, then assert:
    - it returns a non-permanent `redirect` to `/browse`, `/members` or `/organizations` (per `internalType`) when `getHubData` resolves `null`
    - the destination has the locale prefix for a non-default locale and no `?hub=` param
    - it returns `props` when `getHubData` returns a hub
    - the sub-hub query `{ hubUrl, subHub }` is looked up as `parent_sub`
    - unknown sub-hub with an existing parent redirects to `/hubs/<parent>/<type path>` (browse, members, organizations)
    - unknown sub-hub with an unknown parent redirects to the global page
    - the parent hub lookup is not called when the sub-hub exists or when there is no sub-hub segment
- Manual check with `yarn dev`: go through every row of the edge case table and confirm the status code and `Location` header in the browser network tab.

---

## Open Questions

- [ ] Should hub members and organizations pages redirect to their global equivalents (`/members`, `/organizations`, as specified), or should all of them go to `/browse`?
- [ ] Should query params (filters) be kept on the redirect? Hub-specific sector filters may not exist globally, so this spec drops them.
- [ ] During a hub API outage (5xx or timeout) valid hubs would also redirect to `/browse`. Should `getHubData` expose the status so that only a 404 triggers the redirect?

---

## Log

- 2026-09-28 - Implemented in `getHubBrowseTypeServerSideProps.ts` and `pages/hubs/[hubUrl]/index.tsx`, with 11 unit tests in `getHubBrowseTypeServerSideProps.test.ts`. Full frontend suite (859 tests), `tsc` and `yarn lint` pass. Manually verified against the local dev server: `/hubs/x/browse`, `/de/hubs/x/browse`, `/hubs/x/members`, `/hubs/x/y/browse` and `/hubs/x` return 307 to the global page; `/hubs/erlangen/nope/browse` and `/de/hubs/erlangen/nope/members` return 307 to the parent hub page; `/hubs/erlangen/browse` returns 200.
- 2026-09-28 - User decision: an unknown sub-hub under an existing parent hub redirects to the parent hub's page (for example `/hubs/erlangen/nope/browse` to `/hubs/erlangen/browse`).
- 2026-09-28 - User decision: redirect to the global browse page instead of returning 404.
- 2026-09-28 - Spec drafted from GitHub issue climatehub#2196. Root cause confirmed by reading `getHubBrowseTypeServerSideProps`, the hub landing page and `HubAPIView`. Frontend-only scope. Awaiting user review before implementation.
