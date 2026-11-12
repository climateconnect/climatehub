# Project Join Requests — 3. Show Request Dialog

**Status**: DRAFT
**Type**: Full-stack — feature (new read endpoint + frontend dialog + deep link)
**Date created**: 2026-11-09
**GitHub Issue**: [#2310](https://github.com/climateconnect/climatehub/issues/2310) (milestone "Join Requests v2"; labels: frontend/React, backend/Python, frontend/UI)

**Blocked by**: #2307 (confirmation step + message, spec `20261012_1000_...`), #2309 (store deciding admin, spec `20261026_1000_...`)
**Blocks**: #2311 — "Start chat conversation as response" (the **Respond** button)

**Product decision (from the issue author's colleague)**: the team page gets an inline list of open requests; #2310's approve/decline dialog opens from that list. The legacy `ProjectRequestersDialog` is not changed.

**Depends on**:
- `MembershipRequests` model — `backend/organization/models/members.py` (`message`, `request_status`, `requested_at`, `approved_at`, `rejected_at`, `decided_by`)
- `ListProjectRequestersView`, `ProjectRequesterSerializer` — `backend/organization/views/project_views.py`, `serializers/project.py` (list of open requests: `{id, user_profile}` only)
- `ManageJoinProjectView` — `POST /api/projects/<url_slug>/request_membership/<approve|reject>/<request_id>/`
- `ProjectRequestersDialog` — `frontend/src/components/dialogs/ProjectRequestersDialog.tsx` (inline approve/deny icons, no detail view)
- `ProjectPageRoot` — `show_join_requests` query param already opens the requesters list
- Feature toggle `PROJECT_JOIN_REQUEST_CONFIRMATION` (migration `0008`)

---

## Problem Statement

There is only a list of *open* requests with approve/deny icons. Nobody can look at **one** request: admins can't see the requester's message or when they asked, and a decided request disappears entirely, so nobody can see its outcome. There is also no way to link to a single request (e.g. from a notification or a chat).

Add a **join request dialog** that shows one request in full, lets a project admin approve/decline it when pending, and can be opened by URL. The dialog is opened from a **new list of open requests on the team page** (a starting point, behind the feature toggle, doesn't have to be perfect). The old requesters modal is **left untouched**, because opening a modal from a modal is poor UX.

### Current state

- `GET /api/projects/<slug>/requesters/` returns only open requests, only `{id, user_profile}`, admin-only.
- No endpoint loads a single request; `message` and `decided_by` are stored but never returned.
- Approve/decline work and are reused unchanged.

---

## User Stories

- As a **project admin**, I want to open a join request and read the requester's message, profile and date before deciding, so I can make an informed decision.
- As a **project admin**, I want to approve or decline from that dialog.
- As a **project admin**, I want to see (later) who decided a request and when.
- As a **requester**, I want to open my own request via a link and see its status and my message.
- As a **developer** of #2311 / cancel flow, I want a linkable single-request view to attach actions to.

---

## Acceptance Criteria

### AC-1: Backend — single request endpoint

- **AC-1.1** New `GET /api/projects/<url_slug>/join_requests/<request_id>/` returns one request of that project. (Not under `request_membership/<x>/`: that pattern already means `<user_slug>` for POST.)
- **AC-1.2** Response fields: `id`, `user_profile` (`UserProfileStubSerializer`: name, slug, image, location…), `message` (empty string if none), `requested_at`, `request_status` (`pending` | `approved` | `rejected`), `decided_at` (the `approved_at`/`rejected_at` value, else `null`), and **admin-only** `decided_by` (`UserProfileStubSerializer` or `null`).
- **AC-1.3** Permissions:
  - Project admins (same rule as `ReadWriteSensibleProjectDataPermission`): full response including `decided_by`.
  - The requesting user: may read their **own** request; `decided_by` is **omitted** from the response (not just hidden in the UI).
  - Anyone else, including other project members and anonymous users: 403 / 401.
- **AC-1.4** 404 if the project or request doesn't exist, or the request belongs to another project or to an organization (no cross-project leaks; check `target_project`).
- **AC-1.5** The query uses `select_related` (user, user profile, decided_by) — no N+1.
- **AC-1.6** `message` is plain text (validated on write in #2307); the API returns it as stored, never decoded.
- **AC-1.8** `ProjectRequesterSerializer` (list endpoint) additionally returns `message` and `requested_at`. Additive only; existing fields and the legacy modal are unaffected.
- **AC-1.7** Approving/declining an already decided request must not overwrite the decision: respond 400/409 with a clear message. (Verify current `MembershipRequestsManager` behavior; add the guard if missing.)

### AC-2: Frontend — dialog

- **AC-2.1** New component `JoinRequestDetailDialog` (separate file under `src/components/project/`; do not extend `ProjectPageRoot`). Built with `GenericDialog`/MUI v7, `styled()`/`sx`.
- **AC-2.2** Content, top to bottom: requester mini profile (avatar, name, location) linking to `/profiles/<slug>`; "Requested on" date (locale-formatted); status chip (Pending / Approved / Declined) with the decision date when decided; message (rendered as text, preserved line breaks; hidden section or "No message" when empty).
- **AC-2.3** Admins additionally see "Approved/Declined by <admin name>" for decided requests (link to profile). Requesters never see it.
- **AC-2.4** For admins and a **pending** request: **Approve** and **Decline** buttons. They call the existing endpoints, show a loading state, prevent double submit, show the existing success/error feedback, then update the dialog to the new status (dialog stays open, buttons disappear) and refresh the open-requests list/count.
- **AC-2.5** For decided requests, and for the requester's own view: no action buttons.
- **AC-2.6** States: loading skeleton/progress; 404 → "request not found"; 403 → "no permission"; logged out → login prompt with redirect back to the same URL.
- **AC-2.7** Focus trap, labelled dialog (`aria-labelledby`), Escape/backdrop close, focus returns to the trigger. All copy in `public/texts/` (en + de).
- **AC-2.8** **Respond** and **Cancel request** are **not** rendered (out of scope; placeholders for #2311 / follow-up).

### AC-3: Open requests list on the team page, and deep link

- **AC-3.1** New component `OpenJoinRequestsList` (own file under `src/components/project/`) rendered on the project **team** tab, **only for project admins** and only when the toggle is on. With no open requests it renders nothing or a short empty state (decide in implementation).
- **AC-3.2** Each row shows: requester avatar + name, request date, a one-line truncated message preview, and a "View" action. Clicking the row opens `JoinRequestDetailDialog` for that request. No inline approve/decline in the list (they live in the dialog).
- **AC-3.3** The list loads from the existing `GET /api/projects/<slug>/requesters/`, extended **additively** with `message` and `requested_at` (AC-1.8). Open requests only, newest first.
- **AC-3.4** After approve/decline in the dialog the list refreshes and the row disappears; the team member list also refreshes after an approval.
- **AC-3.5** The legacy `ProjectRequestersDialog` and its entry point (`show_join_requests`) are **unchanged** and do not open the new dialog. With the toggle on, both coexist until the old one is retired in a later task.
- **AC-3.6** Deep link: the project **team** page with `?join_request=<id>` opens the dialog on load (SSR-safe: opens client-side after mount). It works for requests not in the list (e.g. already decided).
- **AC-3.7** Opening/closing the dialog updates the URL (`join_request` param added/removed with `router.replace`, shallow) so the state is shareable and browser back closes it.
- **AC-3.8** An invalid id in the URL shows the not-found state and does not break the page.

### AC-4: Feature toggle

- **AC-4.1** Gated by `PROJECT_JOIN_REQUEST_CONFIRMATION` (the toggle from #2307). Off: the new list is not rendered, `join_request` param ignored, team page and old modal unchanged.
- **AC-4.2** The backend endpoint is always available (permissions protect it); the toggle only gates the UI, consistent with #2307.

### AC-5: Tests

- **AC-5.1** Backend (`organization/tests/test_join_request_detail.py`): admin gets full payload incl. `decided_by`; requester gets own request without `decided_by`; other user/member/anonymous denied; request of another project → 404; org request → 404; pending/approved/rejected status mapping; empty message → `""`; decided request can't be re-decided; query count bounded.
- **AC-5.2** Frontend (jest): list renders open requests, opens the dialog on click, and is hidden for non-admins; dialog renders all fields; admin sees decider, requester doesn't; Approve/Decline call the right endpoint and update state; buttons hidden when decided; loading/404/403 states; deep link opens dialog; toggle off hides the list.

### AC-6: Documentation

- **AC-6.1** `doc/api-documentation.md`: new endpoint, permissions, response shape (incl. admin-only field).
- **AC-6.2** `doc/mosy/flows/`: add/update the join-request flow (admin views a request, requester views own request, deep link).
- **AC-6.3** `doc/domain-entities.md`: note `message`/`decided_by` are now exposed via the API.

---

## Constraints

- No model change, no migration (fields exist after #2307/#2309).
- `decided_by` must be filtered in the **serializer**, not only the UI.
- Message is untrusted user text: render as text only.
- Approve/decline endpoints and `ProjectRequesterSerializer` stay backward compatible.
- Do not modify `ProjectRequestersDialog`; no modal-in-modal.
- The list is a first version: simple styling and no pagination/filtering are acceptable.
- Code lives in new files where possible; `ProjectPageRoot.tsx` is already large.

## Out of Scope

- **Respond** (start chat) — #2311.
- **Cancel** by the requester, showing status after a decision elsewhere on the page.
- Mailjet email / notification content changes (including linking notifications to the new deep link — good follow-up).
- Organization join requests.
- Listing decided requests (history list); the new list shows open requests only.
- Polishing the list (pagination, filters, bulk actions) and retiring the old modal.

---

## Open Questions

0. **List placement on the team tab** (above members vs. side panel) — no mockup yet; left to implementation.
1. **Deep link host page.** The issue comment says project tabs should become real pages first. Until then the param works on the current tabbed page via the team tab (hash `#team`). Should this wait for the tab→pages change, or ship on the current page and move the param with it later? *Recommendation: ship now; the param is route-agnostic.*
2. **Who may view a request?** Spec says admins + requester. Confirm the requester access is wanted now (issue text mentions it as a motivation), otherwise restrict to admins and add requester access with the cancel story.
3. **Param name** `join_request` vs. reusing `show_join_requests` — spec proposes a new one since the old opens the list.
4. **Toggle**: reuse `PROJECT_JOIN_REQUEST_CONFIRMATION` or add `PROJECT_JOIN_REQUEST_DIALOG`? Spec reuses it so v2 ships as one unit.

## Risks

- #2309 stores no decider for historical decisions → `decided_by` is `null`; the UI must show "Approved" without a name, not "by unknown".
- `ManageJoinProjectView.post` swallows exceptions into a generic 500 — surface errors in the dialog gracefully.
- Approve flow creates a notification and adds a member; the dialog must refresh the team list, not only its own state.
- Admins who lose permission while the dialog is open → the next action returns 401/403; show `texts.no_permission`.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-11-09 | First draft from issue #2310 and current code. |
| 0.2 (Draft) | 2026-11-09 | Per colleague: dialog opens from a new open-requests list on the team page; legacy modal untouched. |
