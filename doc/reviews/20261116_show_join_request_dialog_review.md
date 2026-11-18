# Code Review: Project join requests – show request dialog

**Branch:** `show-request-dialog`
**Issue:** [#2310](https://github.com/climateconnect/climatehub/issues/2310)
**Spec:** [`20261109_1000_issue_2310_show_join_request_dialog.md`](../spec/20261109_1000_issue_2310_show_join_request_dialog.md). The spec is part of the implementation and was reviewed against the issue, not used as the source of truth.
**Reviewed against:** `master` at `903927946`, branch head `fe2a26e0d`
**Date:** 2026-11-16
**Reviewer:** Claude (main session; findings discussed with the issue author)

---

## Summary

The branch adds `GET /api/projects/<url_slug>/join_requests/<request_id>/` (`JoinRequestDetailView`, `JoinRequestDetailSerializer`). The project team tab gets a `JoinRequestDetailDialog` and an `OpenJoinRequestsList`, and a `?join_request=<id>` deep link opens the dialog. Approve/decline now return 409 for a request that was already decided. The list endpoint now also returns `message` and `requested_at`, and the branch adds texts, tests and docs (API docs, domain entities, Mosy flow).

**Verdict: approve once finding 1 is fixed (the `is_active` flag in the new view's admin check); the rest are small follow-ups.** Everything the issue asks for is covered:

- requester mini profile with a profile link
- request date
- status, with the decision date for decided requests
- who decided, visible to admins only and removed in the serializer, not just hidden in the UI
- the optional message, rendered as plain text
- approve/decline for admins on pending requests
- a linkable dialog
- the `PROJECT_JOIN_REQUEST_CONFIRMATION` toggle gate in the UI

**Checks:**
- Backend: `organization.tests.test_join_request_detail` 8/8 pass. The existing membership-request tests (all `organization/tests` modules that use `request_membership` / `MembershipRequestsManager`) pass, 27/27.
- Frontend: Jest `JoinRequestDetailDialog`, `OpenJoinRequestsList` and `ProjectTeamContent.joinRequests` pass, 3 suites / 14 tests.
- Not run: the full suites, `yarn lint` / `check-types`, and a manual test.

---

## Production impact (outside the toggle)

The UI is behind the toggle. Spec AC-4.2 deliberately leaves the backend un-toggled, so these changes ship whether the toggle is on or off:

1. **Already-decided requests return 409** (`utility/requests.py:120`, `views/project_views.py:2029`). Before this change, a stale legacy modal could reject a request another admin had already approved. The status became "rejected" while the user stayed a member. The guard fixes that bug, but the legacy modal now gets 409 instead of 400 or 200 and presumably shows its generic error.
2. **The requesters list is ordered newest first** (`project_views.py:1795`). The legacy `ProjectRequestersDialog` uses the same endpoint, so its order changes too.
3. **The requesters list now also returns `message` and `requested_at`.** The endpoint is admin-only and the fields are added alongside the old ones, so this is harmless.

Mention all three in the PR description instead of describing the PR as toggle-only.

---

## Findings

Severity legend: **Medium** = should be fixed before or shortly after merge · **Low** = small defect · **Cleanup** = maintainability only.

### 1. [Medium] `JoinRequestDetailView` admin check ignores `is_active`

`JoinRequestDetailView.get_object` (`project_views.py:1755`) treats any `ProjectMember` row with an All or ReadWrite role as an admin. Leaving a project only sets `is_active = False` and keeps the role, so an admin who left can still read the project's join requests, including the admin-only `decided_by`.

**Fix:** add `is_active=True` to the admin query, plus a test that an inactive admin gets 403 (or, for their own request, the requester payload without `decided_by`). This is new code, so hardening it doesn't change existing behaviour. The wider problem in the existing permission checks stays out of scope (see [technical debt](#projectmemberis_active-is-ignored-by-admin-and-permission-checks)).

### 2. [Medium] Heavy refresh after approval, and the legacy badge goes stale

`ProjectTeamContent.tsx` `handleDecided` calls `router.replace(router.asPath)` after an approval, which re-runs the whole `getServerSideProps` of the project page. The page already has a lighter `refreshMembers`, passed to `ProjectPageRoot` as `onMembersRefreshed` (`pages/projects/[projectId]/index.tsx:236`). Passing it to `ProjectTeamContent` would be cheaper and consistent with the event registration flow.

Separately, the open-requests badge in `ProjectContentSideButtons` fetches only on mount. After a decision in the dialog it still shows the old count, but AC-2.4 asks for the list and count to refresh.

### 3. [Low] The 409 check runs before the project-consistency check

`MembershipRequestsManager` sets `already_decided` (`requests.py:120`) before it compares the request's project with the URL's project (`:137`), and the view returns 409 first. An admin of project A who posts to A's approve/reject URL with a request ID from project B learns whether B's request has been decided: 409 means decided, 400 means pending. Little leaks, but running the guard after the consistency check closes the gap.

### 4. [Low] The dialog infers admin status from the payload shape

`JoinRequestDetailDialog.tsx:543` treats the user as an admin if `"decided_by" in request`. The UI then depends on a serializer detail, so a later change, such as always returning the key as `null`, would show the action buttons to requesters. The backend would still reject the decision. An explicit field such as `can_decide` would be more robust.

### 5. [Low] The dialog's login button bypasses `AppLink`

The logged-out state builds the sign-in href by hand with `Button href` and `getLocalePrefix`. `LoginNudge` uses `AppLink`, which adds `?hub=`, so a login started from the dialog inside a hub may not return to the hub. When the user is logged out, the nudge and the dialog also show two login prompts at the same time.

### 6. [Low] The spec contradicts itself on browser back (AC-3.7)

AC-3.7 says to use `router.replace` (shallow) and also that browser back closes the dialog. `replace` adds no history entry, so back leaves the page. The implementation follows `replace`. Decide which behaviour you want, and fix the spec or the code.

### 7. [Cleanup] Test gaps

- Frontend: no tests for closing the dialog and rewriting the URL (`setJoinRequestParam`, hash preserved), for 409 handling in approve/decline, or for the refresh calls after a decision.

### 8. [Cleanup] Import order

In `project_views.py`, `get_object_or_404` sits between the `django.db` imports, and `JoinRequestDetailSerializer` is out of alphabetical order in the serializer import list.

---

## Checked and fine

- `decided_by` is removed in `to_representation` unless the context flag `include_decided_by` is set, and the view sets it only for admins.
- 404 when the project or request doesn't exist, the request belongs to another project, or it's an organization request (the queryset is filtered on `target_project`).
- `select_related("user__user_profile", "decided_by__user_profile")`; the query count is bounded and tested.
- The message is rendered as text with `pre-wrap` (the test includes HTML in the message).
- Requesters see no action buttons; the requester path omits `decided_by`.
- Double submit is prevented, and a 409 reloads the dialog to show the current status.
- Historical decisions without a decider show "Approved"/"Declined" without "by …".
- The legacy `ProjectRequestersDialog` and `show_join_requests` are unchanged.
- Toggle off: the list isn't rendered and the `join_request` param is ignored (tested).
- All project tabs are mounted (hidden), so the deep link also works without `#team`.
- The requesters endpoint pages at 200 (`PAGE_SIZE`), which is enough for the list's single-page view.

---

## Out of scope: technical debt, separate tasks after a product decision

### `ProjectMember.is_active` is ignored by admin and permission checks

**Today:**
- Leaving a project is a soft delete. `LeaveProject` sets `is_active = False` (since 2021, `18eed3ee3`), and the row keeps its role.
- An admin removing a member hard-deletes the row (`UpdateProjectMemberView.perform_destroy`). The two exit paths are inconsistent.
- The field's help text says "Indicates whether the user is still assigned to the project".
- #2350 only added the `is_active=True` filter to `is_part_of_project` and reactivation through `update_or_create`.

**Problem:** 28 `ProjectMember` queries outside tests and migrations don't filter on `is_active`. They include:
- all classes in `organization/permissions.py`, including `ReadWriteSensibleProjectDataPermission`, which guards the requesters list and approve/reject
- the event-registration edit-rights checks
- `is_admin` in the project serializers
- the chat project-admin checks
- `get_project_admin_creators`
- the like and comment notification recipients

An admin who left the project themselves can therefore still use admin endpoints and still receives notifications. The new `JoinRequestDetailView` copied this pattern. It is hardened in this task instead (finding 1), because it is new code.

**Direction discussed (needs a product decision first):**

1. **End of membership.** Leaving and removal both hard-delete the row, and a cleanup removes the existing inactive rows. Today only leave sets `is_active = False`, so every inactive row in production is a leaver.
2. **Admin checks respect `is_active`** whatever inactive comes to mean. An inactive admin must never perform admin actions. Put the check in one helper (e.g. `is_project_admin(user, project)` on an `active()` queryset) instead of building it by hand in about a dozen places. The #2310 view would then use the helper.
3. **Optional feature: inactive members.** `is_active` becomes a temporary paused state, e.g. hidden on the public team page. This needs:
   - an admin UI that shows inactive members and makes them active again
   - decisions on who can make a member inactive, whether inactive members get notifications and chat access, whether they count toward the team size, and how the single-Super-Admin rule applies

The production count of inactive member rows by role was not run, because the read-only query via Grafana was blocked by permissions. Use it to size the cleanup:

```sql
SELECT r.name, r.role_type, pm.is_active, COUNT(*)
FROM organization_projectmember pm
JOIN climateconnect_api_role r ON r.id = pm.role_id
GROUP BY 1, 2, 3 ORDER BY 3, 4 DESC;
```

### Membership logic derived from the first page of members

The open-requests list appears only for admins found in `project.team`. That list is limited to the first page of members (the known member-list pagination bug), so an admin beyond the first 24 members does not see the list. This existed before the branch; the branch only depends on it.

---

## Second review (2026-11-18)

**Reviewed:** `3d60d9277` ("Address join request dialog review findings") on top of `fe2a26e0d`.

**Verdict: approve.** All Medium and Low findings are resolved. What's left is small cleanup that can go into this PR or be skipped.

**Checks:**
- Backend: `organization` 813 tests OK (15 skipped), including the 3 new tests in `test_join_request_detail`.
- Frontend: Jest `JoinRequestDetailDialog`, `OpenJoinRequestsList`, `ProjectTeamContent*`, `Buttons/*`, `appLink` pass, 6 suites / 61 tests. `yarn lint` shows 0 errors (3 warnings, all in files outside this branch). `yarn check-types` reports no errors.
- Not run: a manual test.

### Status of the first-round findings

| # | Finding | Status |
|---|---|---|
| 1 | Admin check ignores `is_active` | **Fixed.** `is_active=True` is in the query. There are tests for an inactive admin: 403 on someone else's request, and no `decided_by` on their own request. The API docs are updated. |
| 2 | Heavy refresh, stale badge | **Fixed.** `onMembersRefreshed` is passed through `ProjectPageRoot` → `ProjectTeamContent` instead of `router.replace`. The badge listens for a `join-requests-changed` window event. Both have tests. |
| 3 | 409 runs before the project check | **Fixed**, with a test (a decided request from another project returns 400). See cleanup A. |
| 4 | Admin status inferred from the payload shape | **Fixed.** There is an explicit `is_admin` field (serializer, type, docs, tests). |
| 5 | Login button bypasses `AppLink`, double prompt | **Fixed.** The team tab now renders only `LoginNudge` when the user is logged out. `LoginNudge` is hub-aware and redirects to `router.asPath`, so `?join_request=` survives the login. See cleanup B. |
| 6 | Spec contradiction AC-3.7 | **Fixed.** The spec now says to keep `replace`, so browser back leaves the page. Typo: "shareable ;" has a stray space before the semicolon. |
| 7 | Frontend test gaps | **Fixed.** Tests now cover closing the dialog (param removed, other query and hash kept), the 409 path, and the refresh and event after an approval. |
| 8 | Import order | **Fixed.** |

### Remaining cleanup (optional)

**A. `requests.py` detects the inconsistency by matching the error string.** The 409 guard checks `"Inconsistent Project and Request" not in self.errors`. If someone rewords that message, the guard silently stops working. A local flag (`inconsistent_project = True` at the consistency check, then `and not inconsistent_project`) does the same thing without depending on the error text.

**B. The dialog's logged-out branch is now unreachable.** `ProjectTeamContent` mounts `JoinRequestDetailDialog` only for logged-in users. That leaves the dialog's `!user` branch unused: its login button (just switched to `appHref`), its `HubContext` use, and the test "prompts to log in when logged out". Either remove it, or keep it on purpose as a fallback for a future second entry point. The flow doc (`project-join-request-flow.md:31`) still describes the prompt as the dialog's own. The behaviour still holds, but now `LoginNudge` provides it.

**C. `TeamContent(... }: any)`.** The props were untyped before as well. The explicit `any` now also covers the new `onMembersRefreshed`. A small props type (`project`, `handleReadNotifications`, `onMembersRefreshed?: () => Promise<void>`) would be cheap.

### Checked and fine

- `is_admin` comes from the same context flag that controls `decided_by`, so the two can't disagree.
- The badge listener registers once (on mount), cleans up on unmount and calls the same `refreshRequesters` as the initial load. `refreshRequesters` returns early for non-admins.
- Reject also sends the event, so the badge count stays right; only approve refreshes the members, which is correct.
- `onMembersRefreshed` is optional in `handleDecided`, so other render paths without the prop don't break.
- A logged-out deep link opens the `#team` tab with `LoginNudge` (the documented link format includes `#team`). A link without `#team` doesn't show the prompt, but the app doesn't generate such links.

### Still open from round 1

- The **production impact** notes (409 for the legacy modal, newest-first order, extra list fields) still need to go into the PR description. I didn't check this, because the GitHub MCP isn't connected in this session.
