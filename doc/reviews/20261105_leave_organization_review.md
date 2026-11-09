# Code Review: Let members leave an organisation

**Branch:** `let-member-leave-an-org`
**Issue:** [#2368](https://github.com/climateconnect/climatehub/issues/2368)
**Spec:** [`20261103_1000_issue_2368_let_members_leave_organization.md`](../spec/20261103_1000_issue_2368_let_members_leave_organization.md)
**Reviewed against:** `master` at branch head `639af1745`
**Date:** 2026-11-05
**Reviewer:** Claude (code-review agent, forked; findings re-verified and discussed in the main session)

---

## Summary

The branch adds `POST /api/organizations/{slug}/leave/` (`LeaveOrganization`), a `LeaveOrganizationButton` with a confirm dialog on the organisation page, an `is_super_admin` flag on the member serializer, texts, tests and flow docs.

**Verdict: changes requested.** The backend matches the issue. A member deletes only their own membership, and a Super Admin is always blocked: they are told to hand over the role when other members remain, or to delete the organisation when they are the last member. So the single-Super-Admin rule holds. But **after a successful leave the frontend reports an error and does not reload** (findings 1 and 2), so the issue's "on success, reload the organisation page" is not met. The page does not crash: the success handler throws, and the button's `catch` turns that exception into the generic "could not leave" error.

**Checks:** backend `organization.tests.test_leave_organization` 8/8 pass · Jest `src/components/organization` 4 suites / 25 tests pass · `yarn check-types` passes, **but it does not cover this page** (see finding 1). **Manual test (2026-11-05):** reproduced. Leaving an organisation showed the error message, with no crash and no reload. After a manual reload the user was no longer a member, which confirms that the leave succeeds and the failure happens only in the frontend success path, as described in findings 1 and 2.

---

## Findings

Severity legend: **Blocking** = must be fixed before merge · **Low** = small defect · **Cleanup** = maintainability only.

### 1. [Blocking, confirmed manually] `router` is undefined, so a successful leave is reported as an error and the page is not reloaded

`pages/organizations/[organizationUrl].tsx:289`: `handleLeft` calls `router.replace(router.asPath)`, but the file never imports `next/router` or calls `useRouter()`.

**What happens:**

1. The member confirms. The POST succeeds and the membership is deleted.
2. `onLeft()` → `handleLeft` sets the success message, then throws `ReferenceError: router is not defined`.
3. `onLeft()` is called inside the `try` in `LeaveOrganizationButton.leave()` (finding 2), so the exception is caught and the page does not crash. The error has no `response`, so the generic `could_not_leave_the_organization` error is shown. According to the code, the success alert set just before should render too. The manual test reported the error message.
4. The page is not reloaded, so the Leave button stays. Clicking it again returns a 404 → the generic error again.

Finding 1 is the cause; finding 2 is why the user sees it as "could not leave" instead of a crash.

**Why it was missed:** `frontend/tsconfig.json` has `"include": ["src/*", "pages/*", …]`. `pages/*` only matches files directly in `pages/`, and nothing imports this page, so `tsc` never type-checks it. The component test mocks `onLeft`, so the page wiring is never exercised.

**Fix:** see finding 3 (reuse `redirect`), or add `const router = useRouter()`. Worth a separate look: the `tsconfig` include pattern likely leaves other nested pages unchecked too.

### 2. [Low] Success-handler errors are reported as a failed leave

`src/components/organization/LeaveOrganizationButton.tsx:55`: `onLeft()` runs in the same `try` as `apiRequest`. Any exception in the success path makes the UI say the leave failed, although the membership is already gone. This is the symptom seen in the manual test, triggered by finding 1.

**Fix:** call `onLeft()` after the `try`/`catch` (e.g. return early from `catch`), so only API errors are mapped to error texts.

### 3. [Cleanup] Reuse the existing `redirect` helper, as the project flow does

`[organizationUrl].tsx:284-290` adds two `useState` hooks, a custom success `Alert` and the broken reload. The project "Leave team" flow, which the issue says to mirror, uses `redirect(url, { message })` from `public/lib/apiOperations.ts`. Calling `redirect(`/organizations/${organization.url_slug}`, { message: texts.you_have_successfully_left_the_organization })` reloads the page with the message the same way and also fixes finding 1.

**Resolution (2026-11-09):** not applied as written, on purpose. `redirect` uses a soft `router.push`. Tested manually: the success message did not appear on the page after leaving, because `WideLayout` reads `?message=` only on mount. `handleLeft` therefore keeps a full page load (`window.location.assign` with the `message` and `hub` params), which shows the message and refetches the members and the Leave button. Findings 1 and 4 are fixed by this too.

### 4. [Low] Success and error alerts can linger

`[organizationUrl].tsx:284-285`: `leftMessage` / `leaveError` are page-level state. `leaveError` is only cleared in `handleClick`, so in the failure path of findings 1 and 2 both alerts can render together. After a soft `router.replace` the success alert stays until dismissed. This goes away with finding 3.

### 5. [Low] 404 has no `code`, and the backend messages are not translated

`organization/views/organization_views.py:1112`: the "not a member" 404 has no `code`, so a user who was already removed (e.g. by an admin in another tab) sees "Something went wrong… try again", and retrying never helps. The messages are hard-coded English although `_` is imported in the module. `LeaveProject` behaves the same way, so this is optional: either add `"code": "not_a_member"` with a matching text, or leave it consistent with projects.

---

## Discussed and accepted (no change in this task)

### Super Admin detected by role name

The leave guard (`organization_views.py:1115`) and the new `is_super_admin` serializer field (`serializers/organization.py:306`) check `role.name == "Super-Admin"`. Most other code (permissions, `ChangeOrganizationCreator`, the frontend `isCreator` / `permission === all_type`) uses `role_type == ALL_TYPE`. The two only differ if the role is renamed in Django admin or a second `ALL_TYPE` role is added, which is very unlikely.

**Decision:** acceptable. The backend guard follows the existing `LeaveProject` implementation (`project_views.py:1795`), which also checks the name. The split between a frontend enum and roles stored in the database is technical debt from the past and out of scope here.

Note for the implementer: the project *frontend* does not use a name-based flag; it uses `permission === ROLE_TYPES.all_type`. Using the existing `currentMember.isCreator` instead of the new `is_super_admin` field would match projects more closely and avoid a new API field. This is optional.

### "Last member" branch in `LeaveOrganizationButton`

The reviewer flagged the client-side last-member message (`LeaveOrganizationButton.tsx:34`) because `memberCount` comes from the paginated member list. **Withdrawn:** one member on the first page means the organisation has exactly one member, so the count is reliable for this check. It mirrors the project flow's `team_size > 1` check. The only difference from projects is deliberate: the last organisation member is told to delete the organisation, while a project deactivates itself.

---

## Out of scope: follow-up issue

### Membership logic is derived from the first page of members

The org page fetches only `members/?page=1&page_size=24` (`public/lib/organizationOperations.ts:86`) and derives from it whether the user is a member (Leave button), `canEdit`, and the `creator`, who is the contact person for the Message button. Members beyond the first 24, including a Super Admin, are invisible to that logic. Projects derive the same from `project.team`.

This predates the branch and affects orgs and projects alike. It will be raised as a separate issue, ideally with shared membership logic for orgs and projects: the backend tells the frontend the current user's role and who the Super Admin is, instead of the frontend scanning a paginated list. That would also be the place to retire the `isCreator` naming.