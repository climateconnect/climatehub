# Use the contact chat drawer on the organization page

**Status**: Draft
**Type**: Frontend — feature (no backend changes)
**Date created**: 2026-11-02
**GitHub Issue**: #2367 — "Use the contact chat drawer on the organization page"

**Builds on**:
- `20260922_0839_project_contact_chat_drawer_poc.md` — the `ChatDrawer` this spec reuses
- `20261007_1100_issue_2327_chat_message_origin_for_organization.md` — organization origin tagging (backend stays as is)

**Depends on** (existing code):
- [frontend/src/components/communication/chat/ChatDrawer.tsx](../../frontend/src/components/communication/chat/ChatDrawer.tsx) — `origin` prop currently typed `{ type: "project"; urlSlug; id }`; hard-codes `origin_project_url_slug` in the POST (l. ~261) and WebSocket (l. ~291) payloads
- [frontend/src/components/project/ProjectPageRoot.tsx](../../frontend/src/components/project/ProjectPageRoot.tsx) — reference consumer (`chatDrawerOpen`, `handleClickContact`, sign-in redirect)
- [frontend/pages/organizations/[organizationUrl].tsx](../../frontend/pages/organizations/%5BorganizationUrl%5D.tsx) — `handleConnectBtn` (calls `startPrivateChat`, then `router.push` to `/chat/<uuid>/?origin_organization=<slug>`)
- [frontend/pages/chat/[chatUUID].tsx](../../frontend/pages/chat/%5BchatUUID%5D.tsx) — `origin_organization` query handling to be removed (origin state, `originRejected`, retry after 400)
- [frontend/public/lib/messageOriginOperations.ts](../../frontend/public/lib/messageOriginOperations.ts) — `getOrganizationOriginBySlug` to be removed
- [frontend/public/texts/project_texts.tsx](../../frontend/public/texts/project_texts.tsx) — `contact_chat_context_term` (project wording, model for the new organization text)
- [doc/mosy/flows/core-flows.md](../mosy/flows/core-flows.md) — flow 7 "Contact From an Organization Page"

---

## Problem Statement

On the project page, "Contact" opens a chat drawer, so the user writes to the project contact without leaving the page. On the organization page, "Send message" still navigates to the full chat page (`/chat/<uuid>/?origin_organization=<slug>`). The message is tagged correctly (#2327), but the user loses the organization page and its context, and the same action behaves differently on two pages.

Only **where the message is written** changes. Who sees the button, who receives the message, and how messages are tagged and displayed stay as they are.

## Key findings from the code

1. **No backend work.** `origin_organization_url_slug` is already accepted and validated on both `SendChatMessage.post` and `DirectMessageConsumer.new_message`; `GET /api/organization-origin/{id}/` and the chip in `Message.tsx` already exist.
2. **`ChatDrawer` is project-specific only in its `origin` handling.** The type is `"project"` only and both payloads hard-code `origin_project_url_slug`. Everything else (header, history, pagination, sending, create-or-get chat on open) is generic.
3. **The drawer creates or fetches the chat itself when opened**, so `handleConnectBtn`'s own `startPrivateChat` call becomes unnecessary on the org page.
4. **The drawer already receives the organization id** from the page (`organization.id`), so the slug-to-id lookup (`getOrganizationOriginBySlug`) that the chat page needs is not required any more.
5. **The creator is already known on the org page** (`members.filter(m => m.isCreator)[0]`), mirroring `creator` in `ProjectPageRoot`.

## Design decisions

| Question | Decision | Rationale |
| --- | --- | --- |
| Recipient | Unchanged: the organization creator (`isCreator`) | Issue: who receives stays as is |
| Origin prop | Widen to a union `{ type: "project" \| "organization"; urlSlug: string; id: number }`; payload key chosen by type (`origin_project_url_slug` / `origin_organization_url_slug`) | Smallest change; optimistic copy still sets `origin_type`/`origin_id` so the sender sees the label immediately |
| Query-param flow | Remove from the chat page | Single way to tag organization messages; no dead code |
| Deep link `?openContactChat=true` on org page | Not added | Out of scope per issue; inbox label already shows the origin |
| Logged-out visitors | Unchanged (button stays hidden) | Separate feature request |

## Acceptance Criteria

### Drawer on the organization page

- [ ] **AC-1**: "Send message" opens `ChatDrawer` with the organization creator as recipient instead of navigating. URL, scroll position and hub context are unchanged.
- [ ] **AC-2**: The drawer matches the project page: bottom sheet on mobile, side sheet on desktop; partner name with "Contact person" as role; message history, load older, sending and error handling; latest messages refetched on every open; closes via scrim, ESC and close button.
- [ ] **AC-3**: The empty-conversation text names the organization ("…your conversation about the organization “x”…" / German equivalent). New EN/DE text key next to `contact_chat_context_term`, passed as `contextTerm`. No hardcoded strings.

### Origin tagging

- [ ] **AC-4**: `ChatDrawer`'s `origin` prop accepts `{ type: "organization", urlSlug, id }` as well as `project`. POST and WebSocket payloads send `origin_organization_url_slug` or `origin_project_url_slug` by type; the optimistic message carries `origin_type`/`origin_id`.
- [ ] **AC-5**: Messages sent from the org-page drawer are stored with `origin_type="organization"` and show the existing organization label for both participants. No backend changes.

### Clean-up

- [ ] **AC-6**: Remove from `pages/chat/[chatUUID].tsx` the `origin_organization` query handling: origin state, `originRejected`/retry-without-origin after a 400, and the `getOrganizationOriginBySlug` import; remove `getOrganizationOriginBySlug` from `messageOriginOperations.ts`. Remove the query param from the org page navigation (`handleConnectBtn` is replaced by the drawer open handler).
- [ ] **AC-7**: Keep backend origin checks, `GET /api/organization-origin/{id}/`, and the organization label in `Message.tsx` with its texts.

### Unchanged

- [ ] **AC-8**: Button visibility (logged-in users who cannot edit the organization), recipient, chat creation (`startPrivateChat` with the creator, now via the drawer), the full chat page `/chat/<uuid>` and its notification deep links, and the project page drawer.

### Docs & verification

- [ ] **AC-9**: Update flow 7 "Contact From an Organization Page" in `doc/mosy/flows/core-flows.md` (drawer instead of navigation; no `origin_organization` query param). `doc/api-documentation.md` needs no change unless it mentions the query param — check and fix.
- [ ] **AC-10**: `yarn lint`, `yarn check-types` and `yarn test` pass.

## Implementation plan

1. `ChatDrawer.tsx`: widen the `origin` type; build the slug payload field from `origin.type` for both POST and socket paths.
2. Texts: add the organization context term (EN/DE) in the organization texts; reuse "Contact person" if an equivalent exists there, otherwise add it.
3. `pages/organizations/[organizationUrl].tsx`: add `chatDrawerOpen` state; the button handler opens the drawer; render `<ChatDrawer open onClose contactPerson={creator} contextTerm contactRole origin={{ type: "organization", urlSlug: organization.url_slug, id: organization.id }} />` when a creator exists. Drop the now-unused `startPrivateChat` import.
4. `pages/chat/[chatUUID].tsx` + `messageOriginOperations.ts`: delete the query-param origin code (AC-6) and any tests covering it.
5. Update the flow doc (AC-9).

## Tests

**Jest**:
- Organization page: clicking "Send message" opens the drawer and does not call `router.push`.
- `ChatDrawer` with an organization origin: POST/socket payload contains `origin_organization_url_slug` and not `origin_project_url_slug`; optimistic message has `origin_type="organization"`.
- `ChatDrawer` with a project origin still sends `origin_project_url_slug` (regression).
- Chat page: no origin handling remains (existing origin-from-query tests removed or updated).

**Manual**: as user A, open an organization page, click "Send message", send a message without leaving the page; user B sees the organization label in inbox and in `/chat/<uuid>`; reopening the drawer shows the history; check mobile and desktop placement.

## Out of scope

- "Send message" for logged-out visitors.
- A deep link that auto-opens the drawer (`?openContactChat=true`).
- Drawer on the profile page and hub ambassador boxes (planned later).

## Open questions

1. Does the organization texts file already have a "Contact person" label, or should the project one be shared?

## Log

- 2026-11-02 — Spec drafted from issue #2367 and the current `ChatDrawer`, org page and chat page code.
