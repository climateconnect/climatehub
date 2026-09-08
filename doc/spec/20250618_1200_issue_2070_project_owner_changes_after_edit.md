# Fix project owner reverting from organisation to member after edit

## Problem Statement

When a project changes ownership from a personal project to an organisation-owned project and is then edited again by a different team member, the ownership can silently revert to the editing member. In the reported reproduction, user A creates a personal project and invites user B to the team. User B changes the project to an organisation-owned project for organisation X. User A then edits the project without changing the ownership toggle back to personal, and the project unexpectedly becomes a personal project owned by user A again.

This is a data-integrity bug in the edit-project flow: the project is supposed to remain organisation-owned if `parent_organization` is still set, but the client and backend can disagree about whether the project is personal and then send a PATCH that clears the organisation owner.

## Why This Happens

The root cause is a state desynchronisation between the derived client flag `is_personal_project` and the actual source of truth `project_parents.parent_organization`:

- On the frontend, the switch state is controlled by `is_personal_project`, while the owner relationship is stored on `project_parents.parent_organization`.
- In the edit form, `handleSwitchChange` updates `is_personal_project` and sometimes also updates `project_parents.parent_organization`, but the logic is asymmetric and can leave the two values out of sync.
- In the diffing step, `EditProjectRoot.getProjectWithoutRedundancies` treats `is_personal_project` as a real change and forwards it even when the underlying organisation ownership has not changed.
- The backend PATCH handler in `ProjectAPIView.patch` treats `is_personal_project: true` as a command to clear `parent_organization`, regardless of whether the organisation assignment is valid or whether the user intended a real ownership change.

Because the backend clears the `parent_organization` on that flag and then the project falls back to `parent_user`, the edited project appears as a personal project of the editing user.

## Related Code

- Frontend ownership toggle logic: [frontend/src/components/editProject/EditProjectContent.tsx](../../frontend/src/components/editProject/EditProjectContent.tsx)
- Frontend diff / request serialization: [frontend/src/components/editProject/EditProjectRoot.tsx](../../frontend/src/components/editProject/EditProjectRoot.tsx)
- Backend ownership update logic: [backend/organization/views/project_views.py](../../backend/organization/views/project_views.py)

## Desired Outcome

Project ownership should be treated as a single source of truth:

- the organisation owner should remain set when the project is an organisation project;
- a personal project should only become personal when the user explicitly changes the ownership to personal; and
- unrelated edits by another project admin must not clear the organisation owner.

The project should remain organisation-owned unless the user explicitly and intentionally changes it back to personal.

## Scope

This fix is scoped to the edit-project ownership flow and the project PATCH handling for ownership changes.

### In Scope

- Frontend edit-project switch logic for personal vs organisation project
- Diffing / payload generation before sending the PATCH
- Backend ownership update handling for `PATCH /api/projects/{slug}/`
- Regression tests covering the organisation-to-personal edge case

### Out of Scope

- General project edit UX refactors unrelated to ownership
- Broad backend permission redesign beyond the ownership fix
- Unrelated project-model changes

## Acceptance Criteria

1. Editing a project while `project_parents.parent_organization` is still set does not clear the organisation owner unless the user explicitly changes the project back to personal.
2. The request payload for editing a project does not send a stale or derived `is_personal_project` value as if it were the authoritative ownership signal.
3. `parent_organization` remains the canonical field used to decide whether a project is organisation-owned.
4. A PATCH with `is_personal_project: true` must not silently null an existing organisation owner unless the action is explicitly authorised and intentional.
5. If an invalid `parent_organization` id is supplied, it is rejected cleanly with a clear validation error instead of being silently swallowed.
6. The fix covers the reported repro: a project transferred to an organisation remains organisation-owned after a later edit by a non-organisation member who did not change the toggle back to personal.
7. Regression tests cover the reported scenario and at least one valid organisation-ownership update scenario.
8. Existing valid project-edit flows continue to work without regressions.

## Proposed Fix Strategy

### Frontend fix (primary protection)

The frontend should keep `is_personal_project` and `project_parents.parent_organization` in sync and should avoid sending the derived flag as an authoritative ownership update.

Recommended implementation:

- Make the toggle handler update the actual ownership fields together in one place.
- When switching to organisation ownership, ensure `parent_organization` is set and `is_personal_project` is derived consistently from it.
- When switching to personal ownership, ensure the user is intentionally changing the project to personal and that the organisation owner is cleared only in that case.
- Strip or ignore `is_personal_project` in the PATCH payload serialization so the backend only sees `parent_organization` as the ownership signal.

### Backend fix (defence in depth)

The backend should not treat `is_personal_project` as authority on PATCH.

Recommended implementation:

- Ignore `is_personal_project` for ownership updates unless it is explicitly validated as an intentional change.
- Determine ownership from `parent_organization` rather than from a separate boolean flag.
- Gate any detach/reset of `parent_organization` behind proper permissions and the project's actual intended state.
- Convert swallowed `Organization.DoesNotExist` errors into a 400-style validation failure instead of silently resetting the relationship to `None`.

## Constraints and Non-Goals

- This is a bug fix for the ownership regression, not a redesign of project ownership concepts.
- No change should be made to the public URL or API contract beyond validation and correct ownership handling.
- The fix should stay narrowly focused on the project edit flow and related tests.

## Testing Plan

### Regression tests to add

1. Project remains organisation-owned after a second edit by another project admin who does not change the toggle.
2. Explicit switch back to personal project still works and clears the organisation owner.
3. Invalid or stale `parent_organization` ids are rejected rather than silently nulling the org.
4. Valid organisation assignment continues to persist correctly on patch.

### Suggested validation steps

- Reproduce the issue in the frontend using the reported steps.
- Confirm the payload from `parseProjectForRequest` no longer contains stale `is_personal_project` ownership writes when the user did not change the toggle.
- Verify the backend no longer clears `parent_organization` when `is_personal_project` is sent incidentally on an unrelated save.

## Implementation Notes

This bug should be fixed at both layers because the issue is not just in the UI: the backend is also accepting a stale client-side ownership flag as a real mutation. The ideal end state is that the edit flow sends one canonical ownership signal, and the backend treats the value as authoritative only after validation.

In practical terms, the fix is meant to ensure:

- no accidental ownership reset from a stale edit state;
- no silent disconnecting of the organisation owner on routine saves; and
- a clear, deterministic ownership model for project updates.
