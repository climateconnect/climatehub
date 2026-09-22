# Fix back navigation after project edit (issue #2227, item 2)

**Status**: DRAFT
**Type**: Frontend — bugfix
**Date created**: 2026-08-20
**GitHub Issue**: [#2227](https://github.com/climateconnect/climateconnect/issues/2227) — item 2
**Related**: PR [#2232](https://github.com/climateconnect/climateconnect/pull/2232) fixed item 1 of the same issue (back button no-op after a server-side redirect)

**Depends on**:
- `frontend/src/components/editProject/EditProjectRoot.tsx` — all navigations leaving the edit page
- `frontend/src/components/project/Buttons/ProjectContentSideButtons.tsx` — edit entry point on the project page
- `frontend/src/components/project/ProjectPreview.tsx` — draft-card entry point (behavior must be preserved)
- `frontend/src/components/general/GoBackButton.tsx` — in-app back button (behavior must NOT change)

---

## Problem Statement

After a user edits a project and saves, pressing back on the project page — both the in-app back button (in the hub sub-header) and the browser back button — lands on the **edit page** instead of where the user was before they started editing. Going back to the edit page is literally correct history behavior, but it is never what the user wants: the edit page is a transient form, not a meaningful destination.

Expected behavior (from the ticket):

- Project A detail → Project B detail (via "similar projects") → edit Project B → save → Project B detail: **back → Project A detail**
- User profile → Project A detail → edit Project A → save → Project A detail: **back → user profile**
- When there is no meaningful back history (e.g. edit page opened directly): **back → default destination** (browse page, or hub browse when a hub is active) — same fallback established by PR #2232.

### Root cause

The edit flow adds two unwanted entries to the browser history:

1. **Entering edit**: the edit button on the project page is a plain anchor (full page load), which pushes `/editProject/<slug>` onto the history stack.
2. **Leaving edit**: after a successful save, the edit flow navigates to the project page with a navigation that adds *another* history entry.

Resulting stack: `[A, B, edit, B']` — back lands on `edit`. And removing only the edit entry would leave `[A, B, B']`, where back lands on the same project page the user is already on — a broken-feeling back button, the same class of bug as ticket item 1. Both the entry and the exit must avoid adding entries.

### Why it matters

- Users who save an edit and press back unexpectedly land back in the edit form — confusing, looks broken, invites accidental re-editing.
- Item 1 of the same issue was already fixed (PR #2232); this is the remaining known back-navigation defect.

---

## User Stories

- As a project admin, after saving my edit I want back to return me to where I was before I started editing, so I can continue browsing without revisiting the form.
- As a user who opened the edit page directly (deep link or new tab), after saving I want back to take me to a sensible default instead of doing nothing.

---

## Acceptance Criteria

- [ ] **AC-1** (ticket example 1): Project A → Project B (via similar projects) → edit B → save → Project B detail. Both the in-app back button and the browser back button land on **Project A detail**.
- [ ] **AC-2** (ticket example 2): User profile → Project A → edit A → save → Project A detail. Both back buttons land on the **user profile**.
- [ ] **AC-3** (draft-card entry): Profile page → own draft card → edit → publish → project detail. Back lands on the **profile page** (where the user was before editing).
- [ ] **AC-4** (cancel): Entering edit from the project page and cancelling (the edit page's top back arrow, including its confirm dialog) returns to the project page; back from there goes to the page before the project page, as if editing never happened.
- [ ] **AC-5** (deep link / new tab): Opening the edit URL directly, saving lands on the project detail; back then uses the existing default fallback (browse / hub browse) and never silently does nothing.
- [ ] **AC-6**: The post-save success message (`?message=…`) and the hub query param (`?hub=…`) are still present on the destination URL; locale prefixes are preserved on all navigations.
- [ ] **AC-7**: Repeated edit → save → edit → save cycles keep producing the same correct back behavior.
- [ ] **AC-8**: `GoBackButton` logic itself is unchanged (PR #2232 redirect case, external referrer, hub fallback); the existing `GoBackButton.test.tsx` suite passes without modification.
- [ ] **AC-9**: Middle-click / open-in-new-tab on the edit button still works (edit page opens in a new tab with its own history).
- [ ] **AC-10**: Verified on mobile, logged out where relevant, and with custom hub theme + default theme (per PR checklist).

---

## Constraints

- Frontend-only; no backend changes.
- No changes to `GoBackButton`'s logic.
- Hub/locale links must preserve the locale prefix and `?hub=` param (project convention: prefer the `appHref` / `AppLink` helpers over manual path construction).
- The edit flow is shared by projects, events, and drafts — all must be covered.
- **Decided**: the fix must make the literal browser history correct (browser back behaves the same as the in-app button), not only patch the in-app button.

---

## Directional hint (agreed approach — "Option A", history-neutral edit flow)

*Agreed with the user in discussion on 2026-08-20. This is the decided direction, not an implementation guide.*

The edit page should never add an entry to the browser history:

- Navigation **into** edit from the project page's edit button replaces the current history entry instead of adding one.
- **All** navigations leaving the edit page (save/publish, save-as-draft, cancel, delete) replace instead of add.
- Entry into edit from **draft cards** (profile/dashboard) keeps its current behavior — replacing there would erase the profile page, which is exactly where back should go after publishing a draft.
- **Accepted trade-off**: browser-back *while on the edit page* skips the project detail page (lands on the page before it). The canonical way to leave editing remains the cancel/back arrow, which already has an unsaved-changes confirm dialog.

Alternatives considered and rejected: exit-replace only + duplicate detection in `GoBackButton` (fixes only the in-app button, leaves browser back on a duplicate page); app-level client-side navigation tracker (substantial machinery, still doesn't fix browser back); capturing the pre-edit URL in a side channel (cannot express "the page before the pre-edit project page", which ticket example 1 requires).

---

## Known limitations (accepted, out of scope)

- **Save-as-draft from a profile draft card** still leaves a duplicate profile entry in history (back lands on the profile page again). Pure history shaping cannot solve every entry/exit combination — the entry cannot know which exit the user will pick. Today's behavior (back → edit page) is no better.
- **No unsaved-changes guard** on the edit page against browser-back/tab-close (the share flow has one via `beforePopState`; edit does not). Follow-up candidate.
- Other edit flows (edit profile, edit organization) are not covered by this task.

---

## AI Agent Insights and Additions

### History stack walkthrough

```
[A, B] ──enter edit (push)──▶ [A, B, edit] ──save (push)──▶ [A, B, edit, B']
                                                          back ──▶ edit  (the bug)
```

Both the entry and the exit must stop adding entries; fixing only one leaves either the edit page or a duplicate project page directly below the current entry.

### Where the navigations happen (domain context)

- **Entry from project page**: `ProjectContentSideButtons.tsx` — MUI `Button`/`IconButton` with a raw `href` (full page load), desktop and narrow-screen variants.
- **Entry from draft card**: `ProjectPreview.tsx` — `AppLink` to `/editProject/<slug>` for drafts (client-side navigation).
- **Exits**: `EditProjectRoot.tsx` — save/publish (→ project page), cancel (→ project page), save-as-draft (→ own profile), delete (→ own profile).
- The **top back arrow on the edit page is the cancel action**: `NavigationButtons` with `position="top"` renders the cancel button with an arrow icon (no text) behind an unsaved-changes `ConfirmDialog`.

### Edge cases to verify during implementation

- Entry into edit becomes a client-side navigation: verify the edit page's server-side guards still behave on client-side entry (redirect to login when logged out, "project not found", "not a member", "no permission" branches of the edit page).
- Deep link / new tab: history `[edit]` → save (replace) → `[B]`; `GoBackButton` falls back to the default URL because `history.length === 1` — consistent with PR #2232.
- Refreshing while on the edit page preserves history; the exit must still produce a correct stack.
- Middle-click / open-in-new-tab on the edit button must keep working (only plain left-click should be intercepted).
- Hub query param and locale prefix must survive on entry and exit URLs alike.

### Testing notes

- Frontend verification must include `yarn tsc` in addition to lint and tests (project constraint).
- The existing `GoBackButton.test.tsx` suite should pass unchanged (AC-8).
- New test coverage: the edit flow's navigations use replace semantics (`EditProjectRoot` currently has no tests), and the edit button intercepts plain left-click only.

---

## System impact

*(to be filled by Archie)*

---

## Log

- 2026-08-20 — Task created. Options discussed with the user (history-neutral replace flow vs. GoBackButton duplicate heuristic vs. client-side navigation tracker); Option A chosen. Awaiting user review of problem statement and AI insights.
