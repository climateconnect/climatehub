# Code Review: Contact chat drawer on the organization page

**Branch:** `adding-chat-drawer-on-org-page`
**Issue:** [#2367](https://github.com/climateconnect/climatehub/issues/2367)
**Spec:** [`20261102_1000_issue_2367_contact_chat_drawer_on_organization_page.md`](../spec/20261102_1000_issue_2367_contact_chat_drawer_on_organization_page.md)
**Reviewed against:** `master` at branch head `9154456ac`
**Date:** 2026-11-03
**Reviewer:** Claude (code-review agent, forked; findings re-verified in the main session)

---

## Summary

The branch replaces the organization page's "Send message" navigation with the `ChatDrawer` already used on the project page. It widens the drawer's `origin` prop to accept organizations, and removes the `origin_organization` query handling from the chat page.

**Verdict: changes requested.** The drawer opens and messages arrive tagged correctly. But **the sender's own message does not show the organization label**, which breaks AC-4 and AC-5. A manual test confirmed this. It should have been caught before review: the spec's manual test step and a check of the sender's view would have shown it. The new tests hide it because their fixture does not match what the page actually gets from the server.

The WebSocket is currently not working in any environment, so every message goes through the POST fallback. This review judges behaviour on that path. WebSocket-only concerns are listed separately and are not blocking.

**Checks:** Jest suites for `communication/chat` and `organization` pass (5 suites, 45 tests). They pass *with* the bug below in place.

---

## Findings

Severity legend: **Blocking** = must be fixed before merge · **Low** = small defect · **Test** = test quality · **Product** = needs a product decision, not an engineering fix.

### 1. [Blocking] The organization id never reaches the drawer, so the sender sees no label

`pages/organizations/[organizationUrl].tsx:439` passes `origin={{ type: "organization", urlSlug: organization.url_slug, id: organization.id }}`. But `organization` comes from `parseOrganization()` (`public/lib/organizationOperations.ts:5-19`), which does not copy `id`. So `origin.id` is always `undefined` in production.

**What happens:**

1. The POST sends `origin_organization_url_slug`. The backend resolves the slug and stores the message correctly tagged, so the recipient sees the label.
2. The drawer then adds the sender's copy with `origin_type: "organization", origin_id: undefined`.
3. `Message.tsx` skips the label when `!message.origin_id`, so **the sender's message has no organization label**. It only appears after reopening the drawer, when the history is fetched again from the server.

**Why it was missed:** the project page works because its own `parseProject` (`pages/projects/[projectId]/index.tsx:511`) copies `id: project.id`. The branch copied that pattern without checking that the organization parser does the same. Before this branch, nothing on the organization page needed the id, because the chat page looked it up by slug through `getOrganizationOriginBySlug`. The spec's "Key finding 4" ("The drawer already receives the organization id from the page") is incorrect, and the implementation relied on it without checking. The drawer's props are untyped on the page side, so `yarn check-types` does not catch it.

**Fix:** add `id: organization.id` to `parseOrganization`. The organization detail serializer already returns `id`. Check other users of `parseOrganization` for side effects (the edit page).

### 2. [Test] The page test fixture hides finding 1

`src/components/organization/OrganizationPage.test.tsx:56` builds `organization` by hand with `id: 3`, instead of passing a server-shaped response through `parseOrganization`. The assertion `props.origin` equals `{ type: "organization", urlSlug: "test-org", id: 3 }` passes in Jest, but in the real page the id is missing.

**Fix:** build the fixture with `parseOrganization(<server-shaped response>)`, or add a unit test for `parseOrganization` that asserts `id` is kept. The test must fail before the finding 1 fix and pass after it.

### 3. [Test] The drawer test does not check the sender's message

`src/components/communication/chat/ChatDrawer.test.tsx:323` only checks the POST payload. AC-4 also requires that the sender's message carries `origin_type: "organization"` and `origin_id`. Add an assertion that the rendered sender message carries both fields, or shows the label.

### 4. [Test] An assertion that can never fail

`OrganizationPage.test.tsx:12` mocks `next/router` and asserts that `push` is never called. The page no longer uses the router for this action, so the assertion is always true. The drawer-opens assertion already covers the intent. Remove the router assertion, or replace it with a meaningful check.

### 5. [Low] No fallback when the server rejects the organization tag

`ChatDrawer.tsx:291`: the chat page used to retry without the origin after a 400. Removing that retry was requested by AC-6. Now, if the server rejects the tag, the drawer shows an error and the message is not sent. The server rejects it only if the recipient (the creator) is no longer an organization admin, for example after being demoted between page load and sending. The project drawer has always behaved the same way, so this is consistent and not a regression of the drawer. No change needed unless product wants a fallback.

### 6. [Product] "Send message" is hidden for organizations without a creator

`[organizationUrl].tsx:340` changes the button condition from `user && !canEdit` to `user && !canEdit && creator`. AC-8 says button visibility is unchanged. In practice nothing changes for users: on master, for an organization without a creator, `startPrivateChat(undefined, …)` failed and the click did nothing. The branch now hides a button that never worked. The drawer needs a contact person, so the guard is justified for this task.

**Open for product:** what should happen for organizations whose creator left, and whether another admin should receive the message instead? This is out of scope for #2367. It should be raised as a separate issue.

---

## WebSocket path (not blocking: socket currently down)

Once the WebSocket works again, these need attention:

- **Label can stay hidden for the session.** The socket path adds the sender's message before the server has saved it. The first label lookup (`GET /api/organization-origin/{id}/`) can then get a 403, and `fetchOriginContext` caches that `null` for the whole session. The removed `getOrganizationOriginBySlug` had a comment describing exactly this situation. The POST path is not affected, because the message is saved before the sender's copy is added.
- **No test checks the socket payload.** Nothing asserts that it contains `origin_organization_url_slug` (AC-4).

---

## Regression check

- **Project page drawer:** the only change to `ChatDrawer` is choosing the slug field by origin type. Project messages still send `origin_project_url_slug`. No regression.
- **Chat page:** after removing the `origin_organization` handling, nothing in the codebase still builds `?origin_organization=` links or calls `getOrganizationOriginBySlug`.
- **Backend:** unchanged. It reads the slug from the request and never uses an id sent by the client, so stored tags are correct in all cases.

---

## Required before merge

- [ ] Fix finding 1 (`parseOrganization` keeps `id`).
- [ ] Fix finding 2 so the test would have caught finding 1.
- [ ] Fix findings 3 and 4.
- [ ] Correct "Key finding 4" in the spec.
- [ ] Manually check as **the sender**: send from the organization page and confirm the label shows on your own message without reopening the drawer. Check the recipient side in inbox and `/chat/<uuid>`.
- [ ] Raise finding 6 with product as a separate issue.
