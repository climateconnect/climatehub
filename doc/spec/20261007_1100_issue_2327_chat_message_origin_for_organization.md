# Include chat message origin when contacting from an organization page

**Status**: Implemented (scope reduced to the issue, see Log)
**Type**: Full stack — feature
**Date created**: 2026-10-07
**GitHub Issue**: #2327 — "Include chat message origin when reacting on an organisation page"

**Builds on**: `20261006_1000_issue_2296_chat_message_origin_for_project.md` (same feature for project pages; branch `include-chat-message-origin-for-project`). This spec **extends** that work with an `organization` origin type and assumes #2296 lands first (shared helper, generalised chip). If it does not, the shared parts listed under "Reused from #2296" must be built here.

**Depends on** (existing code):

- [backend/chat_messages/models/message.py](../../backend/chat_messages/models/message.py) — `Message.origin_type` / `origin_id` (`help_text` already lists `'organization'`)
- [backend/chat_messages/serializers/message.py](../../backend/chat_messages/serializers/message.py) — `MessageSerializer` already exposes both fields
- [backend/chat_messages/views/message_views.py](../../backend/chat_messages/views/message_views.py) — `SendChatMessage` (POST path)
- [backend/chat_messages/consumer.py](../../backend/chat_messages/consumer.py) — `DirectMessageConsumer.new_message` (WebSocket path)
- [backend/organization/views/event_registration_views.py](../../backend/organization/views/event_registration_views.py) — `EventRegistrationOriginView` (resolver pattern to mirror)
- [backend/organization/models/members.py](../../backend/organization/models/members.py) — `OrganizationMember` (`related_name="organization_member"` on organization, `"org_member"` on user)
- [frontend/pages/organizations/[organizationUrl].tsx](../../frontend/pages/organizations/%5BorganizationUrl%5D.tsx) — `handleConnectBtn` (current contact entry point)
- [frontend/pages/chat/[chatUUID].tsx](../../frontend/pages/chat/%5BchatUUID%5D.tsx) — full chat page where messages are composed (`sendMessage`)
- [frontend/src/components/communication/chat/Message.tsx](../../frontend/src/components/communication/chat/Message.tsx) — origin chip rendering

---

## Problem Statement

A user who clicks "Contact" on an organization page starts a private chat with the organization's creator (the member flagged `isCreator`). The recipient sees the text but not **which organization** it is about. This matters because one person often belongs to several organizations, and org admins other than the creator are not even in the chat. Event-registration cancellation messages already solve this with an origin chip; #2296 does the same for projects. Messages sent from an organization page must carry an `organization` origin so the recipient sees "This message is about the organization {name}".

## Key findings from the code

1. **No schema work.** `origin_type="organization"` is already documented as reserved on the model; `origin_id` is the organization PK. No migration.
2. **Origin is server-set only.** Neither send path (`SendChatMessage`, WebSocket consumer) accepts an origin today; #2296 introduces a client _request_ by slug that the server validates and resolves. Same approach here — never trust a raw `origin_id` from the client.
3. **The org page does not use `ChatDrawer` and will not get one.** `handleConnectBtn` calls `startPrivateChat(creator, ...)` and `router.push("/chat/<uuid>")`; messages are typed on the full chat page (`pages/chat/[chatUUID].tsx`, `sendMessage` at POST `/api/chat/<uuid>/send_message/`). That page has no notion of context, so the context has to be handed over when navigating. Only the project page uses `ChatDrawer` today.
4. **Both send paths must be handled** (POST fallback and WebSocket), as in #2296.
5. **The chip is hard-wired per type** in `Message.tsx`; #2296 generalises it to a discriminated union keyed `type:id`. Adding `organization` is one more union member plus text.
6. Only the org **creator** receives the chat, but the origin should still be valid if the recipient is any org admin (`Role.ALL_TYPE` / `Role.READ_WRITE_TYPE`), consistent with the project/event admin definition.

## Design decisions

| Question                       | Decision                                                                                                                                                                                        | Rationale                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where is the message composed? | **Unchanged: the full chat page `/chat/<uuid>`.** The org page passes the context as a query parameter `?origin_organization=<url_slug>` (`&hub=` kept when present)                            | Product decision: no `ChatDrawer` on the organization page. The slug in the URL is only a _request_; the server validates it (never trusts a raw `origin_id`) |
| Who sets origin?               | Client sends `origin_organization_url_slug`; server validates and stores `origin_type="organization"`, `origin_id=organization.id`                                                              | Server-set only, no spoofing                                                                                                                                  |
| Which messages are tagged?     | Messages sent from the chat page while the `origin_organization` query param is present. Opening the chat from the inbox (no param) sends untagged messages. Chip shown on every tagged message | Same chip logic as #2296                                                                                                                                      |
| Resolver                       | New `GET /api/organization-origin/<organization_id>/` returning `{organization_name, organization_url_slug}`                                                                                    | Mirrors `event-registration-origin` and #2296 `project-origin`; embedding in `MessageSerializer` stays a later cross-type refactor                            |
| Chip link                      | Links to the organization page (`/organizations/<slug>`, locale-prefixed)                                                                                                                       | Same as #2296                                                                                                                                                 |
| Deleted organization           | Resolver 404 → chip omitted                                                                                                                                                                     | `origin_id` is deliberately not a FK                                                                                                                          |

## Acceptance Criteria

### Backend

- [ ] **AC-1**: `SendChatMessage.post` accepts optional `origin_organization_url_slug`. Valid → message stored with `origin_type="organization"`, `origin_id=organization.id`. Absent → behaviour unchanged. Invalid → 400 with a clear `detail`.
- [ ] **AC-2**: `DirectMessageConsumer.new_message` accepts the same optional field in the socket payload and applies the same validation. Invalid origin → message is still delivered untagged, warning logged (no message loss).
- [ ] **AC-3**: Validation (shared helper, extending `chat_messages/utility/message_origin.py` from #2296): organization exists, and at least one _other_ active participant of the chat is an `OrganizationMember` of it with `role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE]`. Origin type string comes from a constant (`ORIGIN_TYPE_ORGANIZATION`), not a repeated literal.
- [ ] **AC-4**: `GET /api/organization-origin/<organization_id>/` (`IsAuthenticated`) returns `{organization_name, organization_url_slug}`. 200 for an active participant of a chat containing a message with that origin, or for an organization admin; 403 otherwise; 404 if the organization does not exist; 401 anonymous.
- [ ] **AC-5**: `MessageSerializer` returns `origin_type`/`origin_id` for the new type with no serializer change (verified by test).

### Frontend

- [ ] **AC-6**: The organization page's contact button keeps navigating to `/chat/<uuid>/` and appends `origin_organization=<organization.url_slug>` (plus the existing `hub` param when set). No `ChatDrawer` is added to the page.
- [ ] **AC-7**: `pages/chat/[chatUUID].tsx` reads `origin_organization` from the router query and, while present, sends `origin_organization_url_slug` with every message over both POST and WebSocket, and sets `origin_type`/`origin_id` on the optimistic message so the sender sees the chip immediately. Without the param, payloads are unchanged. A param on a chat the user cannot legitimately use for it is rejected by the server (AC-1/AC-3) and the message is still sent untagged on the socket path / 400 on POST: the page then retries without origin and shows no error to the user.
- [ ] **AC-8**: `Message.tsx` renders the organization chip ("This message is about the organization {name}" / "Diese Nachricht betrifft die Organisation {name}") with the name linking to the organization page; chip is shown on every organization-tagged message (same as project chips); 404 from the resolver → no chip. The event-registration and project chips are unchanged.
- [ ] **AC-9**: Texts added in `public/texts/chat_texts.json` (en + de) next to the existing origin texts: `chat_message_origin_organization`. No hardcoded strings. New styling uses `sx`/`styled`, no new `makeStyles`.
- [ ] **AC-10**: Contact entry points on the profile page and hub-ambassador boxes, and the project-page drawer, are unchanged; the full chat page shows received chips automatically.
- [ ] **AC-11**: The `?hub=` behaviour on the chat link is preserved exactly as today.

### Docs & verification

- [ ] **AC-12**: Updated `doc/api-documentation.md` (new endpoint, new `origin_organization_url_slug` param on `send_message` and socket payload), `doc/domain-entities.md` (`origin_type="organization"` now live), and the contact-chat flow under `doc/mosy/flows/`.
- [ ] **AC-13**: `make test` (new tests), `make ruff`, `make format`, `yarn lint`, `yarn check-types`, `yarn test` pass.

## Reused from #2296 (do not rebuild)

- Shared origin-validation helper and constants module (add an organization resolver next to the project one).
- Generalised origin fetch + cache keyed by `${type}:${id}`; the chip shows on every tagged message.
- The POST/socket payload wiring pattern and `origin` union (extend with `organization`); the chat page builds the same payload the project drawer does.

## Implementation plan

### Backend

1. `resolve_organization_origin(user, chat, organization_url_slug) -> tuple[str, int]` in `chat_messages/utility/message_origin.py`. Use `OrganizationMember` with its real related names (`organization_member`, `org_member`).
2. Wire into `SendChatMessage.post` and `DirectMessageConsumer.new_message`, as for projects (single optional-param handling that dispatches on whichever `origin_*_url_slug` is present; reject a request that sets more than one).
3. `OrganizationOriginView` in `chat_messages/views/message_origin_views.py` and URL `organization-origin/<int:organization_id>/` in `chat_messages/urls.py` next to `project-origin`.
4. Docs per AC-12.

### Frontend

1. Extend `OriginContext` union and `Message.tsx` chip with the `organization` type; add text keys.
2. In `pages/organizations/[organizationUrl].tsx`, `handleConnectBtn` appends `origin_organization=<slug>` to the chat link (keep `hub`).
3. In `pages/chat/[chatUUID].tsx`, derive `origin` from the query (`origin_organization`), include it in the `send_message` payload and socket message, and set it on optimistic messages. Do not persist it beyond the URL.

## Tests

**Backend** (`backend/chat_messages/tests/test_message_origin.py`, extend; style of `organization/tests/test_event_registration_cancellation_message.py`; `--keepdb`):

- POST with valid slug → stored `origin_type="organization"`, `origin_id=org.id`; serializer returns both.
- POST without param → origin empty (regression). Unknown slug → 400. Org whose admin is not in the chat → 400. Both a project and an organization slug → 400.
- Consumer path: valid / invalid / absent.
- No participants are added for organization-tagged messages (POST and consumer).
- `OrganizationOriginView`: 200 participant, 200 org admin, 403 unrelated, 404 unknown, 401 anonymous.

**Frontend** (jest):

- Organization page: contact click navigates to `/chat/<uuid>/?origin_organization=<slug>` (and keeps `hub`).
- Chat page: with the query param, POST and socket payloads include `origin_organization_url_slug`; without it they do not; 400 on origin → retried untagged.
- `Message` tests: organization chip text/link per locale; shown on every tagged message; 404 → no chip; existing chips unchanged.

**Manual**: user A contacts an organization of user B from its page; B sees the chip (inbox and `/chat/<uuid>`), live and after reload; a second message shows the chip again; deleting the organization removes the chip with messages intact.

## Out of scope

- Profile and hub-ambassador contact origins (`origin_type="hub"` and a user-profile type remain reserved).
- A new Notification type, or reaching other org admins (adding them to the chat was removed, see Log).

## Open questions

1. ~~Drawer vs. chat page~~ — **Resolved 2026-10-07**: no drawer on the organization page; the chat page stays the composer and the origin travels as a query param.
2. ~~Recipient~~ — **Resolved 2026-10-21**: only the existing chat participants; other org admins are not involved (see Log).
3. ~~Merge order~~ — **Resolved 2026-10-07**: #2296 is merged first; this spec builds on it.

## Log

- 2026-10-07 — Added AC-17: sender note that all organization admins can see the message.
- 2026-10-07 — Q1/Q3 answered: no drawer on the org page (origin passed via `?origin_organization=` to the existing chat page); #2296 merges first.
- 2026-10-07 — Revised after feedback: no new Notification type; admins are added as chat participants (so they are notified through the existing flow) and may reply. Replaced AC-14–16.
- 2026-10-07 11:00 UTC — Spec drafted from issue #2327, modelled on the #2296 spec. Key divergence found in code: the organization page navigates to the full chat page (no drawer), (superseded: no drawer, see later log entries).
- 2026-10-21 — Scope reduced to the issue: removed the "other org admins join the chat" decision, AC-14–17, the admin note and `add_organization_admins_to_chat`. It was not requested in #2327 and exposed private DM history to admins, let them outrank the original participants and fragmented repeat chats. Reaching other admins needs a separate issue and privacy review. Chip now shows on every tagged message, as for projects.
