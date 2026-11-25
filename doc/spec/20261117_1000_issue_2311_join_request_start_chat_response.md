# Start a chat with the requester as response to a project join request

**Status**: DRAFT (open questions in the last section need a product decision before implementation)
**Type**: Full-stack — feature (backend endpoint + chat origin + frontend button)
**Date created**: 2026-11-17

**Issue**: [#2311 – Project join request - Start chat conversation as response](https://github.com/climateconnect/climatehub/issues/2311)
(milestone *Join Requests v2*; labels backend, frontend/React, frontend/UI; **blocked by #2310** "Show request dialog")

**Depends on**:
- `MembershipRequests` — `backend/organization/models/members.py` (`message`, `decided_by` from #2309 already present)
- `ManageJoinProjectView` / `RequestJoinProject` — `backend/organization/views/project_views.py`
- `MembershipRequestsManager` — `backend/organization/utility/requests.py`
- Chat helpers — `backend/chat_messages/utility/chat_setup.py` (`create_private_or_group_chat`, `check_can_start_chat`), `backend/chat_messages/utility/message_origin.py`, `backend/chat_messages/views/message_origin_views.py`
- Chat origin rendering — `frontend/src/components/communication/chat/Message.tsx`, `ChatDrawer.tsx`
- Precedent: event cancellation chat message — `backend/organization/tasks.py` (~l.380–430, `origin_type="event_registration"`)
- Specs: #2307 (`20261012_1000_project_join_request_confirmation_and_message.md`), #2309 (`20261026_1000_issue_2309_...`)

---

## Problem Statement

Before approving or rejecting a join request, an admin often needs more information from the requester. Today the only options are to approve blindly, reject, or hunt for the person and start an unrelated private chat. With several admins, each would start their own chat, and the others would never see what was asked or answered.

Admins need a "Respond" action on the join request that starts **one shared group chat** between the requester and the project admins, with the join request as visible context.

### Current state

- `MembershipRequests.message` holds the requester's text (≤500 chars after #2307). It is not part of any chat.
- `MembershipRequests.decided_by` is stored (#2309). No link from a request to a chat exists.
- Chat messages already support an *origin context* (`Message.origin_type` + `origin_id`, values `project`, `organization`, `event_registration`), resolved server-side by `resolve_message_origin` and displayed by `Message.tsx` via the `…OriginView` endpoints. There is no `membership_request` origin.
- `create_private_or_group_chat(creator, name, participants)` creates named group chats; `StartGroupChatView` exposes it (rate-limited via `check_can_start_chat`).
- The request dialog (#2310) does not exist yet; this story adds its "Respond" button.

---

## User Stories

- As a project admin reviewing a join request, I want to click "Respond" and talk to the requester before deciding, so I can ask clarifying questions.
- As a second admin of the same project, I want to see and continue the same conversation, so we don't ask the requester the same thing twice or send conflicting messages.
- As a requester, I want the chat to show clearly which join request it is about, with my original message as its first message, so I know why admins are writing.
- As a developer, I want the link between request and chat to be generic (not project-only), since membership requests will later also cover organizations.

---

## Acceptance Criteria

### AC-1: Data model — link request to chat

- **AC-1.1** `MembershipRequests` gets a nullable `response_chat` FK to `MessageParticipants` (`on_delete=SET_NULL`, `related_name="membership_requests"`, default `None`). One chat per request; null until an admin responds.
- **AC-1.2** New origin type `membership_request` (`ORIGIN_TYPE_MEMBERSHIP_REQUEST`) added to `message_origin.py` and to the `Message.origin_type` help text. `origin_id` = `MembershipRequests.id`.
- **AC-1.3** Migration is additive/nullable; no backfill.

### AC-2: Start/open the response chat (backend)

- **AC-2.1** New endpoint `POST /api/projects/<url_slug>/request_membership/<request_id>/respond/` (name `respond-to-join-request`), guarded by `IsAuthenticated` + `ReadWriteSensibleProjectDataPermission` (same as approve/reject). Returns 404 if the request does not belong to the project.
- **AC-2.2** If `response_chat` is null the endpoint creates a **group chat**:
  - name: `"Join request for <project name>"` (en/de via Django locale files; locale of the acting admin),
  - creator: the acting admin (role `ALL_TYPE`, via `create_private_or_group_chat`),
  - participants: the requester and all current project members with role `ALL_TYPE` or `READ_WRITE_TYPE` (`ADMIN_ROLE_TYPES`),
  - then stores it in `response_chat`. The whole step is atomic and idempotent under concurrent clicks (row lock on the request, `select_for_update`), so two admins clicking at the same time end up in the same chat.
- **AC-2.3** If the requester wrote a message, it is created as the **first message of the chat**, sender = requester, `origin_type="membership_request"`, `origin_id=<request id>`, `sent_at` = request's `requested_at`. Empty message → no seed message; the chat starts empty.
- **AC-2.4** If `response_chat` already exists, no new chat is created. The acting admin is (re-)activated as participant if not yet in the chat (admins can change over time). The existing `chat_uuid` is returned.
- **AC-2.5** Response: `200 {"chat_uuid": "...", "created": true|false}`.
- **AC-2.6** Allowed for pending requests. For already approved/rejected requests: allowed too (admins may need to follow up), see Open Question 2.
- **AC-2.7** The chat-start rate limit (`check_can_start_chat`) applies to the **creation** of a new chat only, not to opening an existing one; failing it returns 403 with the same message as `StartGroupChatView`.
- **AC-2.8** Standard chat notifications/emails go to the requester and other admins on messages as for any group chat. No extra notification is sent when the chat is created.

### AC-3: Origin context in chat

- **AC-3.1** `resolve_message_origin` accepts `origin_membership_request_id`-style context only for messages sent in a chat that is the request's `response_chat` and by one of its participants; the server derives type/id, never trusting the client (same rule as the other origins). Admin replies do **not** need to set an origin; only the seed message carries it.
- **AC-3.2** New `MembershipRequestOriginView` (`GET /api/chat/origin/membership_request/<id>/`, next to the existing origin views) returns `{project_name, project_url_slug, request_status}` to chat participants and project admins; 403 otherwise. It must not expose requester data beyond what chat participants already see.
- **AC-3.3** `Message.tsx` renders the seed message with a line "via join request for *<project name>*" (link to the project), analogous to the event-registration origin. Texts in `public/texts/` (en + de).

### AC-4: Frontend — "Respond" button and indicator

- **AC-4.1** The join request dialog from #2310 gets a **Respond** button for users allowed to manage requests. Click → call the endpoint (AC-2.1), show loading state, then open the chat in the existing `ChatDrawer` (or navigate to `/chat/<uuid>` where the drawer is not available). No drawer rework.
- **AC-4.2** Button label stays "Respond" whether or not a chat exists, so admins don't need to know; once a chat exists the dialog additionally shows a chat indicator (icon + "Conversation started") next to the request. For this, the requests list/detail API returns `response_chat_uuid` (nullable) — contract documented in `doc/api-documentation.md`.
- **AC-4.3** Errors (403 rate limit, 404, network) are shown as inline feedback in the dialog; no `window.alert`.
- **AC-4.4** All copy in `public/texts/` (en + de); MUI v7 with `styled()`/`sx`; accessible (button reachable by keyboard, loading state announced).
- **AC-4.5** Feature-gated by a toggle `PROJECT_JOIN_REQUEST_RESPOND_CHAT` (frontend via `useFeatureToggles().isEnabled`, default off while loading). Backend endpoint is always available but only reachable through the UI behind the toggle.

### AC-5: Genericity

- **AC-5.1** Chat creation lives in `MembershipRequestsManager.start_response_chat(acting_user)` and works from `target_membership_type` (project now; organization admins list is resolved from a target-specific helper). Only the project path is exposed via an endpoint in this story.

### AC-6: Tests

Backend (`organization/tests/test_join_request_response_chat.py`, `APITestCase`, admin with `Role.ALL_TYPE`):

| Test | Expectation |
|---|---|
| `test_respond_creates_group_chat` | 200, `created=true`, chat name contains project name, participants = requester + admins, `response_chat` set |
| `test_seed_message_with_origin` | requester message becomes first message with `origin_type="membership_request"`, correct sender |
| `test_no_message_no_seed` | empty request message → chat has no messages |
| `test_second_admin_reuses_chat` | second admin → same `chat_uuid`, `created=false`, admin added as participant |
| `test_idempotent_double_call` | two calls → one chat |
| `test_non_admin_forbidden` | plain member / requester → 403 |
| `test_wrong_project_404` | request id from another project → 404 |
| `test_rate_limit_only_on_create` | limit reached → create 403; existing chat still opens |
| `test_deleted_chat_resets_link` | chat deleted → `response_chat` null, next call creates new |
| `test_origin_view_permissions` | participant/admin 200, stranger 403 |

Frontend (jest): Respond calls the endpoint and opens the drawer; loading/disabled state; error feedback; indicator shown when `response_chat_uuid` present; toggle off → no button; `Message` renders the membership-request origin line.

### AC-7: Documentation

- `doc/domain-entities.md`: `MembershipRequests.response_chat` and the new origin type.
- `doc/api-documentation.md`: new endpoint, new origin endpoint, `response_chat_uuid` field.
- `doc/mosy/flows/`: update the join-request flow with the "Respond" step.
- `doc/environment-variables.md`: no change (toggle lives in DB).

---

## Proposed Solution (summary)

1. **Model**: add `MembershipRequests.response_chat` (FK, `SET_NULL`). Choosing an FK over looking up chats by origin keeps "which chat belongs to this request" a single, indexed, unambiguous fact and survives admin changes. This resolves the issue's linking question: replies go into the one existing group chat; we also show an indicator.
2. **Chat**: group chat created via `create_private_or_group_chat`, seeded with the requester's message carrying the new origin.
3. **Endpoint**: `respond` (get-or-create, locked) returning `chat_uuid`.
4. **Frontend**: button + indicator in the #2310 dialog; origin line in `Message.tsx`.

## Out of Scope

- The request dialog itself (#2310) and storing the decider (#2309).
- Organization membership request endpoints/UI (model is ready, see AC-5).
- Requester-initiated chat before deciding; automatic approve/reject from chat.
- Syncing participants when project admins change *after* the chat was created, beyond AC-2.4 (admin joins when they press Respond). See Open Question 1.
- Emailing the requester on the first admin message differently from standard chat emails.

## Open Questions (for product, Harald)

1. **Admin changes**: should newly added project admins be auto-added to existing request chats, or only when they press "Respond" (spec default)? Removed admins stay as participants unless deactivated — do we remove them?
2. **Decided requests**: may admins still respond to approved/rejected requests (spec default: yes)?
3. **Chat title**: "Join request for <project>" (default) — is the requester's name needed in the title for admins with many requests?
4. **Rate limit**: should creating a request chat count against the "4 new chats / 3 hours" limit? Spec default: yes (reuses `check_can_start_chat`), but a busy admin could hit it.
5. **Requester privacy**: group chat shows all admins' names to the requester and all admins see the requester's profile — acceptable?

## Known Adjacent Issues (not part of this story)

- `ManageJoinProjectView.post` swallows exceptions into a generic 500 without logging (noted in #2309).
- `MembershipRequestsManager` organization approve path uses an unset `self.organization` (noted in #2309).

## Rollout

Additive nullable column + new endpoints; backend can ship before the frontend. Frontend behind `PROJECT_JOIN_REQUEST_RESPOND_CHAT`. Frontend work waits for #2310; backend work (AC-1–3) can start now.
