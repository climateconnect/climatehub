# Upgrade Django Backend to 5.2 LTS

**Status**: DRAFT
**Type**: Backend — dependency upgrade / maintenance
**Date**: 2026-08-11

---

## Problem Statement

The backend pins `Django~=4.2.27` (`backend/pyproject.toml`). Django 4.2 LTS security support ended **April 2026**; as of 2026-08-11 we are ~4 months past EOL and running an unsupported branch in production. The next LTS, **Django 5.2** (released 2025-04-02, supported through at least April 2028), is the natural target.

Climate Connect has always ridden Django LTS releases (2.2 → 3.2 → 4.2). The next LTS jump is 4.2 → 5.2.

**Urgency**: prod is on an unsupported Django branch *today*. Every day we delay is another day without upstream security patches.

**This spec deviates from the official Django upgrade guide**, which recommends stepping through each feature release (4.2 → 4.3 → 5.0 → 5.1 → 5.2) with a `python -Wa` deprecation sweep before each step. We are doing the whole jump in one PR because the EOL pressure makes a 3-6 month incremental rollout unacceptable. The `python -Wa` sweep is preserved as an acceptance criterion so removed-in-5.x APIs surface and get fixed in this PR.

This spec is **behavior-preserving**: no API contract changes, no new 5.2 features adopted, frontend must not notice.

---

## Target

- **Django 5.2.x** (latest 5.2.x patch as of spec date). Pin `Django~=5.2.0` to allow patch-level fixes.
- **Python 3.12** stays the floor (Django 5.2 supports 3.10–3.14).
- **PostgreSQL 17.10** in prod (verified 2026-08-11). Well above Django 5.2's 14+ floor. No DB upgrade required.

---

## Scope

### In scope

**Dependency bumps in `backend/pyproject.toml`:**

| Package | From | To | Reason |
|---|---|---|---|
| `Django` | `~=4.2.27` | `~=5.2.0` | The upgrade itself |
| `djangorestframework` | `>=3.14.0` | `~=3.18.0` | DRF 3.16+ dropped Django 4.2; 3.18 explicitly requires Django 5.2+ |
| `django-filter` | `>=23.1` | `>=26.1` | django-filter 26.x classifiers list only Django 5.2/6.0/6.1 |
| `django-timezone-field` | `>=6.0` | `>=7.0` | v7 is the pytz-free release |
| `asgiref` | `>=3.5.0` | `>=3.8.1` | Django 5.1 minimum |
| `psycopg2-binary` | `>=2.9.5` | `>=2.9.9` | Django 5.2 floor |
| `pytz` | `>=2021.3` | *remove* | Django 5.0 removed pytz support |
| `django-rest-knox` | `>=4.2.0` | bump if needed | Verify compatibility with DRF 3.18 at install time; bump together if PDM complains |
| `sentry-sdk` | `>=1.9.10` | `>=2.0.0` | Sentry 1.x doesn't support Django 5.2; 2.x is the current line |

Plus the transitive bumps PDM resolves on its own (sqlparse, colorama, docutils, Pillow, etc.).

**Code changes in `backend/`:**
- `backend/climateconnect_api/views/donation_views.py` lines 28 and 41: replace `pytz.utc` with stdlib `datetime.timezone.utc`, drop the `import pytz`. Also `datetime.datetime.utcnow()` → `datetime.now(timezone.utc)`.
- `backend/climateconnect_main/settings.py`: verify `STORAGES = {...}` is used (not the removed-in-5.0 `DEFAULT_FILE_STORAGE` / `STATICFILES_STORAGE`).
- `backend/agent.md`: change "Django 4.2" → "Django 5.2" in the tech stack line.
- Regenerate `backend/pdm.lock` and commit.

**Verification (run during implementation):**
- Full test suite passes with `python -Wa` flag.
- `makemigrations --dry-run` produces zero new migrations (we are not adopting new 5.2 features).
- `manage.py check` is clean.

### Out of scope

- Frontend changes.
- Django 6.x.
- Adopting any new 5.2 features (composite primary keys, `{% querystring %}`, `db_default`, `GeneratedField`, PostgreSQL connection pools, etc.).
- **Migrating to psycopg 3** (`psycopg[binary]`). Our code has zero direct `psycopg2` imports, but psycopg 3's server-side parameter binding breaks some raw-SQL patterns (`WHERE id IN %s` with a tuple, `WHERE field IS %s`). Needs a raw-SQL audit first. Separate PR.
- **Celery 5.2.7 → 5.6.3**. Not required by Django 5.2. Separate PR.
- **Channels 4.x**. Already compatible with Django 5.2; bump opportunistically.
- **Azure platform image / Debian version / OS upgrade**. Out of our control; per user 2026-08-11, not a planning concern for this team. Microsoft manages the platform image under commercial extended support.
- **GDAL and `start_backend.sh` install path**. Recorded as context below; not changed in this PR.

---

## Research

### Why 5.2 (LTS) and not 5.0 or 5.1

- Django 5.0 and 5.1 are non-LTS; landing on either forces another upgrade within ~12 months. 5.2 → 6.2 (next LTS) buys us ~3 years of security support.
- Django 5.2 is officially designed for the 4.2 → 5.2 jump; no in-between hops required for technical compatibility.

### Codebase audit for 5.0/5.1/5.2 breaking changes

Grepped for the patterns the release notes explicitly remove or break. Findings:

- **`pytz.utc` (removed in 5.0)** — 2 sites in `donation_views.py:28,41`. **Must fix.** Detailed above.
- **`pytz` as the timezone backend (default removed in 5.0)** — only the 2 sites above. Fixed by the same change.
- **`is_dst=` argument (removed in 5.0)** — not used. ✓
- **`USE_L10N` setting (removed in 5.0)** — not set. ✓
- **`index_together` (removed in 5.1)** — not used; we use `Meta.indexes = [...]`. ✓
- **`assertFormsetError` old spelling (removed in 5.1)** — not used. ✓
- **`JSONField` encoded-string-literal support (removed in 5.1)** — not used. ✓
- **`GeoModelAdmin` / `OSMGeoAdmin` / `OpenLayersWidget` (removed in 5.0)** — not used. ✓
- **`cx_Oracle` / `oracledb`** — not used. ✓
- **`FORMS_URLFIELD_ASSUME_HTTPS` transitional setting (deprecated 5.0)** — not set. ✓
- **`DEFAULT_FILE_STORAGE` / `STATICFILES_STORAGE` (removed in 5.0)** — must verify settings use `STORAGES` dict.
- **`Model.save()` positional args (deprecated 5.2)** — audit at IMPLEMENTATION time.
- **`EmailMultiAlternatives.alternatives` set-as-list (5.2)** — our email goes through `mailjet-rest`, but the celery task that renders emails may use Django's `EmailMultiAlternatives`. Audit at IMPLEMENTATION time.
- **`django.utils.text.Truncator` HTML parser change (5.1)** — used in email templates; behavior change is "more robust" per release notes. Watch email rendering tests; not a blocker.
- **`asgiref` floor** — currently 3.5.0, must bump to 3.8.1.
- **Transitive floors** — sqlparse, colorama, docutils, Pillow etc. all raised in 5.0/5.1/5.2; PDM resolves.

### Third-party package compatibility (PyPI audit, 2026-08-11)

Every Django-adjacent dep checked on PyPI. The full list lives in the AI insights section's "third-party compat table" if needed; the only forced bumps are the ones in the in-scope table above. Verified: `drf-spectacular`, `django-cors-headers`, `django-celery-beat`, `django-storages`, `django-redis`, `django-ratelimit`, `django-debug-toolbar`, `django-rest-knox`, `channels`, `channels-redis`, `daphne` — all support Django 5.2 either on their current floor or with a small bump captured above.

### Migration considerations

- Django 5.2's `makemigrations --dry-run` should produce **zero** new migrations. We are not adopting `db_default`, `GeneratedField`, or any other 5.2-specific model features. If it suggests anything, that's a real signal something is wrong.
- The cache may contain pickled objects from 4.2; clear cache after deploy (Django's deploy checklist).

---

## GDAL: context, not work

**We are not changing GDAL in this PR.** It is recorded here as context only.

- Django 5.2 requires GDAL ≥ 3.1 and GEOS ≥ 3.10. All our environments meet that floor:

| Environment | GDAL | Source |
|---|---|---|
| Local venv | 3.12.3 | Homebrew on the dev Mac |
| `.devcontainer/Dockerfile` | 3.4.x | Debian bullseye apt |
| `docker/backend.Dockerfile` | 3.6.x | `python:3.11-slim` (Debian bookworm) apt |
| CI (`backend_tests.yml`) | 3.8.x | `ubuntu-latest` (24.04) apt |
| `start_backend.sh` (manual setup) | unpinned | user's local `apt-get` |
| **Azure prod (App Service)** | **3.2.2** | `libgdal28 3.2.2+dfsg-2+deb11u2`, from `start_backend.sh`'s `apt-get install gdal-bin` at cold start |

- **Prod is on Debian 11 (bullseye)**, directly verified via `cat /etc/os-release` on 2026-08-11. Debian 11 community LTS ended June 2026 (~6 weeks before this spec). Per user, OS/platform-image decisions are out of this team's scope.
- The GDAL version spread between environments (3.2.2 prod vs 3.12.3 local) is real but the only environment we don't control is the one that matters most. **No code or install-path change in this PR.**

---

## Acceptance Criteria

### Build & install
- [ ] `cd backend && pdm install` succeeds with no resolver errors. After install, run `pdm why pytz` (expected resolvers: `twisted`, `autobahn`) and `pdm why sentry-sdk` (expected: 2.x) to verify the resolver tree is sane.
- [ ] `cd backend && pdm run python -c "import django; print(django.get_version())"` prints a 5.2.x version.
- [ ] `cd backend && pdm run python manage.py check` returns "System check identified no issues (0 silenced)."

### Migrations
- [ ] `cd backend && pdm run python manage.py makemigrations --dry-run` produces no new migration files.
- [ ] `cd backend && pdm run python manage.py migrate --plan` shows only existing migrations.

### Tests
- [ ] `cd backend && pdm run python -Wa manage.py test --keepdb` passes 100%. The `-Wa` is required to surface `RemovedInDjango50Warning` / `RemovedInDjango51Warning` / `RemovedInDjango52Warning`.
- [ ] Any deprecation warning that surfaces in the test run is a real compatibility regression and must be fixed in this PR.
- [ ] Sentry integration smoke: in dev, trigger a 500 (or run `pdm run python -c "from sentry_sdk import capture_message; capture_message('django 5.2 upgrade smoke test')"`) and confirm the `sentry-sdk>=2.0.0` `DjangoIntegration` loads cleanly under Django 5.2.
- [ ] PostgreSQL on port 5432 and Redis on port 6379 are running (per `backend/agent.md`).
- [ ] GDAL verification: `pdm run python -c "from django.contrib.gis.gdal.libgdal import GDAL_VERSION; print(GDAL_VERSION)"` prints a tuple `>= (3, 1, 0)`.

### Code changes
- [ ] `grep -r "pytz" backend/ --include="*.py"` returns zero matches in app code.
- [ ] `donation_views.py:28,41` use `datetime.timezone.utc` (or `django.utils.timezone.now()`).
- [ ] `settings.py` uses `STORAGES = {...}`; no `DEFAULT_FILE_STORAGE` or `STATICFILES_STORAGE`.
- [ ] `backend/agent.md` mentions Django 5.2.
- [ ] `grep -rE "is_dst=|assertFormsetError|index_together" backend/ --include="*.py"` returns zero matches.

### Dep files
- [ ] `pyproject.toml` updated per the In-scope table.
- [ ] `backend/pdm.lock` regenerated and committed.

### Quality gates
- [ ] `cd backend && make format` passes.
- [ ] `cd backend && pdm run python manage.py check --deploy` reports no new warnings vs. 4.2 baseline.
- [ ] Sentry test exception in dev still works (sanity check that error reporting integrations still load).

### Smoke test
- [ ] `cd backend && pdm run python manage.py runserver` starts cleanly.
- [ ] `curl http://localhost:8000/api/` returns 200.

---

## Constraints

- **LTS-only strategy**: do not land on Django 5.0 or 5.1 even as a stepping stone. Go directly 4.2 → 5.2.
- **Behavior-preserving**: no API contract changes; frontend must not notice.
- **No new features**: do not adopt 5.2's new features in this PR.
- **Python floor**: 3.12 minimum, unchanged.
- **PostgreSQL floor**: 14+, unchanged.
- **PDM workflow**: use `pdm` exclusively; no `pip` / `requirements.txt` regeneration.
- **No test workarounds**: if a test fails, fix it. Do not skip, mark xfail, or rewrite to dodge a real 5.2 behavior change.

---

## Implementation Hints

- The bulk of this PR is pyproject.toml + lockfile + 2-line code change in `donation_views.py`. Expect ~30 min plus a full test run.
- Run `pdm update Django djangorestframework django-filter django-timezone-field asgiref` first; let PDM resolve the rest; then audit the diff in `pdm.lock`.
- Pay close attention in the test run to: `assertFormsetError`, `JSONField` encoded literals, `Model.save()` positional args, Sentry's `DjangoIntegration` version, and any `STORAGES` warnings on startup.
- If `pdm` pulls a major bump on something unexpected (`celery`, `djangorestframework`, etc.), stop and ask — a transitive constraint shifted; don't absorb unrelated upgrades.
- Known silent bumps PDM will surface: `sentry-sdk` 1.x → 2.x (in-scope, see dep table), `MarkupSafe` 2.x → 3.x (transitive, expected), `cryptography` and `pyOpenSSL` patch bumps (security-driven, expected and note in PR description). Anything else that appears is unexpected — stop and ask.

---

## Local environment & devcontainer

The full backend development workflow (venv-per-Django pattern, devcontainer setup, manual system dependencies, broken-venv recovery, common gotchas) lives in [`doc/backend-development.md`](../../doc/backend-development.md). This section captures only the 5.2-upgrade-specific deltas on top of that document.

### Critical: activate the right venv before running tests

The 5.2 upgrade adds a second venv (`django5`) alongside the existing 4.2 venv (`django4`). The classic symptom of being on the wrong venv: "CI was green, my local check is red, or vice-versa." **Before any backend command on this branch, confirm:**

```bash
cd backend
pdm run python -c "import django; print(django.get_version())"   # MUST print 5.2.x
```

If it prints `4.2.x`, switch with `pdm use -p .venv-django5` (or `pdm venv activate django5`). Full workflow in `doc/backend-development.md`.

### 5.2-upgrade-specific actions for the implementer

In addition to the existing workflow:

- Create the new venv: `pdm venv create --name django5 -p 3.12` (or `python3.12 -m venv backend/.venv-django5` for non-PDM-managed setups).
- After `pdm install`, verify the resolver tree: `pdm why pytz` (expected resolvers: `twisted`, `autobahn`) and `pdm why sentry-sdk` (expected: 2.x).
- Run the test suite with `-Wa`: `pdm run python -Wa manage.py test --keepdb`.
- The devcontainer does not need code changes for the upgrade (Python 3.12, GDAL, libgdal-dev, libproj-dev are already correct in the Dockerfile). Just rebuild the container and create the new venv inside it.
- `start_backend.sh` is the production startup script (per README "Deploy") and is **unchanged by this PR**. If you want to bump GDAL on a branch, do it in a separate PR.

### Manual system dependencies that PDM does not handle

The full table of system packages PDM doesn't manage lives in `doc/backend-development.md`. Watch for `ImportError` or `OSError: [Errno 2] No such file or directory` on a fresh venv that is not a known Django 5.2 issue. If you hit one, add the missing dep to the table in `doc/backend-development.md` (if it's permanent) or to a comment in this spec (if it's 5.2-upgrade-specific).

### Broken venv recovery

If a `pdm install` fails on an existing venv, the nuclear option is `rm -rf .venv .venv-django*; pdm venv create -p 3.12; pdm install`. **Do not do this on a shared CI machine** - always preserve `pdm.lock`.

## Documentation & agent-file updates (in scope, part of Definition of Done)

The agent files (`backend/agent.md`, `AGENTS.md`, `.github/agents/BackendDeveloper.agent.md`, `.github/COPILOT_SETUP_GUIDE.md`, `.github/COPILOT_SUMMARY.md`) currently say **Django 4.2** and `pdm venv activate django4`. They **must be updated as part of this PR** because the project's Definition of Done includes complete and consistent documentation — an upgrade that ships code without telling the next agent (or the next human) about it is incomplete.

### Why this is safe despite the timing concern

A natural worry is: "if the agent files say Django 5.2 but the code is still 4.2, the implementation agent will get confused." This is solved by the fact that **the doc edits and the code edits land in the same PR**:

- If the PR is open for review, the implementation agent working on it sees the *current* spec (which says 5.2) and the *current* agent files (which the implementation agent itself is editing to 5.2). Both are consistent with the branch's intent.
- If the PR is merged, code and docs land together on master. There is no intermediate state on master.
- If the PR is reverted, code and docs revert together.

So the atomic-PR property gives us the consistency we need. The "deferred to a follow-up PR" pattern would actually be *worse* here: it would leave master in a state where code is 5.2 but agent files still say 4.2, which is the inconsistency we're trying to avoid.

### Files to update in this PR

| File | Change |
|---|---|
| `backend/agent.md` | "Django 4.2 + DRF" → "Django 5.2 + DRF" in the tech stack; "Language: Python 3.11" → "Python 3.12" (was already inconsistent with prod and devcontainer) |
| `AGENTS.md` | "Django 4.2 + DRF" → "Django 5.2 + DRF"; `pdm venv activate django4` → `pdm venv activate django5` (with note that both venvs coexist during the upgrade window) |
| `.github/agents/BackendDeveloper.agent.md` | "Django 4.2 + Django REST Framework" → "Django 5.2 + Django REST Framework" |
| `.github/COPILOT_SETUP_GUIDE.md` | "Always use Django 4.2 patterns" → "Always use Django 5.2 patterns"; bump `docs.djangoproject.com/en/3.2/` links to `en/5.2/` where present |
| `.github/COPILOT_SUMMARY.md` | "Django 4.2" → "Django 5.2" in the tech stack; bump `en/3.2/` links to `en/5.2/` |
| `README.md` | **No change.** The README does not mention a Django version number. (It does link to `docs.djangoproject.com/en/3.1/` in two places, which is already stale on master; that's a separate doc-cleanup PR.) |

### Files intentionally NOT updated

- **`README.md` 3.1 doc links**: pre-existing on master, separate doc-cleanup PR.
- **Older specs** in `doc/spec/` that mention "Django 4.2" in their problem-statement context (e.g. `20260708_1302_rich_text_image_support.md`): historical records of decisions made under Django 4.2; do not retroactively rewrite them.
- **`backend/local-env-setup.md`**: already version-agnostic.
- **`.devcontainer/devcontainer.json` and `.devcontainer/Dockerfile`**: already specify Python 3.12, which is what Django 5.2 needs.

### Manual deps the user remembers installing

The user noted that during the 3.x → 4.x setup, there were some dependencies they had to install manually (beyond what `pdm install` handles, beyond what `start_backend.sh` does for prod). We do **not** know which ones in advance. The spec defers this to the IMPLEMENTATION phase:

- During IMPLEMENTATION, on a fresh venv, watch for any `ImportError` or `OSError: [Errno 2] No such file or directory` that is not a known Django 5.2 issue.
- If something is missing and it's a system-level tool (e.g. `libxml2-dev`, `libxslt-dev`, `build-essential`, `pkg-config`), document it in a new "Manual system dependencies" sub-section of the Local environment section of this spec, **or** in `backend/local-env-setup.md` if it's truly environment-setup rather than Django-version-specific.
- If it's a Python package that should have been in `pyproject.toml`, add it to the in-scope dep list and run `pdm add`.

### `doc/backend-development.md` (in scope)

The venv-per-Django pattern and full backend development workflow live in a new file, [`doc/backend-development.md`](../../doc/backend-development.md). It is created as part of this PR because the pattern is permanent (it will be needed for the next Django upgrade, which will be Django 6.2 LTS) and we do not want it to live only in a time-bounded spec.

The README's Backend / First Time Setup section is updated to point at this new file.

### Acceptance criteria for the docs updates (part of Definition of Done)

- [ ] `backend/agent.md` line 6: "Django 4.2" → "Django 5.2".
- [ ] `AGENTS.md` line 14: "Django 4.2" → "Django 5.2"; the line also gains the `pdm venv activate django5` note.
- [ ] `.github/agents/BackendDeveloper.agent.md` line 35: "Django 4.2" → "Django 5.2".
- [ ] `.github/COPILOT_SETUP_GUIDE.md`: no remaining "Django 4.2" references in the runtime-instruction sections; doc links bumped from `/en/3.2/` to `/en/5.2/`.
- [ ] `.github/COPILOT_SUMMARY.md`: no remaining "Django 4.2" references; doc links bumped.
- [ ] `git grep "Django 4\\.2" backend/agent.md AGENTS.md .github/agents/BackendDeveloper.agent.md .github/COPILOT_SETUP_GUIDE.md .github/COPILOT_SUMMARY.md` returns no matches in the runtime/tech-stack sections. (Historical references in other spec files are OK.)
- [ ] `doc/backend-development.md` exists and contains the venv-per-Django pattern (the `pdm venv activate django4` / `pdm venv activate django5` naming, the wrong-venv smoke test, and the broken-venv recovery procedure).
- [ ] `README.md` Backend / First Time Setup section contains a pointer to `doc/backend-development.md`.

## Open Questions

1. ~~**PostgreSQL version in prod**: confirm 14+...~~ **Resolved 2026-08-11:** prod is on PostgreSQL 17.10, well above the 14+ floor.
2. **`pytz` removal**: remove from `pyproject.toml` and let PDM complain. The `twisted` / `autobahn` / Channels stack brings `pytz` transitively, so `pdm install` will still succeed. After install, verify with `pdm why pytz` and confirm the only resolvers are `twisted` and `autobahn`. (Recommendation: remove from pyproject.)
3. **`django-rest-knox` compatibility with DRF 3.18**: verify on install whether it pins a DRF upper bound below 3.18. If it does, bump knox together. (Recommendation: bump together if needed.)
