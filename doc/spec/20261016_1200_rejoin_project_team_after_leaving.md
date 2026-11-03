# Allow Re-Joining a Project Team After Leaving or Being Removed

**Status**: DRAFT
**Type**: Backend — bugfix
**Date created**: 2026-10-16
**GitHub Issue**: [#2041](https://github.com/climateconnect/climatehub/issues/2041)

**Depends on**:
- `MembershipRequests` model — `backend/organization/models/members.py`
- `ProjectMember` model — same file (`unique_together = ("user", "project")`, `is_active` flag)
- `MembershipRequestsManager` — `backend/organization/utility/requests.py`
- `LeaveProject`, `UpdateProjectMemberView`, `AddProjectMembersView`, `RequestJoinProject`, `ManageJoinProjectView` — `backend/organization/views/project_views.py`
- `Notification.membership_request` (`on_delete=CASCADE`) — `backend/climateconnect_api/models/notification.py`

---

## Problem Statement

A user who was once a team member of a project cannot request to join that team again. The typical flow:

1. User requests to join, an admin approves, the user becomes a member.
2. The user leaves the team (or an admin removes them).
3. The user requests to join again and gets an error ("Request already exists to join project").

### Root cause

`MembershipRequests` has `unique_together = ("user", "target_project")` and `MembershipRequestsManager.__init__` rejects a new request when **any** row exists for the user and target, regardless of `request_status` (`requests.py:54-67`). The approved request from step 1 is never removed when the membership ends, so it blocks every future request.

### Two removal paths behave differently

| Path | Code | What happens to `ProjectMember` | What happens to `MembershipRequests` |
|---|---|---|---|
| User leaves | `LeaveProject.post` (`project_views.py` ~L1750) | **Soft**: `is_active = False`, row stays | Untouched |
| Admin removes member | `UpdateProjectMemberView.perform_destroy` (`project_views.py` ~L1380) | **Hard**: row deleted | Untouched |

### A second, latent bug the issue's proposed fix does not cover

The issue proposes: *"upon removal from a team also remove the matching join request"*. That fixes the "request already exists" error, but for users who **left** (soft path) the flow would still break on approval:

- `ProjectMember` keeps the inactive row, and has `unique_together = ("user", "project")`.
- `MembershipRequestsManager.__init__` (approve path) calls `is_part_of_project`, which counts **inactive** members too (`utility/project.py:264`) and fails with "User is already a member of the project".
- Even if that check passed, `add_project_member` does `ProjectMember.objects.create(...)` and would hit an `IntegrityError` on the unique constraint.

So re-joining after leaving needs both: the stale request removed **and** approval able to reactivate the inactive membership. `AddProjectMembersView` already reactivates inactive members (L1359-1363), so there is precedent for the reactivation behaviour.

### Expected behaviour (from the issue)

- A previous team membership does not prevent the user from requesting to join again.
- A previously **rejected** request keeps blocking a new request (current behaviour is intended).
- Join requests are history worth keeping, but the one tied to an ended membership may be removed.

---

## Acceptance Criteria

### AC-1: Ending a membership removes the matching join request

**AC-1.1** When a user leaves a project via `LeaveProject`, the `MembershipRequests` row for `(user, target_project)` is deleted if it exists and its status is `APPROVED`.

**AC-1.2** When an admin removes a member via `UpdateProjectMemberView` (DELETE), the same cleanup happens for the removed member.

**AC-1.3** `REJECTED` and `PENDING` requests are never deleted by AC-1.1/1.2. (A user with a pending request can't be an active member, so this is just a safety rule.)

**AC-1.4** The cleanup and the membership change happen in one transaction (`transaction.atomic`): either both are applied or neither is.

**AC-1.5** Cleanup is a no-op, without error, if no matching request exists (e.g. members added directly via `AddProjectMembersView` or as project creator never had a request).

**AC-1.6** The shared logic lives in one helper (e.g. `remove_approved_membership_request(user, project)` in `organization/utility/requests.py`) used by both views, not duplicated.

### AC-2: A former member can request again

**AC-2.1** After AC-1, `POST` to the join-request endpoint for a project the user previously left or was removed from returns 200 and creates a new `PENDING` request.

**AC-2.2** A user with a `REJECTED` request still gets HTTP 400 "Request already exists to join project" (unchanged).

**AC-2.3** A user with an existing `PENDING` request still gets HTTP 400 (unchanged).

**AC-2.4** An active member requesting to join is not part of this fix; existing behaviour is kept. (Consider a clearer error in a follow-up, see Out of Scope.)

### AC-3: Approving a re-join request reactivates the inactive membership

**AC-3.1** `is_part_of_project` (or the check in `MembershipRequestsManager`) only treats **active** members as "already a member". A user with an inactive `ProjectMember` row can have a request approved.

**AC-3.2** `approve_request` / `add_project_member`: if an inactive `ProjectMember` row exists for `(user, project)`, it is reactivated (`is_active = True`) and its `availability` is updated from the request. The role is reset to `Member` and `role_in_project` to `None`, so a re-joiner does not silently regain previous admin rights. No second row is created.

**AC-3.3** If no row exists, a new `ProjectMember` is created (current behaviour).

**AC-3.4** `is_part_of_project` is only used in `requests.py`. If its semantics change, confirm no other caller exists (verified 2026-10-16: none) and update its docstring.

### AC-4: Notifications

**AC-4.1** `Notification.membership_request` is `CASCADE`, so deleting the request also deletes the "user requested to join" and "request approved" notifications that reference it. This is accepted: they describe a membership that no longer exists, and a new request creates fresh notifications.

**AC-4.2** The cleanup must not leave an orphaned `UserNotification` row (it cascades from `Notification`). Add a test that confirms this.

### AC-5: Existing stuck users

**AC-5.1** Users who left or were removed before the fix still have a stale approved request. Provide a one-off backfill, a management command `cleanup_stale_membership_requests` under `backend/organization/management/commands/`, that deletes `APPROVED` requests for projects where the user has no active `ProjectMember` row.

**AC-5.2** The command has a `--dry-run` flag that only reports counts and ids, logs each affected `(user_id, project_id, request_id)`, and is idempotent.

**AC-5.3** The command is run once after deploy. It is not scheduled and not a data migration (operational data fix, not schema history).

### AC-6: Tests (`backend/organization/tests/`)

- Leave → rejoin: leave, then request again returns 200; the old request is gone.
- Admin removal → rejoin: same, via the DELETE member endpoint.
- Rejected request still blocks a new request (400).
- Pending request still blocks a new request (400).
- Leave → request → approve: the existing `ProjectMember` is reactivated, no duplicate row, role is `Member`, availability from the new request.
- Cleanup is a no-op when no request exists.
- Notification and `UserNotification` rows tied to the deleted request are removed (no orphans).
- Management command: dry-run changes nothing, apply deletes only approved requests without an active member, idempotent.
- Atomicity: if the cleanup fails, the membership change is rolled back.

Use `factory_boy` factories and the existing test helpers (`organization/tests/_helpers.py`). Follow `test_membership_requests_admin.py` for style.

### AC-7: Documentation

- `doc/api-documentation.md`: document the join request, leave and remove member behaviour (a former member can request again; approved requests are removed when membership ends).
- `doc/domain-entities.md`: note the `MembershipRequests` lifecycle (approved request is deleted when the membership ends; rejected requests are kept) and that leaving is a soft-delete of `ProjectMember`.

---

## Constraints

- **No API contract change**: endpoints, request and response shapes are unchanged. Only the 400 → 200 outcome for former members changes.
- **No schema change / migration**: `unique_together` stays. The fix is data cleanup in the views, plus reactivation logic.
- **No new dependencies.**
- **Organization membership out of scope**: `MembershipRequests` also supports organization targets, but `unique_together` only covers `target_project`, and the issue is about projects.
- **Rejected history stays**: do not delete rejected requests.
- **Frontend**: no change expected. The join button state is derived from `has_open_membership_request` and `is_member` (`project_views.py` ~L1550), which will be correct after the fix. Verify manually in the browser that the "Join" button reappears after leaving.

---

## Implementation Plan

1. **Helper** in `organization/utility/requests.py`: `remove_approved_membership_request(user, project)` deleting `MembershipRequests` where `user`, `target_project`, `request_status=APPROVED`. Returns the number of deleted rows.
2. **`LeaveProject.post`**: wrap the save and cleanup in `transaction.atomic()`; call the helper after deactivating the member.
3. **`UpdateProjectMemberView.perform_destroy`**: wrap in `transaction.atomic()`; capture `instance.user` and `instance.project`, delete the member, call the helper.
4. **Reactivation**: change `is_part_of_project` to filter `is_active=True` (or add an `active_only` param). Update `add_project_member` to `update_or_create`-style behaviour per AC-3.2 (reactivate instead of create).
5. **Management command** `cleanup_stale_membership_requests` with `--dry-run`.
6. **Tests** per AC-6.
7. **Docs** per AC-7.
8. After deploy: run the command with `--dry-run`, review the count, then run for real.

Suggested PR split: PR 1 = steps 1-4 + tests + docs (fixes the bug going forward). PR 2 = backfill command (can ship right after).

---

## Decisions

1. **Reactivated role — decided**: a re-joiner is reset to role `Member` with `role_in_project = None`, even if they were an admin before. An admin can promote them again after approval.
2. **Admin-removed users — decided**: they may request to join again immediately. Every request still needs admin approval. A permanent block would be a separate "ban" feature (out of scope).
3. **Request history — decided**: the approved request is deleted, as the issue says. The helper logs each deletion (`logger.info` with user id, project id, request id) as a minimal audit trail. No `ended_at` field or new status.
4. **Legacy duplicate rows — decided**: the helper and backfill command use `filter(...)`, never `.get()`, so zero, one or many rows are handled. The backfill logs any `(user, project)` pair with more than one `ProjectMember` row for manual review.
5. **Concurrent requests — decided**: `RequestJoinProject` catches `IntegrityError` around `create_membership_request` and returns the same 400 "Request already exists" as the normal duplicate case, instead of a 500. Add a test for it to AC-6.

---

## Out of Scope (follow-ups)

- Clearer error message when an active member tries to request to join.
- Re-join handling for **organizations** (same stale-request pattern may exist).
- Replacing the `print()` calls and the malformed error dict in `ManageJoinProjectView.post` (`f"message': 'Operation failed…"`) with proper logging and a valid response.
- Translating the duplicate-request error message (`"Request already exists to join project"` is hard-coded English).

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-10-16 | First draft from issue #2041 and code review of the leave/remove/approve paths. |
| 0.2 (Draft) | 2026-10-19 | Replaced open risks with decisions (role reset, re-request after removal, audit log, filter-not-get, IntegrityError → 400). |
