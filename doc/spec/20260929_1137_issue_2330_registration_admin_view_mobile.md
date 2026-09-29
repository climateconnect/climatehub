# Event registration admin view usable on mobile

**Status**: DRAFT
**Type**: Frontend - bug
**Date created**: 2026-09-29
**GitHub Issue**: [climatehub#2330](https://github.com/climateconnect/climatehub/issues/2330) - Bug: Event registration admin view not usable on mobile

**Depends on**:
- [frontend/src/components/project/ProjectRegistrationsContent.tsx](../../frontend/src/components/project/ProjectRegistrationsContent.tsx) - Registrations tab: settings summary, guest DataGrid, toolbar, footer, row actions
- [frontend/src/components/project/ProjectPageRoot.tsx](../../frontend/src/components/project/ProjectPageRoot.tsx) - renders the Registrations tab inside the project page `Container`
- [frontend/src/components/project/ViewRegistrationAnswersModal.tsx](../../frontend/src/components/project/ViewRegistrationAnswersModal.tsx) - per-guest answers dialog opened from a row
- [frontend/src/components/project/CancelGuestRegistrationModal.tsx](../../frontend/src/components/project/CancelGuestRegistrationModal.tsx) - cancel-guest dialog opened from the row menu
- [frontend/src/components/project/SendEmailToGuestsModal.tsx](../../frontend/src/components/project/SendEmailToGuestsModal.tsx) - email dialog opened from the toolbar
- [frontend/public/texts/project_texts.tsx](../../frontend/public/texts/project_texts.tsx) - guest list copy (`search_guests`, `send_email_to_guests`, ...)

---

## Problem Statement

Organisers use the **Registrations** tab of an event project to check guests in at the door, usually on a phone. On a phone the view is hard to use. The issue says the search box is too small to find guests.

The layout code explains the problem (`ProjectRegistrationsContent.tsx`):

- **Toolbar crowding.** `RegistrationsToolbar` puts four things in one row that never wraps: the search `TextField` (`flex: 1, maxWidth: 360`), an empty spacer `Box` (`flex: 1`), the outlined **Email guests** button with its text label, and `GridToolbarExport`, which also has a text label. On a 360–390 px screen the two buttons take most of the width. The search field and the spacer split what is left, so the search box shrinks to a few characters. German is worse: the button label is "Gäste per E-Mail benachrichtigen".
- **Grid wider than the screen.** The visible columns need at least 56 + 120 + 120 + 160 + 120 + 88 = **664 px** (avatar, first name, last name, registration date, status, actions). On a phone the grid scrolls sideways. The status chip and the row actions (view answers, cancel) start off screen, so they are the hardest to reach.
- **Search only matches single name fields.** The filter checks `first_name` and `last_name` separately. Typing a full name like "Anna Mü" returns nothing. On a phone, typing the whole name is often the quickest way to find someone, so this matters more there.
- **Smaller issues.** The settings summary items have `minWidth: 180`, which is fine, but they stack loosely. The footer pagination has 25 rows per page, and changing pages on a phone is fiddly when checking in a crowd.

The issue says the view does not have to be perfect on mobile, but it has to work.

### Why it matters

- Organisers check guests in during the live event, on a phone, under time pressure. Right now finding a guest is the hard part.
- The actions that matter during the event (see answers, cancel) are hidden behind sideways scrolling.
- A lot of organisers use the event registration feature, and a door list that works on phones makes it more useful.

---

## User Stories

- As an organiser at the event entrance, I want a search box that fills the width of my phone screen, so I can quickly type a guest's name.
- As an organiser, I want to search by full name ("Anna Müller"), so I find the guest however I type it.
- As an organiser on a phone, I want each guest row to show the name, status and actions without scrolling sideways, so I can check a guest with one look and one tap.
- As an organiser on a phone, I still want to reach "Email guests" and "Export", even if they are shown more compactly.

---

## Acceptance Criteria

### Toolbar and search

- [ ] **AC-1**: Below the `sm` breakpoint (< 600 px), the search field takes the full width of the toolbar on its own row. The toolbar wraps: search on the first row, actions on a second row or shown compactly next to it. The search field is never narrower than the content width minus the gutter.
- [ ] **AC-2**: On mobile the search input has a comfortable touch target: at least 44 px tall and a font size of at least 16 px, so iOS Safari does not zoom in on focus. It keeps the search icon, the placeholder (`search_guests`) and the `aria-label`.
- [ ] **AC-3**: On mobile, **Email guests** and **Export** stay available but take less space: icon buttons with an `aria-label` and a tooltip, or a single overflow menu. On `sm` and up the desktop toolbar looks as it does today.
- [ ] **AC-4**: Search matches a guest when the query is in the first name, the last name, or `"first last"`. Matching ignores case and trims surrounding whitespace. Empty search shows all rows, as it does today. This applies on every screen size.
- [ ] **AC-5** *(optional, decide in review)*: The search field has a clear (×) button once it has text, so the organiser can reset between guests with one tap.

### Guest rows on mobile

- [ ] **AC-6**: Below `sm`, the guest list fits the viewport width. No sideways scrolling is needed to see a guest's name, status, or row actions.
- [ ] **AC-7**: Below `sm`, each row shows: avatar, **full name** (first + last in one cell, linked to the profile as today), status chip (Active / Cancelled with the cancelled-date tooltip kept), and the actions (view answers icon, three-dot menu). The registration date may be hidden or shown as secondary text under the name.
- [ ] **AC-8**: Row action buttons have a touch target of at least 40 × 40 px on mobile. The view-answers and cancel-guest flows open and work on a 360 px wide viewport. The modals are usable there, either full screen or fitting the width.
- [ ] **AC-9**: Cancelled rows keep their dimmed styling on mobile.

### Unchanged behaviour

- [ ] **AC-10**: Desktop (`md` and up) layout, columns, sorting, default sort (`registered_at asc`), pagination, and footer counts behave as today.
- [ ] **AC-11**: CSV export and print output are unchanged on every screen size: same fields, same file name, same hidden ISO/custom-field columns. Mobile column visibility changes must not affect export fields. `csvFields` and `printFields` are already explicit and must stay that way.
- [ ] **AC-12**: Footer counts (total / active / cancelled) and pagination still render on mobile. They may wrap, but they must not overflow sideways.

### Tests

- [ ] **AC-13**: Add a Jest test file for `ProjectRegistrationsContent` (none exists today) that covers:
  - Search by first name, last name, full name "first last", and mixed case.
  - Mobile layout (mock `useMediaQuery` / theme breakpoint): the search field and action buttons render with their accessible names, and the full-name cell renders.
  - Desktop layout still renders separate first / last name columns.

---

## Constraints

- Frontend only. No backend, API, serializer or data model changes. `GET /api/projects/{slug}/registrations/` stays as it is.
- Keep MUI X `DataGrid` (v7) as the list component on every screen size. Do not add a second list implementation just for mobile unless review decides otherwise (see Open questions). Use column visibility, a combined name column, and responsive `sx` / `useMediaQuery` from `@mui/material`.
- Use the existing responsive approach (MUI breakpoints via `theme.breakpoints` / `useMediaQuery`). Do not add new dependencies.
- Any new copy (e.g. an overflow menu label or a "clear search" label) needs English and German keys in `project_texts.tsx`.
- Accessibility: every icon-only button keeps an `aria-label`. The search field keeps its label. Visible focus stays intact.
- Run `yarn lint`, `yarn format`, the TypeScript build and `yarn test` before merging.

---

## Out of scope

- A real **check-in / attendance** feature (marking a guest as arrived). The issue mentions checking guests during the event, but it only asks for a usable list. If check-in is wanted, it gets its own issue and spec, and it will need backend work.
- Redesigning the settings summary or the edit registration settings modal. Only fix it if it clearly overflows at 360 px.
- Showing custom-field answers inline in the mobile row. The answers modal stays the way to see them.

---

## Directional hints

- **Toolbar**: in `RegistrationsToolbar`, add `flexWrap: "wrap"`, and below `sm` give the search field `flex: "1 1 100%"` and `maxWidth: "none"`. Remove the spacer box on mobile, or only render it on `sm` and up. Swap the email button and `GridToolbarExport` for icon-only versions on mobile. `GridToolbarExport` accepts button props, and hiding the label with `sx` or using an `IconButton` that triggers export via `apiRef.current.exportDataAsCsv()` are both options. With the second option, check that `csvOptions.fields` is passed the same way.
- **Search**: pull the row filter into a small pure helper, e.g. `matchesGuestSearch(row, query)`, that checks `first`, `last` and `` `${first} ${last}` ``. That makes AC-4 easy to unit test and keeps the JSX readable.
- **Columns**: add a `user_full_name` display column with `disableExport: true` that renders the linked full name. Use `columnVisibilityModel` as a controlled prop based on `isMobile`: on mobile show `user_full_name` and hide `user_first_name`, `user_last_name`, `registered_at`. On desktop do the reverse. Keep the hidden ISO/custom-field columns hidden on both. Because `csvFields` / `printFields` are explicit, export stays the same.
- **Width**: on mobile give name columns `flex: 1, minWidth: 0` so the grid fits the container. The page `Container` in `ProjectPageRoot` already has gutters, so check that the grid does not add extra padding.
- **Modals**: check `ViewRegistrationAnswersModal`, `CancelGuestRegistrationModal`, and `SendEmailToGuestsModal` at 360 px. If a dialog overflows, `fullScreen={isMobile}` is the usual fix.

---

## Open questions (for review)

1. **Actions on mobile**: icon buttons in the toolbar or a single overflow (⋮) menu with "Email guests" and "Export CSV / Print"? Recommendation: icon buttons with tooltips. They are discoverable and need no new menu copy.
2. **Registration date on mobile**: hide it completely or show it as secondary text under the name? Recommendation: hide it. It is not needed at the door and can still be seen in export.
3. **Page size on mobile**: keep 25 or raise it (e.g. 50/100) to reduce paging at the door? Recommendation: keep 25. Search is the main way to find guests once AC-1–AC-4 are in.
4. **Clear button (AC-5)**: include it now or later?

---

## System impact

- **Actors**: Organiser / Team Admin viewing the Registrations tab. No new actors.
- **Actions**: View registered guests, search guests, view answers, cancel guest, email guests, export. All already exist, and only the presentation changes on small screens. Search also gains full-name matching.
- **Entities**: None changed. `EventRegistration` / registration rows and `RegistrationFieldAnswer` are read as today.
- **Flows**: No change to `doc/mosy/flows/core-flows.md`.
- **Backend**: None.
- **Frontend**: `ProjectRegistrationsContent` toolbar, columns and filter. Possibly `fullScreen` on the three related modals.
- **Mosy doc updates required**: None expected.
- **Risks**: Low. The main risk is changing CSV/print output by accident when column visibility changes. AC-11 covers it, and explicit export fields prevent it.

---

## Log

- 2026-09-29 - Spec drafted from GitHub issue climatehub#2330. Root causes found by reading `ProjectRegistrationsContent.tsx`: non-wrapping toolbar with spacer and two labelled buttons squeezing the search field, 664 px minimum column width causing sideways scroll, and a search filter that does not match full names. No existing Jest test for the component. Not yet reproduced in a mobile viewport in the browser. Awaiting user review of the open questions before implementation.
