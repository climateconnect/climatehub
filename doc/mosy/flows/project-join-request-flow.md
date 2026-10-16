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

The backend re-sanitizes the message and rejects more than 500 characters with `400`.

## Toggle off, or logged-out user

Clicking **Join** sends the request immediately with the default message "Would like to join the project!" (unchanged legacy behaviour).
