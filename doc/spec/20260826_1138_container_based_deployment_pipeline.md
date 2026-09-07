# Container-based deployment pipeline: faster, automated, versioned releases

**Status**: DRAFT
**Type**: DevOps / CI-CD
**Date created**: 2026-08-26

**Related specs**:
- `doc/spec/20260414_1315_frontend_deploy_artifact_scope.md` — deploy only the relevant app directory (Phase 1 of this task; status READY FOR IMPLEMENTATION)
- `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` — the Celery `lookup` worker must stay exactly one process (relevant when containerizing the backend startup script)

**Related files**:
- `.github/workflows/master_climate-backend-appservice(slot2).yml` — production backend deploy workflow
- `.github/workflows/master_climateconnect-frontend-appservice(slot2).yml` — production frontend deploy workflow
- `start_backend.sh` — production backend startup script (installs system packages + Python deps on every cold start)
- `docker/backend.Dockerfile`, `docker/frontend.Dockerfile` — dev-only Dockerfiles (not production-ready)
- `frontend/next.config.js` — embeds build-time env vars into the client bundle
- `frontend/package.json` — `devlink-sync` script (Webflow export) that runs before `yarn build`

---

## Problem Statement

Getting a change from `master` to production is slow, partially manual, and causes platform downtime. Both services (Next.js frontend, Django backend) are deployed via GitHub Actions to Azure App Service deployment slots (`slot2`), after which a human must manually trigger the slot swap in the Azure portal.

The current process has four compounding problems:

### 1. Deployment is slow end-to-end

- Both workflows zip and upload the **entire monorepo** — the frontend artifact ships the backend source and vice versa (documented in the related artifact-scope spec).
- The backend build job installs no dependencies at all; instead `start_backend.sh` runs `apt-get install` and `pdm install` on **every cold start** on the App Service. Every swap therefore includes a full dependency installation on the server.

### 2. The slot swap is manual

A person must be present to swap slots after each deployment. The manual step is an error risk (swapping too early, swapping the wrong slot, forgetting the migration) and means deployments cannot complete unattended.

### 3. The swap causes platform downtime

During the swap, the incoming slot reboots and — for the backend — installs system packages and Python dependencies before it can serve traffic. Users experience downtime on the order of minutes per release.

### 4. There is no version history and no fast rollback

There are no release branches, and what is on a slot is whatever the last deployment put there. Rolling back a bad release means re-running the (slow) CI pipeline against old code. There is no artifact history that shows what was deployed when.

### Why it matters

- Slow, risky, manual deployments discourage frequent small releases — each release becomes a big event with a large blast radius.
- Downtime per release directly affects platform users.
- The missing fast rollback turns every incident caused by a release into a longer incident.

---

## User Stories

- As a maintainer, I want a merge to `master` to reach production without manual steps, so that releases do not require my presence.
- As a maintainer, I want to roll back to the previous known-good version within minutes and without rebuilding, so I can react quickly when a release breaks.
- As a maintainer, I want to test the new deployment mechanism in parallel to the running production path, so nothing breaks while migrating.
- As a platform user, I want releases to happen without noticeable downtime.

---

## Desired Outcome — Phased

Each phase is independently valuable and leaves production in a working state.

**Phase 1 — Deploy only the relevant app directory**
Implement the existing artifact-scope spec (`20260414_1315_frontend_deploy_artifact_scope.md`). Immediate speed-up (smaller artifacts, faster uploads) and stops shipping each service's source code to the other's server.

**Phase 2 — Manually-triggered container build workflow (parallel to production)**
A new, manually-triggered workflow builds production-ready container images for backend and frontend and pushes them to a container registry. This phase deploys nothing and touches the current deployment path not at all. Purpose: validate image builds, registry authentication, image contents, and runtime behaviour in isolation.

**Phase 3 — Validate container deployment in isolation**
Run the container images on Azure App Service in an isolated test target (not the production apps) and verify the full runtime contract: startup, configuration via app settings, database migration, background workers, WebSockets — and measure startup time against today's zip path.

**Phase 4 — Production cutover with automated promotion**
The production App Services run from container images. Promotion to production happens automatically after health verification, with no manual steps. Rolling back means re-pointing at a previous image tag. Deployment downtime is at most what it is today, and significantly reduced.

**Phase 5 — Frontend runtime configuration (secrets out of the build)**
Frontend configuration that is embedded at build time today (including secrets) moves to runtime configuration. Images contain no sensitive values, and configuration changes no longer require a rebuild.

---

## Acceptance Criteria

### Phase 1

- **AC-1.1**: All acceptance criteria of `doc/spec/20260414_1315_frontend_deploy_artifact_scope.md` are met.

### Phase 2

- **AC-2.1**: A manually-triggered workflow exists that builds a backend image and a frontend image and pushes both to the container registry, each tagged with the commit SHA of the build.
- **AC-2.2**: Each image contains only its own service — no cross-service source code, docs, or workflows.
- **AC-2.3**: The backend image starts outside production and serves the API using only runtime-provided environment variables (no baked-in secrets).
- **AC-2.4**: The frontend image starts outside production and serves pages, including the Webflow devlink content (the build reproduces the `devlink-sync` step).
- **AC-2.5**: The existing production workflows are unchanged and continue to deploy successfully.
- **AC-2.6**: Registry images are not publicly accessible (or contain nothing sensitive — see constraints).

### Phase 3

- **AC-3.1**: Both images run on an isolated Azure App Service target configured purely via Azure app settings.
- **AC-3.2**: Backend runtime contract verified: API serves requests, database migrations run safely, both Celery workloads run (default worker with beat; exactly one `lookup` queue worker), WebSockets work.
- **AC-3.3**: Frontend runtime contract verified: SSR pages render, API and WebSocket connectivity work, locale routing works.
- **AC-3.4**: Cold-start time is measured and is faster than the current zip + on-server install path.

### Phase 4

- **AC-4.1**: A push to `master` results in the new version serving production traffic with no manual steps.
- **AC-4.2**: Promotion happens only after automated health verification; if verification fails, promotion is aborted and the previous version keeps serving.
- **AC-4.3**: Rolling back to a previous image tag is possible within minutes and without rebuilding.
- **AC-4.4**: Observed deployment downtime is at most what it is today (target: significantly reduced).
- **AC-4.5**: Every production release is traceable to an immutable, tagged image in the registry.

### Phase 5

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

## System impact

*(to be filled by Archie)*

---

## Log

- 2026-08-26 11:38 UTC — Task created from the CI/CD improvement discussion. Current workflows inspected; phased plan agreed: start with the existing artifact-scope spec (quick win), then containerize with a manually-triggered parallel workflow before touching production. Awaiting user review of problem statement and AI insights.
