# Let members leave an organisation ("Leave team")

**Status**: READY FOR IMPLEMENTATION
**Type**: Full stack — new endpoint + organisation page UI
**Date created**: 2026-11-03

**Issue**: [#2368 – Let members leave an organisation ("Leave team")](https://github.com/climateconnect/climatehub/issues/2368)
**Related**: #261 (closed, frontend never built), #326 (closed, backend gap), #992 (leave-confirmation warnings), #1487, #2367

**Depends on**:
- `backend/organization/views/project_views.py` (`LeaveProject` — the model to copy)
- `backend/organization/views/organization_views.py` (member update/delete view, `OrganizationMemberReadWritePermission`)
- `backend/organization/models/members.py` (`OrganizationMember`)
- `frontend/pages/organizations/[organizationUrl].tsx`
- `frontend/public/texts/organization_texts.tsx`

---

## Problem Statement

Projects have a "Leave team" button; organisations do not.

- Admins and Super-Admins can remove themselves via *Manage Members*. A regular member cannot leave at all; only an admin can remove them.
- The backend has no usable path either. `DELETE /api/organizations/<slug>/update_member/<pk>/` exists, but `OrganizationMemberReadWritePermission` only considers members whose role type is `ALL_TYPE` or `READ_WRITE_TYPE`. A regular (read-only) member removing themselves therefore gets 403, and there is no UI for it.
- Frontend issue #261 was closed in a cleanup without being implemented.

### Current behaviour (projects, for reference)

`POST /api/projects/<url_slug>/leave/` (`LeaveProject`, `IsAuthenticated`):
- 404 if the user is not an active member.
- Super-Admin with other active members → 400 "A new creator needs to be assigned first".
- Super-Admin who is the only member → project deactivated, membership deactivated.
- Anyone else → `ProjectMember.is_active = False`, 200.

The frontend (`ProjectPageRoot.tsx`) shows a confirmation dialog, calls the endpoint, then redirects with a success message; a Super-Admin gets an error message instead of the dialog.

---

## User Stories

- As a regular member of an organisation, I want to leave it myself, so that I don't have to ask an admin to remove me.
- As an admin, I want the same "Leave team" button as on projects, so that the two behave consistently.
- As a Super-Admin, I want to be told clearly that I must hand over my role first, so that the organisation is never left without an owner.

---

## Acceptance Criteria

### Backend
1. New endpoint `POST /api/organizations/<url_slug>/leave/`, authenticated users only (`IsAuthenticated`).
2. Any member (Member, Admin, Super-Admin) can leave; their `OrganizationMember` row is **deleted** (`OrganizationMember` has no `is_active`; this matches what admins already do via Manage Members). Response 200 with a message.
3. Super-Admin while other members remain → 400, message "A new Super-Admin needs to be assigned first". Membership is untouched.
4. Super-Admin who is the **last member** → 400 with a message pointing to "Delete organisation". Membership is untouched. (Differs from projects, which deactivate: `Organization` has no `is_active`, and we are deliberately not adding one for this.)
5. Authenticated user who is not a member of the organisation, or unknown slug → 404.
6. Anonymous user → 401.
7. Only the requesting user's own membership can be affected; there is no pk/user parameter.
8. Failure to process returns a generic 500 message as in `LeaveProject`, no stack traces leaked.

### Frontend (organisation page)
9. A "Leave team" button is shown to every logged-in member of the organisation, admins and Super-Admins included. Not shown to non-members or anonymous users.
10. Clicking it opens a confirmation dialog first (cancel = no request).
11. If the user is a Super-Admin, no dialog; show the translated error explaining the role must be handed over first via *Manage Members* (frontend check, backed by the 400 from the API). Text comes from `organization_texts`, not a hardcoded string.
12. On confirm and a 200 response: reload the organisation page and show a success message.
13. On an API error, show the message as an error (translated text where we have one, never a raw English backend string for the known Super-Admin cases).
14. All new copy lives in `organization_texts` in EN and DE.

---

## Proposed Solution

### 1. Backend view

Add `LeaveOrganization(APIView)` to `organization_views.py`, modelled on `LeaveProject`:

```python
class LeaveOrganization(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, url_slug):
        organization = get_object_or_404(Organization, url_slug=url_slug)  # -> 404
        try:
            membership = OrganizationMember.objects.select_related("role").get(
                user=request.user, organization=organization
            )
        except OrganizationMember.DoesNotExist:
            return Response({"message": "..."}, status=404)

        if membership.role.name == "Super-Admin":
            other_members = OrganizationMember.objects.filter(
                organization=organization
            ).exclude(id=membership.id).exists()
            if other_members:
                return Response({"message": "A new Super-Admin needs to be assigned first"}, status=400)
            return Response({"message": "You are the last member. Delete the organisation instead."}, status=400)

        membership.delete()
        return Response({"message": f"Left organization {url_slug} successfully"}, status=200)
```

Notes:
- Identify Super-Admin by `role.name == "Super-Admin"` exactly as `LeaveProject` does, so both entities share the same definition. (`Admin` and `Super-Admin` are both `Role.ALL_TYPE`, so `role_type` alone is not enough.)
- Do **not** wrap in a blanket `except Exception` that hides bugs beyond what `LeaveProject` does; let unexpected errors reach Sentry via DRF's 500 handler.
- Do not touch `OrganizationMemberReadWritePermission`; the new endpoint is separate and the existing update/delete endpoint keeps its semantics.

Route in `organization/urls.py`:

```python
path("organizations/<str:url_slug>/leave/", organization_views.LeaveOrganization.as_view(), name="leave-organization"),
```

Place it before any catch-all `organizations/<str:url_slug>/...` patterns that could shadow it.

### 2. Frontend

In `pages/organizations/[organizationUrl].tsx`:
- Derive `currentMember = members.find((m) => m.id === user?.id)` (already done inside `canEdit`; extract it) and `isMember = !!currentMember`.
- Add a "Leave team" button next to the members section headline (beside *Manage Members* for admins), icon-only on tiny screens like the existing button.
- Add `leaveOrganization()` using `apiRequest({ method: "post", url: "/api/organizations/${slug}/leave/", payload: {}, token, locale })`. On 200, `router.replace` to the same page (or `router.reload()`) carrying a success message, following the pattern used by `redirect(..., { message })` in `ProjectPageRoot.tsx`; reuse whatever mechanism the org page already has to display a post-redirect message, or add the same `Alert` pattern used there.
- Confirmation: reuse the existing `ConfirmDialog` component used by `ProjectPageRoot.tsx`.
- Super-Admin check: `currentMember.role.name === "Super-Admin"` (verify the exact member field name in `getMembersWithAdditionalInfo` / the member serializer while implementing; the page currently reads `m.permission` and `m.isCreator`).

New texts in `organization_texts.tsx` (EN + DE), suggested keys:
`leave_team`, `do_you_really_want_to_leave_this_organization`, `are_you_sure_that_you_want_to_leave_this_organization`, `you_cant_leave_an_organization_as_the_super_admin`, `you_have_successfully_left_the_organization`, `you_are_the_last_member_delete_organization_instead`.

---

## Tests

### Backend — `backend/organization/tests/test_leave_organization.py`
Use `APITestCase`, mirror setup in `test_delete_organization.py`.

| Case | Expected |
|---|---|
| Regular member leaves | 200, row deleted, others unchanged |
| Admin (not Super-Admin) leaves | 200, row deleted |
| Super-Admin with other members | 400, message "A new Super-Admin needs to be assigned first", row still exists |
| Last Super-Admin (sole member) | 400, points to delete, row still exists, organisation still exists |
| Authenticated non-member | 404 |
| Unknown slug | 404 |
| Anonymous | 401 |
| User A cannot affect user B's membership | B's row unchanged |

### Frontend
Jest test for the org page (or an extracted `LeaveOrganizationButton`): button visible for member/admin, hidden for non-member/anonymous; Super-Admin click shows error and no request; confirm triggers POST to `/api/organizations/<slug>/leave/`; cancel does not.

---

## Documentation

- `doc/api-documentation.md`: add `POST /api/organizations/<url_slug>/leave/` (auth, responses 200/400/401/404).
- `doc/mosy/flows/core-flows.md`: add/adjust the "leave organisation" flow if organisation membership flows are described there.
- No model change → `doc/domain-entities.md` unchanged.
- Run `make format` and `yarn lint` / `yarn check-types`.

---

## Out of Scope

- UX improvements to leaving, for projects or organisations (separate issue).
- Adding `is_active` to `Organization` or `OrganizationMember`.
- Auto-promoting a new Super-Admin or auto-deleting the organisation when the last Super-Admin leaves.
- Notifying remaining admins that someone left.
- Changing `OrganizationMemberReadWritePermission`.

## Open Questions

1. Should the Super-Admin-only-member case offer a direct link to "Delete organisation" in the error text? (Spec assumes a text pointer only, per the issue.)
2. Is the exact Super-Admin role name identical for organisations and projects in production data? Confirm before relying on `role.name == "Super-Admin"`.
