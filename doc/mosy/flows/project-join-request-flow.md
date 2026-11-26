# Project Join Request Flow

Feature toggle: `PROJECT_JOIN_REQUEST_CONFIRMATION` (spec `doc/spec/20261012_1000_project_join_request_confirmation_and_message.md`).

## Toggle on (logged-in user)

1. User opens a project page and clicks **Join** (`JoinButton`).
2. `JoinRequestDialog` opens with an explanation, an optional message field (max 500 characters, counter `n / 500`), **Cancel** and **Send join request**.
3. Cancel / Escape / backdrop click closes the dialog; nothing is sent and the draft is discarded.
4. **Send join request** trims the message and strips HTML tags, then calls `POST /api/projects/<url_slug>/request_membership/<user_slug>/`. Both buttons are disabled while the request is in flight.
5. Success: dialog closes, success feedback is shown, the button switches to "Requested".
6. "Request already exists to join project": same as success (feedback, button switches to "Requested", dialog closes).
7. Any other error: error feedback is shown and the dialog stays open so the user can retry.

The backend always (independent of the toggle) treats `message` as optional, rejects messages containing HTML and messages longer than 500 characters with `400`.

## Toggle off, or logged-out user

Clicking **Join** sends the request immediately with an empty message (no default text any more; spec `20261126_1000_issue_2308_join_request_message_in_admin_email.md`). Otherwise unchanged legacy behaviour.

## Notification of project admins (independent of the toggle)

After a join request is created, the backend notifies every project admin in-app and by email (spec `20261126_1000_issue_2308_join_request_message_in_admin_email.md`). The email contains the requester's message only when one was written (optional plain text; no message block when empty). The EN/DE Mailjet templates are maintained by hand in Mailjet (not in the repo) and must show the message block conditionally. The in-app notification text does not include the message.

## Viewing a join request (toggle on; spec `20261109_1000_issue_2310_show_join_request_dialog.md`)

**Admin**
1. On the project **team** tab an "Open join requests" list (`OpenJoinRequestsList`) shows open requests, newest first (avatar, name, date, message preview).
2. Clicking a row opens `JoinRequestDetailDialog` and sets `?join_request=<id>` (shallow `router.replace`); closing removes it.
3. The dialog loads `GET /api/projects/<url_slug>/join_requests/<id>/` and shows profile, request date, status chip, message and, for decided requests, who decided.
4. For a pending request **Approve** / **Decline** call the existing `request_membership/<approve|reject>/<id>/` endpoint; the dialog reloads with the new status, the list and the side-button badge refresh, and after an approval the team members are reloaded.

**Requester**: opens a link with `?join_request=<id>#team` and sees their own request (status, message) without actions and without the deciding admin.

**Deep link**: `<project>?join_request=<id>#team` opens the dialog after mount, also for decided requests. Logged out: login prompt with redirect back; unknown id: "not found"; no access: "no permission".

**Legacy entry points**: with the toggle on, `?show_join_requests=true` (join request emails and notifications) and the admin's "show requests" side button switch to the team tab instead of opening the legacy `ProjectRequestersDialog`. Linking emails/notifications to the request's own dialog is a separate task.

With the toggle off the list and the `join_request` param are ignored, and `show_join_requests` and the side button open the legacy requesters modal as before.
