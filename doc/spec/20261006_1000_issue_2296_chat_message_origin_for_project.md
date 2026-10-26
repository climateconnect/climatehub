# Include chat message origin when contacting from a project page

**Status**: Plan approved — not implemented
**Type**: Full stack — feature
**Date created**: 2026-10-06
**GitHub Issue**: #2296 — "Include chat message origin when reacting on a project page"

**Depends on** (existing pattern to follow — issue #2102, event-registration cancellation messages):
- [backend/chat_messages/models/message.py](../../backend/chat_messages/models/message.py) — `Message.origin_type` / `origin_id` (already exist; `help_text` already lists `'project'`)
- [backend/chat_messages/serializers/message.py](../../backend/chat_messages/serializers/message.py) — `MessageSerializer` already exposes both fields
- [backend/organization/tasks.py](../../backend/organization/tasks.py) — `send_cancellation_chat_message` (sets origin server-side)
- [backend/organization/views/event_registration_views.py](../../backend/organization/views/event_registration_views.py) — `EventRegistrationOriginView` (origin → display context resolver)
- [backend/chat_messages/views/message_views.py](../../backend/chat_messages/views/message_views.py) — `SendChatMessage` (POST fallback)
- [backend/chat_messages/consumer.py](../../backend/chat_messages/consumer.py) — `DirectMessageConsumer.new_message` (WebSocket send path)
- [frontend/src/components/communication/chat/Message.tsx](../../frontend/src/components/communication/chat/Message.tsx) — renders the event-registration origin chip
- [frontend/src/components/communication/chat/ChatDrawer.tsx](../../frontend/src/components/communication/chat/ChatDrawer.tsx) — contact drawer on the project page (POC, see `20260922_0839_project_contact_chat_drawer_poc.md`)
- [frontend/src/components/project/ProjectPageRoot.tsx](../../frontend/src/components/project/ProjectPageRoot.tsx) — only consumer of `ChatDrawer`

---

## Problem Statement

A user who clicks "Contact" on a project/idea/event page ends up in a plain private chat with the project's admin. The recipient sees the text but not *which* project/idea/event it is about, so replies are often out of context. Cancellation messages from event registrations already solve this with an origin chip ("This message is about the registration for {event_name}"). The same must happen for messages sent from a project page, using the right word for the project type (project / idea / event).

## Key findings from the code

1. **No schema work needed.** `Message.origin_type` (`""`, `"project"`, `"event_registration"`, …) and `origin_id` exist; `"project"` is already documented as reserved. No migration.
2. **Origin is only ever set server-side today**, in the Celery cancellation task. The normal send paths (`SendChatMessage` POST, WebSocket consumer) never set it, and the frontend `ChatDrawer` sends only `message_content` / `message`.
3. **Two send paths must both be handled.** `ChatDrawer` uses the WebSocket when connected, the POST otherwise. Updating only one leaves origin missing intermittently.
4. **Frontend rendering is hard-wired to `event_registration`** (`Message.tsx`: fetch function, cache, text template, `EventIcon`). It resolves display context via a separate endpoint with a module-level cache, rather than embedding it in `MessageSerializer`.
5. **Recipients' live messages** arrive over the socket as `message_id` only; the receiving client refetches the message through the serializer, so origin fields should arrive for free (verify in implementation, see Tests).
6. `Message.tsx` still uses `makeStyles` although CLAUDE.md says it's removed (migration #2290 is in progress). New code must use `sx`/`styled`; don't add new `makeStyles` usage.

## Design decisions

| Question | Decision | Rationale |
|---|---|---|
| Who sets origin? | Client *requests* a project context by `url_slug`; server validates and resolves to `origin_type="project"`, `origin_id=project.id` | Keeps origin "server-set only" (never trust a raw `origin_id` from the client) |
| Which messages get tagged? | Every message sent from the project drawer | Simple, stateless, no "is first message" logic. Noise is avoided in the UI (below) |
| Avoid chip spam in thread | Frontend shows the chip only when a message's origin differs from the previous message's origin | A conversation of 10 drawer messages shows one chip |
| Resolve display data | New `GET /api/project-origin/<project_id>/` mirroring `event-registration-origin`; frontend cache generalised to key `type:id` | Consistent with #2102; the alternative (embed `origin_context` in `MessageSerializer`) saves requests but needs prefetching to avoid N+1 — can be a later refactor covering all origin types |
| Terminology | Resolver returns `project_type` (`project` / `idea` / `event`); three text templates | Matches the issue's request; `contact_chat_context_term` already branches on event vs. project |
| Deleted/hidden project | Resolver returns 404 → chip omitted | `origin_id` is deliberately not a FK |
| Notifications / email | Unchanged in this issue (open question below) | |

## Implementation plan

### Backend

1. **Shared helper** `backend/chat_messages/utility/message_origin.py`
   - `resolve_project_origin(user, chat, project_url_slug) -> tuple[str, int]`
   - Validates: project exists; the sender is a participant of `chat` (callers already check); at least one *other* active participant of `chat` is a `ProjectMember` of the project with `role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE]` (same admin definition as `EventRegistrationOriginView`). Raises a typed error (`ValueError`/DRF `ValidationError`) otherwise.
   - Use the `ProjectMember` related names `project_member_user`, `project_member_project`, `project_member_role` where traversing relations.
   - Define constants for origin types (`ORIGIN_TYPE_PROJECT = "project"`) rather than repeating string literals.

2. **`SendChatMessage.post`** — accept optional `origin_project_url_slug`; call helper; return 400 with a clear `detail` if invalid; pass `origin_type`/`origin_id` to `Message.objects.create`. Absent param → behaviour unchanged.

3. **`DirectMessageConsumer`** — accept optional `origin_project_url_slug` in the socket payload; reuse the helper inside `new_message` (it already does sync ORM work there; keep that style). On invalid origin, skip tagging and log a warning (a socket has no clean 400 path; the message itself must not be lost).

4. **Resolver endpoint** `ProjectOriginView` (`GET /api/project-origin/<int:project_id>/`, `IsAuthenticated`), registered in `organization/urls.py` next to `event-registration-origin`. Authorisation mirrors `EventRegistrationOriginView`: active participant of a chat containing a message with `origin_type="project"`, `origin_id=project_id`, **or** project admin. Response: `{ "project_name", "project_url_slug", "project_type" }` (`project_type` = `project_type` field value). Use `select_related` as needed; 404 if project missing, 403 otherwise.

5. **Admin/other callers**: grep for other `Message.objects.create` sites (only consumer, view, cancellation task today) to confirm nothing else needs updating.

6. **Docs**: `doc/api-documentation.md` (new endpoint, new `origin_project_url_slug` param on `send_message` and socket payload), `doc/domain-entities.md` (`origin_type = "project"` is now live; update the "reserved" wording).

### Frontend

1. **Generalise origin resolution** in `Message.tsx` (or extract to `public/lib/messageOriginOperations.ts`): a discriminated union `OriginContext = { type: "event_registration"; event_name; event_url_slug } | { type: "project"; project_name; project_url_slug; project_type }`; one fetch+cache keyed by `${type}:${id}`; calls via `apiRequest`. Keep the existing event-registration behaviour byte-for-byte.
2. **Render the project chip**: icon by `project_type` (event / idea / project), template chosen by type, project name as a link to the project page (use `getLocalePrefix(locale)` like the sender link). Use `sx` for styling. Suppress the chip when the previous message in the thread has the same origin (pass `previousMessage` or a precomputed `showOrigin` flag from the list component).
3. **Texts** in `public/texts/chat_texts.json` (en + de), next to `chat_message_origin_event_registration`:
   - `chat_message_origin_project`: "This message is about the project {project_name}" / "Diese Nachricht betrifft das Projekt {project_name}"
   - `chat_message_origin_idea`: "… the idea {project_name}" / "… die Idee {project_name}"
   - `chat_message_origin_event`: "… the event {project_name}" / "… die Veranstaltung {project_name}"
   No hardcoded strings.
4. **`ChatDrawer`**: add optional prop `origin?: { type: "project"; urlSlug: string; id: number }`. When set, (a) include `origin_project_url_slug` in the POST payload and the socket JSON, and (b) set `origin_type`/`origin_id` on the optimistic message so the sender sees the chip immediately. Generic prop so profile/org/hub callers can adopt later.
5. **`ProjectPageRoot`**: pass `origin={{ type: "project", urlSlug: project.url_slug, id: project.id }}` to `ChatDrawer`.
6. **Types**: extend `Message` type in `src/types.ts` only if needed (fields already exist).
7. **Flow doc**: update the contact-chat flow under `doc/mosy/flows/`.

### Out of scope

- Org-page, profile and hub-ambassador contact origins (mentioned in the issue as a larger initiative; the `origin` prop and helper are built to extend, adding `organization` / `hub` types later).
- Showing origin on the full `/chat/[chatUUID]` page *composer* (it renders messages through the same `Message` component, so received chips appear there automatically).

## Tests

**Backend** (new file, e.g. `backend/chat_messages/tests/test_message_origin.py`; follow `organization/tests/test_event_registration_cancellation_message.py` style; use `--keepdb`):
- POST with valid `origin_project_url_slug` → message stored with `origin_type="project"`, `origin_id=project.id`; serializer returns both.
- POST without param → origin empty (regression).
- Unknown slug → 400; slug of a project whose admin is not in the chat → 400 (no spoofing of arbitrary origins).
- Consumer path with and without origin (async test of `new_message`, valid + invalid).
- `ProjectOriginView`: 200 for chat participant and for project admin; 403 for unrelated user; 404 for unknown project; 401 anonymous.

**Frontend** (jest):
- `ChatDrawer.test.tsx`: payload includes `origin_project_url_slug` over POST and socket; omitted when `origin` prop absent.
- `Message` tests: chip renders correct wording per `project_type` and locale; hidden on consecutive same-origin messages; event-registration chip unchanged; failed resolve (404) renders no chip.
- Run `yarn lint`, `yarn check-types`, `make format`, `make ruff`.

**Manual**: user A contacts an event, a project and an idea of user B from the drawer; B sees the matching chip (inbox and `/chat/<uuid>`), live via socket and after reload; second message in the same session shows no repeated chip; delete the project → chip disappears, messages intact.

## Resolved questions (confirmed 2026-10-07)

1. **Email/in-app notification** mentioning the project: deferred to a follow-up (touches `create_email_notification` and email templates). Not part of this issue.
2. **Tagging**: every drawer message is tagged; the UI shows the chip only when the origin changes.
3. **Chip link**: the chip links to the project page.
