# Project Join Requests — 2. Include the optional message in the email to admins

**Status**: IMPLEMENTATION (spec complete, no open questions; branch `send-optional-join-request-message-in-email`)
**Type**: Full-stack, small: backend email variable + frontend default-message removal + manual Mailjet template change (EN + DE)
**Date created**: 2026-11-26
**GitHub Issue**: [#2308](https://github.com/climateconnect/climatehub/issues/2308) (milestone "Join Requests v2")

**Part of Epic**: "Join Requests v2" (guarded by feature toggle `PROJECT_JOIN_REQUEST_CONFIRMATION`, enabled locally only).
**Related**: #2307 (confirmation dialog + message, spec `20261012_1000_project_join_request_confirmation_and_message.md`, which explicitly left the email out of scope), #2310 (show request dialog, spec `20261109_1000_issue_2310_show_join_request_dialog.md`).

**Touches** (areas, not a design):
- `backend/organization/utility/email.py` (`send_join_project_request_email`)
- `frontend/src/components/project/ProjectPageRoot.tsx` (`handleSendProjectJoinRequest`)
- Mailjet templates behind `PROJECT_JOIN_REQUEST_TEMPLATE_ID` / `PROJECT_JOIN_REQUEST_TEMPLATE_ID_DE` (edited by hand in the Mailjet dashboard, not in the repo)
- Docs: `doc/environment-variables.md`, `doc/mosy/flows/project-join-request-flow.md`

---

## Problem Statement

A join request to a project can carry an optional message from the requester. Since #2307 the message is stored on the request, but nobody sees it: the email that notifies project admins about a new join request does not contain it. The message is exactly the context an admin needs to decide whether to accept or reject a prospective team member, and the email is the first (and often only) place the admin looks.

**What we want**: when a join request has a message, the admin notification email shows it. When there is no message, the email looks as it does today: no empty box, no empty quotation marks, no dangling heading.

**Why it matters**: admins can make an informed decision straight from the email, and the effort requesters put into writing a message is not wasted.

### Current state

- `send_join_project_request_email` sends the Mailjet variables `RequesterName`, `FirstName`, `ProjectName` and `url`. The request's message is not among them.
- `MembershipRequests.message` is optional (nullable, may be empty). The create endpoint stores `""` when the client sends nothing, rejects HTML and enforces 500 characters (#2307).
- **Old default message**: `handleSendProjectJoinRequest` in `ProjectPageRoot.tsx` still falls back to the hard-coded text `"Would like to join the project!"` whenever it is called without a message. That is the toggle-off / logged-out path (the only caller without a message is `JoinButton`'s legacy branch). That path therefore always stores a non-empty message, which would appear in the email as if the requester had written it. This is the only occurrence in application code; the backend has no default of its own.
- **Why the default exists**: until #2343 (#2307) the create endpoint required the `message` key (`required_params` was `["user_availability", "message"]`, a missing key returned 400), so the frontend always had to send some text. #2343 made the message optional: a missing key, `null` or `""` is accepted and stored as `""` (covered by `test_empty_and_missing_message_accepted`). The default text is therefore obsolete, and it is safe to remove it without any backend change. `user_availability` stays required; the frontend keeps sending it.

### Feature toggle consideration

This task only **adds an optional template variable** and **removes** a hard-coded fallback. It must be safe with the toggle **on and off**, so it is **not** put behind the toggle:

| Toggle | Requester path | Stored message | Email shows message block? |
|---|---|---|---|
| on (logged-in) | confirmation dialog, requester may type a message | what the requester typed, or `""` | only if typed |
| off / logged-out | immediate send, no dialog | `""` (default text no longer sent) | no |

Consequence: with the toggle off nobody has a message, so the admin email stays identical to today. The only change visible to existing users is that the meaningless default text is no longer stored.

---

## User Stories

- As a **project admin**, I want to read the requester's message in the join request email, so that I can decide whether to accept or reject without opening the platform first.
- As a **project admin**, I want an email without a message to look unchanged, so that I am not confused by empty sections.
- As a **requester** who does not write a message, I do not want a made-up default sentence presented to the admin as my words.
- As a **maintainer**, I want the change to work with the feature toggle on and off, so that it can ship ahead of the rest of the epic.

---

## Acceptance Criteria

### AC-1: Backend: message is passed to the email

> **Reference implementation (hint, not a requirement)**: the closest existing pattern is the email to a guest when an **admin cancels** their registration (`send_guest_cancellation_notification` in `organization/utility/email.py`, variable `OrganizerMessage`, template `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID`): an optional plain-text message is passed unchanged to Mailjet and the template shows it only when non-empty (`{% if var:OrganizerMessage != "" %}`). Follow its conventions and reuse what fits: variable passed as plain text, docstring listing the Mailjet variables, env variable documentation, and the test style in `organization/tests/test_event_registration_admin_cancel.py`. Do not confuse it with the **guest self-cancel** flow (`EventRegistrationsView.delete`): there the optional message is stored on the registration (`cancellation_reason`) and delivered to the organiser as a chat message, with no Mailjet variable, so it is not a model for this task. Differences from the admin-cancel email: there the email is only triggered when the admin entered a message (`if message:` in the view), whereas the join request email is always sent for every request and merely gains the variable, so the template's `{% if %}` is what hides the block when it is empty. The admin-cancel view limits the message to 1000 characters; join requests are already validated at 500 on write (#2307), so no new validation is needed here.

- **AC-1.1** `send_join_project_request_email` passes the request's message to Mailjet as a new template variable `RequesterMessage`. The variable is **always present** in the payload, so the template never has to guess whether it exists.
- **AC-1.2** A request without a message (empty string or `NULL`) results in an **empty string**, never `None` and never the text "None".
- **AC-1.3** The value is passed as **plain text, exactly as stored**: no escaping, no HTML conversion and no `<br>` insertion in Python. This is the same approach as the existing admin cancellation email (`OrganizerMessage`). The message is plain text by contract (the create endpoint rejects HTML tags, #2307) and the template shows it as text inside a `div` using the normal double-brace output (see instructions), so no raw-HTML variable is needed. Line breaks are preserved by the template's styling (AC-3.3), not by the backend.
- **AC-1.4** The stored message is never modified, neither in the database or API responses nor when building the email variables (apart from `NULL` becoming `""`, AC-1.2).
- **AC-1.5** All existing variables (`RequesterName`, `FirstName`, `ProjectName`, `url`), the subject lines, the user-setting check (`email_on_join_request`) and the hub handling are unchanged.
- **AC-1.6** The message is **not** added to the in-app notification text (`Notification.text`) or anywhere else. Scope is the email only.
- **AC-1.7** Deploy-order: sending the new variable to a template that does not (yet) reference it is harmless, so the **backend can go live before the template edit**. The reverse order is **not** safe: the templates follow the existing convention (no default values, as in the event templates), and Mailjet raises a template error for a completely undefined variable. So the template edit must happen **after or together with** the backend deployment.

### AC-2: Frontend: old default message is gone

- **AC-2.1** `handleSendProjectJoinRequest` no longer sends the text "Would like to join the project!". When called without a message (legacy path) it sends an **empty string** for `message`. The backend accepts a missing, `null` or empty message (verified, see "Why the default exists"); sending the key explicitly with `""` is preferred because it stays valid against any backend version that still required the key.
- **AC-2.2** With the toggle **on**, behaviour is unchanged: the dialog's message (possibly empty) is sent as typed.
- **AC-2.5** Comments that describe the removed default behaviour are updated in the same change (`handleSendProjectJoinRequest` call site in `ProjectPageRoot.tsx`, and the prop comment on `handleSendProjectJoinRequest` in `JoinButton.tsx`).
- **AC-2.3** No other occurrence of the old default text remains in application code (frontend, backend, translations). Documentation mentions are updated (AC-5).
- **AC-2.4** The legacy flow (toggle off) still sends the request immediately and shows the same feedback and "Requested" state as before. Only the stored message differs.

### AC-3: Mailjet templates (EN + DE): manual, see instructions below

- **AC-3.1** Both templates (`PROJECT_JOIN_REQUEST_TEMPLATE_ID` EN and `..._DE`) show the message block **only when the message is non-empty**.
- **AC-3.2** The template prints `RequesterMessage` with the normal double-brace output inside a `div` (as text), never with a raw-HTML variable form, and without wrapping functions.
- **AC-3.3** Line breaks typed by the requester are visible: the `div` that holds the message preserves line breaks through its styling (`white-space: pre-wrap`). **Manual test result (2026-11-26): not met in the rendered email, accepted as a known limitation** (maintainer). The backend delivers the `\n` characters unchanged (covered by backend tests), so this is purely a rendering matter in the Mailjet template or mail client. Not a blocker; a possible follow-up is the template or a `<br>` conversion in the backend.
- **AC-3.4** A request without a message renders an email with **no** message block, no heading and no empty quotation marks.
- **AC-3.0** Testing set-up: local development uses the **same Mailjet templates** as the other environments, so the maintainer edits the templates once, before local testing; the special-character check (AC-3.5) is then done locally with real join requests. Implementation must therefore be testable locally with the real send path (no mocking in manual tests). Until the maintainer has edited the templates, the backend variable is simply ignored (AC-1.7).
- **AC-3.5** Both templates are verified with Mailjet's preview/test send for: with message, without message, and a message with special characters and line breaks as they can really be stored (`I <3 climate & Tom &amp; Jerry "quoted"`, entity-encoded text like `&lt;script&gt;`, emoji, several lines). Expected: the text appears exactly as written, nothing is interpreted as markup, and the lines stay separate. **If the preview shows any character mangled or interpreted as markup, stop and report it: the spec then needs the escaping variant (backend escapes before sending).**

### AC-4: Tests

- **AC-4.1** Backend (in `organization/tests/`, new file): `send_join_project_request_email` called with a request that has a message passes `RequesterMessage` in the variables unchanged (including `I <3 climate & Tom &amp; Jerry "quoted"`, `&lt;script&gt;`, line breaks and emoji: no escaping, no `<br>`); `""` and `None` both give `""`; the stored message on the request object is untouched; existing variables still present. Mock `send_email` (or the Mailjet client), never call the real API.
- **AC-4.2** Backend: creating a join request **without** a `message` key stores `""` (already covered by `test_project_join_request_message.py`, keep it green).
- **AC-4.3** Frontend (jest): the legacy send path (no message) posts an empty `message` and **not** the old default text; the toggle-on path posts the typed message. This is a **new** test: no existing test inspects the join request POST payload (`ProjectPageRoot.test.tsx` mocks `apiRequest` without such a case, `JoinButton.test.tsx` only asserts the handler call), so budget effort for it.
- **AC-4.4** Existing tests that patch `send_join_project_request_email` (e.g. `test_rejoin_project_team.py`) stay green with unchanged intent.

### AC-5: Documentation

- **AC-5.1** `doc/environment-variables.md`: add a "Project join request template variables" table (EN and DE templates) in the style of the existing template tables, listing `RequesterName`, `FirstName`, `ProjectName`, `url` and the new `RequesterMessage` (plain text, may be empty, show it as text in a `div` with `white-space: pre-wrap`, wrap in a condition).
- **AC-5.2** `doc/mosy/flows/project-join-request-flow.md`: replace the statement that the legacy flow sends the default message "Would like to join the project!" with the new behaviour (empty message), and mention that the admin email includes the message when present.
- **AC-5.3** The docstring of `send_join_project_request_email` lists the Mailjet variables (same style as `send_organizer_message_to_guest`).

---

## Mailjet Template Instructions (manual, EN + DE)

> Done by hand in the Mailjet dashboard. Repeat for **both** templates: English = template ID in `PROJECT_JOIN_REQUEST_TEMPLATE_ID`, German = template ID in `PROJECT_JOIN_REQUEST_TEMPLATE_ID_DE`.

### How it works (what matters for the instructions)

- The backend already sends `"TemplateLanguage": true`, so Mailjet's template language is active: `{{var:Name}}` prints a variable, `{% if ... %} ... {% endif %}` is a condition. (Source: Mailjet Template Language Reference, dev.mailjet.com.)
- **Follow the pattern of the existing templates.** The backend always sends the variable (empty string when there is no message), so the template needs no default values and uses the same condition style as the event emails, e.g. `{% if var:OrganizerMessage != "" %}{{var:OrganizerMessage}}{% endif %}` (admin cancellation) and `{% if var:OrganiserName != "" %}...{% endif %}`.
- **Plain text in a `div`.** The backend sends `RequesterMessage` as plain text, exactly as the requester wrote it. The template prints it with normal double braces inside a `div` (like `{{var:OrganizerMessage}}` in the cancellation template). Do not use a raw-HTML variable form and do not wrap it in `Escape()`. Line breaks are kept by `white-space: pre-wrap` on the `div`.
- Unused variables sent by the backend are ignored, so the backend may go live **before** the template edit. Not the other way round: a template that references a variable the backend does not send yet raises a template error (see AC-1.7).

### New variable

| Variable | Content |
|---|---|
| `RequesterMessage` | Optional message the requester wrote. **Plain text**, exactly as stored, line breaks as `\n`. **May be an empty string.** |

Existing variables (unchanged): `RequesterName`, `FirstName`, `ProjectName`, `url`.

The name is case-sensitive and must match exactly between template and backend.

### Steps

1. Mailjet → **Transactional** → **Templates**. Open the template with the ID from `PROJECT_JOIN_REQUEST_TEMPLATE_ID` (EN). Edit it in place (do not create a new one, the ID must stay). Tip: duplicate it first as a backup.
2. Decide where the message goes: **between the sentence "<name> requested to join <project>" and the button/link** that opens the project. Keep it visually secondary to the button.
3. Add the block. In the drag-and-drop editor use three consecutive blocks, because a condition may open and close in different blocks:
   1. a **Template Language** block containing exactly: `{% if var:RequesterMessage != "" %}`
   2. a **Text** (or HTML) block with the visible content, see below
   3. a **Template Language** block containing exactly: `{% endif %}`

   Visible content (adapt the look to the template). If the **Text** block cannot keep line breaks, use the HTML block variant below instead; the message must sit in a `div` with `white-space: pre-wrap`:

   ```
   Message from {{var:RequesterName}}:
   {{var:RequesterMessage}}
   ```

   If you prefer a single HTML block (keep condition and HTML together in the same HTML block as Mailjet recommends):

   ```
   {% if var:RequesterMessage != "" %}
   <p style="margin:0 0 4px 0;"><strong>Message from {{var:RequesterName}}:</strong></p>
   <div style="margin:0 0 16px 0; padding:8px 16px; border-left:4px solid #cccccc; white-space:pre-wrap;">{{var:RequesterMessage}}</div>
   {% endif %}
   ```

   Rules: normal double braces only, message inside a `div` with `white-space: pre-wrap`, no `Escape()`, every `{% if %}` has its `{% endif %}`.
4. **German template**: same structure, German copy. Suggested heading: `Nachricht von {{var:RequesterName}}:`.
5. **Do not change** the template ID. The subject is set by the backend, so leave it.
6. **Verify** each template with Mailjet *Preview* / *Send a test email*, using the test variables (JSON):
   - With message:
     `{"RequesterName":"Ada Lovelace","FirstName":"Sam","ProjectName":"Solar Roof","url":"https://example.org","RequesterMessage":"Hi!\nI <3 climate &amp; Tom \"quoted\" &lt;script&gt; 🌍"}`
     (the backend sends the stored text unchanged). Expected: block visible, text shown exactly as written (`I <3 climate &amp; Tom "quoted" &lt;script&gt;` literally), two separate lines, emoji renders, layout intact.
   - Without message: same JSON with `"RequesterMessage":""`. Expected: **no** heading, no box, no stray gap.
   (The backend always sends the variable, so there is no "variable missing" case to support. Mailjet raises a template error for a completely undefined variable; that is acceptable because the backend and the template are changed for the same release, but **deploy the backend first or together with the template edit** so the template never runs without the variable. See AC-1.7.)
7. Repeat steps 1-6 for the German template; check umlauts.
8. After the backend is deployed, do an end-to-end check on staging (toggle on): one join request with a message and one without; check both emails in EN and DE (switch the admin's language).

> **Syntax confirmed**: the condition style `{% if var:X != "" %}...{% endif %}` is already used in production by the event templates (admin cancellation message, organiser name), so no syntax doubt remains. A Mailjet preview is still part of the verification (step 6).

---

## Constraints

- **No model change, no migration.**
- **Not behind the feature toggle**; safe with toggle on and off (see table above).
- The message is **plain text** passed through unchanged (like the admin cancellation message); the template shows it as text in a `div`. No raw-HTML variable is used.
- No new personal data beyond the message the requester already chose to send to the project admins.
- Mailjet payload additions are additive only; no existing variable is renamed or removed.
- Do not change the in-app notification, chat or the join request detail dialog in this task.

## System impact

Written by Archie on 2026-11-26. Checked against the working tree (not `.claude/worktrees/` copies): `organization/utility/email.py`, `organization/utility/notification.py`, `organization/views/project_views.py` (`RequestJoinProject`), `organization/utility/requests.py`, `climateconnect_api/utility/email_setup.py` (`send_email`), `ProjectPageRoot.tsx`, `JoinButton.tsx`, and all of `doc/mosy/`. `doc/mosy/` has no OpenAPI or AsyncAPI spec, so none is affected. **No `doc/mosy/` file has been changed yet**: the proposed changes below await review.

### Affected actors, actions, flows

- **Project admin** (email recipient, Super-Admin/Administrator via `get_project_admin_creators`): receives one more optional piece of content in the existing join request email. Nothing else changes for them.
- **Requester** (logged-in user): with toggle off / legacy path, the stored message changes from the default sentence to empty. With toggle on nothing changes.
- **Flow: Project Join Request Flow** (`doc/mosy/flows/project-join-request-flow.md`): step "Toggle off, or logged-out user" changes (empty message instead of default text). The email notification is a side effect of the existing "create request" step; it is not described in the flow file today.
- **Other flows** (`core-flows.md` flows 1–12): no relevant system impact. The join request is not one of the numbered core flows.

### Entities

- `MembershipRequests`: **no change** (no field, no migration). `message` is already nullable/optional; the API limit (500) and plain-text rule (#2307) stay. The stored value is never altered (AC-1.4).
- `Notification`: no change (AC-1.6). `UserNotification`, `EmailNotification`: no change.
- `doc/mosy/entities/system-entities.md` entry `MembershipRequest` already lists `message: Text`. It is accurate and stays as is, apart from the optional clarification below.

### Integration points

- **Mailjet (external)**: one new, additive template variable `RequesterMessage` in the existing transactional send for `PROJECT_JOIN_REQUEST_TEMPLATE_ID` / `..._DE`. Contract: always present, plain text, may be empty. Mailjet is the only integration touched.
- **Manual dependency**: the templates live in the Mailjet dashboard, not in the repo. The feature is only visible to admins once both templates (EN + DE) are edited by hand. Until then, the backend variable is silently ignored (harmless, AC-1.7). No env variable and no template ID changes.
- **Failure behaviour (verified)**: `send_email` catches and logs all Mailjet errors, so a template or Mailjet problem never fails the join request itself. A template syntax error surfaces through Mailjet's `TemplateErrorReporting` mail to the maintainer, not to users. This is why the preview/test step (AC-3.5) matters.
- **Internal call chain**: `RequestJoinProject.post` -> `create_project_join_request_notification` -> `send_join_project_request_email` (one call per project admin) -> `send_email`. This is the only production caller of the email function; organisation join requests do not use it. The test `test_rejoin_project_team.py` patches the function at its use site in `notification.py`, so a changed signature or variable set does not affect it.
- **API contract**: the `request_membership` endpoint is unchanged (request and response). The frontend may omit `message` or send `""`; both already store `""`.

### Feature toggle behaviour

`PROJECT_JOIN_REQUEST_CONFIRMATION` is deliberately **not** used by this task. Toggle on: the typed message (or none) reaches the email. Toggle off / logged-out: the stored message is empty, so the email is unchanged for admins. The email is sent by the backend regardless of the toggle. The toggle table in the spec is accurate.

### `doc/mosy/` changes: approved by the maintainer on 2026-11-26 (to be applied by Archie after implementation, in the VALIDATION phase)

| File | Proposed change | Needed? |
|---|---|---|
| `flows/project-join-request-flow.md` | In "Toggle off, or logged-out user": replace the default-message sentence with: the request is sent immediately with an empty message. Add a short, toggle-independent note (e.g. under the backend sentence in the "Toggle on" part or a new "Notification" part): after creating the request the backend notifies each project admin in-app and by email; the email contains the requester's message when one was written, nothing otherwise. Mention that the Mailjet templates (EN/DE) are maintained by hand and must show the message block. | **Yes** (after implementation) |
| `entities/system-entities.md` | Optional: in `MembershipRequest`, state that `message` is optional plain text (max 500 via API) and may be empty. Current text is not wrong. | Skipped (not approved, low value) |
| `architecture_overview.md` | Mailjet is already listed as external service. No new actor or service. | No relevant system impact |
| `flows/core-flows.md` | Join requests are not a numbered core flow; the flow lives in its own file. | No relevant system impact |
| `entities/feature-toggle-entity.md`, `flows/manage-feature-toggles-flow.md` | No toggle added or changed. | No relevant system impact |
| `flows/passwordless-login-flow.md`, `metrics/*` | Unrelated. | No relevant system impact |

Non-mosy documentation is covered by AC-5 (`doc/environment-variables.md` template variable table, docstring).

### Findings for Taskie

> **Status 2026-11-26**: findings 1, 2, 3 and 4 were folded into the acceptance criteria (findings 2: AC-2.5; 3: superseded by the plain-text decision, see AC-3.3; 4: AC-4.3; 1: AC-2.3 is read as "application code"). Findings 5 and 6 are cosmetic and accepted. Finding 7 remains open as Open Question 2.

Verified accurate: the only occurrence of the old default in application code is `ProjectPageRoot.tsx:369`; the backend has no default; `JoinButton`'s no-argument call is the only caller without a message; no existing test, translation or fixture asserts the old text; `test_rejoin_project_team.py` is unaffected. Discrepancies and gaps (acceptance criteria left unchanged):

1. **Other mentions of the old text.** The old text also appears in the earlier spec `20261012_1000_project_join_request_confirmation_and_message.md` (lines 25 and 32, describing the state *before* #2307). That is history, not application code, so AC-2.3 stays correct, but the "no other occurrence" check will find it if run over `doc/`. Suggest: leave as is, and word the implementer's check as "application code".
2. **Stale comments next to the default.** `ProjectPageRoot.tsx:368` (comment "keep sending the old default text") and the prop comment in `JoinButton.tsx:50-51` ("sends the legacy default message") describe the removed behaviour and will be wrong afterwards. Not covered by an AC. Suggest: mention in AC-2 or the implementer notes that these comments are updated with the change.
3. ~~Line-break normalisation.~~ Superseded 2026-11-26: the backend no longer converts line breaks; the template keeps them via `white-space: pre-wrap` (AC-3.3).
4. **AC-4.3 needs a new test, not an adaptation.** `ProjectPageRoot.test.tsx` mocks `apiRequest` but has no test of the join-request payload, and `JoinButton.test.tsx` only asserts the handler call. A test that checks the POST payload of `handleSendProjectJoinRequest` therefore has to be written from scratch (render path through `ProjectPageRoot` or an extracted function). Suggest: note this as effort, not as a risk.
5. **"Touches" list.** It lists `doc/mosy/flows/project-join-request-flow.md` only, which is right. It does not list the `JoinButton.tsx` comment (finding 2) or the new test files. Cosmetic.
6. **Wording in the Problem Statement.** "the only caller without a message is `JoinButton`'s legacy branch" is correct. The spec also mentions logged-out users in the legacy path; note that `JoinButton` computes `useConfirmation = !!user && toggle`, so a logged-out user is routed to the legacy immediate send, which in practice leads to the login redirect rather than a request. No discrepancy for this task, just confirming the toggle table row "off / logged-out" is about the code path, not an actual stored request.
7. **Mailjet syntax** is now confirmed by existing production templates (open question 2 resolved). The residual risk is only the manual template edit itself; the Mailjet preview and the staging check cover it.
8. **Notification text.** The in-app `Notification.text` ("... wants to join your project ...!") is unchanged by design (AC-1.6). Confirmed: nothing else in the backend reads `MembershipRequests.message` for email or notification purposes.

---

## Out of Scope

- Showing the message in the in-app notification or the join request detail dialog (#2310 covers the dialog).
- Pointing the email link at the individual request (`?join_request=<id>`), a separate follow-up listed in #2310.
- Changing the confirmation dialog, message limits or validation (#2307).
- Emails to the requester (approval/rejection).
- Organisation join requests.
- Automating Mailjet template management (templates stay hand-edited, as for all other templates).
- **Cleaning up existing join requests that stored the old default text** "Would like to join the project!". Tracked as a separate task (to be created by the issue author). This task only stops new requests from storing it.

---

## Open Questions

1. ~~Heading wording / design of the message block.~~ **Resolved (2026-11-26):** left to the maintainer while editing the templates; the copy in the instructions is only a suggestion and does not block implementation.
2. ~~Mailjet syntax check.~~ **Resolved (2026-11-26):** the `{% if var:X != "" %}` style is already used by production templates (event cancellation message, organiser name); the instructions follow it.
3. ~~Old default text in existing data.~~ **Resolved (2026-11-26): out of scope.** Cleaning up existing requests is a separate task to be created by the issue author; it belongs with the work that shows the message in the UI (#2310). Until it ships, #2310's dialog may show the old default text for pre-existing requests.

## Risks

- **Template/backend mismatch**: wrong variable name in the template means the block never shows, silently. Mitigated by the preview test data and the staging end-to-end check.
- **Rendering of special characters in Mailjet**: the design relies on Mailjet showing a `{{var:...}}` value as text (as the existing cancellation template does). If the preview shows that characters such as `<`, `&` or entity text are mangled or interpreted, the backend must escape before sending instead. Mitigated by the special-character preview test (AC-3.5) before go-live.
- **Legacy callers**: any caller of `handleSendProjectJoinRequest` relying on the default text now sends an empty message. Current search shows only `JoinButton` (legacy path and dialog path).

---

## Task Log

| Date (UTC) | Entry |
|---|---|
| 2026-11-26 | Spec drafted from issue #2308 and code review (`email.py`, `notification.py`, `project_views.py`, `ProjectPageRoot.tsx`, `JoinButton.tsx`, `email_setup.py`). Toggle impact analysed: change is additive/removal-only, works on and off. Mailjet syntax checked against the official Template Language Reference: no automatic HTML escaping, hence escaping in the backend. |
| 2026-11-26 | Review feedback: corrected escaping rationale (write side already rejects HTML; escaping preserves stored text exactly), realistic test data; cleanup of old default texts moved out of scope (separate task by issue author). |
| 2026-11-26 | Archie: System impact analysis performed (flows, entities, Mailjet integration, toggle behaviour, `doc/mosy/` proposals). No entity or API contract change; one `doc/mosy/` file needs an update after implementation (proposal awaits user review, nothing applied). Eight findings for Taskie listed in the System impact section. |
| 2026-11-26 | Verified via git history (#2343) that the create endpoint formerly required `message` and now accepts a missing, null or empty message. That is why the frontend default existed and why it can be removed with no backend change. Archie findings 1-4 folded into the ACs (AC-1.3, AC-2.1, AC-2.5, AC-4.1, AC-4.3). |
| 2026-11-26 | Mailjet instructions aligned with the existing production templates (user-supplied examples): condition `{% if var:X != "" %}`, no default values. Consequence: backend must be deployed before/with the template edit (AC-1.7). Syntax open question resolved. |
| 2026-11-26 | Decision (maintainer): the message is plain text, sent unchanged and shown by Mailjet as text in a `div` (no raw-HTML variable). Backend escaping and `<br>` conversion removed from AC-1.3/AC-4.1; line breaks via `white-space: pre-wrap` in the template; special-character rendering to be verified in the Mailjet preview (AC-3.5). |
| 2026-11-26 | Maintainer: the join request message is the same use case as the admin cancellation message, so the implementation should follow that example and reuse parts (added as a reference-implementation hint to AC-1). `doc/mosy/` change to `project-join-request-flow.md` approved; the optional `system-entities.md` note is skipped. |
| 2026-11-26 | Correction of the reference hint (twice): there are two cancellation flows. Admin cancels a guest: optional message goes into the Mailjet variable `OrganizerMessage` (email only triggered when a message is given), this is the model. Guest self-cancels: optional message is stored as `cancellation_reason` and sent to the organiser as a chat message, no Mailjet variable, not a model. Hint reworded accordingly. |
| 2026-11-26 | All questions resolved. Maintainer will edit the Mailjet templates himself and test locally (same templates locally and elsewhere), including the special-character check. Spec committed on branch `send-optional-join-request-message-in-email`; status set to IMPLEMENTATION; handed to an implementation sub-agent. |
| 2026-11-26 | Implementation done by sub-agent (backend variable, frontend default removed, tests, env docs); verified independently: 30 backend and 24 frontend tests pass, formatting clean. Maintainer's manual local tests with the edited templates passed (message shown, no-message email without block, special characters as written). Only line breaks do not show in the rendered email: accepted as a known limitation (AC-3.3). Open point noted: Mailjet blocks an email on an undefined variable without default, so the template edit must not reach production before the backend (see AC-1.7), unless defaults are added to the template. |

## AI Agent Insights and Additions

- The issue says "Be careful, right now the frontend sets a default message". Verified: the only occurrence in application code is `ProjectPageRoot.tsx` (`message ?? "Would like to join the project!"`). The backend already treats a missing message as empty, so no backend default exists to remove.
- The issue suggests no feature toggle is needed once the default is removed. Confirmed by the toggle table above.
- Plain-text decision (maintainer, 2026-11-26): the message is sent unchanged, as the admin cancellation message already is, and the template shows it as text in a `div`; a raw-HTML variable is deliberately avoided. The write side already rejects HTML tags (`is_plain_text`, #2307; the frontend `toPlainText` strip is only a convenience). An earlier draft had the backend escape and add `<br>`; that was dropped. The one thing to verify in the Mailjet preview is that special characters show as written (AC-3.5).
- Existing rows holding the old default text are deliberately not touched here (separate cleanup task, see Out of Scope).
- `send_email` always sends `"TemplateLanguage": True`, so conditionals are available and always sending the variable (empty string) keeps the template condition simple.
- **System impact** analysis was done by Archie on 2026-11-26 (see section above).

---

## Revision History

| Version | Date | Changes |
|---|---|---|
| 0.1 (Draft) | 2026-11-26 | First draft from issue #2308 and current code. |
| 0.2 (Draft) | 2026-11-26 | Escaping rationale corrected, test data made realistic, old-default-text cleanup declared out of scope. |
| 0.3 (Draft) | 2026-11-26 | System impact section added by Archie (no entity change; Mailjet template contract and manual step; `doc/mosy/` proposals, since approved; findings for Taskie). |
| 0.4 (Draft) | 2026-11-26 | Rationale for the old default documented (message was a required API parameter until #2343); AC-2.1 stated as fact (send empty string); new AC-2.5 (stale comments); line-break variants in AC-1.3/AC-4.1; AC-4.3 marked as new test. |
| 0.5 (Draft) | 2026-11-26 | Mailjet condition/print syntax simplified to match existing templates (no `:""` defaults); AC-1.7 deploy order corrected (backend first); syntax open question resolved. |
| 0.6 (Draft) | 2026-11-26 | Plain-text decision: no backend escaping or `<br>`; template uses a `div` with `white-space: pre-wrap`; ACs 1.3, 1.4, 3.2, 3.3, 3.5, 4.1, 5.1, risks and insights updated. |
| 0.7 (Draft) | 2026-11-26 | Reference-implementation hint (admin cancellation email) added to AC-1; `doc/mosy/` flow change approved, optional entity note skipped. |
| 0.8 | 2026-11-26 | Status IMPLEMENTATION; AC-3.0 (testing set-up with shared templates) added; open questions closed. |
| 0.9 | 2026-11-26 | Manual test results recorded; AC-3.3 line breaks accepted as known limitation. |
