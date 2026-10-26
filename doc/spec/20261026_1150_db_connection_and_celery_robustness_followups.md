# DB connection and Celery robustness: follow-up candidates

**Status**: DRAFT (a backlog of candidates to pick up later; not scheduled)
**Type**: DevOps / backend robustness
**Date created**: 2026-10-26

**Origin**: split out of `doc/spec/20261026_1130_issue_2352_no_celery_on_backend_slot2.md` (issue [#2352](https://github.com/climateconnect/climatehub/issues/2352)), decisions Q6, Q9 and Q10.

**Related specs**:
- `doc/spec/20261026_1130_issue_2352_no_celery_on_backend_slot2.md`: stops Celery on slot2 (`RUN_CELERY=false`)
- `doc/spec/20260826_1138_container_based_deployment_pipeline.md`: container cutover (process topology, migrations)

---

## Problem Statement

On 2026-10-26 the platform had a problem with too many open database connections. The cause is still under investigation. Candidates are heavy Celery work and Grafana dashboard queries against the production DB; slot2 is not confirmed as the cause.

The backend has no connection management beyond Django's defaults, worker concurrency is implicit, and heavy periodic tasks fan out without a limit. Exactly one beat depends only on configuration (`RUN_CELERY`, #2352).

### Why it matters

- One DB server serves the web app, Celery and reporting (Grafana). A burst from any of them can starve the others, and users then see errors.
- Without a connection budget per consumer, incidents like this one are hard to explain and prevent.
- Users have not received unread-message reminders for a long time, because the reminder email is paused.

## Baseline (measured read-only 2026-10-26)

- Postgres Flexible Server `climateconnect-postgres11`, `Standard_D2ds_v5` (2 vCores), PG 17:
  - `max_connections` 859 (15 reserved)
  - PgBouncer off
  - `idle_in_transaction_session_timeout` and `idle_session_timeout` both 0 (off)
- Redis `climateconnect-redis`, Standard C0 (256 clients); peak 68 clients, 0 errors.
- Django: no `CONN_MAX_AGE` (= 0), no `CONN_HEALTH_CHECKS`, psycopg2. One connection per request or task.
- Worst case per backend instance in full mode is ~30–32 connections:
  - web ~24 (4 ASGI workers, ~6 sync threads each)
  - `lookup` 4
  - default 2 (concurrency = CPU count; 2 pool children confirmed on production 2026-10-26)
  - masters 0–2
- `active_connections` on 2026-10-25/26: typically 12–26, one spike to **79 at 08:05 UTC** (DB CPU ~61 %) that no beat schedule explains; 0 failed connections. The server-wide limit was not reached.

## Candidates

Each candidate is independent. Pick them up as separate tasks when needed.

| # | Candidate | What it would address | Notes |
|---|---|---|---|
| F1 | **Finish the investigation of the 2026-10-26 incident** | Find the actual cause and which limit was hit (exact error message and time) | Check per-role limits (F3), application-side errors, Grafana (F2), and the 08:05 spike |
| F2 | **Grafana as a connection source** | Dashboards that query the production DB add connections and load | Know Grafana's DB role, refresh rates and query cost. Consider a separate role with its own limit, a read replica, or caching. |
| F3 | **Check the per-DB-user connection limit** | A role limit lower than `max_connections` would explain "too many connections" at low totals | Only readable from inside the DB; consider deliberate per-role limits afterwards |
| F4 | **PgBouncer (built into the Flexible Server) or app-side pooling** | Bounds and reuses server connections across web, workers and slots | Check transaction-mode compatibility (server-side cursors, session state) |
| F5 | **Set `CONN_MAX_AGE` and `CONN_HEALTH_CHECKS` deliberately** | Every request/task opens a new connection (setup cost, bursts) | The trade-off depends on F4 |
| F6 | **Explicit concurrency for the default Celery worker** | Concurrency follows the CPU count the process sees, so the connection count is implicit | Make it a configured number. The `lookup` worker topology stays. |
| F7 | **Throttle or batch the heavy tasks** | `schedule_automated_update_to_project_ranks` (daily 02:00 UTC) sends one `calculate_project_rankings` task per 100 projects, all run in parallel. Others: `fetch_and_create_location_translations` (up to 5 retries), `aggregate_autocomplete_stats` (`select_for_update(skip_locked)`), bulk deletes in `cleanup_login_tokens` / `cleanup_login_audit_logs` | Rate-limit, lower the parallelism, or spread the work |
| F8 | **`idle_in_transaction_session_timeout` on the server** | Stuck transactions hold connections and locks forever | Pick a value above the longest legitimate transaction (check `aggregate_autocomplete_stats` and migrations) |
| F9 | **Locked DB beat scheduler** | A second beat (misconfigured `RUN_CELERY`, swap overlap, container cutover) fires everything twice | `django_celery_beat` is installed but unused; a DB scheduler plus a single-beat lock gives protection in code |
| F10 | **Re-enable the paused reminder emails** | `schedule_automated_reminder_for_user_notifications` returns early, so users get no reminders | Precondition: #2352 shipped and its AC-7 verified. Consider F7-style throttling for its fan-out. |
| F11 | **Verify the lost event registration emails** | Hypothesis: task stealing by slot2 running other code | Check worker logs / Sentry for the affected tasks. Also consider retry/alerting for failed email tasks, and late acknowledgement: with the default early ack, in-flight tasks are lost on every restart. |

## Acceptance criteria (for this backlog doc)

- Each candidate picked up becomes its own task spec in `doc/spec/` and links back here.
- When a candidate is done or rejected, this doc is updated.

## System impact

*(to be filled by Archie when a candidate is picked up)*

---

## Log

- 2026-10-26: Created from the #2352 decisions. Candidates F1–F11 recorded; none scheduled. The detailed DB baseline was moved here from the #2352 spec, and the late-ack note was added to F11.
