# Inline contact chat drawer on the project page (POC)

**Status**: POC implemented (frontend-only) — awaiting graduation decision
**Type**: Frontend — feature (proof of concept)
**Date created**: 2026-09-22
**GitHub Issue**: none (UX proof of concept)

**Depends on**:
- [frontend/src/components/project/ProjectPageRoot.tsx](../../frontend/src/components/project/ProjectPageRoot.tsx) — current contact handler (`handleClickContact`), sign-in redirect, all contact triggers funnel here
- [frontend/src/components/project/Buttons/ContactCreatorButton.tsx](../../frontend/src/components/project/Buttons/ContactCreatorButton.tsx) — contact button (in-page + floating/collapsable variant)
- [frontend/src/components/project/Buttons/ProjectInteractionButtons.tsx](../../frontend/src/components/project/Buttons/ProjectInteractionButtons.tsx) — interaction bar "Contact" button + floating creator button
- [frontend/pages/chat/[chatUUID].tsx](../../frontend/pages/chat/%5BchatUUID%5D.tsx) — parity reference for drawer content/behavior
- [frontend/src/components/communication/chat/MessagingLayout.tsx](../../frontend/src/components/communication/chat/MessagingLayout.tsx) — existing chat UI (reuse candidate)
- [frontend/public/lib/messagingOperations.ts](../../frontend/public/lib/messagingOperations.ts) — `startPrivateChat` (create-or-get private chat)
- [frontend/pages/_app.tsx](../../frontend/pages/_app.tsx) — page-level unread-notification mechanism (source of a known POC deviation)
- [backend/organization/utility/email.py](../../backend/organization/utility/email.py) — `send_event_registration_confirmation_to_user` (motivating use case; `EventUrl` variable)

---

## Problem Statement

Several pages offer a "Contact" button that starts an internal chat message. Today this button fully navigates the user to the chat page (`/chat/<chat uuid>`), so they leave the page they were on and lose all context. A user who wanted to ask one question about a project now has to find their way back — and there is no way to arrive at a project page *with the intent to chat*, e.g. from an email.

The motivating flow is the event registration confirmation email: it already links to the event's project page, and we want its recipients to be able to contact the organiser immediately, in the event's context.

This is a proof of concept for an inline chat overlay on the project page:

- Clicking Contact opens a chat drawer on top of the current page instead of navigating away.
- On mobile the overlay is a bottom sheet; on desktop a side sheet on the right — the placement pairing recommended by Material Design 3 (verified; see AI insights).
- The overlay offers the same information and behavior as the chat page (who am I chatting with, message history, sending messages), plus a minimal line of project context so it is clear why this conversation exists.

Underneath, this is a generic concept: **a new chat with a person, in a context, shown in a drawer** — the project page is only its first consumer. If the POC proves out, the same overlay can be adopted by the other pages that initiate chats (profile, organization page, hub ambassador), each supplying its own context, with no rework of the overlay itself. If it fails, nothing is lost: the full chat page stays in place.

## User Stories

- As a visitor browsing a project, I want to contact the organiser without leaving the page, so I can continue exploring the project after sending my message.
- As an event participant clicking the link in my registration confirmation email, I want to land on the event page with the contact chat already open, so I can ask the organiser a question in one step and still see the event.
- As a user who already has a conversation with the organiser, I want the drawer to show my existing conversation and let me continue it right there.
- As an organiser, nothing changes: messages arrive in my existing conversation and inbox exactly as today.
- As a developer, I want the drawer built as a page-agnostic unit (contact person + context as inputs), so other chat-initiating pages can adopt it later without rework.

---

## Acceptance Criteria

### Auto-open deep link

- [ ] **AC-1**: The project page supports an auto-open variant of its URL (query parameter). A logged-in user visiting it sees the contact chat drawer open automatically (after the chat with the project contact is started/resolved).
- [ ] **AC-2**: A logged-out user arriving via the auto-open link goes through the existing sign-in redirect; after signing in they land back on the project page and the drawer opens (the auto-open flag survives the login round-trip).
- [ ] **AC-3**: Plain project URLs never auto-open the drawer — normal visits behave exactly as today.
- [ ] **AC-4**: The auto-open URL format is documented for use in the event registration confirmation email. Wiring the email itself is a follow-up decision (see Constraints) — not part of this POC.

### Drawer behavior

- [ ] **AC-5**: Clicking any contact entry point on the project page (overview contact card, interaction bar "Contact" button, floating creator button shown while scrolling) opens the chat drawer. URL, scroll position and page state are unchanged — the user stays on the project page.
- [ ] **AC-6**: Placement follows Material Design 3 sheet guidance: on mobile (compact) a modal bottom sheet, full width, with scrim; on desktop (medium and up) a modal side sheet anchored right, max ~400dp wide, with scrim.
- [ ] **AC-7**: The drawer header identifies the chatting partner (avatar, name, role in the project) and includes a short project-context line (project name or equivalent) explaining why the chat is about to start.
- [ ] **AC-8**: Content and behavior parity with the private-chat view of the existing chat page: message history with load-older pagination, live incoming messages while open, sending messages with the same failure/validation handling, same error display conventions (no `window.alert`).
- [ ] **AC-9**: Existing conversations: if the user already has a conversation with the project contact, the drawer shows that existing thread (recent messages, load older) — the drawer experience is the same whether the thread is new or existing.
- [ ] **AC-10**: Chat creation semantics unchanged: the chat is started-or-fetched via the existing create-or-get call when the drawer opens; no duplicate conversations; messages sent in the drawer land in the same thread visible in inbox and chat page.
- [ ] **AC-11**: Dismissal works via scrim click, ESC key and a visible close affordance. After closing, the user is exactly where they were on the project page; reopening shows the persisted conversation.
- [ ] **AC-12**: While open, the overlay is modal: the page behind it is inert (scrim), per modal sheet guidance.
- [ ] **AC-13**: Accessibility: focus moves into the overlay on open and returns to the triggering button on close; the sheet is labelled so screen readers announce what it is (MUI Drawer provides the base behavior; verify in implementation).

### Unchanged (guards)

- [ ] **AC-14**: The full chat page `/chat/<uuid>` is unchanged, including deep links from notifications.
- [ ] **AC-15**: Other contact entry points (profile, organization page, hub ambassador) keep today's navigate-to-chat behavior.
- [ ] **AC-16**: No backend API changes; no new dependencies beyond what MUI already provides.

### Verification

- [ ] **AC-17**: `yarn lint`, `yarn format` and `yarn tsc` pass. Jest tests cover: contact click opens the drawer, auto-open param opens the drawer for a logged-in user and does not for a plain visit, drawer renders partner + project context, sending a message goes through the same chat send path, and an existing thread renders its messages.

---

## Constraints

- Frontend-only for the POC; reuse the existing private chat APIs, websocket and message pagination. No backend changes.
- The overlay surface is MUI `Drawer` (project is on MUI 7); MD3 sheet guidelines govern placement/dimensions: side sheet right-anchored, max 400dp (16dp inset allowed); mobile bottom sheet full width, 28dp top corner radius, optional drag handle; modal (scrim) variant for both.
- The chat page remains the canonical full-page experience; the POC adds an overlay and must not remove or degrade it.
- Known deviations accepted for the POC (revisit at graduation): (1) unread chat notifications for the open conversation are not auto-marked read — that mechanism keys off page props today; (2) the URL does not change while the drawer is open, so browser back does not close it.
- Member management / leave-chat UI is intentionally absent from the drawer (private chats cannot be left anyway).
- New copy (drawer header, context line) must exist in English and German per i18n convention.
- Reusable by design, but not generalized yet: the drawer is a self-contained component whose inputs are the contact person and a context description; project-specific details must not leak into it. Do not build configurability for future pages in this POC — that happens when a second consumer adopts it.
- Email wiring is out of POC scope: the confirmation email's link is assembled in `send_event_registration_confirmation_to_user` (`EventUrl` = frontend URL + locale + `/projects/<slug>`) and the Mailjet templates (EN/DE) define the actual CTA. Pointing it at the auto-open URL is either a one-variable backend tweak (e.g. a dedicated URL variable for the contact link) or a Mailjet-side template edit — decide at graduation, not silently bundled here.

---

## Directional hints

*(hints only — implementation decisions belong to the implementing mode)*

- The parity reference is how the chat page renders a private chat: `MessagingLayout` inside a fixed-height layout. A drawer needs the same height-constrained chat container — evaluate reusing `MessagingLayout` before writing new chat UI.
- The chat page fetches chat + messages server-side; the drawer needs client-side equivalents. The page's fetch helpers (`getChat`, `getChatMessagesByUUID`) are module-scope functions and candidates for extraction/reuse rather than duplication.
- Auto-open can follow the hub calendar subscribe-modal pattern (`autoOpenSubscribe` flag, client-side open on mount, SSR unaffected — see `20260914_1335_hub_calendar_short_link.md`).
- After `startPrivateChat` returns the chat, the drawer just renders it — a brand-new chat is simply a thread with zero messages, so new vs. existing needs no special casing.
- Mobile: don't assume a near-full-height sheet — the chat chrome is compact (small multiline input + 40px send button, one-line header, see `ChatContent.tsx`), and a fresh conversation has an empty message area; an existing thread's message list simply scrolls within whatever height is available. MD3 permits preset heights/drag handles — pick a content-fitting height with a sensible minimum during implementation instead of a fixed assumption.

---

## AI Agent Insights and Additions

### Current flow, confirmed against code

- `ProjectPageRoot.tsx` `handleClickContact` (~lines 287–300): not logged in → redirect to `/signin` with message; otherwise `startPrivateChat(creator, token, locale)` (POST `/api/start_private_chat/` with the creator's `url_slug` — create-or-get semantics), then `router.push("/chat/" + chat.chat_uuid)`. The "creator" is the first team member with `ROLE_TYPES.all_type` permission.
- Three trigger renderings, one handler: the `ProjectOverview` contact card, the `ProjectInteractionButtons` interaction-bar "Contact" button, and the floating `ContactCreatorButton` (`collapsable`, absolute bottom-right) that appears when the in-page button scrolls out of view — this matches the user's description of "the floating one at the bottom".
- The same navigate-away pattern exists in `ProfileRoot.tsx`, `organizations/[organizationUrl].tsx`, `LocalAmbassadorInfoBox.tsx` and `ContactAmbassadorButton.tsx` — rollout candidates if the POC graduates.

### Existing threads (user question during Q&A, resolved)

The concern "an existing thread won't fit into the drawer" assumes a fork between new and existing conversations. There isn't one: after `startPrivateChat` the drawer always holds a `chat_uuid`; a new chat is a thread with zero messages, an old one a paginated message list — the chat page already renders both inside a fixed-height viewport, and a drawer is a fixed-height viewport. Decision (encoded in AC-9): always render the conversation; no preview-and-link fallback. Rejected alternative: showing only a preview + "open in chat" link for existing threads would split the UX (same button sometimes overlays, sometimes navigates away) and undermines the POC's premise. Optional nicety: a small "open full conversation" link in the drawer header for power users — not required for the POC.

### Material Design 3 research (answers the drawer-placement question)

- MD3 bottom sheets: compact breakpoints (mobile, <600dp), full width, modal variant with scrim, 28dp top corner radius, optional drag handle.
- MD3 side sheets: medium (600–839dp) and expanded (840dp+) breakpoints, anchored to the right edge — "usually on the right side to avoid interference with any navigational components on the left edge" — max width 400dp, optional 16dp inset.
- MD3 explicitly: "At medium and expanded breakpoints like desktop, a bottom sheet can be swapped for a side sheet that shows similar content." The proposed pairing (bottom on mobile, right on desktop) is the official adaptive pattern, not a compromise.
- Terminology: MD3 calls this a *sheet*, not a navigation drawer (the left-side nav component, deprecated in M3 Expressive). MUI's `Drawer` implements both sheet types via `anchor="bottom" | "right"` with `variant="temporary"` (scrim/modality).

### Notification auto-read detail

`_app.tsx` marks chat notifications read based on `pageProps.chatUUID && pageProps.messages` — a page-level mechanism. A drawer conversation will not trigger it; this is the deviation listed in Constraints. If the POC graduates, parity here likely requires moving that mechanism (flag for Archie at graduation, not now).

### Test coverage gaps

No existing Jest coverage for the contact flow (`ProjectPageRoot.handleClickContact`, `ContactCreatorButton`, `ProjectInteractionButtons`). New tests should target the new drawer component's behavior rather than re-testing the buttons. Frontend verification must include `yarn tsc` (project constraint).

---

## System impact

**Verdict: view-layer only — confirmed.** No backend, no API, no entity, no event, no migration. The domain behavior (create-or-get private conversation, send/receive/paginate messages) is consumed identically to today; only *where the conversation is rendered* changes.

### Actors & actions

- Actors unchanged: Visitor (logged out), logged-in user, project creator (passive recipient). No new roles, no permission changes.
- **"Start contact chat"** (user → conversation with project creator): domain behavior unchanged — same create-or-get call, same login gate for logged-out users. Only the presentation outcome changes: render the conversation in an overlay on the project page instead of navigating to the chat page.
- **"Send message" / "receive message" / "load older messages"**: unchanged behavior, relocated from the chat page into the overlay component. This is the one real (and intended) frontend-architecture delta: the conversation UI gains its first non-page mount point, and the project page hosts live-chat behavior it never had.
- **New presentation-level entry point** "auto-open contact chat" (URL parameter): not a new domain action — it triggers the same existing "start contact chat" action on page load (after the login round-trip for logged-out users). SSR output unaffected; the overlay opens client-side only.

### Entities

None affected. `MessageParticipants` (Conversation) and `Message` are consumed read-only, exactly as before — no new or changed entities, attributes, or relations. Note: the domain already models conversation context via `Message.origin_type` (`project`, `event_registration`, …, server-set) — wiring it up for project-related messages is a known separate task, explicitly out of this POC's scope. The drawer's context line here is pure frontend presentation.

### APIs & events

- Consumed APIs unchanged: `POST /api/start_private_chat/`, `GET /api/chat/<uuid>/`, `GET /api/messages/`, `POST /api/chat/<uuid>/send_message/`, chat websocket, `GET /roles/`.
- No produced events, no new endpoints, no OpenAPI/AsyncAPI changes.

### Flows (doc/mosy/flows/core-flows.md)

- No flow specification is affected: core-flows.md documents no "contact organiser / start private chat" flow, and this POC introduces no new domain flow — it re-renders an existing one. No flow file changes required for the POC.
- If the POC graduates, document the "contact organiser in context" flow then (the rollout to profile/organization/ambassador pages would be the natural moment).

### Architecture (doc/mosy/architecture_overview.md)

- No changes required for the POC. "Real-Time Messaging" remains a page-level capability; if the POC graduates and the overlay rolls out, the reusable in-context chat overlay becomes an architecture-level frontend building block worth recording.

### Integration points & known deviations

- Chat websocket: this POC does not change socket behavior — the drawer reuses the same mechanism as the chat page and degrades identically. The websocket is currently not working platform-wide; that is a pre-existing condition unaffected by this change (the POC only relocates where the conversation is rendered). The drawer and chat page remain mutually exclusive consumers (different routes).
- Notification auto-read stays page-level (`_app.tsx` keys off page props) — drawer conversations won't auto-mark notifications read (accepted deviation).
- URL/back button not wired to the overlay (accepted deviation).
- Unchanged guards: chat page and its deep links, all other contact entry points (AC-14/15).

### Out of scope / deferred to graduation

- Email wiring (backend `EventUrl` variable or Mailjet template edit), rollout to profile/organization/ambassador pages, notification auto-read parity, Mosy flow documentation for the contact-organiser flow.

---

## Log

- 2026-09-22 08:39 UTC — Spec drafted from the user's POC proposal after Q&A round: (1) auto-open URL variant confirmed in-scope — motivating case is the event registration confirmation email (Mailjet templates, `EventUrl` assembled in `email.py`; email wiring itself flagged as follow-up decision); (2) minimal project-context line in the drawer header confirmed; (3) all project-page contact triggers in scope; (4) existing-thread handling decided — drawer always renders the conversation, new vs. existing is one code path. MD3 sheet guidance verified. Awaiting user review of problem statement and insights.
- 2026-09-22 10:44 UTC — Review feedback: removed the ~85% mobile-height assumption from the directional hints. Verified against `ChatContent.tsx`: chat input is a small single-row multiline field with a 40px send button; height should be content-fitting with the message list scrolling, not a fixed large value. Still in DRAFT, awaiting further review.
- 2026-09-22 10:46 UTC — Review feedback: reusability intent made explicit — the drawer is conceived as a generic "new chat with a person, in a context" overlay (project page = first consumer; profile, organization, ambassador pages = known future consumers). Added developer user story and a self-contained-component constraint with a no-speculative-generality note. Still in DRAFT, awaiting approval.
- 2026-09-22 10:50 UTC — Archie system impact analysis complete. Verdict: view-layer only; no entity, API, event, or flow-specification impact. Two precise deltas noted (behavior relocation into a page-mounted overlay; chat socket gains a second, mutually exclusive consumer). No doc/mosy changes required for the POC; flow documentation deferred to graduation. Awaiting user review of the System impact section.
- 2026-09-22 10:53 UTC — Impact review feedback applied: (1) `Message.origin_type` wiring for project-related messages is a known separate task, out of POC scope; (2) chat websocket is currently not working platform-wide and is unaffected by this POC — drawer reuses the same mechanism with identical degradation, double-binding verification concern removed.
- 2026-09-22 11:30 UTC — POC implemented (frontend-only). **Auto-open URL format (AC-4)**: `/projects/<url_slug>?openContactChat=true` (locale-prefixed variants like `/de/projects/…` work identically; the flag survives the sign-in round-trip because the login redirect carries the full current URL including query). Email wiring remains a graduation decision. **Implementation notes**: new generic `ChatDrawer` (`src/components/communication/chat/ChatDrawer.tsx`) takes `contactPerson` + `contextDescription` as inputs — no project specifics inside; renders MUI `Drawer` temporary with `anchor="bottom"` (mobile, full width, 28dp top radius, `min(75vh, 560px)` content-fitting height) / `anchor="right"` (≥600px, 400dp wide, full height), scrim included via temporary variant. Reuses `ChatContent` (message list + composer) rather than `MessagingLayout`, whose header couples back-to-inbox navigation and member management that have no place in the drawer. Chat page fetch helpers (`getChat`, `getChatMessagesByUUID`, `getRolesOptions`, `parseParticipants*`) extracted to `public/lib/messagingOperations.ts` and imported by the chat page (behavior unchanged). `ProjectPageRoot.handleClickContact` now opens the drawer; the auto-open flag is stripped from the URL on drawer close (mirrors the `openRegistration` modal pattern). Drawer thread logic (socket receive, send via socket with POST fallback, load-older pagination) mirrors the chat page's client-side equivalents. Focus moves into the drawer on open and returns to the trigger on close. New copy (EN/DE): `close_chat`, `could_not_start_chat` (chat texts), `contact_chat_context_line` (project texts, interpolates project name). Tests: `ChatDrawer.test.tsx` (7 cases), `ProjectPageRoot.test.tsx` (4 cases); `yarn lint`, `yarn tsc`, full Jest suite pass.
- 2026-09-22 11:55 UTC — Review feedback applied (user Q&A round): (1) the drawer header previously showed the chat conversation's participant role (generic "Member" from `/roles/`) — replaced by a caller-supplied role text: `contactRole` prop; the project page passes "Project Creator" (`responsible_person_project`) or the new "Event Owner" (`responsible_person_event`) based on project type, so future consumers pass their own owner label. (2) The empty-conversation text in `Messages` is now context-aware for drawer chats: "This is the very beginning of your conversation about the project “x” with <partner>." — implemented via an optional `emptyConversationLead` override prop on `Messages`/`ChatContent`; the chat page's default text is untouched. To support both renderings, the drawer's context input changed from a full sentence (`contextDescription`) to a noun phrase (`contextTerm`, e.g. `the project “x”` via the renamed `contact_chat_context_term` project text) — the drawer composes the header line (`this_chat_is_about` chat text, phrased to avoid the German "zum" contraction) and the empty-state lead itself from shared `{context}` placeholder texts. Header context line kept (needed once messages exist). Tests now cover: caller-provided role shown, generic "Member" role absent, context-aware empty text. 13 drawer/page cases; lint, tsc, full suite pass.
- 2026-09-22 12:00 UTC — Review feedback applied (user Q&A round): (1) header context line removed — with the context-aware empty-state text the "This chat is about the project…" line was redundant; the drawer header now shows only partner + role (`this_chat_is_about` key removed; AC-7 amended: project context is conveyed by the empty-conversation text and the page itself, not a permanent header line). (2) `contact_chat_context_term` is now project-type-aware: event projects yield "the event “x”" / "die Veranstaltung „x“", everything else "the project “x”" / "das Projekt „x“" (event wording asserted in the ProjectPageRoot event test). (3) Mobile bottom sheet height switched from fixed `min(75vh, 560px)` to content-fitting: `height: auto`, `minHeight: 280`, `maxHeight: min(75vh, 560px)` — a new chat renders a compact sheet, an existing thread grows to the cap and scrolls internally (paper is now a flex column; `maxHeight` overrides reset at `sm` so the desktop side sheet keeps full height). Height settles instantly when the thread resolves (auto heights don't animate, no transition added); desktop unchanged. 14 drawer/page cases; lint, tsc, full suite pass.
- 2026-09-22 12:40 UTC — Review feedback applied: the empty-conversation text ("This is the very beginning…") touched the drawer edges on desktop — `noHistoryText` in `Messages` now has padding (`2×3` spacing). This is the shared empty-state container, so the chat page's identical empty state gains the same padding (cosmetic only, no behavior change). All checks pass.
- 2026-09-22 12:50 UTC — Review feedback applied: the owner role ("Project Creator"/"Event Owner") now renders directly below the partner's name inside the header preview instead of as a separate line below it. `MiniProfilePreview` gained an optional `title` prop (small secondary line under the name, inside the existing avatar+name layout; optional, so all existing consumers are unchanged); the drawer passes `contactRole` through it and no longer renders its own role line. All checks pass.
- 2026-09-22 13:00 UTC — Header preview polish (verified live on a dev-server project page): (1) the name and role now share a left edge — the 8px avatar→text gap moved from `profileName` (where it indented only the name inside the new column) to the `nameAndTitle` wrapper, preserving the gap for every consumer; (2) the gap between the name line and the role line is reduced — when a title is present, the name's line-height is tightened to 1.2 via a `nameAndTitleWithTitle` modifier class (default h6 line-height 1.6 left ~10px of dead space), and the title's extra top margin dropped; no-title consumers keep the untouched line-height (verified in the browser: no-title preview = 16px font at 1.6 default, drawer name = 20px at 1.2; 8px gap and vertical centering identical to the original in both). 8 MiniProfilePreview consumers besides the drawer (chat header/previews/content, user search, project metadata/content, event registration modal, edit project) — all title-less, rendering unchanged; full suite 845/845, lint clean.
- 2026-09-22 13:10 UTC — User review: POC considered in a good state. Noted for graduation: (1) the contact button's hover info card (`ContactCreatorButtonInfo`, a custom MUI Card/CardHeader — not MiniProfilePreview) uses `responsible_person_project` ("Project Creator") regardless of project type, while the drawer shows the type-aware role ("Event Owner" for events) — wording unification pending the user's wording verification; (2) the old button's EN/DE role texts diverge in meaning (pre-existing, outside this POC); (3) consolidation candidate: hover card could adopt MiniProfilePreview with the `title` prop and share one role source with the drawer. Uncommitted, ready for review/commit on request.
