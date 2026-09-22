# Container-based deployment pipeline: faster, automated, versioned releases

**Status**: DRAFT
**Type**: DevOps / CI-CD
**Date created**: 2026-08-26

**Related specs**:
- `doc/spec/20260414_1315_frontend_deploy_artifact_scope.md` — deploy only the relevant app directory (Phase 1 of this task; **COMPLETED** — each workflow now ships only its own service)
- `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` — the Celery `lookup` worker must stay exactly one process (relevant when containerizing the backend startup script)

**Related files**:
- `.github/workflows/master_climate-backend-appservice(slot2).yml` — production backend deploy workflow
- `.github/workflows/master_climateconnect-frontend-appservice(slot2).yml` — production frontend deploy workflow
- `backend/start_backend.sh` — production backend startup script (installs system packages + Python deps on every cold start)
- `docker/backend.Dockerfile`, `docker/frontend.Dockerfile` — dev-only Dockerfiles (not production-ready)
- `frontend/next.config.js` — embeds build-time env vars into the client bundle
- `frontend/package.json` — `devlink-sync` script (Webflow export) that runs before `yarn build`

---

## Problem Statement

Getting a change from `master` to production is slow, partially manual, and causes platform downtime. Both services (Next.js frontend, Django backend) are deployed via GitHub Actions to Azure App Service deployment slots (`slot2`), after which a human must manually trigger the slot swap in the Azure portal.

The current process has four compounding problems:

### 1. Deployment is slow end-to-end

- ~~Both workflows zip and upload the **entire monorepo**~~ **(fixed by Phase 1 — each workflow now ships only its own service).**
- The backend build job installs no dependencies at all; instead `start_backend.sh` runs `apt-get install` and `pdm install` on **every cold start** on the App Service. Every swap therefore includes a full dependency installation on the server.

### 2. The slot swap is manual

A person must be present to swap slots after each deployment. The manual step is an error risk (swapping too early, swapping the wrong slot, forgetting the migration) and means deployments cannot complete unattended.

### 3. The swap causes platform downtime

During the swap, the incoming slot reboots and — for the backend — installs system packages and Python dependencies before it can serve traffic. Users experience downtime on the order of minutes per release.

### 3b. The standby slot is not a safe rollback target (learned 2026-09-09)

Both slots run the same startup script, so both are equally vulnerable to external dependency failures. When the Debian 11 `bullseye-security` repository expired on 2026-09-07, the first deploy to `slot2` failed at cold start (Sep 8, 08:11 UTC), and production followed ~15 hours later when Azure recycled its worker instance (Sep 8, 23:39 UTC). The same failure guaranteed that a swap would not recover production either — production's next cold start would hit the identical broken code path. A slot swap can only recover a *code* regression; it cannot recover a *startup-infrastructure* regression when both slots share the same startup script. (Full incident details in “AI Agent Insights”.)

### 4. There is no version history and no fast rollback

There are no release branches, and what is on a slot is whatever the last deployment put there. Rolling back a bad release means re-running the (slow) CI pipeline against old code. There is no artifact history that shows what was deployed when.

### Why it matters

- Slow, risky, manual deployments discourage frequent small releases — each release becomes a big event with a large blast radius.
- Downtime per release directly affects platform users.
- The missing fast rollback turns every incident caused by a release into a longer incident.
- Cold starts are not limited to deploys — Azure platform maintenance (worker instance replacement) also triggers them, meaning the startup script is a live production dependency even when no one is deploying.

---

## User Stories

- As a maintainer, I want a merge to `master` to reach production without manual steps, so that releases do not require my presence.
- As a maintainer, I want to roll back to the previous known-good version within minutes and without rebuilding, so I can react quickly when a release breaks.
- As a maintainer, I want to test the new deployment mechanism in parallel to the running production path, so nothing breaks while migrating.
- As a platform user, I want releases to happen without noticeable downtime.

---

## Desired Outcome — Phased

Each phase is independently valuable and leaves production in a working state.

The backend and frontend are containerised **separately**, each with its own cutover path. The backend goes first: it has the higher impact (kills the cold-start apt problem and the swap downtime) and the easier migration (no DNS complexity). The frontend is deferred: it is purely JavaScript with no system dependencies, so its exposure is lower, and its DNS migration is more complex.

---

### Backend

**Phase 2B — Backend container image (build and verify in isolation)**
A manually-triggered workflow builds a production-ready backend container image and pushes it to a container registry. A throwaway App Service (or the existing `slot2`) runs the image against the shared production database to verify the full runtime contract: startup, configuration via app settings, database migrations, both Celery workers, WebSockets. This phase does not touch the production backend. Purpose: validate image contents, registry auth, and runtime behaviour before any cutover.

**Phase 3B — Backend parallel running and cutover**
The new backend container runs on a **separate App Service** with a new hostname (e.g. `api.climatehub.org`), while the existing production backend (`api.climateconnect.earth`) continues to serve traffic unchanged. The frontend's API endpoint is switched to the new hostname via its app settings — a single config change, no redeploy. Both backends share the same database. Once the new backend is verified against real traffic, the old backend is decommissioned. Rollback: switch the frontend's API endpoint back to the old hostname.

Benefits of this approach over in-place slot swap:
- Zero downtime: the old backend never stops serving until the switch is confirmed.
- Genuine rollback: both backends can run in parallel indefinitely; reverting is a config change, not a rebuild.
- No startup-script fragility: the container image is fully baked; cold starts need no apt, no pdm install.
- No standby-slot risk: the new backend is a completely independent App Service, not a slot of the same app.
- The old backend remains untouched during validation, so a failed test cannot take down production.

---

### Frontend

**Phase 2F — Frontend container image (build and verify in isolation)**
Same pattern as Phase 2B: a workflow builds the frontend image and validates it on an isolated target. More complex than the backend because the build requires Webflow devlink credentials and embeds runtime config into the client bundle (addressed by Phase 5).

**Phase 3F — Frontend cutover**
The frontend container replaces the current zip deployment. This is the more complex cutover because multiple DNS entries (`climateconnect.earth`, locale subdomains, etc.) point at the current App Service. Cutover options (to be decided by Archie): (a) switch the existing App Service from code mode to container mode in-place; (b) create a new App Service, update DNS, and run both in parallel. The in-place switch is simpler but offers no rollback via DNS. The parallel approach is safer but requires DNS TTL management.

---

### Frontend runtime configuration

**Phase 5 — Secrets out of the frontend build**
Frontend configuration that is embedded at build time today (including secrets) moves to runtime configuration. Images contain no sensitive values, and configuration changes no longer require a rebuild. This is a prerequisite for the frontend image being safely public (if hosted on GHCR) or safely redistributable.

---

## Acceptance Criteria

### Phase 2B (backend image)

- **AC-2B.1**: A manually-triggered workflow builds a backend container image and pushes it to the container registry, tagged with the commit SHA.
- **AC-2B.2**: The image contains only backend code — no frontend source, docs, or workflows.
- **AC-2B.3**: The image starts on an isolated App Service and serves the API using only runtime-provided environment variables (no baked-in secrets).
- **AC-2B.4**: Backend runtime contract verified: API serves requests, database migrations run safely, both Celery workloads run (default worker with beat; exactly one `lookup` queue worker), WebSockets work.
- **AC-2B.5**: Cold-start time is measured and is faster than the current zip + on-server install path.
- **AC-2B.6**: The existing production workflows are unchanged and continue to deploy successfully.
- **AC-2B.7**: Registry images are not publicly accessible (or contain nothing sensitive — see constraints).

### Phase 3B (backend cutover)

- **AC-3B.1**: The new backend runs on a separate App Service with its own hostname while the old backend continues serving traffic.
- **AC-3B.2**: The frontend's API endpoint is switched to the new hostname via app settings; no frontend redeploy required.
- **AC-3B.3**: Both backends share the same database and coexist without interference.
- **AC-3B.4**: Rolling back means switching the frontend's API endpoint back to the old hostname — possible within minutes.
- **AC-3B.5**: The old backend is decommissioned only after the new one is verified against real traffic.
- **AC-3B.6**: Every production release on the new backend is traceable to an immutable, tagged image in the registry.
- **AC-3B.7**: A push to `master` results in the new backend image serving production traffic with no manual steps.
- **AC-3B.8**: Promotion happens only after automated health verification; if verification fails, promotion is aborted and the previous image keeps serving.

### Phase 2F (frontend image)

- **AC-2F.1**: A manually-triggered workflow builds a frontend container image and pushes it to the container registry, tagged with the commit SHA.
- **AC-2F.2**: The image contains only frontend code — no backend source, docs, or workflows.
- **AC-2F.3**: The image starts on an isolated App Service and serves pages, including the Webflow devlink content (the build reproduces the `devlink-sync` step).
- **AC-2F.4**: Frontend runtime contract verified: SSR pages render, API and WebSocket connectivity work, locale routing works.
- **AC-2F.5**: The existing production workflows are unchanged and continue to deploy successfully.

### Phase 3F (frontend cutover)

- **AC-3F.1**: The frontend container replaces the current zip deployment with zero (or minimal) downtime.
- **AC-3F.2**: DNS resolution for all current hostnames (`climateconnect.earth`, locale subdomains) is preserved.
- **AC-3F.3**: Rolling back to the previous frontend version is possible within minutes.
- **AC-3F.4**: A push to `master` results in the new frontend serving production traffic with no manual steps.

### Phase 5 (frontend runtime configuration)

- **AC-5.1**: The frontend image contains no secret values (verified by inspecting the built output).
- **AC-5.2**: Changing a frontend runtime configuration value requires only a configuration change + restart, not a rebuild.

---

## Constraints and Non-Negotiable Requirements

- **No production availability regression during the migration.** The current zip-based path remains the fallback until Phase 4 is verified.
- **Public repository**: the GitHub repository is public, so GitHub Container Registry images are public by default. Until Phase 5 removes sensitive values from the frontend build output, images must either be made private in the registry or be pushed to a private registry.
- **Single shared production database**: both slots use the same database. Schema changes must remain coordinated across slots, and per-release changes must be additive-only so that old code keeps running during rollout and rollback.
- **Celery process model must be preserved**: exactly one `lookup` queue worker process (see `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md`), plus the default worker with beat. Containerization must not change this topology.
- **The frontend build requires the Webflow devlink export** (`yarn devlink-sync`) before `yarn build`, which needs Webflow credentials at build time.
- **Cost discipline**: prefer free options (GitHub Container Registry). A paid service (e.g. Azure Container Registry, ~$5/month) only as a fallback if private images are not possible with GHCR.
- **Azure app settings remain the source of runtime secrets**; images must not require secrets at build time except for the frontend build-time values listed above (which Phase 5 eliminates).

---

## AI Agent Insights and Additions

### Findings from the current workflows (verified 2026-08-26)

- Neither production workflow contains a swap step or a health check — the swap is fully manual in the Azure portal.
- The backend build job creates a virtualenv but installs nothing (the install step is commented out); the server does all installation at cold start via `start_backend.sh`. This is the single biggest contributor to slow swaps.
- The backend CI sets up Python 3.12 while the dev Dockerfile uses `python:3.11-slim`. The production image's Python version should be pinned deliberately (Django 5.2 supports both).
- The frontend workflow's "Write build env" step writes secret values (`FRONTEND_SENTRY_DSN`, `LETS_ENCRYPT_FILE_CONTENT`, API URLs, …) in plaintext into `frontend/build_info.json`, which is deployed with the artifact. Worth cleaning up independently of the container work.
- The frontend build runs `yarn devlink-sync` (Webflow devlink export) before `yarn build` — a container build must reproduce this step and its credential requirements.

### Security analysis for a public repository

- **Backend image is secret-free**: `climateconnect_main/settings.py` reads all sensitive values from environment variables at runtime. A backend image could safely be public.
- **Frontend build embeds sensitive values into the client bundle**: `next.config.js` picks `WEBFLOW_API_TOKEN`, `FRONTEND_SENTRY_DSN`, and `LETS_ENCRYPT_FILE_CONTENT` from the environment into the built JS. In a public image, anyone could extract them.
- `SENTRY_AUTH_TOKEN` is used at build time only for source map upload and is not embedded — safe as a build-time secret.
- Options, in order of preference: (a) move sensitive values to runtime (Phase 5) so images can safely be public — this also enables config changes without rebuilds; (b) set GHCR package visibility to private (may be restricted by the org plan for public repos — needs verification); (c) Azure Container Registry Basic tier (~$5/month), private by default.

### Azure App Service container mode

- The runtime mode (code vs container) is set at the **app service level**, while the image reference is **per slot**. One cannot run zip deployment on one slot and a container on the other within the same app — this is why Phase 3 validates on an isolated target (e.g. a throwaway App Service) before cutover.
- Switching back to code mode is possible (clear the container configuration) — the rollback path during evaluation.

### Database migrations

- Today, migrations are run manually against the shared production database before the swap.
- In the container pipeline, one canonical mechanism should be chosen. Running migrations as an automated step **before** promotion preserves the current ordering and is safest with a shared database; running migrations in each container's startup command risks two slots migrating concurrently. (Suggestion, not a requirement — for Archie to decide.)
- Keep migrations additive-only per release (add columns/tables/indexes; defer drops and renames to a later release) so rollback to an old image stays safe.

### Downtime expectations

- Containers remove the runtime dependency installation, so swap + cold start should drop from minutes to roughly tens of seconds.
- A brief interruption during the swap remains. True zero-downtime requires traffic splitting (e.g. Azure Container Apps revision weights, or a gateway in front of two backends) and is deliberately out of scope for now — possible follow-up once the container path is proven.

### Versioning and rollback

- Tagging images with the commit SHA (plus a stable moving alias) gives the registry a full release history — closing the gap that the missing release branches leave.
- Rollback becomes "point the slot at the previous tag and restart" — no CI rebuild required.

### Open questions for Archie

- Where migrations run in the container pipeline (CI step vs startup vs one-off job).
- The backend has **no health endpoint today** (no `health` route found in any `urls.py`) — automated promotion (AC-4.2) needs one, or an equivalent verification mechanism.
- Whether slot-specific configuration (e.g. `FEATURE_TOGGLE_ENVIRONMENT=staging` on the staging slot) carries over cleanly to the container setup.
- Whether the Celery workloads should eventually be split into separate containers (out of scope for this task; topology must be preserved for now).

---


### Incident: Debian EOL breaks both slots (2026-09-08 / 2026-09-09)

**Root cause**: `start_backend.sh` runs `apt-get install gdal-bin libgdal-dev` on every cold start. The App Service Python 3.12 image is based on Debian 11 (bullseye), which reached end-of-life on 2026-08-31. The `bullseye-security` Release file expired on 2026-09-07 at 21:13:04 UTC.

**Timeline** (all UTC):

| Time | Slot | Trigger | Outcome |
|---|---|---|---|
| 2026-09-07 21:13 | — | Debian `bullseye-security` `Valid-Until` expires | Bug armed; no visible effect yet |
| 2026-09-08 08:10 | slot2 | Deploy of PR #2247 to `master` | Cold start → `apt-get update` fails → `&&` short-circuits → GDAL never installed → `ImproperlyConfigured: Could not find the GDAL library` |
| 2026-09-08 23:39 | production | Azure worker instance replacement (B2 → JE, no control-plane event) | Same failure on production → crash-loop overnight |
| 2026-09-09 08:32 | production | Fixed `start_backend.sh` deployed | `GDAL (3, 2, 2)` → `Listening at` → green |

**Key lessons**:

- The failure was invisible for ~11 hours: the running container already had GDAL installed in its ephemeral filesystem, so nothing broke until the first cold start after the `Valid-Until` expiry.
- **Azure did not change the base image** — the tag `appsvc/python:3.12_20260710.8.tuxprod` was identical from Sep 1 through the entire incident. The breakage was caused by Debian’s repository state, not by a platform change.
- Production’s trigger was a **routine Azure platform maintenance** event (worker instance replacement), not a deploy. This means the startup script is a live production dependency even when no one is deploying — Azure recycles containers on its own schedule.
- The `&&` operator in the original script converted a `apt-get update` failure into a silent skip of `apt-get install`, which turned the first-minute diagnosis into a 12-hour investigation.
- The three separate faults stacked up on the same day: (1) expired bullseye-security index (the outage), (2) `set -uo pipefail` under `dash` (exit 2 in 5 s), (3) purged security pool 404s on `.deb` files. Each required a separate deploy to fix.

**Resolution**: `backend/start_backend.sh` now repoints apt at `archive.debian.org/debian bullseye main` on bullseye (the EOL workaround), installs only runtime shared objects (`libgdal28`/`libgeos-c1v5`/`libproj19` instead of the `-dev` packages that 404’d), discovers package names dynamically from the apt index so a Python-version bump (and therefore distro bump) cannot break it again, and keeps `set -u` instead of `set -uo pipefail` since `/bin/sh` is `dash` on the App Service images.

### Python version → Debian version coupling in App Service managed images (learned 2026-09-09)

Azure App Service’s managed Python runtimes are pre-built Docker images. Each Python version is pinned to a specific Debian base at image-build time, and Microsoft does not rebase existing versions:

| Python | Base | Notes |
|---|---|---|
| 3.12 | Debian 11 (bullseye) | EOL Aug 2024; security pool purged Sep 2026 |
| 3.13 | Debian 12 (bookworm) | Valid until ~2028 |
| 3.14 | Ubuntu LTS | Microsoft announced Oct 2025 that all new major versions target Ubuntu |

The coupling is invisible: the portal offers `PYTHON|3.12` and `PYTHON|3.13` with no indication of the underlying distro. Changing the Python version silently changes the distro, system packages, and library versions — which is how the 2026-09-08 incident’s first test (switching to 3.13 to fix the Debian EOL) produced a *second* failure (`libpython3.12.so.1.0: cannot open shared object file`) because the old `antenv` virtualenv was built for 3.12. Node follows the same pattern (Node 24 will also use Ubuntu).

With a container-based deployment, the image owner chooses both the Python version and the base OS independently. Microsoft’s distro decisions become irrelevant.
## System impact

*(to be filled by Archie)*

---

## Log

- 2026-08-26 11:38 UTC — Task created from the CI/CD improvement discussion. Current workflows inspected; phased plan agreed: start with the existing artifact-scope spec (quick win), then containerize with a manually-triggered parallel workflow before touching production.
- 2026-09-09 13:15 UTC — Phase 1 confirmed completed (each workflow now ships only its own service). Incident case study added; phases restructured to separate backend and frontend cutover paths; Phase 1 removed from spec.
- 2026-09-09 11:00 UTC — Production incident on 2026-09-08/09: Debian 11 EOL broke both slots’ cold starts. Incident case study and Python’version-to-Debian coupling analysis added to AI Agent Insights. Problem Statement strengthened with standby-slot rollback risk (3b) and cold-start-as-live-dependency observation. File reference corrected (`backend/start_backend.sh`).
