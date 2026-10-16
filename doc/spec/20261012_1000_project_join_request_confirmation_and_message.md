# Project Join Requests — 1. Confirmation Step and Optional Message

**Status**: DRAFT
**Type**: Full-stack — feature (backend validation + frontend modal)
**Date created**: 2026-10-12
**GitHub Issue**: [#2307](https://github.com/climateconnect/climatehub/issues/2307) (milestone "Join Requests v2")

**Blocks**: #2310 — "Project join requests - 3. Show request dialog"

**Depends on**:
- `MembershipRequests` model — `backend/organization/models/members.py` (already has `message`, max length 4096)
- `RequestJoinProject` view — `backend/organization/views/project_views.py` (`POST /api/projects/<url_slug>/request_membership/<user_slug>/`)
- `MembershipRequestsManager` — `backend/organization/utility/requests.py`
- `handleSendProjectJoinRequest` — `frontend/src/components/project/ProjectPageRoot.tsx`
- `JoinButton` — `frontend/src/components/project/Buttons/JoinButton.tsx`
- Feature toggles — `backend/feature_toggles`, `frontend/src/components/featureToggle`

---

## Problem Statement

Clicking "Join" on a project page immediately creates a join request. This causes:

1. **Accidental requests** — one misclick notifies project admins and cannot be undone by the user.
2. **No context for admins** — the frontend hard-codes `message: "Would like to join the project!"`, so admins learn nothing about why the person wants to join.

The join-request feature was never fully completed; this is the first of three steps (1 confirm + message, 2 TBD, 3 show request dialog to admins, #2310).

### Current state

- `JoinButton` calls `handleSendProjectJoinRequest` directly on click (three render variants, lines ~84/99/114).
- `handleSendProjectJoinRequest` posts `{ message: "Would like to join the project!", user_availability: "4" }`.
- `RequestJoinProject.post` requires `message` and `user_availability` in `request.data`, passes `message` unvalidated to `MembershipRequestsManager`, which stores it.
- The message is **not** returned by the API and **not** sent in the Mailjet email. Both are explicitly out of scope here (separate task).

---

## Acceptance Criteria

### AC-1: Confirmation modal (frontend)

- **AC-1.1** Clicking the join button no longer sends a request; it opens a modal.
- **AC-1.2** The modal contains: a title and short explanation, an optional multi-line message field, a character counter (`n / 500`), a **Cancel** button and a **Send join request** button.
- **AC-1.3** Cancel (and Escape / backdrop click) closes the modal, sends nothing, and discards the draft.
- **AC-1.4** **Send join request** calls the existing endpoint with the entered message; the button is disabled and shows a loading state while the request is in flight (prevents double submits).
- **AC-1.5** On success: modal closes, existing success feedback (`texts.your_request_has_been_sent`) is shown and `handleJoinRequest(true)` is called, as today.
- **AC-1.6** On error: error feedback is shown and the modal stays open, except for "Request already exists to join project" which keeps today's behaviour (feedback + `handleJoinRequest(true)`, modal closes).
- **AC-1.7** The field enforces a 500-character limit (`maxLength` + counter; pasted text is truncated). Empty message is allowed.
- **AC-1.8** If the user is not logged in, the existing logged-out join behaviour is unchanged (no modal).
- **AC-1.9** The message is trimmed and reduced to plain text before sending (strip HTML tags). When empty after trimming, the frontend sends the empty string (not the old default text).
- **AC-1.10** All copy is in `public/texts/` (en + de); modal is a MUI v7 component styled with `styled()`/`sx`, accessible (focus trap, labelled field, focus returns to the join button on close).

### AC-2: Backend validation and storage

- **AC-2.1** `message` is stored on `MembershipRequests.message` (no schema change).
- **AC-2.2** The backend sanitizes `message` to plain text (strip HTML tags, decode/normalize whitespace, trim) before storing. Frontend sanitization is not trusted.
- **AC-2.3** Messages longer than 500 characters (after sanitization) are rejected with HTTP 400 and a clear `message`; they are not silently truncated. Validation lives in a serializer or the manager, not in `full_clean()` (DRF does not call it).
- **AC-2.4** `message` may be empty. With the toggle on, a missing `message` key is treated as an empty message; with the toggle off, a missing key keeps returning 400 as today.
- **AC-2.5** Duplicate-request handling, availability handling and notification creation are unchanged.
- **AC-2.6** The 500 limit is a constant shared by validation and tests (e.g. `MEMBERSHIP_REQUEST_MESSAGE_MAX_LENGTH`), distinct from the 4096 column limit.

### AC-3: Feature toggle

- **AC-3.1** A new toggle `PROJECT_JOIN_REQUEST_CONFIRMATION` gates the new behaviour.
- **AC-3.2** Toggle **off**: join button behaves exactly as today (immediate send, default message); backend accepts the old payload and does not enforce the new 500 limit/sanitization differently than today.
- **AC-3.3** Toggle **on**: modal flow (AC-1) and backend validation (AC-2) apply.
- **AC-3.4** Frontend reads the toggle via `useFeatureToggles().isEnabled(...)` (default `false` while loading); backend uses `is_feature_enabled(...)`.

### AC-4: Tests

- **AC-4.1** Backend (`organization/tests/`): message stored; HTML stripped; 500 chars accepted, 501 rejected; empty message accepted; duplicate request still 4xx; toggle off keeps legacy behaviour.
- **AC-4.2** Frontend (jest): click opens modal and sends nothing; Cancel sends nothing; Send posts the entered message; counter/limit; button disabled while sending; error keeps modal open; toggle off → legacy immediate send.

### AC-5: Documentation

- **AC-5.1** `doc/api-documentation.md`: document the `message` constraints (≤500 chars, plain text) on `request_membership`.
- **AC-5.2** `doc/mosy/flows/`: add/update the join-request user flow with the confirmation step.
- **AC-5.3** `doc/domain-entities.md`: note that `MembershipRequests.message` is optional user text capped at 500 at the API level.

---

## Constraints

- No DB migration; column stays at 4096 so the limit can be raised later without a migration.
- Message is untrusted user text: always rendered as text, never HTML (relevant for #2310 and the email follow-up).
- No new dependencies if avoidable — use Django's `strip_tags` (+ `html.unescape`) on the backend and a small util on the frontend.
- API remains backward compatible while the toggle is off.
- Do not return the message from the API or send it via Mailjet in this task.

---

## Out of Scope

- Returning `message` in API responses and showing it to admins (#2310).
- Including the message in the Mailjet notification (separate task).
- Customizable `user_availability` (stays hard-coded to `"4"`).
- Withdrawing a request, organization join requests.

---

## Open Questions

None. Resolved decisions:

- **Missing `message` key**: accepted as empty when the toggle is on; stays a 400 when off.
- **Toggle**: `PROJECT_JOIN_REQUEST_CONFIRMATION`, shared with later "Join Requests v2" steps if they must ship together.
- **Plain text**: strip only real HTML tags; keep stray `<` / `>` characters (e.g. "I <3 climate").

---

## Risks

- Frontend/backend length counting differ for emoji/multi-code-point characters — count in Unicode code points on both sides (`[...str].length` / `len(str)`).
- Sanitizing after counting vs. before: validate length on the sanitized value on the backend, otherwise tag-stuffed input could pass or be wrongly rejected.
- `ProjectPageRoot.tsx` is large; keep the modal as its own component (`JoinRequestDialog`) rather than adding more state there.

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-10-12 | First draft from issue #2307 and current code. |
