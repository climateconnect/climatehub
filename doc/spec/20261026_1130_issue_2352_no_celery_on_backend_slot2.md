# Backend slot2: no Celery on the standby slot (`RUN_CELERY`)

**Status**: IMPLEMENTATION (code and docs done; Azure configuration and verification pending)
**Type**: DevOps / runtime configuration
**Date created**: 2026-10-26

**GitHub Issue**: [#2352 – DevOps - Don't run celery on slot2](https://github.com/climateconnect/climatehub/issues/2352)

**Touches**:
- `backend/start_backend.sh`: startup script of the live App Service (zip deployment, code mode)
- `backend/run_celery.sh` (new): shared POSIX helper, sourced by both scripts below. Parses `RUN_CELERY`, sets `RUN_CELERY_ENABLED`, prints the startup log line.
- `docker/backend-entrypoint.sh`: the start command (`CMD`) of the backend container image. It is a separate script from `start_backend.sh` but starts the same processes.
- Azure App Service `climate-backend-appservice` (resource group `climate-connect-backend`), production slot and `slot2`. The same setting is also needed on `climate-backend-container` (see the container spec).
- `doc/environment-variables.md`, `doc/architecture.md` (AC-10)

**Related specs**:
- `doc/spec/20260826_1138_container_based_deployment_pipeline.md`: container cutover. Its section "Celery topology and migrations after #2352" carries this task over to the container backend.
- `doc/spec/20261026_1150_db_connection_and_celery_robustness_followups.md`: follow-up candidates (DB connections, the 2026-10-26 incident, the locked beat scheduler, re-enabling the reminder emails, the lost registration emails)

---

## Problem Statement

The backend runs in two Azure App Service slots: production and `slot2`. Every `master` push is deployed to `slot2`, and a person swaps the slots by hand. After the swap, `slot2` holds the previous release as a rollback target. Before a swap, the maintainer uses slot2's Django admin and API to check the new release.

Both slots run the same startup script, so both start:
- the web server
- the `lookup` Celery worker
- the default Celery worker with embedded beat

No app setting is sticky, so both slots have the same configuration, including the **same database, Redis broker and `ENVIRONMENT`**. slot2 therefore acts as a second production backend: it **consumes production background tasks and schedules production periodic tasks**.

| Effect while slot2 runs Celery | Consequence |
|---|---|
| slot2's default worker takes tasks from the shared queue | About half of all background tasks (emails, translations, rankings) can run on code that is not live: untested new code before the swap, the previous release after it. A changed task signature or model makes them fail or behave wrongly. |
| A second `lookup` worker | Celery's `rate_limit` applies per worker, so the effective LocationIQ request rate doubles. This breaks the "exactly one `lookup` worker" rule. |
| A second beat | The beat uses the local-file scheduler, so every running beat fires every periodic task on its own. That doubles token cleanup (30 min), autocomplete stats (10 min), daily project ranks (heavy DB load), audit log cleanup, and the weekly reminder email. The reminder is paused in code because of this ("Pause notifications until we figure out celery issue with deployment slot"). |
| Shared DB | Duplicate work raises the number of open DB connections and the DB load |
| Shared resources | Both slots share one App Service plan (P1v3); slot2's ~dozen Django processes take memory and CPU from production |
| Sentry | Same environment name, so slot2's errors look like production errors (optional fix, AC-O1) |

slot2 must keep Django running, because the maintainer uses its admin and API before going to production. It must not run Celery.

**Lost event registration emails (hypothesis, not verified).** A few event registration emails were lost recently; the users are still registered. One plausible cause is that slot2's worker, running different code, took these tasks and failed on them (e.g. around the guest-seats release #2356). Verifying this is F11 in the follow-up doc. This task removes the mechanism either way.

**DB connections (goal, not the incident cause).** A DB connection problem on 2026-10-26 is still under investigation and is **not** attributed to slot2 (F1/F2 in the follow-up doc). Reducing slot2's connections is still a goal:
- There is no pooling and no `CONN_MAX_AGE`: one connection per request or task.
- Worst case per slot in full mode is ~30–32 connections (web ~24, `lookup` 4, default 2, masters 0–2). Both slots: ~60–64.
- With this task, slot2 runs only the web server and no Celery (≤ ~24 connections under load, ~0 when idle, which is its normal state). Both slots then total **~54–56** worst case, and periodic and fanned-out tasks no longer run twice against the DB.

### Why it matters

- Background work has to run exactly once, from the code version that serves production.
- It is a precondition for switching the paused reminder emails back on (F10).
- Production gets the plan's full resources, and the DB only carries production's background workload.

## Options considered

| Option | Verdict |
|---|---|
| **A1: slot-sticky `RUN_CELERY`; with `false`, no Celery; the web server unchanged** | **Chosen** |
| A2: placeholder HTTP process instead of Django on slot2 | Rejected: admin and API must work on slot2 |
| B: lower Celery concurrency on slot2 | Rejected: still consumes and schedules |
| C: stop slot2 permanently | Rejected: deploys fail while it is stopped. Kept as the normal state between deployments. |
| D: separate broker per slot | Rejected: beat would still run periodic tasks against the shared DB |
| E: locked DB beat scheduler | Fixes only the double beat; follow-up F9 |
| F: bigger or separate plan | Rejected: does not fix correctness |

## Decisions (user, 2026-10-26)

| # | Question | Decision |
|---|---|---|
| Q1 | Django on slot2? | Keep it running **unchanged** (gunicorn with 4 workers, as on production). The admin and API must keep working. An idle Django uses few resources; the task is about Celery only. A 1-worker gunicorn was dropped during implementation: it would need its own sticky setting and was never asked for. |
| Q2 | Setting missing | **Run Celery.** Production must never run without Celery by mistake. |
| Q3 | Unknown value | **Treat as `true` and log a warning.** |
| Q4 | Name and values | **`RUN_CELERY=true\|false`**, Celery only. Production `true`, slot2 `false`, both deployment slot settings (sticky). |
| Q5 | Rollout and operations | slot2 stays stopped until this ships. After that it is started only around deployments. One production restart in a low-traffic window is accepted to add the setting. |
| Q6 | Re-enable the paused reminder emails | Deferred (F10) |
| Q7 | Stale scripts (`start_backend.sh` in the repo root, `backend/start_backend.bak.sh`) | Leave them; they get cleaned up with the container cutover |
| Q8 | Monitoring on slot2 | New Relic: no change (not used). Sticky non-production `SENTRY_ENVIRONMENT`: optional (AC-O1). |
| Q9 | 2026-10-26 DB connection incident | Under investigation, not attributed to slot2 (F1–F3) |
| Q10 | Connection and Celery robustness | Follow-up doc |
| Q11 | Container and LocationIQ specs | Update the container spec (done). Leave the LocationIQ spec as is; the user cleans it up separately. |
| Q12 | Case of the value | **Case-insensitive**, surrounding whitespace ignored: `true`/`True`/`TRUE` and `false`/`False`/`FALSE` are valid. Case-sensitive settings have caused errors before. |

## Desired outcome

- Values are compared **case-insensitively** after trimming whitespace (Q12).
- **`RUN_CELERY=true`** (production; also when the setting is missing, and for unknown values with a warning): exactly today's process set.
- **`RUN_CELERY=false`** (slot2):
  - dependency installation as today
  - the web server **as today** (gunicorn, 4 workers), so the Django admin, the API, `/ping/` and `/api/version/` work
  - **no** Celery worker on any queue and **no** beat
  - the container stays alive on the web server process
- The setting is defined on both slots and is sticky. A swap restarts both slots, and each comes up with its own value with no extra step.
- `backend/start_backend.sh` and `docker/backend-entrypoint.sh` behave the same way.

### Startup log line (contract for implementation and runbook)

Both scripts print **exactly one** line that starts with `RUN_CELERY: celery=`, before they start the processes. The value in quotes is the raw value as set (e.g. `'False'`):

| Situation | Line |
|---|---|
| `true` | `RUN_CELERY: celery=on (value 'true')` |
| `false` | `RUN_CELERY: celery=off (value 'false')` |
| missing | `RUN_CELERY: celery=on (not set, default)` |
| unknown, e.g. `yes` | `RUN_CELERY: celery=on (unknown value 'yes', treated as true)` |

An unknown value also prints a warning line on stderr that starts with `WARN(RUN_CELERY):`. The runbook greps for `RUN_CELERY: celery=`.

## User Stories

- As a maintainer, I want slot2 to do no background work, so that every task and every periodic job runs exactly once, on the live code version.
- As a maintainer, I want to use slot2's Django admin and API before swapping, so that I can check a release before it reaches production.
- As a maintainer, I want a swap to need no extra steps for Celery, so that production can never end up without background workers.
- As the platform, I want production to get the plan's resources and the DB's capacity, instead of sharing them with an idle copy.

## Acceptance Criteria

**slot2 (`RUN_CELERY=false`)**
- **AC-1**: After a cold start, slot2 runs no Celery worker (neither default nor `lookup`) and no beat. Checked with runbook step 4.
- **AC-2**: slot2 runs the web server as today. Once started, it accepts a deployment from the existing workflow. The Django admin (login plus browsing an object list), the API, `GET /ping/` and `GET /api/version/` work, and `/api/version/` shows the newly deployed SHA. Checked with runbook step 5.
- **AC-3**: slot2 uses clearly less memory than today. Before/after numbers are recorded in the log of this spec.

**Production (`RUN_CELERY=true`)**
- **AC-4**: Production runs exactly today's process set: the web server with 4 workers, exactly one `lookup` worker, and the default worker with embedded beat.
- **AC-5**: With `RUN_CELERY` missing, production behaves as today. With an unknown value, it behaves as `true` and logs the warning. Both print the startup log line above. `False`, `FALSE` and ` false ` behave as `false`; `True` and `TRUE` as `true`.

**Swap**
- **AC-6**: After a swap, with no manual step, the new production runs the full process set and the new slot2 runs without Celery. Checked with runbook step 6.
- **AC-7**: Outside the swap overlap, each periodic task fires once per schedule. For example, `cleanup_login_tokens` (every 30 minutes) appears in production's log only.

**Database connections**
- **AC-8**: While slot2 runs with `RUN_CELERY=false`, no Celery process on slot2 holds a DB connection. The DB's connection list or the `active_connections` metric shows production's processes plus at most slot2's web workers. Before/after numbers, including one daily ranking run at 02:00 UTC, are recorded in the log of this spec.

**Parity and docs**
- **AC-9**: `docker/backend-entrypoint.sh` behaves the same for `RUN_CELERY`, including the log line. Local `docker-compose` setups are unaffected.
- **AC-10**: `doc/environment-variables.md` describes `RUN_CELERY` (values, default, unknown values, sticky on both slots). `doc/architecture.md` no longer says the `lookup` worker runs on every slot. The runbook below is the operating reference. The setting is configured in Azure: production `true`, slot2 `false`, both sticky.

**Optional**
- **AC-O1**: slot2 has a sticky non-production `SENTRY_ENVIRONMENT`.

## Constraints

- Production availability must not regress. Adding the sticky setting restarts production once; do it in a low-traffic window.
- Production's Celery topology does not change (exactly one `lookup` worker; default worker with beat).
- No change to the swap procedure, the deployment workflow trigger, or the database migration practice.
- No secrets in the repo; `RUN_CELERY` is not secret.

## Out of scope

- Everything in `doc/spec/20261026_1150_db_connection_and_celery_robustness_followups.md`: re-enabling the reminder email, the incident investigation and Grafana, DB connection tuning, the locked beat scheduler, verifying the lost emails.
- `migrate` in the container entrypoint (decided in the container spec, section "Celery topology and migrations after #2352").
- New Relic configuration; deleting the stale startup scripts; splitting Celery into separate services; automating the start of slot2 in the deployment workflow.

---

## Operating procedure and runbook

### Operating procedure (after this ships)

1. Normally slot2 is **stopped**.
2. Before a deployment, **start slot2** (step 3). With `RUN_CELERY=false` it starts Django only.
3. Deploy (merge to `master`; the workflow deploys to slot2). A push while slot2 is stopped makes the deploy job fail; re-run it after starting slot2.
4. Optionally check the new release on slot2 (steps 4 and 5).
5. Swap, away from schedule ticks (not at :00/:10/:20/:30/:40/:50, not between 02:00 and 03:15 UTC). Then run step 6.
6. Stop slot2 again once a rollback is no longer expected (optional; with `RUN_CELERY=false` it is harmless while running).

### Runbook

All commands use the Azure CLI (checked against 2.82). Set these once per shell:

```sh
RG=climate-connect-backend
APP=climate-backend-appservice
```

Hostnames (from `az webapp show ... --query defaultHostName`):
- production: `climate-backend-appservice-d7ctamddgxb6aahg.germanywestcentral-01.azurewebsites.net`
- slot2: `climate-backend-appserv-slot2-bydthgcjexgab2fx.germanywestcentral-01.azurewebsites.net`

```sh
PROD_HOST=$(az webapp show -g $RG -n $APP --query defaultHostName -o tsv)
SLOT2_HOST=$(az webapp show -g $RG -n $APP --slot slot2 --query defaultHostName -o tsv)
```

#### Step 1: Configure the setting (once; restarts production)

Do this in a low-traffic window. Ideally slot2 is stopped. Changing app settings **restarts** the slot, and production's restart is a full cold start (apt and pdm, several minutes).

Portal:
1. App Service `climate-backend-appservice` → Settings → **Environment variables** → App settings → **+ Add**.
2. Name `RUN_CELERY`, value `true`, tick **Deployment slot setting** → Apply → Apply → Confirm.
3. Deployment slots → `slot2` → Environment variables → + Add: name `RUN_CELERY`, value `false`, tick **Deployment slot setting** → Apply → Confirm.

CLI (`--slot-settings` adds the setting and marks it sticky):

```sh
az webapp config appsettings set -g $RG -n $APP --slot slot2 --slot-settings RUN_CELERY=false
az webapp config appsettings set -g $RG -n $APP --slot-settings RUN_CELERY=true
```

Set slot2 first; that slot is stopped, so nothing happens there. The second command restarts production.

#### Step 2: Verify stickiness and values

```sh
az webapp config appsettings list -g $RG -n $APP \
  --query "[?name=='RUN_CELERY'].{name:name,value:value,sticky:slotSetting}" -o table
az webapp config appsettings list -g $RG -n $APP --slot slot2 \
  --query "[?name=='RUN_CELERY'].{name:name,value:value,sticky:slotSetting}" -o table
```

Expected:

```
Name        Value    Sticky
----------  -------  --------
RUN_CELERY  true     True        # production
RUN_CELERY  false    True        # slot2
```

If `Sticky` is `False` anywhere, fix it before the next swap. Otherwise the value moves with the swap and production ends up without Celery.

#### Step 3: Start, stop and check slot2

```sh
az webapp start -g $RG -n $APP --slot slot2
az webapp stop  -g $RG -n $APP --slot slot2
az webapp show  -g $RG -n $APP --slot slot2 --query state -o tsv    # Running | Stopped
```

Portal: App Service → Deployment slots → `slot2` → Overview → **Start** / **Stop**; the state is shown under "Status".

The cold start takes several minutes. Wait until step 5's `/ping/` answers before checking processes.

#### Step 4: Verify Celery is off on slot2 and on in production

**a) Startup log line.** In the Portal: the slot → Monitoring → **Log stream**. Or with the CLI:

```sh
az webapp log tail -g $RG -n $APP --slot slot2 | grep --line-buffered 'RUN_CELERY'
az webapp log tail -g $RG -n $APP              | grep --line-buffered 'RUN_CELERY'
```

`log tail` only shows new output, so start it before (re)starting the slot. Alternatively, download the logs afterwards with `az webapp log download -g $RG -n $APP --slot slot2 --log-file slot2-logs.zip` and grep the unzipped files. Expected:
- slot2: `RUN_CELERY: celery=off (value 'false')`
- production: `RUN_CELERY: celery=on (value 'true')`
- No `WARN(RUN_CELERY):` line on either slot.

The same output is in the slot's SSH shell (step 4b), under `/home/LogFiles` (confirmed on production on 2026-10-26). This also works after the fact:

```sh
grep -h 'RUN_CELERY' /home/LogFiles/*_default_docker*.log | tail -5
```

The files rotate at ~2 MB (`*_default_docker.1.log`, `.2.log`, …), so the glob includes the rotated files.

Only if no `*_default_docker.log` files are written: enable container logging with `az webapp log config -g $RG -n $APP [--slot slot2] --docker-container-logging filesystem`. This also restarts the slot.

**b) Process list (SSH).** Open the shell in the Portal: the slot → Development Tools → **SSH** → Go. Or with the CLI: `az webapp ssh -g $RG -n $APP --slot slot2` (without `--slot` for production). Then run:

```sh
ps -eo pid,ppid,args | grep -E '[c]elery|[g]unicorn'
```

If `ps` is missing, use this instead:

```sh
for p in /proc/[0-9]*; do tr '\0' ' ' < $p/cmdline; echo; done | grep -E '[c]elery|[g]unicorn'
```

Expected on **slot2**: only gunicorn, 5 lines (master and 4 workers), as on production. **No line containing `celery`.**

```
 1234   980 ... gunicorn --preload --bind=0.0.0.0 climateconnect_main.asgi:application -w 4 -k uvicorn.workers.UvicornWorker
 1240  1234 ... gunicorn --preload --bind=0.0.0.0 climateconnect_main.asgi:application -w 4 -k uvicorn.workers.UvicornWorker
 ... (3 more workers with parent 1234)
```

Expected on **production**:
- gunicorn with `-w 4`: 5 lines (master and 4 workers)
- `celery -A climateconnect_main worker -Q lookup -c 4 -l INFO`: 5 lines (master and 4 children)
- `celery -A climateconnect_main worker -B -l INFO`: 4 lines (master, the beat process and 2 pool children; concurrency 2 on P1v3)

Confirmed on production on 2026-10-26: the quick counts below gave 5 and 4. The parent of the three top-level processes is the startup shell, not PID 1.

Quick counts:

```sh
ps -eo args | grep -c '[c]elery.*-Q lookup'    # production: 5   slot2: 0
ps -eo args | grep -c '[c]elery.*worker -B'    # production: 4   slot2: 0
```

#### Step 5: Verify the web part on slot2

```sh
curl -s https://$SLOT2_HOST/ping/          # {"result":"pong"}
curl -s https://$SLOT2_HOST/api/version/   # {"sha":"<deployed sha>","ref":"...","built_at":"..."}
```

The `sha` must match the merged commit (compare with `git rev-parse --short HEAD` on `master`, or with the workflow run). Then open `https://$SLOT2_HOST/admin/`, log in with your admin account (`<admin user>` / `<password>`), and open any object list, e.g. Users.

#### Step 6: After a swap (checklist)

Run this a few minutes after the swap has completed (both slots restarted):

- [ ] Production log shows `RUN_CELERY: celery=on (value 'true')` (step 4a).
- [ ] slot2 log shows `RUN_CELERY: celery=off (value 'false')`.
- [ ] Production process list shows both Celery workers and beat; slot2 shows no `celery` (step 4b).
- [ ] `curl -s https://$PROD_HOST/api/version/` shows the new SHA.
- [ ] Over the next ~15 minutes, production's log has no `Reclaiming abandoned LocationIQ lookup` warnings. A stream of them means no `lookup` worker is running.
- [ ] Step 2 still shows both values sticky.

#### Step 7: Rollback if production has no Celery

Symptoms: production's log shows `celery=off`, step 4b shows no `celery` processes, or `Reclaiming abandoned LocationIQ lookup` warnings keep coming.

Fix: set production back to `true` (this restarts production):

```sh
az webapp config appsettings set -g $RG -n $APP --slot-settings RUN_CELERY=true
```

Alternatively, remove it (a missing value means "run Celery"):

```sh
az webapp config appsettings delete -g $RG -n $APP --setting-names RUN_CELERY
```

Portal: App Service → Environment variables → `RUN_CELERY` → set the value to `true` (keep "Deployment slot setting" ticked) → Apply → Confirm.

Confirm with steps 2, 4a and 4b on production. Tasks that were enqueued while no worker ran wait in the broker and run once the workers are back. Beat ticks that fell in the gap are skipped.

If slot2 runs Celery by mistake (`celery=on` on slot2), set `RUN_CELERY=false` on slot2 the same way with `--slot slot2`, or simply stop slot2 (step 3).

---

## System impact

*(Archie, 2026-10-26)*

### Mosy specs and related specs

No `doc/mosy/` change is needed. The task changes no actor, flow, entity, API or event. Flows that depend on background work (emails, notifications, login-token cleanup, location autocomplete) keep their steps; the work just runs once, on the live code.

| Spec | Status |
|---|---|
| `doc/spec/20260826_1138_container_based_deployment_pipeline.md` | **Updated**: section "Celery topology and migrations after #2352", AC-2B.4a–c, AC-3B.9/3B.10 |
| `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` | **Intentionally left as is** (Q11) |

The container image runs `docker/backend-entrypoint.sh` (its `CMD`; both `climate-backend-container` slots have an empty startup command), not `start_backend.sh`. So AC-9 is a change of its own. Its slots carry the production settings, so `RUN_CELERY` must be set explicitly there before they are started again.

### Runtime topology

| | Production (`RUN_CELERY=true`) | slot2 (`RUN_CELERY=false`) |
|---|---|---|
| Web server | gunicorn, 4 workers | gunicorn, 4 workers (the main process) |
| `lookup` worker | 1 process (`-c 4`) | none |
| Default worker and beat | 1 worker with embedded beat | none |
| Broker, DB, channel layer | shared | shared, used only as a producer |
| Normal state | running, Always On | stopped; started around deployments |

**Swap.** Stickiness is a per-app list of setting names, so each slot keeps its own value through a swap:
1. Azure restarts the slot2 instances (new release) with production's `true`. They come up with full Celery.
2. Routing switches.
3. Azure restarts the old production instances with `false`.

Between steps 1 and 3 (minutes; with "swap with preview", until the swap is completed) both releases run Celery: two beats, two `lookup` workers, two code versions on the queue. This is accepted. Swap away from schedule ticks (operating procedure, step 5).

**Tasks enqueued from slot2 run on production's workers, with production's code.** The same applies to chat messages through the channel layer. Before a swap, a task that exists only in the new release fails on production (unregistered task, message discarded). New background features cannot be tested on slot2.

**Pre-existing, unchanged:** a restart kills workers, and with Celery's default early acknowledgement, in-flight tasks are lost. This is relevant to F11.

### Interfaces

- REST API: no change (`/ping/` and `/api/version/` are reused).
- Celery tasks, queues, routes, beat schedule: no change; only the number of consumers changes.
- Data model and events: no change.
- New configuration: the `RUN_CELERY` app setting. Local development is unaffected: `runserver` and `make celery` don't use the startup scripts, the compose `celery` / `celery-lookup` services override the image command, and an unset value means today's behaviour wherever the entrypoint does run.

### Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | `RUN_CELERY` not sticky | After a swap, production runs without Celery; it fails silently | Runbook steps 2 and 6 after every swap; step 7 to fix |
| R2 | Values mixed up (production `false`) | Same as R1, right after the restart | Steps 2 and 4 after configuring |
| R3 | slot2 value missing or mistyped | slot2 runs Celery again (fails toward production safety) | Case-insensitive values (Q12); warning line; step 4 after each deploy |
| R4 | Swap overlap | Double ticks, doubled LocationIQ rate, two code versions, for minutes | Accepted; swap timing in the operating procedure |
| R5 | Setting change restarts production (full cold start) | Minutes of downtime; startup fragility | Low-traffic window; configure in one go (step 1) |
| R6 | slot2 stopped on a `master` push | Deploy job fails | Re-run after starting slot2 |
| R7 | Container backend started with production settings | Second consumer and beat, plus `migrate` against production | Container spec, section "Celery topology and migrations after #2352" |
| R8 | One beat depends only on configuration | A misconfiguration fires everything twice | Accepted; F9 |

---

## Log

- 2026-10-26: Created from issue #2352. Startup scripts, workflows and Azure configuration investigated read-only (no sticky settings; shared broker, DB and `ENVIRONMENT`; slot2 runs the full Celery topology). Connection budget documented. User decisions Q1–Q11 recorded. Follow-ups moved to `20261026_1150_db_connection_and_celery_robustness_followups.md`.
- 2026-10-26: Archie: System impact added (no `doc/mosy/` change). Container spec updated; LocationIQ spec left as is. Startup log line contract and runbook added. Spec trimmed to the relevant content. Case-insensitive values decided (Q12); no open decisions.
- 2026-10-26: Implemented on branch `improve-slot2-operation`: `backend/run_celery.sh` (new), `backend/start_backend.sh` (sources the helper before the installs, so the log line appears early; standby runs gunicorn in the foreground), `docker/backend-entrypoint.sh` (same helper; standby `exec`s gunicorn; `migrate` unchanged), `doc/environment-variables.md`, `doc/architecture.md`. Helper tested with sh, bash and dash for unset, empty, `true`/`True`/`TRUE`, ` false `/`False`/`FALSE`/`false` and `yes`; the process sections of both scripts were run with stubbed `gunicorn`/`celery`/`python`. Open: AC-1 to AC-8 and AC-10's Azure configuration need the deployed code (runbook steps 1–6).
- 2026-10-26: Scope correction (user): `RUN_CELERY` controls Celery only. The 1-worker gunicorn on slot2 is removed; gunicorn stays at 4 workers on every slot, and the startup log line no longer has `gunicorn_workers=`. Spec, runbook, docs and helper updated.
