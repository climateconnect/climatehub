# Remove the ClimateMatch Backend Implementation

**Status**: DRAFT
**Type**: Backend cleanup (+ small frontend tidy-up) — deletes the `climate_match` Django app, its
6 tables, and every cross-app artifact whose only consumer was ClimateMatch.
**Epic**: Dead Code Removal
**Date and time created**: 2026-08-26 11:29
**Related**:
- GitHub issue [#1730](https://github.com/climateconnect/climateconnect/issues/1730) — this cleanup.
  Links to the frontend removal issue, which is **already done** (see *Preconditions*).
- `doc/spec/20260609_1251_remove_dead_featured_projects_endpoint.md` — same shape of task, smaller
  blast radius. The `ProjectSuggestionSerializer` that spec explicitly kept alive is removed here,
  because ClimateMatch was its last consumer.
- `doc/spec/20260706_1430_refactor_project_serializers.md` — lists climate match among the
  importers of `organization/serializers/project.py`. That import goes away with this change.

---

## Preconditions

**The frontend no longer uses ClimateMatch.** Verified on `master` at the time of writing:

- There is no `pages/climatematch*` route (`frontend/pages/` contains only `climatehubs.tsx`, which
  is the unrelated hub directory page).
- No frontend source file calls `/api/climate-match/…`, `/api/questions/`,
  `/api/climatematch_question_answers/`, or `/api/climatematch_results/`.
- The only remaining `climatematch` strings in the frontend are (a) hard-coded **external** links
  inside `frontend/devlink/pageComponent/*.tsx` — generated Webflow code pointing at
  `https://climatehub.org/…/climatematch` — and (b) an unrelated CSS class name (see *Frontend*).

Nothing in this spec should be started until that is re-verified on the branch point, because every
endpoint below is deleted, not deprecated.

---

## Problem Statement

`climate_match` is a full Django app — 6 models, 3 public endpoints, a 150-line raw-SQL ranking
query, an admin registration, and 15 migrations — serving a questionnaire feature the product no
longer runs. The frontend stopped calling it; the backend was left in place.

Beyond the usual cost of dead code, this app is actively expensive to carry:

1. **It holds the codebase's largest raw SQL blob.** `climate_match/utility/sort_resources.py`
   hand-writes a 9-CTE query against 14 tables by name, with f-string interpolation of the user
   filter. Every schema change to `organization_project`, `hubs_hub`, `ideas_idea`,
   `organization_organizationtags`, `climateconnect_skill`, or their join tables can silently break
   it — no ORM, no migration checks, no tests (`climate_match/tests.py` is empty). It is a standing
   tripwire under refactors that have nothing to do with ClimateMatch.
2. **It pins serializers other work wants to move.** `ProjectSuggestionSerializer`,
   `OrganizationSuggestionSerializer`, and `HubClimateMatchSerializer` exist solely for ClimateMatch
   responses, and the project-serializer refactor has to keep reasoning about them.
3. **It keeps a personal-data table growing with no reader.** `climate_match_userquestionanswer`
   links `auth_user` rows to answer sets and to the hub the user arrived from. Under GDPR, data with
   no purpose should not be retained — a dead feature's table is exactly that.
4. **It puts an unreachable field in the admin.** `OrganizationTags.show_in_climatematch` is a
   curated boolean staff have to reason about in the Django admin, read by nothing but the dead SQL.

---

## Core Requirements

### What We're Removing

#### The app itself

| Artifact | Location |
|---|---|
| Entire Django app | `backend/climate_match/` — models, serializers, views, urls, admin, permissions, utility, tests, and all 15 migrations |
| `INSTALLED_APPS` entry | `backend/climateconnect_main/settings.py:96` |
| URL include | `backend/climateconnect_main/urls.py:201–202` (`path("api/", include("climate_match.urls"))`) |
| Coverage source entry | `backend/pyproject.toml:162` (`"climate_match"` in `[tool.coverage.run] source`) |

The three endpoints that disappear (all `AllowAny`):

| Route | View |
|---|---|
| `GET /api/questions/` | `QuestionAnswerView` |
| `GET`, `POST /api/climatematch_question_answers/` | `UserQuestionAnswersView` |
| `GET /api/climatematch_results/` | `UserResourcesMatchView` |

#### Cross-app artifacts whose only consumer was ClimateMatch

| Artifact | Location | Note |
|---|---|---|
| `OrganizationSuggestionSerializer` | `backend/organization/serializers/climatematch.py` | Delete the whole file — it contains nothing else. Not re-exported from `organization/serializers/__init__.py` (verified). |
| `ProjectSuggestionSerializer` | `backend/organization/serializers/project.py:559–569` | Only importers: `climate_match/views/user_match_views.py` and the file above. |
| `HubClimateMatchSerializer` | `backend/hubs/serializers/hub.py:164–172` | Only importers: `climate_match/views/user_match_views.py` and `climate_match/serializers/question_answer.py`. |
| `OrganizationTags.show_in_climatematch` | `backend/organization/models/tags.py:61–65` | Field + column. Only reader is the dead ranking SQL. |
| `create_climatematch_data` command | `backend/climateconnect_api/management/commands/create_climatematch_data.py` | Seeds the 4 questions and their answers. Delete the file. |
| `show_in_climatematch=True` kwargs | `backend/climateconnect_api/management/commands/create_test_data.py:148, 155` | Remove the two kwargs; keep both `OrganizationTags.objects.create(...)` calls. |
| Question images | `frontend/public/images/climatematch-question-{1,2,3,4}.jpg`, `frontend/public/images/erlangen_climatematch.jpg` | Referenced only by `create_climatematch_data.py` (as `../frontend/images/…`) and by nothing else in the frontend — verified by grep across `frontend/` excluding `node_modules`/`.next`. |

#### Database objects

Eight tables, dropped in one migration (names confirmed against the raw SQL in `sort_resources.py`):

```
climate_match_question
climate_match_answer
climate_match_answermetadata
climate_match_userquestionanswer
climate_match_questiontranslation
climate_match_answertranslation
climate_match_answer_answer_metadata          -- M2M Answer.answer_metadata
climate_match_userquestionanswer_answers      -- M2M UserQuestionAnswer.answers
```

Plus: the `django_content_type` rows for `app_label='climate_match'`, the `django_migrations` rows
for `app='climate_match'`, and the `show_in_climatematch` column on `organization_organizationtags`.

### What Stays

| Artifact | Reason |
|---|---|
| `ProjectStubSerializer` | Parent of the deleted `ProjectSuggestionSerializer`, but used directly by `ListProjects`, `ListSimilarProjects`, `ListUserProjects`. Keep unchanged. |
| `IdeaMinimalSerializer` | ClimateMatch was one of six consumers; the others (`chat_messages`, `ideas` views, idea support/comment serializers) remain. |
| `SkillSerializer`, `OrganizationSerializer` | Broadly used. |
| `create_sector_hub_data` command | Sector hubs are a live concept independent of ClimateMatch. **Only** reword the `help` string (`backend/climateconnect_api/management/commands/create_sector_hub_data.py:8`), which currently says "necessary e.g. for the ClimateMatch". |
| Sector hubs themselves (`Hub.SECTOR_HUB_TYPE`) | Used by hub browsing. |
| Historical migrations in other apps | `organization/migrations/0088_organizationtags_show_in_climatematch.py` and `0090_merge_20211126_1438.py` must **not** be edited or deleted — they are history. The new migration removes the field going forward. |
| `devlink/pageComponent/*.tsx` ClimateMatch links | Generated Webflow code (`yarn devlink-sync`); never hand-edited per `CLAUDE.md`. They point at external URLs. Fixing them is a Webflow-side task — out of scope, flagged in *Follow-ups*. |
| Existing spec documents mentioning climate match | `doc/spec/*` is a historical record. Do not rewrite past specs. |

---

## Data Handling

`climate_match_userquestionanswer` contains personal data (`user_id`, or an anonymous `token`,
joined to answer choices and to the arrival hub). The decision is: **export first, then drop.**

### Export, before the migration is deployed

Two artifacts, produced against production by whoever runs the deploy:

1. **Anonymised aggregate (the durable one).** A CSV of counts, holding no user or token identifier:

   ```sql
   -- answer popularity per question, per arrival hub
   SELECT q.id   AS question_id,
          q.text AS question_text,
          h.url_slug AS hub,
          COALESCE(a.text, ct.model || ':' || amd.reference_id) AS answer,
          COUNT(DISTINCT uqa.id) AS times_chosen
   FROM climate_match_userquestionanswer uqa
   JOIN climate_match_question q ON q.id = uqa.question_id
   LEFT JOIN hubs_hub h ON h.id = uqa.hub_id
   LEFT JOIN climate_match_answer a ON a.id = uqa.predefined_answer_id
   LEFT JOIN climate_match_userquestionanswer_answers uqaa ON uqaa.userquestionanswer_id = uqa.id
   LEFT JOIN climate_match_answermetadata amd ON amd.id = uqaa.answermetadata_id
   LEFT JOIN django_content_type ct ON ct.id = amd.resource_type_id
   GROUP BY 1, 2, 3, 4
   ORDER BY 1, 3, 5 DESC;
   ```

   Plus a one-line completion count per hub. This is the part with lasting analytical value ("which
   sectors and skills did people in hub X pick"), and it is safe to keep indefinitely.

2. **Full dump (short-lived safety net).**
   `pdm run python manage.py dumpdata climate_match --indent 2 > climate_match_full_YYYYMMDD.json`

   This **is** personal data. Store it under the same access controls and retention rules as a
   database backup, not in the repository, and delete it once the removal is confirmed stable
   (suggested: 30 days after deploy). Note it in whatever record the team keeps of data exports.

Neither artifact is committed to git. The spec's acceptance criteria treat "export produced and
stored" as a gate on running the migration.

---

## Migration Strategy

**One PR, one deploy, one migration** — added to the `organization` app, which already needs a
migration for `show_in_climatematch`. This works because **no migration in any other app depends on
a `climate_match` migration** (verified: `grep -rn "climate_match" */migrations/` matches nothing
outside `climate_match/` itself). The `climate_match` migrations only ever depended *outward*, on
`climateconnect_api`, `hubs`, and `contenttypes`.

`backend/organization/migrations/0146_remove_climatematch.py` (next number after
`0145_delete_organizationfieldtagging`, which landed on `master` while this spec was being
implemented):

```python
from django.db import migrations


def delete_climate_match_bookkeeping(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    ContentType.objects.filter(app_label="climate_match").delete()
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DELETE FROM django_migrations WHERE app = 'climate_match'")


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0145_delete_organizationfieldtagging"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="organizationtags",
            name="show_in_climatematch",
        ),
        migrations.RunSQL(
            sql="""
                DROP TABLE IF EXISTS
                    climate_match_userquestionanswer_answers,
                    climate_match_answer_answer_metadata,
                    climate_match_userquestionanswer,
                    climate_match_answertranslation,
                    climate_match_questiontranslation,
                    climate_match_answermetadata,
                    climate_match_answer,
                    climate_match_question
                CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(
            delete_climate_match_bookkeeping,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
```

Notes on the shape of this migration:

- **It is one-way.** `reverse_sql`/`reverse_code` are no-ops so `migrate organization 0145` does not
  explode, but the tables and their data do not come back. The archive from *Data Handling* is the
  only recovery path. Say so in the migration's module docstring.
- **`CASCADE` + explicit ordering.** All eight names are listed child-first anyway; `CASCADE` covers
  anything the list misses (indexes, the M2M constraints). Postgres DDL is transactional, so a
  failure rolls the whole migration back.
- **`DELETE FROM django_migrations` is raw SQL on purpose** — `django_migrations` has no model to go
  through `apps.get_model` for. Without it, `showmigrations` keeps listing 15 phantom
  `climate_match` entries forever. Django tolerates the orphans, but they are exactly the confusing
  residue this issue is about.
- **Content types before or after the drop doesn't matter**, but doing it in the same migration
  avoids relying on someone remembering `manage.py remove_stale_contenttypes` (which is interactive
  and therefore usually skipped in deploys).
- **Order of operations inside the PR matters for the test run**: the app must be removed from
  `INSTALLED_APPS` in the same commit, or Django will try to build model state for models whose
  migrations no longer exist.

---

## System Impact

### Files deleted

```
backend/climate_match/                                              (entire directory, incl. migrations/)
backend/organization/serializers/climatematch.py
backend/climateconnect_api/management/commands/create_climatematch_data.py
frontend/public/images/climatematch-question-1.jpg
frontend/public/images/climatematch-question-2.jpg
frontend/public/images/climatematch-question-3.jpg
frontend/public/images/climatematch-question-4.jpg
frontend/public/images/erlangen_climatematch.jpg
```

### Files edited

| File | Change |
|---|---|
| `backend/climateconnect_main/settings.py` | Drop `"climate_match",` from `INSTALLED_APPS` (line 96) |
| `backend/climateconnect_main/urls.py` | Drop the `# Climate match APIs` comment and the `include("climate_match.urls")` path (lines 201–202) |
| `backend/pyproject.toml` | Drop `"climate_match",` from `[tool.coverage.run] source` (line 162) |
| `backend/organization/models/tags.py` | Delete the `show_in_climatematch` field (lines 61–65) |
| `backend/organization/serializers/project.py` | Delete `ProjectSuggestionSerializer` (lines 559–569) |
| `backend/hubs/serializers/hub.py` | Delete `HubClimateMatchSerializer` (lines 164–172) |
| `backend/climateconnect_api/management/commands/create_test_data.py` | Remove `show_in_climatematch=True` from both `OrganizationTags.objects.create(...)` calls (lines 148, 155) |
| `backend/climateconnect_api/management/commands/create_sector_hub_data.py` | Reword `help` (line 8) — e.g. "Create sector hub data" |
| `backend/organization/migrations/0146_remove_climatematch.py` | **New** — see above |

### Frontend

Small and strictly separate from the backend commits:

| File | Change |
|---|---|
| `frontend/public/images/climatematch-*.jpg`, `erlangen_climatematch.jpg` | Delete (5 files, unreferenced) |
| `frontend/src/components/pageNav/PageNav.tsx` | **Rename, do not delete.** The `climateMatchLink` class (defined line 59, used lines 212 and 274) is now applied to two *live* links — the narrow-screen `hubTabLink` and the Emmendingen "Bürgerenergie" link. Rename it to something honest like `highlightedLink` and update both usages. Deleting it would break live UI. |

### Documentation

Every one of these is part of the change, per `CLAUDE.md`:

| File | Change |
|---|---|
| `CLAUDE.md` | Remove `climate_match` from the app list (line 56) |
| `backend/agent.md` | Remove `climate_match` from the app list (line 20) |
| `GLOSSARY.md` | Delete the **Climate Match** entry (lines 34–37, heading through the "Purpose" bullet). Note its "Related Models" names (`ClimateMatchQuestion` etc.) never matched the real class names — no need to fix what is being deleted. |
| `doc/architecture.md` | Remove the feature bullet (line 34), the `climate_match/` tree entry (line 168), the app table row (line 190), the `/api/climate-match/questions/` route (line 222), and the `climateMatch/` frontend tree entry (line 316) |
| `doc/domain-entities.md` | Delete section 7 (lines 749–798, heading through its trailing `---`) and its TOC entry (line 17); renumber sections 8+ **or** leave numbering and note the gap — pick one and be consistent, noting the file already has two sections numbered 9. Also fix line 895 (Hub → "Climate Match via `UserQuestionAnswer.hub`"), line 1007 (the `ClimateMatch` node in the ER summary), and line 1029 (the "Matching Intelligence" bullet). |
| `doc/mosy/architecture_overview.md` | Remove the Climate Matching bullet (line 17) |
| `doc/mosy/entities/system-entities.md` | Remove the Climate Match survey-item definition (line 204) |
| `doc/api-documentation.md` | **No change needed** — verified to contain no ClimateMatch reference |

---

## Acceptance Criteria

- [ ] The frontend precondition is re-verified on the branch point: no `pages/climatematch*`, no call to any of the three routes.
- [ ] The anonymised aggregate CSV and the full `dumpdata` JSON are produced from production and stored outside the repo, before the migration is deployed.
- [ ] `backend/climate_match/` no longer exists.
- [ ] `grep -rniE "climate.?match" backend --include='*.py' | grep -v migrations` returns nothing.
- [ ] `climate_match` is gone from `INSTALLED_APPS`, `urls.py`, and the coverage source list.
- [ ] `ProjectSuggestionSerializer`, `OrganizationSuggestionSerializer`, and `HubClimateMatchSerializer` are gone, and `ProjectStubSerializer` / `IdeaMinimalSerializer` / `OrganizationSerializer` are untouched.
- [ ] `show_in_climatematch` is gone from the model, from `create_test_data.py`, and from the DB.
- [ ] Migration `organization/0146_remove_climatematch.py` applies cleanly on a copy of the production DB, and `manage.py showmigrations` afterwards lists no `climate_match` app.
- [ ] After migrate, `SELECT count(*) FROM django_content_type WHERE app_label = 'climate_match'` returns 0.
- [ ] `pdm run python manage.py makemigrations --check --dry-run` reports no pending changes.
- [ ] `pdm run python manage.py test --keepdb --noinput` passes; `make ruff` and `make format` are clean.
- [ ] `manage.py create_test_data` and `manage.py create_sector_hub_data` still run end to end on a fresh DB.
- [ ] Frontend: 5 images deleted, `climateMatchLink` renamed with both usages updated, `yarn lint` and `yarn build` clean, and the Emmendingen + narrow-screen hub-tab links still render styled correctly.
- [ ] All documentation rows above are updated in the same PR.

---

## Non-Goals

- **Deprecating instead of deleting.** The endpoints have no consumer; they go in one step.
- **Editing `frontend/devlink/`.** The generated Webflow landing pages link to `/climatematch` on external hosts. That is a Webflow content fix, not a code fix.
- **Rewriting historical migrations.** `organization/0088` and `0090` stay exactly as they are.
- **Building a replacement.** If a recommendation/matching feature returns, it starts from a fresh design; nothing here is preserved as a foundation.
- **Rewriting past spec documents** in `doc/spec/` that mention climate match.
- **Renumbering unrelated docs beyond the sections listed.**

---

## AI Agent Insights

### The `sort_resources.py` SQL is the reason this app is worth deleting, not just muting

It is worth reading `climate_match/utility/sort_resources.py` once before deleting it, because it
explains why "just leave it, it's not hurting anyone" is wrong. The query names
`organization_project`, `organization_project_skills`, `organization_projecttagging`,
`organization_projecttags`, `organization_organizationtagging`, `organization_organizationtags`,
`organization_organization_hubs`, `organization_projectparents`, `hubs_hub`,
`hubs_hub_location`, `hubs_hub_filter_parent_tags`, `ideas_idea`, `climateconnect_skill`, and
`django_content_type` — directly, as strings. There are no tests. Any rename or restructure in those
tables produces a runtime `ProgrammingError` on an endpoint nobody is watching, which is the worst
possible failure mode: invisible until someone stumbles onto it.

It also interpolates its filter with an f-string (`user_id = {}` / `token = '{}'`). The values are
`request.user.id` and a query-param token, so this is not currently exploitable in an obvious way,
but it is a SQL-injection pattern sitting in an `AllowAny` view. Deleting it is the fix.

### `UserResourcesMatchView` has a latent `UnboundLocalError`

At `climate_match/views/user_match_views.py:70–78`, the `hub` variable is assigned inside
`if uqa.exists() and uqa[0].hub:` in the `request.query_params.get("hub")` branch, and if
`Hub.DoesNotExist` fires while that condition is false, `hub.id` on line 81 raises
`UnboundLocalError`. There is also a dead `try:`/`pass` block at lines 30–39 with a
`# TODO: fix this assignment or remove this try block` comment and a commented-out `UserProfile`
lookup. Both are noted here only as evidence the app is unmaintained — **do not fix them**, delete
them with the rest.

### `climate_match/permissions.py` is already dead inside a dead app

`UserResourceMatchPermission` is defined but never referenced; all three views use `AllowAny`. No
analysis needed, it just goes.

### Question images have an Azure counterpart

`Question.image` uploads to `climate_match/questions/<id>/<filename>` in Azure Blob Storage. Dropping
the table orphans those blobs — they cost approximately nothing and deleting them is a manual
console operation, so it is listed under *Follow-ups* rather than as a blocker. The
`frontend/public/images/climatematch-question-*.jpg` files are the *source* images the seed command
uploads from, which is why they are deleted here.

### Why the migration lives in `organization`

Django needs the `show_in_climatematch` removal to be an `organization` migration regardless. Adding
the `DROP TABLE` there costs nothing extra and keeps the whole removal atomic — one migration, one
transaction, all-or-nothing. Putting it anywhere else (a new throwaway app, or a `climate_match`
migration that must survive its own app's deletion) is strictly more machinery for the same result.

### `Language` loses two reverse accessors

`Question.language` and `Answer.language` declare `related_name="question_language"` and
`"answer_language"` on `climateconnect_api.Language`. Grep confirms nothing outside `climate_match`
uses either accessor, so their disappearance is invisible. Same for
`UserQuestionAnswer.user` → `user_qna` on `auth.User` and
`UserQuestionAnswer.hub` → `user_question_answer_locatin_hub` (sic) on `Hub`.

---

## Implementation Notes

Suggested commit order — each step leaves the tree in a state where `manage.py check` passes:

1. **Archive first.** Produce and store both exports from production. Nothing else starts until
   this is confirmed done; the migration is irreversible.
2. **Cut the entry points.** Remove the `INSTALLED_APPS` entry, the URL include, and the coverage
   source entry. The app is now unreachable but still on disk.
3. **Delete the app directory** `backend/climate_match/` in full, including `migrations/`.
4. **Delete the cross-app artifacts**: `organization/serializers/climatematch.py`,
   `ProjectSuggestionSerializer`, `HubClimateMatchSerializer`, the `show_in_climatematch` field,
   `create_climatematch_data.py`, the two kwargs in `create_test_data.py`, the `help` string in
   `create_sector_hub_data.py`. Run `make ruff` — it will catch any import left dangling.
5. **Write the migration** `organization/0146_remove_climatematch.py` as specced, with a docstring
   stating it is one-way. Verify with `makemigrations --check --dry-run` that Django agrees the
   model state matches; the `RemoveField` must be there or Django will want to generate its own.
6. **Test against real data.** Restore a production dump locally, run `migrate`, then confirm:
   the 8 tables are gone, `django_migrations` has no `climate_match` rows, `django_content_type` has
   no `climate_match` rows, and `organization_organizationtags` has no `show_in_climatematch`
   column. Then run `manage.py create_test_data` and `create_sector_hub_data` on a fresh DB.
7. **Frontend commit.** Delete the 5 images; rename `climateMatchLink` → `highlightedLink` in
   `PageNav.tsx` and update both usages. `yarn lint && yarn build`.
8. **Documentation commit.** Every row in the *Documentation* table.

### Testing

There is nothing to add — `climate_match/tests.py` is empty, so no test is lost. The relevant signal
is the existing suite continuing to pass, in particular `organization` and `hubs`, whose serializer
modules are edited:

```sh
cd backend
pdm run python manage.py test organization --keepdb
pdm run python manage.py test hubs --keepdb
pdm run python manage.py test --keepdb --noinput
```

Requires PostgreSQL on 5432 and Redis on 6379.

### Deployment

Single deploy. The migration takes milliseconds (`DROP TABLE` on small tables, one column drop).
Because the API routes are removed in the same release, any external client still calling the three
endpoints starts receiving 404 immediately — acceptable, since they are undocumented, unauthenticated,
and return nothing meaningful without questionnaire data.

---

## Follow-ups (not in this PR)

- Delete the orphaned `climate_match/questions/**` blobs from Azure Blob Storage.
- Update the Webflow landing pages so the generated `devlink/pageComponent/*.tsx` files stop linking
  to `/climatematch`, then re-run `yarn devlink-sync`.
- Delete the full `dumpdata` archive once the removal is confirmed stable (suggested: 30 days).
