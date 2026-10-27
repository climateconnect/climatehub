# Store which admin approved or rejected a join request

**Status**: READY FOR IMPLEMENTATION
**Type**: Backend — data model / audit trail
**Date created**: 2026-10-26

**Issue**: [#2309 – Project join requests - 2. Store which admin approved or rejected a request](https://github.com/climateconnect/climatehub/issues/2309)
(milestone *Join Requests v2*; blocks #2310 "Show request dialog")

**Depends on**:
- `backend/organization/models/members.py` (`MembershipRequests`)
- `backend/organization/utility/requests.py` (`MembershipRequestsManager.approve_request` / `reject_request`)
- `backend/organization/views/project_views.py` (`ManageJoinProjectView.post`)
- `backend/organization/admin.py` (`MembershipRequestsAdmin`)

---

## Problem Statement

`MembershipRequests` stores *when* a request was approved (`approved_at`) or rejected (`rejected_at`), but not *who* decided. There is no audit trail, so nobody can answer "which admin let this person in / turned them down?". This matters for projects with several admins and even more for organization membership requests.

This story is **storage only**. Showing the decider in the UI is handled by later stories (#2310).

### Current behaviour

- `ManageJoinProjectView.post` (`POST /api/projects/<url_slug>/request_membership/<approve|reject>/<request_id>/`) is guarded by `ReadWriteSensibleProjectDataPermission`, so `request.user` is always a project admin/read-write member.
- It builds `MembershipRequestsManager(membership_request_id=...)` and calls `approve_request()` or `reject_request()`, which set status + timestamp and save. The acting user is never passed down.
- Organization requests can be created (`MembershipRequestsManager` supports `MembershipTarget.ORGANIZATION`), but there is currently **no approve/reject endpoint for organizations**, so only the project path needs wiring now.

---

## User Stories

- As a platform admin / support person, I want to see which project admin approved or rejected a join request, so that I can resolve disputes ("who added this person?").
- As a developer of #2310, I want the deciding admin stored on the request so the request dialog can display it.

---

## Acceptance Criteria

1. `MembershipRequests` has a nullable reference to the user who decided the request.
2. When a request is approved via the API, the reference is set to the approving admin (`request.user`) in the same save that sets `approved_at` and `request_status`.
3. When a request is rejected via the API, the reference is set to the rejecting admin in the same save that sets `rejected_at` and `request_status`.
4. Pending requests have the field `null`; existing approved/rejected rows stay `null` (no backfill — the information does not exist).
5. Deleting the admin's account does **not** delete the request (`on_delete=SET_NULL`).
6. The field is visible (read-only) in the Django admin change page and usable in `raw_id_fields`.
7. No change to any API response (the field is not serialized yet).
8. Tests cover approve, reject, and the admin-deleted case.
9. `doc/domain-entities.md` documents the new relationship.

---

## Proposed Solution

### 1. Model

In `MembershipRequests`:

```python
decided_by = models.ForeignKey(
    User,
    verbose_name="Decided by",
    help_text="The admin who approved or rejected the request (null while pending)",
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    default=None,
    related_name="decided_membership_requests",
)
```

- **One field for both outcomes.** `request_status` already says whether the decision was approve or reject; two fields (`approved_by`, `rejected_by`) would be redundant and allow inconsistent states.
- **FK to `User`, not `UserProfile`.** The issue says "user profile", but every other relation in this model (`user`) and in the app (`ProjectMember.user`, `Notification`) points at `User`; the profile is reachable via `user.user_profile`, and the stub serializers already take it from there. Mention this choice in the PR.
- The explicit `related_name` is required: `MembershipRequests.user` already uses the (misnamed) `related_name="users"`, and a second FK to `User` without one would clash with the default reverse accessor.

Migration: `organization/migrations/0150_membershiprequests_decided_by.py` (`makemigrations`; nullable add-column, no data migration).

### 2. Manager

`organization/utility/requests.py`:

```python
def approve_request(self, decided_by):
    ...
    self.membership_request.decided_by = decided_by

def reject_request(self, decided_by):
    ...
    self.membership_request.decided_by = decided_by
```

`decided_by` is a **required** argument so a future caller cannot forget it. The only existing callers are the view below.

### 3. View

In `ManageJoinProjectView.post` pass `request.user`:

```python
request_manager.approve_request(decided_by=request.user)
...
request_manager.reject_request(decided_by=request.user)
```

### 4. Admin

`MembershipRequestsAdmin`: add `"decided_by"` to `raw_id_fields` and `list_select_related`; add it to `list_display` after `request_status`. Optionally add `decided_by__username` to `search_fields`.

### 5. Docs

`doc/domain-entities.md`, *MembershipRequests*: add `User` (decided_by, nullable) to the ForeignKey list. No `api-documentation.md` change (no contract change).

---

## Out of Scope

- Returning the decider in any serializer / UI (#2310).
- An approve/reject endpoint for organization requests (the field is on the shared model, so it will be usable when that endpoint exists).
- Backfilling historic decisions.
- Notifying anyone about who decided.

## Known Adjacent Issues (not part of this story)

- `MembershipRequestsManager.approve_request` for organization targets uses `self.organization`, which is never set when the manager is built from an existing `membership_request_id`. That would raise `AttributeError` once an org approve endpoint is added. Worth a note in the org-approval story.
- `ManageJoinProjectView.post` swallows all exceptions into a generic 500 without logging.

---

## Testing

Add `organization/tests/test_membership_request_decided_by.py` (API-level, `APITestCase`, authenticated as a project admin with a role of type `Role.ALL_TYPE`):

| Test | Expectation |
|---|---|
| `test_approve_sets_decided_by` | POST `approve` → 200; `decided_by == admin`, `approved_at` set, status `APPROVED` |
| `test_reject_sets_decided_by` | POST `reject` → 200; `decided_by == admin`, `rejected_at` set, status `REJECTED` |
| `test_second_admin_is_recorded` | Two admins on the project; the one who acts is stored, not the project creator |
| `test_pending_request_has_no_decider` | Freshly created request → `decided_by is None` |
| `test_deleting_admin_keeps_request` | Delete the admin user → request still exists, `decided_by is None` |
| `test_non_admin_cannot_decide` | Plain member → 403; `decided_by` stays `None` |

Extend `test_membership_requests_admin.py` with one test that the changelist/change page renders with `decided_by` set.

Run: `pdm run python manage.py test organization.tests.test_membership_request_decided_by --keepdb`

## Rollout

Additive nullable column; safe to deploy backend before/after any frontend. No feature flag, no env var.
