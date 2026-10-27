# Review: Project join request – confirmation step and optional message

- **Issue:** [climateconnect/climatehub#2307](https://github.com/climateconnect/climatehub/issues/2307) – "Project join requests - 1. Include confirmation step and optional message"
- **Branch:** `project-join-request-confirmation-optional-message` (compared to `master`)
- **Date:** 2026-10-27
- **Spec reviewed alongside (not source of truth):** `doc/spec/20261012_1000_project_join_request_confirmation_and_message.md`

## Outcome

**Changes requested.** The frontend matches what the issue asks for. The backend has one security defect, uses a feature toggle that isn't wanted there, and contains an unrequested admin change.

## What the issue asks for vs. the branch

| Requirement (#2307) | Status |
|---|---|
| Join button opens a modal dialog with an optional message, Cancel and "Send join request" | ✅ `JoinRequestDialog.tsx`, left-aligned (not the centred mock-up) |
| Join request is only created when Send is clicked | ✅ |
| Message limited to 500 characters | ✅ frontend cap + counter (counted in code points); backend rejects > 500 |
| Message is plain text, no HTML/JS: sanitized in frontend **and** backend | ⚠️ frontend OK; backend can be bypassed (see F1) |
| Optional message is stored in the backend | ✅ |
| Changes placed behind a feature toggle | ✅ frontend; backend should not use the toggle (see F2) |

## Findings

### F1 – Must fix: backend sanitizer turns entity-encoded HTML back into markup

`backend/organization/utility/requests.py` – `sanitize_membership_request_message` runs `unescape(strip_tags(...))`. Because entities are decoded *after* tags are stripped, encoded markup comes back as real HTML:

```
'&lt;script&gt;alert(1)&lt;/script&gt;'  -> '<script>alert(1)</script>'
'&lt;img src=x onerror=alert(1)&gt;'      -> '<img src=x onerror=alert(1)>'
```

The frontend `toPlainText` only strips real tags, so these payloads also pass through the normal UI. Nothing renders the message today (the Django admin escapes it), but the follow-up task (API + Mailjet) would expose a stored XSS. `test_html_stripped` only covers literal tags.

**Recommendation:**
- Drop the custom `strip_tags` + `unescape` helper and reuse the existing sanitizer `sanitize_html` from `climateconnect_api/utility/html.py` with an empty allowlist (`allowed_tags=[]`, `allowed_attributes={}`).
- Bleach returns HTML-escaped output (`I <3` → `I &lt;3`). Storing that output would show `&lt;` in React and in plain-text emails. Instead, use it as a check: reject with 400 if `unescape(cleaned) != unescape(message)`, and otherwise store the trimmed original. Probe results with this rule:

  | Input | Result |
  |---|---|
  | `<b>Hi</b>`, `<script>x</script>`, `<<script>script>…` | rejected |
  | `I <3 climate`, `Tom & Jerry`, `Tom &amp; Jerry`, quotes, newlines, emoji | accepted unchanged |
  | `&lt;script&gt;…` | accepted, stored as inert text (never decoded) |

- Add a test for the entity-encoded case.
- Keep the frontend `toPlainText`. It strips tags before sending, so users normally never hit the backend rejection. No further custom regex is needed.

### F2 – Change: no feature toggle in the backend; `message` becomes optional

`backend/organization/views/project_views.py` (`RequestJoinProject.post`) currently switches on `PROJECT_JOIN_REQUEST_CONFIRMATION`:
- toggle off: `message` is **required** (400 if missing), stored unsanitized, no length limit (legacy);
- toggle on: `message` is optional (missing / `null` → `""`), sanitized, max 500.

The backend doesn't normally use feature toggles, and the message hasn't really been used so far, so the new behaviour can apply unconditionally:
- Remove `is_feature_enabled_for_current_environment` and its import from the view.
- Always treat `message` as optional, and always run the sanitizer and length check.
- Remove the toggle-off tests (`test_missing_message_rejected_without_toggle`, `test_toggle_off_keeps_legacy_behaviour`) and the `TOGGLE_PATH` patch.
- Keep the toggle migration `0008`, because the frontend still uses it for the dialog. Drop the "validates the message … in the backend" part from its description.
- Update the backend toggle parts of the docs: `doc/api-documentation.md`, `doc/mosy/flows/project-join-request-flow.md`, and spec AC-2.4 / AC-3.2 / AC-3.4 / AC-4.1.

This doesn't break anything: the current frontend always sends a `message` key, with the old default text when the toggle is off.

### F3 – Remove: admin view change (scope creep)

`backend/organization/admin.py` adds a `short_message` column (and the `Truncator` import) to `MembershipRequestsAdmin`. The issue doesn't ask for this. Revert the file to `master`.

### F4 – Consider: a click before the toggles load skips the dialog

`frontend/src/components/project/Buttons/JoinButton.tsx` – `isEnabled(...)` returns `false` until the toggles are fetched, so a click in that short window sends the request immediately with the legacy default text. Low impact. It can be closed by doing nothing on click while `isLoading` is true.

### F5 – Minor

- `JoinButton.test.tsx` prints React `act(...)` warnings when the dialog closes after an async send. The tests pass.
- The tag pattern is broad: both frontend and backend treat `<word …>` as a tag, so `I <love> this` loses `<love>` (frontend) or would be rejected (backend). This is acceptable for a plain-text field.

## Verified OK / no regressions found

- With the toggle off, the frontend behaves as before: immediate send with the default message.
- A frontend/backend toggle mismatch still works, because the frontend always sends the `message` key.
- A duplicate request ("Request already exists") closes the dialog and marks the user as having requested.
- A failed send keeps the dialog open; both buttons are disabled while sending, so a double submit is blocked.
- Cancel discards the draft, and an empty message is sent as `""`.
- Logged-out users keep the legacy path. The pre-existing behaviour there is unchanged by this branch.
- Migration `feature_toggles/0008` correctly depends on `0007`, the latest on `master`.

## Test runs

- Frontend: `JoinButton.test.tsx` – 10/10 passed.
- Backend: `manage.py test organization feature_toggles` – 796 tests OK (15 skipped), including the new `test_project_join_request_message.py`.
- The full backend suite was **not** run.

## Required changes (summary)

1. Replace the backend sanitizer with a plain-text check based on `sanitize_html` (F1), and add a test for entity-encoded input.
2. Remove the backend feature toggle; make `message` optional; adjust the tests, migration description and docs (F2).
3. Revert `backend/organization/admin.py` (F3).
4. Optional: guard the click while the toggles are loading (F4).
