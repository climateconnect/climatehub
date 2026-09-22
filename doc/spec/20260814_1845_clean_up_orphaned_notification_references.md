# Clean Up Orphaned Notification References on User / Comment Deletion

**Status**: DRAFT
**Type**: Backend — bugfix / data integrity
**Date created**: 2026-08-14
**Discovered via**: Sentry issue `CLIMATEHUB-FRONTEND-S` (project page crash), `CLIMATEHUB-FRONTEND-1M` (chat page crash), and production log review of `notifications_views.py:51` 500s
**GitHub Issue**: [#2220](https://github.com/climateconnect/climateconnect/issues/2220)

**Depends on**:
- `Notification` model — `backend/climateconnect_api/models/notification.py`
- `UserNotification` model — same file
- `User` deletion (Django default behaviour — no custom signal)
- `ProjectComment` / `Comment` model — `backend/organization/models/content.py`
- `NotificationSerializer` — `backend/climateconnect_api/serializers/notification.py`

**Related**:
- Backend Sentry issues `CLIMATECONNECT-BACKEND-S/V/Y/11` (logger errors in `chat_messages/utility/chat_setup.py` "there is no user notification for X") — same family of orphaned-reference problem
- Frontend defensive fix landed in commit on 2026-08-14 (adds null guards + `Sentry.captureException` to `getNotifications` catch block) — masks the symptoms but does not fix the root cause

---

## Problem Statement

`Notification` rows in `climateconnect_api_notification` reference several FK targets that can be deleted *before* the notification is marked read or cleaned up. When any of those references is missing, the `NotificationSerializer` (used by `GET /api/notifications/` and `POST /api/set_user_notifications_read/`) throws an unhandled exception, the endpoint returns HTTP 500, and every user whose notification feed is re-serialized (e.g. after marking one notification read) is impacted — not just the user whose underlying record was deleted.

The breakages the Sentry session 2026-08-14 surfaced were confirmed against production data via the diagnostic SQL query (see "AI Insights → Diagnostic SQL" below):

| Failure type | Root cause | Serializer crash site |
|---|---|---|
| `like_missing_profile` | `Notification.project_like` points to a `ProjectLike` whose `user` no longer has a `UserProfile` (user was deleted, but the `ProjectLike` survived — see "Cascade audit" below) | `NotificationSerializer.get_project_like` line 132: `UserProfile.objects.get(...)` → `DoesNotExist` |
| `follower_missing_profile` | Same pattern, but for `ProjectFollower` | `get_following_user` in `backend/climateconnect_api/utility/notification.py:262` → `UserProfile.objects.filter(...)[0]` → `IndexError` |
| `org_follower_missing_profile` | Same pattern, but for `OrganizationFollower` | Same `get_following_user` crash |
| `project_comment_null_parent` | `Notification.project_comment` points to a top-level `ProjectComment` (`parent_comment_id IS NULL`); the serializer unconditionally serializes `obj.project_comment.parent_comment` (None) | `NotificationSerializer.get_project_comment_parent` line 92-97: `ProjectCommentSerializer(None)` → AttributeError/TypeError on `.content` |

### Why it matters

- **Active production incident**: users hitting the notifications endpoint (after any state change — login, page nav, WebSocket push, marking one notification read) get a 500 response. On the frontend this was masked by `getNotifications()` returning `null` (silently swallowed) and the downstream `null?.filter()` turning the missing array into `undefined`, which then crashed the project page / chat page on the next render. The frontend was patched defensively on 2026-08-14 but the backend is still serving 500s.
- **Data integrity**: the system is in a state the data model says is impossible. `User` has `on_delete=CASCADE` on `UserProfile`, `ProjectFollower`, `ProjectLike`, `OrganizationFollower` — so when a user is deleted, the notification's FK target (`ProjectLike` etc.) is also deleted via CASCADE, which should CASCADE the `Notification` too. That the orphaned rows exist at all means **the cascade is not running as expected in production**, likely because user deletion in this codebase does not happen through a single canonical `User.delete()` call.
- **Recurrence risk**: every future user deletion (admin, GDPR erasure, account-self-delete) will create more orphaned rows if the upstream cause isn't fixed. Cleaning the existing data without fixing the cause is a one-off.
- **Scope creep beyond notifications**: the same orphan pattern is visible in chat_messages (`chat_messages/utility/chat_setup.py:88` — `UserNotification.DoesNotExist` on `set_read`). The fix here may surface or resolve adjacent issues.

### Current state (confirmed against production schema on 2026-08-14)

- The `Notification` model's FK targets use `on_delete=CASCADE` (verified — see `notification.py:76, 85, 97, 106, 115, 124, 133, 142, 151, 166, 174`).
- `UserProfile.user` is `OneToOneField(User, on_delete=CASCADE)` (`user.py:27`).
- `ProjectLike.user`, `ProjectFollower.user`, `OrganizationFollower.user` are all `ForeignKey(User, on_delete=CASCADE)`.
- `UserNotification` is `ForeignKey(Notification, on_delete=CASCADE)` and `ForeignKey(User, on_delete=CASCADE)`.
- The diagnostic SQL (AI Insights) returned rows for at least one user in all four failure categories above. This is the production reality today, not a theoretical concern.
- The frontend fix landed in commit on 2026-08-14 (see session digest) and adds null guards + `Sentry.captureException`. The backend fix is out of scope of that change.

---

## Acceptance Criteria

### AC-1: Cascading delete behaves correctly when a user is deleted

**AC-1.1** When a `User` is deleted (via any path — Django admin, custom management command, GDPR erasure, or API), the following chain executes and completes successfully:
- All `UserProfile` rows for the user are deleted (CASCADE from `User`)
- All `UserNotification` rows for the user are deleted (CASCADE from `User`)
- All `ProjectFollower` rows where `user_id = deleted_user.id` are deleted (CASCADE from `User`)
- All `OrganizationFollower` rows where `user_id = deleted_user.id` are deleted (CASCADE from `User`)
- All `ProjectLike` rows where `user_id = deleted_user.id` are deleted (CASCADE from `User`)
- All `IdeaSupporter` rows where `user_id = deleted_user.id` are deleted (CASCADE from `User`)
- All `MembershipRequest` rows where `user_id = deleted_user.id` are deleted (CASCADE from `User`)
- All `Notification` rows that referenced any of the above (via FK CASCADE from the above) are deleted

**AC-1.2** No `Notification` row exists in `climateconnect_api_notification` with a non-null FK to a deleted `ProjectLike`, `ProjectFollower`, `OrganizationFollower`, `IdeaSupporter`, `MembershipRequest`, or `ProjectComment` after the chain completes.

**AC-1.3** A management command is provided that can be run ad-hoc to identify the code path(s) where user deletion is happening in this codebase, and what each path does to the cascade. The output is a list of:
- Source file and function/method
- The exact call used to delete the user (e.g. `user.delete()`, `User.objects.filter(...).delete()`, `auth_user` raw SQL, etc.)
- Whether the path is covered by AC-1.1's chain

### AC-2: Cascading delete behaves correctly when a top-level project comment is deleted

**AC-2.1** When a `ProjectComment` with `parent_comment_id IS NULL` (a top-level comment) is hard-deleted (or soft-deleted and then hard-deleted), the following chain executes:
- All `Notification` rows with `project_comment_id = deleted_comment.id` are deleted (CASCADE from `ProjectComment.comment_ptr_id` → `Notification.project_comment_id`)

**AC-2.2** No `Notification` row exists with `project_comment_id` pointing to a deleted `ProjectComment`.

**AC-2.3** The existing `get_project_comment_parent` serializer method is fixed to not crash when `parent_comment` is `None` — either by guarding with `if obj.project_comment.parent_comment` or by returning `None` explicitly. This is a defensive fix; the cascade fix above is the real correctness fix.

### AC-3: Diagnostic cleanup of existing orphaned rows

**AC-3.1** A one-off management command `clean_orphaned_notifications` is provided (under `backend/climateconnect_api/management/commands/`) that:
- Identifies all `Notification` rows where any FK target is missing (replicating the diagnostic SQL)
- Logs the count of each failure type
- Deletes the `UserNotification` link (or, if preferred for safety, the `Notification` itself) for each orphaned row
- Is idempotent (running twice produces the same result)
- Is safe to run against production: no destructive changes beyond the intended cleanup
- Has a `--dry-run` flag that reports counts without deleting

**AC-3.2** After running the command against production, the diagnostic SQL returns zero rows for all failure types.

**AC-3.3** After running the command against production, the `POST /api/set_user_notifications_read/` endpoint no longer returns 500s for the previously-affected users.

### AC-4: Tests

**AC-4.1** Backend tests using `factory_boy` and the existing test infrastructure:
- Test: deleting a user removes all their `UserNotification` rows, all `ProjectFollower`/`OrganizationFollower`/`ProjectLike` rows, and any `Notification` rows that referenced those.
- Test: deleting a top-level `ProjectComment` cascades to remove the `Notification` row(s) that referenced it.
- Test: after both deletions, running the diagnostic SQL returns zero orphaned rows.
- Test: the `clean_orphaned_notifications` management command is idempotent and `--dry-run` works.

**AC-4.2** A test for the `NotificationSerializer` directly:
- Construct a `Notification` row with a `project_comment` whose `parent_comment` is `None` and assert serialization does not raise.

### AC-5: Documentation

**AC-5.1** `doc/domain-entities.md` (or the equivalent data-model doc) gets a short section on the notification FK cascade chain and what code paths must preserve it.

**AC-5.2** `doc/operations/user-deletion.md` (new file or section in an existing operations doc) lists the canonical user-deletion patterns and which ones are safe.

---

## Constraints and Non-Negotiable Requirements

- **No data loss beyond the orphans**: the cleanup command must only delete rows that are demonstrably orphaned (the diagnostic SQL proves the FK target is missing). It must not delete valid notifications.
- **GDPR**: ensure the cascade fix is consistent with the project's GDPR data handling — user deletion must remove all personal data associated with the user, including notification history (which is already the case via CASCADE on `UserNotification`).
- **Backwards compatibility**: no change to the public API contract (`GET /api/notifications/`, `POST /api/set_user_notifications_read/`). The serializer's response shape and field values for valid notifications must be byte-identical.
- **No new dependencies**.
- **No DB schema change** — the cascade behaviour is already declared correctly in the models; the gap is in the code paths that bypass it.
- **Production safety**: the cleanup command must default to `--dry-run` or require an explicit `--apply` flag, and must log every row it intends to delete (or deletes) so an operator can audit.

---

## Domain Context

### The cascade chain (what should happen)

`User → CASCADE → UserProfile, ProjectFollower, OrganizationFollower, ProjectLike, IdeaSupporter, MembershipRequest, UserNotification`
- `UserNotification.notification → CASCADE → Notification`
- `Notification.project_follower → CASCADE → ProjectFollower` (so deleting the follower deletes the notification)
- `Notification.project_like → CASCADE → ProjectLike`
- `Notification.organization_follower → CASCADE → OrganizationFollower`
- `Notification.idea_supporter → CASCADE → IdeaSupporter`
- `Notification.membership_request → CASCADE → MembershipRequest`
- `Notification.project_comment → CASCADE → ProjectComment` (which itself extends `Comment`)
- `ProjectComment.comment_ptr → CASCADE → Comment` (the `Comment` base row)

So in theory, deleting a `User` should transitively delete every notification tied to them. The fact that orphaned rows exist means at least one user-deletion path is bypassing Django's CASCADE — most likely by deleting the `UserNotification` or `Notification` rows directly, or by deleting from a lower-level model in a way that doesn't trigger the full chain.

### The serializer contract

`NotificationSerializer` is consumed by:
1. `ListNotificationsView` (`GET /api/notifications/`) — returns the user's unread notification feed
2. `SetUserNotificationsRead` (`POST /api/set_user_notifications_read/`) — marks notifications read, then re-serializes all remaining unread notifications to return them in the response

The second is the more dangerous one: marking **one** notification as read triggers serialization of **all** remaining unread notifications. A single orphaned row poisons the entire response.

### Comment deletion

`ProjectComment` is a multi-table-inheritance child of `Comment` (PK is `comment_ptr_id`). The `parent_comment_id` is on the `Comment` base table. When a `Comment` is deleted, the `CASCADE` on `Comment.parent_comment` means any child comments are also deleted. But the serializer's `get_project_comment_parent` doesn't check for `None` before calling `ProjectCommentSerializer(None)` — this is a latent bug independent of the data cascade.

### Why "ideas no longer in use" still appears in the diagnostic

The `Notification` model still has `idea_comment_id` and `idea_supporter_id` FKs. Even if new idea-related notifications are no longer created, old ones persist until read or until the user is deleted. The diagnostic query includes idea checks; the fix should handle them too (the `get_idea_supporter_chat` and `get_idea_supporter` serializer methods have the same `UserProfile` and `DoesNotExist` landmines).

---

## AI Insights

### Implementation Hints

- **Find the user-deletion paths first**: before writing the cleanup command, write the management command from AC-1.3 that scans the codebase for `user.delete()`, `User.objects.filter(...).delete()`, `auth_user` references, and any `subprocess`/`call_command` that might bypass Django. The output of this command is the prerequisite for AC-1.1 — you can't fix the cascade if you don't know which paths are broken.
- **Cleanup command design**: prefer `UserNotification.objects.filter(notification_id__in=orphaned_ids).delete()` over `Notification.objects.filter(id__in=...).delete()` as the first cut, because deleting the `UserNotification` link is what unblocks the user's UI without affecting other users who might be reading the same notification row (rare, but possible — e.g. a notification referenced by both a `project_follower` and a `project_comment` through shared creation, though the current model only allows one FK at a time). In practice, the `Notification` row is also safe to delete since its other target is also broken.
- **Serializer fix for `get_project_comment_parent`**: the minimal change is `if obj.project_comment and obj.project_comment.parent_comment:` before serializing. This matches the pattern in `get_idea_comment_parent` at line 157-158.
- **Idempotency**: the cleanup command should use the same diagnostic SQL as the verification step. After the first run, the same SQL returns zero rows, so a second run is a no-op.
- **Logging**: use `logger.warning` (not `logger.error`) for the cleanup command's per-row output, since these are pre-existing data issues being resolved, not new errors.

### Diagnostic SQL (validated against production schema on 2026-08-14)

This query (replace `:user_id` with the affected user's ID) was run successfully and returned broken rows in all four categories. The same query without the `un.read_at IS NULL` filter gives a system-wide view.

```sql
WITH unread AS (
    SELECT un.id AS user_notification_id,
           n.id AS notification_id,
           n.notification_type,
           n.project_comment_id,
           n.project_follower_id,
           n.project_like_id,
           n.membership_request_id,
           n.organization_follower_id,
           n.idea_comment_id,
           n.idea_supporter_id
    FROM climateconnect_api_usernotification un
    JOIN climateconnect_api_notification n ON n.id = un.notification_id
    WHERE un.user_id = :user_id
      AND un.read_at IS NULL
)
-- 1. project_comment with null parent (serializer line 94: parent_comment is None → crash)
SELECT 'project_comment_null_parent' AS failure, u.notification_id, u.user_notification_id
FROM unread u
JOIN organization_comment c ON c.id = u.project_comment_id
WHERE u.project_comment_id IS NOT NULL AND c.parent_comment_id IS NULL
UNION ALL
-- 2. project_follower with missing UserProfile
SELECT 'follower_missing_profile', u.notification_id, u.user_notification_id
FROM unread u
JOIN organization_projectfollower pf ON pf.id = u.project_follower_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = pf.user_id
WHERE u.project_follower_id IS NOT NULL AND up.id IS NULL
UNION ALL
-- 3. organization_follower with missing UserProfile
SELECT 'org_follower_missing_profile', u.notification_id, u.user_notification_id
FROM unread u
JOIN organization_organizationfollower of2 ON of2.id = u.organization_follower_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = of2.user_id
WHERE u.organization_follower_id IS NOT NULL AND up.id IS NULL
UNION ALL
-- 4. project_like with missing UserProfile
SELECT 'like_missing_profile', u.notification_id, u.user_notification_id
FROM unread u
JOIN organization_projectlike pl ON pl.id = u.project_like_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = pl.user_id
WHERE u.project_like_id IS NOT NULL AND up.id IS NULL
UNION ALL
-- 5. membership_request with missing UserProfile
SELECT 'membership_request_missing_profile', u.notification_id, u.user_notification_id
FROM unread u
JOIN organization_membershiprequests mr ON mr.id = u.membership_request_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = mr.user_id
WHERE u.membership_request_id IS NOT NULL AND up.id IS NULL
UNION ALL
-- 6. idea_supporter with missing UserProfile (ideas no longer in use but stale rows exist)
SELECT 'idea_supporter_missing_profile', u.notification_id, u.user_notification_id
FROM unread u
JOIN ideas_ideasupporter ist ON ist.id = u.idea_supporter_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = ist.user_id
WHERE u.idea_supporter_id IS NOT NULL AND up.id IS NULL
UNION ALL
-- 7. idea_supporter with missing chat (related_idea_id is SET_NULL, chat could be gone)
SELECT 'idea_supporter_missing_chat', u.notification_id, u.user_notification_id
FROM unread u
JOIN ideas_ideasupporter ist ON ist.id = u.idea_supporter_id
LEFT JOIN chat_messages_messageparticipants mp ON mp.related_idea_id = ist.idea_id
WHERE u.idea_supporter_id IS NOT NULL AND mp.id IS NULL
UNION ALL
-- 8. idea with null hub_shared_in
SELECT 'idea_null_hub_shared_in', u.notification_id, u.user_notification_id
FROM unread u
LEFT JOIN ideas_ideacomment ic ON ic.comment_ptr_id = u.idea_comment_id
LEFT JOIN ideas_ideasupporter ist ON ist.id = u.idea_supporter_id
LEFT JOIN ideas_idea i ON i.id = COALESCE(ic.idea_id, ist.idea_id)
WHERE (u.idea_comment_id IS NOT NULL OR u.idea_supporter_id IS NOT NULL)
  AND i.hub_shared_in_id IS NULL
ORDER BY notification_id;
```

### Trade-off Notes

- **Cleanup approach: delete `UserNotification` link vs. delete `Notification` row**: deleting the link is safer (only affects the one user) but leaves the orphaned `Notification` row in the table. A follow-up admin task can clean those up. Deleting the `Notification` row itself is more thorough but could affect another user's `UserNotification` if one exists (rare but possible). **Recommendation: delete the `UserNotification` link first, log orphaned `Notification` IDs for review, and leave a follow-up task for the row-level cleanup.**
- **Why not just fix the serializer to be resilient to all four failure types?**: that's a valid defensive measure and AC-2.3 covers the comment case. But the user-deletion cascade is a real correctness issue — leaving orphaned rows means every future user deletion recreates the same problem. The serializer fix masks the symptom; the cascade fix cures the disease.
- **Management command vs. data migration**: this is operational cleanup, not schema migration. A management command (with `--dry-run` and `--apply`) is the right tool. A data migration would also work but mixes operational cleanup with schema history.
- **Don't auto-run the cleanup on every deploy**: the cleanup is a one-time data fix. After AC-1 and AC-2 are in place, no new orphans should be created. The command stays as a safety net for future incidents but is not run automatically.
- **GDPR implications**: deleting orphaned `UserNotification` rows does not affect GDPR — the user's data is already gone (the `User` is deleted, the `UserProfile` is deleted, the underlying `ProjectLike` etc. is gone). The orphaned `Notification` row is a shell that no longer represents any personal data, but it can still be deleted to be safe.

### Risks

- **The cascade audit (AC-1.3) may reveal a user-deletion path that touches production data outside Django's ORM** (e.g. a `psql` script run by support staff, a one-off `TRUNCATE auth_user CASCADE` for a test, a backup-restore that lost the cascade). These paths can't be fixed in code; they need an operational runbook update.
- **The cleanup command may be slow on large tables** — the diagnostic joins hit several large tables (`organization_projectlike`, `organization_projectfollower`). Run during low-traffic hours. Add progress logging every N rows.
- **A `Notification` row may be referenced by multiple `UserNotification` rows** (one per recipient). Deleting the `UserNotification` link for one user doesn't help the others. The `Notification` row itself must be deleted to fix all users. The diagnostic query filters by `un.user_id`, so it only catches orphans for one user at a time. A system-wide diagnostic (drop the `WHERE un.user_id` clause) is needed for the cleanup command's `--dry-run` mode.
- **`factory_boy` test factories for `User` may set up `UserProfile` inconsistently** — verify that existing tests for user deletion actually exercise the full cascade, and add a new test that explicitly checks the notification cleanup.
- **The serializer fix for `get_project_comment_parent`** changes the response shape for top-level comment notifications (the `project_comment_parent` field becomes `None` instead of crashing). Any frontend code that depends on this field being non-null for top-level comments will need a guard — search the frontend for `project_comment_parent` usage.

### Verification commands

After deploying AC-1, AC-2, AC-3 fixes, verify with:

```sql
-- Should return zero rows for all failure types
SELECT 'project_comment_null_parent' AS failure, COUNT(*)
FROM climateconnect_api_notification n
JOIN organization_comment c ON c.id = n.project_comment_id
WHERE c.parent_comment_id IS NULL
UNION ALL
SELECT 'follower_missing_profile', COUNT(*)
FROM climateconnect_api_notification n
JOIN organization_projectfollower pf ON pf.id = n.project_follower_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = pf.user_id
WHERE up.id IS NULL
UNION ALL
SELECT 'org_follower_missing_profile', COUNT(*)
FROM climateconnect_api_notification n
JOIN organization_organizationfollower of2 ON of2.id = n.organization_follower_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = of2.user_id
WHERE up.id IS NULL
UNION ALL
SELECT 'like_missing_profile', COUNT(*)
FROM climateconnect_api_notification n
JOIN organization_projectlike pl ON pl.id = n.project_like_id
LEFT JOIN climateconnect_user_profile up ON up.user_id = pl.user_id
WHERE up.id IS NULL;
```

---

## System Impact Analysis

*(To be completed by Archie mode after DRAFT review.)*

---

## Out of Scope (Follow-up Specs)

- **Chat messages admin display for deleted users**: the user mentioned a separate fix in `chat_messages` admin for deleted users. That fix may interact with this one (both touch the user-deletion path). Coordinate via the `Related` section.
- **`set_read` race condition in `chat_messages/utility/chat_setup.py:88`**: `UserNotification.DoesNotExist` when two concurrent requests try to mark the same notification as read. This is a separate race-condition issue, not a cascade issue, and should be a different spec.
- **Frontend `Header.tsx` notification bell** still uses `notifications && notifications.length > 0` — the defensive guard is correct, but if the backend cascade is fixed properly the frontend could drop the guard. Not necessary, just an option.
- **Sentry alerting on 500s from the notifications endpoint**: now that the cascade is correct, a Sentry alert on `notifications_views.py:51` 500s would catch any future regression. Worth adding as a follow-up.
- **`refreshNotifications` stale closure** in `frontend/pages/_app.tsx:141-147` — the `...state` spread can clobber state under concurrent calls. Separate frontend bug, minor (no crash, just potential UI flicker).

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 (Draft) | 2026-08-14 | First draft. Problem statement, acceptance criteria, and AI insights based on Sentry triage session 2026-08-14. Confirmed against production schema. Awaiting user review. |

---

## Log

- 2026-08-14 18:45 UTC - Task created from the Sentry triage session. Confirmed all four failure types exist in production data via diagnostic SQL. Frontend defensive fix landed in commit (see session digest). Backend cascade fix and cleanup command pending. Awaiting user review of problem statement and acceptance criteria.
