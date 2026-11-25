# Code Review: Project join request – start chat conversation as response

**Branch:** `start-chat-in-project-join-request`
**Issue:** [#2311](https://github.com/climateconnect/climatehub/issues/2311) (epic *Join Requests v2*, behind the `PROJECT_JOIN_REQUEST_RESPOND_CHAT` toggle)
**Spec:** [`20261117_1000_issue_2311_join_request_start_chat_response.md`](../spec/20261117_1000_issue_2311_join_request_start_chat_response.md). The spec is part of the implementation and was reviewed against the issue, not used as the source of truth.
**Reviewed against:** `master` at `853d34aab`, branch head `98757d5d8`
**Date:** 2026-11-25
**Reviewer:** Claude (main session; findings discussed with the issue author)

---

## Summary

The branch adds a **Respond** button to the join request dialog. It calls the new `POST /api/projects/<url_slug>/request_membership/<request_id>/respond/`, which gets or creates one shared group chat ("Join request for <project>") between the requester and the project admins, and opens it at `/chat/<uuid>`. The chat is stored in the new `MembershipRequests.response_chat` FK. On creation, the requester's message becomes the first chat message, tagged with the new `membership_request` origin, and `Message.tsx` renders it as "via join request for <project>". The dialog shows "Conversation started" once a chat exists. The branch also adds the toggle migration, en/de texts, tests and docs.

**Verdict: approve once finding 1 is fixed (only active admins in the chat); finding 2 is a small API fix.** Everything the issue asks for is covered:

- admins start a group chat with the requester from the dialog's Respond button
- all admins share the same chat; a second Respond reuses it and adds the admin if needed
- the chat title names the project
- the requester's message starts the chat and references the join request
- an indicator shows that a chat already exists
- the link between request and chat is generic (`MembershipRequests`, not project-specific)

**Checks:**
- Backend: `organization.tests.test_join_request_response_chat` and `chat_messages` pass, 43/43. `makemigrations --check` reports no missing migrations.
- Frontend: Jest `JoinRequestDetailDialog` and `Message` pass, 2 suites / 24 tests.
- Not run: the full suites, `yarn lint`, `make format`, and a manual test.

---

## Findings

Severity legend: **Medium** = should be fixed before or shortly after merge · **Low** = small defect · **Cleanup** = maintainability only.

### 1. [Medium] Former admins are added to the response chat

`start_response_chat` (`backend/organization/utility/requests.py:265`) selects the admins with

```python
ProjectMember.objects.filter(project=project, role__role_type__in=ADMIN_ROLE_TYPES)
```

without `is_active=True`. Leaving a project only sets `is_active = False` and keeps the role (`project_views.py:1894`). So an admin who left is added to the chat, sees the requester's message and profile, and gets notified on every reply. The issue intends the chat for the project's current admins.

Leaving may later delete the membership instead. Until then:

- add `is_active=True` to the admin query in `start_response_chat`, plus a test that an admin who left is not a participant;
- add the same filter to the admin check in `MembershipRequestOriginView` (`chat_messages/views/message_origin_views.py:180`), so a former admin can't read the request's origin details.

The same gap in `ReadWriteSensibleProjectDataPermission`, which guards the `respond` endpoint, is existing debt and stays out of scope here.

### 2. [Low] `request_status` has two formats

`MembershipRequestOriginView` returns the raw integer from the model (`message_origin_views.py:205`). The join request detail endpoint returns `"pending"` / `"approved"` / `"rejected"`. The frontend type `MembershipRequestOriginContext` (`public/lib/messageOriginOperations.ts`) copies the integer. Nothing reads the field yet, so align it now: return the string, as `JoinRequestDetailSerializer` does, and change the type to `"pending" | "approved" | "rejected"`.

---

## Decided with the issue author (no change needed)

| Point | Decision |
|---|---|
| Respond is shown on approved or rejected requests (`JoinRequestDetailDialog.tsx:304`; the dialog opens for any `?join_request=<id>`) | Fine. Decided requests leave the list, so this is only reachable by direct link; any admin may still respond. An existing chat is reused, never a second one (already implemented and tested). |
| `response_chat_uuid` in the open-requests list (`/requesters/`) is not displayed yet | Keep the field. A chat icon or link in the team-tab list is possible; a UX review of the flow follows. |
| Respond opens the full `/chat/<uuid>` page, not the chat drawer | Expected. The request is shown in a modal, so the drawer is not an option. |
| The chat name is stored in the acting admin's language | Acceptable. Content in another language than the interface is a general, rare case. |
| Creating a response chat counts toward the 4-chats-per-3-hours limit | Accepted for now. |
| Admins join an existing chat only when they press Respond | Accepted. |
| The chat title has no requester name | Accepted. |
| The requester sees the admins' names in the chat | Accepted. The team list is public. |
| The spec status is still DRAFT; the flow doc says "UI pending #2310" | Minor. The epic is behind a toggle; the docs must be correct when the epic is done. |

### Checked and fine

- Concurrent clicks end in one chat: the row lock (`select_for_update(of=("self",))`) works with the nullable `target_project` join.
- The rate limit applies only when a new chat is created, not when an existing one is opened.
- A deleted chat resets `response_chat` (`SET_NULL`); the next Respond creates a new chat.
- Message origins are validated on the server; an origin ID sent by the client is never trusted.
- The toggle migration creates `PROJECT_JOIN_REQUEST_RESPOND_CHAT` switched off in production.
- The seed message has no `MessageReceiver` rows and sends no notification, which matches the spec: no extra notification when the chat is created.
