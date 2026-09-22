# Roll-out Plan — Frontend Hub Context Refactor

Companion to `doc/spec/20260701_1205_refactor_frontend_hub_context.md`.

## Guiding principles

- **No big-bang.** Every phase is independently shippable, merged on its own PR, and leaves the app in a working state.
- **Start additive.** Phase 1–3 add new code (context, utilities, component) without changing any existing behavior, so they carry near-zero regression risk.
- **Prove it, then spread it.** After the additive foundation, migrate a *small* showcase set of links, manual-test it thoroughly, then roll the rest out in batches.
- **Tests + lint + format gate every phase.** Frontend: `yarn lint`, `yarn format`, `yarn test` (Jest), and a production build (`yarn build`) to confirm SSR still compiles. There are **no automated e2e tests**, so each "important phase" below has a manual e2e checklist that must be walked before merge.
- **Boy-scout rule from Phase 3 onward.** Once the showcase (Phase 3) has merged, the new machinery is the default for *all* link-building: any **new** feature must use `<AppLink>`/`appHref`, and any **old** link touched incidentally during other work should be migrated to it on the spot. This keeps the migration moving without needing a dedicated pass, and prevents new `?hub=`/`getLocalePrefix` concatenations from creeping back in. (Phases 4–7 remain the structured batches for the bulk of the existing ~30 / ~200 sites.)

## Phase overview

| Phase | What | Behavior change | Risk | Manual test |
|------|------|-----------------|------|-------------|
| 0 | Scaffolding: URI utility + `appHref` + keep `getLocalePrefix` | None (additive) | None | No (unit only) |
| 1 | `HubProvider` + `HubContext` (server-fetched hubs list, `UserContext.hubUrl` shim) | None (shim keeps old API working) | Low | Yes |
| 2 | `<AppLink>` component (unused for now) | None (additive) | None | No (unit only) |
| 3 | **Showcase:** migrate a handful of representative links | Yes (links now use new machinery) | Medium | **Yes — primary manual gate** |
| 4 | Batch A — hub landing / browse pages | Yes | Medium | Yes |
| 5 | Batch B — project / organization / profile cross-entity links (Category A) | Yes | Medium | Yes |
| 6 | Batch C — global nav / footer / settings / dashboard (Category B, `leaveHub`) | Yes | Medium | Yes |
| 7 | Batch D — hub switcher / `HubsDropDown` (Category C, no `AppLink`) | Yes | Low–Med | Yes |
| 8 | Cleanup: remove shim + `UserContext.hubUrl`, drop per-page `getAllHubs` calls | Yes (deletes legacy paths) | Low | Yes |

---

## Phase 0 — URI utility + `appHref` (additive, zero risk)

**Objective:** Land the shared link-building primitives with full unit coverage. Nothing consumes them yet.

**Changes**
- New `appendQueryParam` / `withQuery(href, params)` on `URL` + `URLSearchParams` in `public/lib/urlOperations.ts` (or `public/lib/uriOperations.ts`).
- New `appHref(href, { leaveHub, hubUrl, locale })` next to `getLocalePrefix`. It must: strip optional locale prefix before the hub-in-path check; skip `?hub=` when (a) `leaveHub`, (b) no active hub, (c) destination is a hub route (`/hubs/...`), or (d) `?hub=` already present; join with `&` when a query exists; place params before `#`; URL-encode the slug.
- `getLocalePrefix` stays unchanged (server-side use).

**Risk:** None — no call sites yet.

**Automated tests:** Unit tests for the URI utility and `appHref` covering: locale prefix on/off, `&` join, anchor preservation (`#` after query), already-present `?hub=`, hub-route skip (with and without `/de` prefix), absolute-URL passthrough, encoding.

**Exit:** `yarn lint && yarn format && yarn test && yarn build` green.

---

## Phase 1 — `HubProvider` + `HubContext` (additive via shim)

**Objective:** Introduce the reactive hub context and the shared hubs list without touching any component that reads hub state.

**Changes**
- `HubProvider` placed **outside** `UserContext.Provider` in `pages/_app.tsx`. It fetches the hubs list **once on the server** (`getInitialProps`) and exposes: active hub slug, active hub object, active hub theme, full hubs list. Active slug derived from `router.query` (`getHubslugFromUrl`: path `hubUrl` preferred, `?hub=` fallback).
- `UserContext.hubUrl` becomes a **shim** reading from `HubContext` (possible because `HubProvider` wraps it).
- Hub data/theme fetched on slug change, cached by slug.

**Risk:** Low. Old `UserContext.hubUrl` consumers keep working unchanged.

**Automated tests:** Resolver unit tests (from `?hub=`, from `/hubs/<slug>`, from sub-hub `/hubs/<slug>/<subHub>/browse` → top-level slug); hubs-list fetched once.

**Manual e2e checklist (walk before merge):**
- [ ] Browse the site normally; visual/behavior identical to before (regression smoke test — the shim returns the same slug the old code computed).
- [ ] On a hub page, `UserContext.hubUrl` still resolves to the correct slug (devtools / a temporary log), confirming the shim matches the pre-refactor value from both `?hub=` and `/hubs/<slug>` URLs.
- [ ] Hub-dependent UI that reads the shared hubs list (e.g. the hub switcher) still populates — the server-fetched list is available.

> Note: theming is **not** yet driven by `HubContext` in this phase — each page still fetches `getHubTheme` itself. Theming/SSR-render checks move to Phase 3, where `appHref`/`AppLink` first build hub-scoped URLs. Phase 1 is effectively a regression smoke test for the shim + resolver + shared hubs list.

---

## Phase 2 — `<AppLink>` component (additive, unused)

**Objective:** Land the component wrapper with tests; do not wire it into any page yet.

**Changes**
- `<AppLink>` wraps `next/link`, accepts the same props + `leaveHub`, computes `href` via `appHref`. (Confirmed: existing `next/link` usage passes a pre-prefixed `href` with **no** `locale` prop, so we match that — no double prefix.)

**Risk:** None — not referenced anywhere yet.

**Automated tests:** Render tests asserting resolved `href` for Category A (appends `?hub=`), Category B (`leaveHub` → no `?hub=`), locale prefix, absolute-URL passthrough, anchor preservation.

**Exit:** lint/format/test/build green.

---

## Phase 3 — Showcase migration (primary manual gate)

**Objective:** Prove the machinery end-to-end on a *small, representative* set of links, then manual-test hard before touching the rest.

**Scope (suggested 4–6 links covering every category):**
- Header "Share a project" link (`headerLinks.ts` `/share?hub=`) — Category A.
- One cross-entity link on a hub-scoped page, e.g. a project → its organisation (`ProjectPageRoot`) — Category A, exercises `?hub=` + existing query/anchor.
- Footer "Imprint"/"Privacy" (`Footer.tsx`) — Category B (`leaveHub`), exercises locale prefix + global destination.
- `LoginNudge.tsx` signin/signup redirect — exercises `&` join and existing query string (the known buggy spot).
- One hub switcher target in `HubsDropDown` / `HubLinks` — Category C (constructed directly, **not** via `AppLink`).

**Risk:** Medium — this is the first real behavior change.

**Manual e2e checklist (must pass before merge):**
- [ ] On a hub page, click Share → lands on `/share?hub=<slug>` (locale-prefixed). Hub preserved.
- [ ] From a hub-scoped project, open its organisation / a member profile → `?hub=<slug>` carried; locale prefix correct in both `de` and `en`.
- [ ] A link that already had a query param (e.g. `?tab=about`) gets `&hub=` not a second `?`.
- [ ] A link with an anchor (e.g. `/chat/abc#comments`) keeps the anchor and puts `?hub=` before `#`.
- [ ] Footer/Imprint (global) drops `?hub=` (Category B).
- [ ] Hub switcher navigates to a *different* hub with no stale `?hub=<old>` on the destination.
- [ ] External links (if any in scope) unchanged.
- [ ] Deep-link each changed destination directly; SSR/theming correct.
- [ ] `yarn build` succeeds (SSR compile).

**Exit:** All manual checks pass + automated gate green.

---

## Phases 4–7 — Incremental batch migration

Each batch follows the same shape: migrate the area's links to `<AppLink>`/`appHref`, remove the bare `?hub=` / `getLocalePrefix` concatenation at those call sites, then run the manual checklist focused on that area.

- **Phase 4 — Batch A: hub landing / browse pages.** ✅ DONE (2026-08-12) Highest value: these are where the path-based hub (`/hubs/<slug>`) lives, so the "skip `?hub=` when hub already in path" rule is exercised. Manual: navigate within `/hubs/<slug>` and `/hubs/<slug>/<subHub>/browse`; confirm no redundant `?hub=` and correct cross-entity behavior.
- **Phase 5 — Batch B: project / organization / profile cross-entity links (Category A).** ✅ DONE (2026-08-12) The bulk of "preserve hub" links.
- **Phase 6 — Batch C: global nav / footer / settings / dashboard (`leaveHub`).** Audit these for "leave hub" decisions; they must be greppable (`leaveHub`).
- **Phase 7 — Batch D: hub switcher / `HubsDropDown` (Category C).** Construct target paths directly from the hubs list; confirm no current-hub `?hub=` leaks. No `AppLink` used here.

Order note: do the **hub** batches (4–7 as they apply) before the broad **locale**-only migration, per the spec. The locale work reuses the same component/helper, so once BATCH B/C are done, a follow-up pass converts the remaining `getLocalePrefix(locale) + "/path"` sites to `appHref(href, { locale })` / `<AppLink>` in further small PRs.

**Per-batch manual checklist (subset relevant to the area) + full automated gate.**

---

## Phase 8 — Cleanup

**Objective:** Remove legacy paths once migration is complete.

**Changes**
- Delete `UserContext.hubUrl` shim only after `grep -r "UserContext.hubUrl"` returns zero non-test hits.
- Remove now-redundant per-page `getAllHubs(...)` calls in `getServerSideProps` (hub list comes from shared context).
- Remove any leftover bare `?hub=` / `/<locale>/` string concatenation.

**Risk:** Low (legacy only; covered by grep + tests).

**Manual e2e:** Full regression of the Phase 3 checklist across the whole site, plus a locale sweep (`en` + `de`) on hub and non-hub pages.

---

## Reusable manual e2e matrix (run after every "important" phase)

Run in both `en` and `de`, on a hub-scoped page and a global page:

| Scenario | Expected |
|----------|----------|
| Deep-link hub page (`/de/hubs/<slug>`) | Theming correct on first paint (SSR) |
| Hub page → project → organisation → profile | `?hub=<slug>` preserved throughout; locale prefix correct |
| Link with existing `?x=1` | becomes `?x=1&hub=<slug>` (never `?x=1?hub=`) |
| Link with `#anchor` | `?hub=` placed before `#`; anchor preserved |
| Footer / Settings / About / Imprint | No `?hub=` (Category B) |
| Hub switcher → different hub | Destination has no stale `?hub=<old>` |
| External link | Untouched |
| Switch locale mid-session | Hub context retained |

## Definition of Done (whole refactor)

- [ ] `grep` for bare `?hub=` and `getLocalePrefix(locale) + "/path"` concatenation returns zero hits outside tests/utilities.
- [ ] `UserContext.hubUrl` removed; zero non-test consumers.
- [ ] `yarn lint && yarn format && yarn test && yarn build` green.
- [ ] Manual e2e matrix passes in `en` and `de`.
- [ ] No backend changes (per spec constraint).
