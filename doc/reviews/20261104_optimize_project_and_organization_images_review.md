# Code Review: Optimised project and organisation images (WebP variants)

**Branch:** `optimize-project-and-organization-images`
**Issue:** [#2199](https://github.com/climateconnect/climatehub/issues/2199)
**Reviewed against:** `master` (`b499d8cf0`), branch head `ac5cd0d2b`
**Date:** 2026-11-04
**Reviewer:** Claude (code-review agent, forked; the findings were then checked against the code in the main session and discussed with the maintainer)

The specs in `doc/spec/20260916_1136_*` are part of this implementation. They are **not** the source of truth. This review measures the branch against the intent of the issue: project and organisation images, the project hero image above all, should not be served as multi-megabyte originals.

---

## Summary

The branch adds a Celery task that generates WebP variants for image fields:

- 1200px and 600px versions of `image` (and `background_image` for organisations)
- a WebP copy of the thumbnail at its original size

The paths are stored in a new `image_variants` JSON field. They are exposed through `ImageVariantsField` in the serializers and used in the frontend by `ResponsiveImage` (`<picture>` with a WebP `<source>`) and `resolveVariantUrl`. A management command, `backfill_image_variants`, generates variants for existing rows.

**Verdict: the goal of the issue is reached. Two robustness issues must be fixed before merging, and the scope must go back to project and organisation images.**

- The project hero image (`ProjectOverview`) and the project cards (`ProjectPreview`) use the variants and fall back to the original.
- The fallback works for new and replaced images. `post_save` first drops the field's entry from `image_variants`, the old files are deleted only after the commit, and a new upload gets a new filename, so its variants also get new names. Until the task has finished, the API lists no variant and the browser loads the original.
- No regression was found in the existing create and edit flows for projects and organisations.

We read the code and ran no tests for this review.

### Key design rule

The frontend fallback only works if **`image_variants` lists only files that exist**. `<picture>` does not fall back to its `<img>` when a `<source>` URL returns 404. CSS `background-image` banners do not fall back either. Every finding below marked *must fix* is about keeping this rule true, or about keeping a broken broker from breaking the user's save.

---

## Findings

| #   | Severity       | Finding                                                                        | Decision            |
| --- | -------------- | ------------------------------------------------------------------------------ | ------------------- |
| 1   | Must fix       | A broker error in the `on_commit` callback turns a successful save into a 500  | Fix                 |
| 2   | Must fix       | Regenerating variants deletes the live file before the replacement is written | Fix                 |
| 3   | Must fix       | Scope creep: UserProfile variants and members-list cache invalidation          | Remove              |
| 4   | Should fix     | The source image is decoded once per variant width                            | Fix                 |
| 5   | Should fix     | `image_variants` ends up in the org edit state and is sent with every PATCH    | Fix                 |
| 6   | Cleanup        | Variant file naming is implemented twice                                       | Fix                 |
| 7   | Cleanup        | `IMAGE_FIELD_NAMES` duplicates the keys of `IMAGE_VARIANT_CONFIGS`             | Fix                 |
| 8   | Low            | List serializers return variant keys the cards don't use                       | Optional            |
| 9   | Decision       | Test runner `MEDIA_ROOT` override                                              | See below           |
| –   | Dropped        | Variants are bounded by width only, not by a box                               | No change           |
| –   | Accepted       | Original files are now deleted when an image is replaced or a row is deleted   | Keep                |

---

### 1. A broker error during enqueue fails the request (must fix)

`backend/climateconnect_main/utility/image_variants.py:187`

`generate_image_variants.delay()` runs in a `transaction.on_commit` callback without `robust=True`. If Redis is unavailable, kombu raises from the callback. The existing `CELERY_BROKER_TRANSPORT_OPTIONS` (2s socket timeouts) make it fail quickly. In autocommit the callback runs right away, so the edit endpoint returns a 500 even though the row and the new image are already saved. Before this branch, image edits did not depend on Celery at all.

**Fix:** use `transaction.on_commit(_enqueue, robust=True)`, or wrap `.delay()` in `try/except` and log the error with model and pk.

**Behaviour after the fix:** `robust=True` only catches and logs the exception. It does **not** retry. The user's save succeeds and the original image is served, which is correct because the variant entry was already removed. That row has no variants until `backfill_image_variants` runs again.

**Optional follow-up (not required for this PR):** a periodic Celery beat task that picks up rows with an image but no variants, so they recover without manual action.

### 2. Regeneration deletes the live variant before the new one exists (must fix)

`backend/climateconnect_main/utility/image_variants.py:429` (in `generate_and_store_variants`)

Variant names are derived from the source name (`<base>_1200.webp`, …). To reuse that fixed name, the loop first deletes the currently recorded file, then encodes and saves the new one. The map is updated only afterwards, in `_commit_variants`. While that runs, `image_variants` points at a file that does not exist. WebP encoding with `method=6` takes seconds per variant. If `storage.save` fails, the file stays missing until the map is rewritten.

This only affects regeneration for an unchanged source:

- `backfill_image_variants --force`
- `backfill_image_variants --verify`
- a task retry after a partial run (`max_retries=3`)

New uploads and replaced images are not affected, because their variants get new names.

**Fix:** never delete a file the map still references.

1. Save each regenerated variant under a **new** name. The simplest way is to stop the pre-delete and let `storage.save()` pick a free name, or to add a short token to the name.
2. Write the new names to `image_variants` (`_commit_variants`).
3. Delete the previously recorded files with `transaction.on_commit`, after the map update has committed.

A side benefit: an overwritten fixed name can keep stale content in CDN and browser caches, and new names avoid that.

**Consequence for cleanup:** once names are no longer fully deterministic, deleting files on replace or row delete (`_image_file_names`, `capture_image_field_changes`, `delete_image_files`) must use the names **recorded in `image_variants`**. It can keep the computed names as an extra safety net. See also finding 6.

**Tests:** add a test showing that during regeneration the recorded file stays readable until the map points at the new one. Add another showing that a failed `storage.save` leaves the previous variant in place and referenced.

### 3. Scope beyond the issue (must fix: remove)

Issue #2199 is about **project and organisation** images. What matters most is the project hero image, where users often upload very large files. The branch also adds:

- **UserProfile variants:**
  - the `UserProfile.image_variants` field and migration `0103_userprofile_image_variants.py`
  - `ImageVariantsField` on four user serializers
  - `backend/climateconnect_api/signals.py` and its registration in `apps.py`
  - the `UserProfile` support in `backfill_image_variants`
  - the profile-related frontend changes: `profileOperations.ts`, the avatar components, `AccountPage`, `Header`, the communication and notification components, the dialogs, and so on

  Profile images are mostly shown as thumbnails, which are already small.
- **Members-list cache invalidation** (`invalidate_member_list_cache` in `climateconnect_api/signals.py`). This only exists because of the UserProfile variants. It also runs a Redis `KEYS` scan twice per avatar change and duplicates `remove_cache_keys` in `climateconnect_api/models/user.py`. The underlying problem, that the cached members list is not refreshed after an avatar change, already exists on `master` and should be its own issue if wanted.

**Decision:** remove both from this branch, including the migration, the UserProfile config entries, the user serializer fields, the profile frontend changes and the related tests and docs (`doc/architecture.md`, `doc/domain-entities.md`, `doc/api-documentation.md`). Deleting `UserProfile` rows must not leave dangling references.

### 4. The source image is decoded once per width (should fix)

`backend/climateconnect_main/utility/images.py:95–103`

`generate_and_store_variants` reads the source bytes once. But `generate_webp_variant` calls `Image.open` and `ImageOps.exif_transpose` again for every width. Each image field therefore pays for two full decodes, which roughly doubles CPU and peak memory per image during the backfill over the whole corpus.

**Fix:** decode and correct the orientation once per field, then derive each width **from that decoded original**. Don't resize the 600 variant from the 1200 result: resizing an already-resized image is what we want to avoid. This is a structural change to how `generate_webp_variant` is called, not a change to the output.

### 5. `image_variants` is sent with every organisation PATCH (should fix)

`frontend/public/lib/organizationOperations.ts:12`

`parseOrganization` now puts `image_variants` on the edit-form state. `EditOrganizationRoot.getChanges` compares with `!==`. The old organisation is fetched again before saving, so the two `image_variants` objects are never identical and the map is included in every PATCH.

**Impact today:** this does **not** trigger new variant generation. `image_variants` is not in the view's `pass_through_params`, so the backend ignores it. `image` and `thumbnail_image` are only sent when the URL strings differ, and generation only starts when a stored file name changes. So these are useless bytes in every request, and a trap if the PATCH handling is ever made more generic.

**Fix:** leave `image_variants` out when `editMode` is true in `parseOrganization`, or skip it in `getChanges`.

### 6. Variant file naming is implemented twice (cleanup)

`backend/climateconnect_main/utility/images.py:117–127` and `_variant_filename` in `backend/climateconnect_main/utility/image_variants.py:48`

`generate_webp_variant` builds the variant name itself. The cleanup code computes it with `_variant_filename`. If the two drift apart, replaced or deleted images leave orphaned files behind. Have `generate_webp_variant` use one shared helper, or pass the target name in. This interacts with finding 2: after that fix, cleanup should primarily use the recorded names.

### 7. `IMAGE_FIELD_NAMES` duplicates the config (cleanup)

`backend/climateconnect_main/utility/image_variant_models.py:31`

`IMAGE_FIELD_NAMES` repeats the keys of `IMAGE_VARIANT_CONFIGS`. A field added to one and not the other either disables change detection for that field or causes a `KeyError` in `delete_image_files`. Derive it instead:

```python
IMAGE_FIELD_NAMES = {model: list(fields) for model, fields in IMAGE_VARIANT_CONFIGS.items()}
```

### 8. List serializers return unused variant keys (low, optional)

`backend/organization/serializers/project.py`, `backend/organization/serializers/organization.py`

`ProjectStubSerializer` (used by the project list endpoints) returns three variant URLs per project: `image` 1200 and 600, and the thumbnail WebP. The cards only use the thumbnail WebP. The organisation stub and card serializers are similar. The lists are paginated, so the overhead is acceptable. Most of the original concern was about the user serializers, which go away with finding 3. Trim this only if it is cheap, for example with an optional key whitelist on `ImageVariantsField`. Don't build a general mechanism for it.

### 9. Test runner `MEDIA_ROOT` override (decision)

`backend/climateconnect_main/test_runner.py`

The custom test runner now points `MEDIA_ROOT` at a temporary directory for the whole test run, and also sets the environment variable for spawned parallel workers. Without this, tests that upload images write files into the developer's real `media/` directory, next to real rows with the same primary keys. The change is reasonable and is needed by the new image tests. Still, it changes the test infrastructure as a whole and is not part of the issue.

**Recommendation:** keep it, but mention it explicitly in the PR description, or split it into its own small PR merged first. In both cases, run the **full** backend suite locally before merging, not only the image tests.

---

## Raised and dropped or accepted

- **Width-only bound (dropped).** Variants are bounded by width only, so a portrait image would keep its full height. In practice every upload flow in the UI crops first: 16:9 for the project image (`AddPhotoSection`, `EditProjectOverview`), 3:1 for backgrounds and 1:1 for avatars. Only old rows or images set outside the UI could be portrait. No change needed. Bounding by a box (`thumbnail((w, w))`) is a one-line change if it is ever wanted.
- **Permanent deletion of originals (accepted).** Original uploads and their variants are now deleted when an image is replaced and when a project or organisation row is deleted, including cascaded deletes. We don't restore rows in practice, and a delayed delete ("image trash") would add a lot of complexity for little gain. Keep it, but limit it to project and organisation after finding 3.

---

## Acceptance checklist for the next iteration

- [ ] `on_commit` enqueue is robust; a broker outage during an image save returns success and logs the error (test with a mocked `.delay` that raises).
- [ ] Regeneration (`--force`, `--verify`, retry) never leaves `image_variants` pointing at a missing file; previous files are deleted only after the map update commits (tests added).
- [ ] Cleanup on replace and row delete uses the recorded variant names.
- [ ] UserProfile variants, the migration, user serializer fields, profile frontend changes and members-list cache invalidation are removed; the docs are updated to match.
- [ ] The source is decoded once per field; both widths come from the original.
- [ ] `image_variants` is no longer part of the organisation edit state or PATCH payload.
- [ ] Variant naming has a single implementation; `IMAGE_FIELD_NAMES` is derived from the config.
- [ ] The `MEDIA_ROOT` test runner change is called out in the PR or split out.
- [ ] `make format`, `yarn lint`, `yarn format` clean; **full** backend suite and frontend tests pass.

---

# Follow-up review (2026-11-16)

**Reviewed against:** `master`, branch head `7730a1cb6` (fixes in `81bae58cf`)
**Reviewer:** Claude (main session; the avatar finding was checked against production with the maintainer)

## Summary

Every finding of the first review has been addressed correctly. One regression came in with this iteration: the organisation page avatar now shows the small thumbnail. It needs a small frontend change. After that, the branch is ready for manual testing.

**Verdict: fix finding A, update the PR description, then hand over for manual testing.**

### Verification

- Full backend suite: `Ran 1204 tests … OK (skipped=15)`, with Postgres and Redis running locally.
- `makemigrations --check`: no changes.
- Frontend: `ResponsiveImage.test.tsx` and `organizationOperations.test.ts` pass (24 tests). `yarn lint` shows no errors and no warnings in branch files. Prettier and `tsc --noEmit` are clean.
- `black --check` flags three files, but this branch does not touch them (`test_project_join_request_message.py`, `test_project_crud_views.py`, `serializers/event_registration.py`).

## Status of the first review's findings

| #   | Finding                                       | Status                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Broker error fails the save                   | ✅ `.delay()` is wrapped in `try/except` and logged with model, pk and fields, and `on_commit(…, robust=True)` is set. Tests: `test_broker_error_does_not_fail_the_save`, `test_enqueue_callback_is_registered_robust`.                                                  |
| 2   | Regeneration deletes the live file            | ✅ Each variant gets a new name with a random token (`_variant_filename`). The map is switched under `select_for_update`, and superseded files are deleted only `on_commit`. A failed `storage.save` keeps the previous file. Tests: `test_regeneration_keeps_recorded_files_until_the_new_map_commits`, `test_failed_store_keeps_the_previous_variant_referenced`, `test_total_store_failure_keeps_the_previous_entry`. |
| 3   | Scope creep                                   | ✅ Removed: UserProfile variants, migration 0103, `climateconnect_api/signals.py`, the user serializer fields, the profile frontend changes and the members-list cache invalidation. The docs state that profiles have no variants.                                                     |
| 4   | Source decoded once per width                 | ✅ `decode_image` runs once per field, and `encode_webp_variant` derives every width from that original. Test: `test_source_is_decoded_once_and_every_width_from_the_original`.                                                                                    |
| 5   | `image_variants` in every org PATCH           | ✅ Left out of `parseOrganization` when `editMode` is true. Tested.                                                                                                                                                                                                 |
| 6   | Variant naming implemented twice              | ✅ `_variant_filename` is the only implementation. Cleanup uses the names recorded in `image_variants`.                                                                                                                                                                      |
| 7   | `IMAGE_FIELD_NAMES` duplicates the config     | ✅ Derived from `IMAGE_VARIANT_CONFIGS`.                                                                                                                                                                                                                             |
| 8   | Unused variant keys in list serializers       | Unchanged. It was optional, so this is fine.                                                                                                                                                                                                                         |
| 9   | Test runner `MEDIA_ROOT` override             | ⚠️ The code is kept and the full suite passes, but the PR description does not mention it yet (see below).                                                                                                                                                          |

The optional follow-up from finding 1 was also built: an hourly Celery beat task, `regenerate_missing_image_variants`. It only picks up rows whose `updated_at` lies between 1 hour and 7 days ago, at most 50 rows per model per run. Writing the variants uses `update_fields=["image_variants"]`, so `updated_at` does not change and repaired rows are not picked up again. This is beyond what was required, but the review suggested it, and it closes the gap that `robust=True` leaves. Mention it in the PR description.

## New findings

| #   | Severity | Finding                                                                 | Decision                 |
| --- | -------- | ----------------------------------------------------------------------- | ------------------------ |
| A   | Must fix | The organisation page avatar now shows the thumbnail, which is too small | Fix (option 1)           |
| B   | Cleanup  | `parseOrganization` adds a `thumbnail_image` that is always `undefined` | Fix together with A      |
| C   | Low      | A row deleted from a stale instance can leave orphaned variant files     | No change in this PR     |
| –   | Out of scope | The avatar border makes the image smaller (142 instead of 150px)     | Separate issue if wanted |

### A. The organisation page avatar shows the thumbnail (must fix)

`frontend/src/components/account/AccountPage.tsx:472` (`avatarUrl`)

In this iteration the header avatar on the organisation page started using `THUMBNAIL_SOURCES`, so it now shows the thumbnail WebP first. On `master` it showed the full `image`, which was a waste of bytes but always sharp.

The thumbnail is too small for this slot:

- It is made in the browser (`UserAvatar.tsx:147`) with `getResizedImage(url, 120, 120)`. That function only halves the image and stops once halving again would go below 120px (`forceExactSize` is not passed). So the thumbnail ends up between 121 and 240px wide, for example 1859 → 232px and 1000 → 125px. Uploads under 240px stay as they are.
- The backend thumbnail WebP keeps that size (`"widths": [None]`) and only changes the format.
- The avatar is 150px with a 4px border inside (`border-box`). The image area is **142×142**, which needs **284px** at 2× DPR.

With a thumbnail of about 125px, the avatar is upscaled even on normal screens and looks soft on retina. The problem only shows **after** variants exist. Before the backfill, the page falls back to the original, as on production.

Sizes checked on production:

| Where                               | Component                   | Size on screen | Source on this branch | OK? |
| ----------------------------------- | --------------------------- | -------------- | --------------------- | --- |
| Organisation page header            | `AccountPage` → `UserAvatar` | 142×142        | thumbnail WebP        | ❌  |
| Organisation card (browse)          | `OrganizationPreviewHeader` | 80×80          | thumbnail WebP        | ✅  |
| Mini avatar (project page, lists)   | `MiniOrganizationPreview`   | 20×20 (30 for `medium`) | thumbnail WebP | ✅  |

Making the thumbnail bigger is not the fix. The cards and mini avatars would then download larger files on every browse page.

**Fix (option 1, agreed):** give the header avatar its own source list in `AccountPage`, which prefers the 600 variant of the 1:1 org `image`:

```ts
const AVATAR_SOURCES: VariantSource[] = [
  { field: "image", key: "600" },
  { field: "thumbnail_image", key: "webp" },
];
```

Use `account.image` as the original fallback. The 600×600 WebP is sharp at 142px on any screen and is still only a fraction of the original. The cards and mini avatars keep `THUMBNAIL_SOURCES`. Add a test for the chosen URL. User profiles have no `image_variants`, so they still fall back to `account.image`, as before.

**Considered and rejected (option 2):** change the org config to `"image": {"widths": [300]}` or `[600, 300]` and use the 300 variant. It would match the size better, and the 1200 variant of the org `image` is not used anywhere in the frontend. But it changes the backend config, the tests and the `THUMBNAIL_SOURCES` fallback, and it needs a `--force` backfill for organisations. It only saves a few KB per visit on one page. Possible follow-up.

### B. `thumbnail_image` in `parseOrganization` has no effect (cleanup)

`frontend/public/lib/organizationOperations.ts:12`

`parseOrganization` now sets `thumbnail_image: getImageUrl(organization.thumbnail_image)`. But `OrganizationSerializer` and `EditOrganizationSerializer` do not return `thumbnail_image`, so the value is always `undefined`. It does no harm: the edit form diff treats `undefined` on both sides as equal, so nothing extra is PATCHed. But it is misleading, and with A fixed the `account.thumbnail_image || account.image` fallback in `AccountPage` is not needed any more. Remove both.

### C. A stale instance on delete can leave orphaned variants (low)

`backend/climateconnect_main/utility/image_variants.py` (`delete_image_files`)

`delete_image_files` takes the variant names from the in-memory `instance.image_variants`. If the variant task commits after the delete view loaded the row but before the delete, the new variant files are never deleted. This only leaves extra files: nothing references them and no page points at a missing file. The window is small. It could be closed by re-reading `image_variants` in a `pre_delete` receiver. Not required for this PR.

### Out of scope: the avatar border makes the image smaller

`frontend/src/components/account/UserAvatar.tsx:34`

`UserAvatar` is 150px with a 4px white border inside it (`border-box`), so the image area is only 142px. Nothing is cut off: the upload is a square crop inside a round crop frame (`borderRadius={10000}`), and `object-fit: cover` only scales it down. Showing the full 150px image with the border around it (`boxSizing: "content-box"`, or 158px outer size) would be a reasonable design change. But it also affects user profiles and the edit overlay (`calc(${dimensions}px - 4px)`), and it is not part of #2199. Handle it as its own issue. The 600 variant from A also covers a 150px image at 2× (300px).

## Before manual testing

- [x] Fix A (header avatar uses `AVATAR_SOURCES`) and B, with a test.
  - `AVATAR_SOURCES` (`image` 600, then `thumbnail_image` WebP) is defined in `ResponsiveImage.tsx` next to the other source lists. `AccountPage` uses it with `account.image` as the fallback.
  - The `THUMBNAIL_SOURCES` comment no longer says it serves detail-page avatars.
  - `parseOrganization` no longer sets `thumbnail_image`. The `account.thumbnail_image || account.image` fallback is removed.
  - Tests: `ResponsiveImage.test.tsx` (header avatar prefers the 600px variant, then the thumbnail WebP, then the original) and `organizationOperations.test.ts` (no `thumbnail_image` in read or edit mode). Both test files pass (27 tests). Prettier and eslint are clean. `tsc` shows only the existing errors from the `devlink/` imports, which are generated and not on disk.
- [x] Update the PR #2349 description. 
  - [x] the `MEDIA_ROOT` test runner change (finding 9)
  - [x] the new hourly beat task `regenerate_missing_image_variants`
  - [x] the deployment step: run `backfill_image_variants --dry-run` first, then `backfill_image_variants`

## Manual test plan

- Project hero on mobile and desktop: the WebP variant loads after the task finishes, and the original is shown until then.
- Project and organisation cards, and mini avatars on the project page: the thumbnail WebP loads.
- Organisation page: the banner loads the 1200 variant on mobile and on desktop (corrected in the third review, finding D). The avatar is sharp on a retina screen after the backfill (A).
- Replace and remove a project image and an organisation image: the old original and its variants are deleted from storage, and the new variants appear.
- Delete a project and an organisation: their originals and variants are deleted.
- Save an image while Redis or Celery is stopped: the save succeeds and the original is shown. After restarting, the beat task (or the backfill) generates the variants.
- Run `backfill_image_variants --dry-run`, then a real run on a copy of production data. A second run reports every row as already complete.

---

# Third review and manual test (2026-11-23)

**Reviewed against:** `master`, fixes in `a5bc91ba2`, branch head after the `master` merge `b0cb71eb5`
**Reviewer:** Claude (main session; the manual tests were run in the browser against the local dev setup with Celery running)

## Summary

Findings A and B are fixed and the PR description is updated. The manual test found one more problem: on phones the organisation banner looked blurrier than on `master` (finding D). It is fixed in `ce4e32287`.

**Verdict: ready to merge after the remaining manual tests below. Run the backfill on a copy of production data before the deployment.**

## Status of the second review's findings

| #   | Finding                                         | Status                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Organisation page avatar shows the thumbnail    | ✅ `AVATAR_SOURCES` (`image` 600, then `thumbnail_image` WebP, then `account.image`). Checked in the browser: the 142px avatar loads the 600 variant on desktop and on a phone. The thumbnail of a 2000px upload is only 125×125. |
| B   | `thumbnail_image` in `parseOrganization`        | ✅ Removed, together with the `account.thumbnail_image \|\| account.image` fallback. `master` never set it either, so the edit flow is unchanged.                                                                             |
| C   | Stale instance on delete                        | Unchanged, as agreed.                                                                                                                                                                                                        |
| 9   | PR description                                  | ✅ Mentions the `MEDIA_ROOT` test runner change, the hourly beat task and the deployment steps.                                                                                                                               |

Branch only touches the frontend and the review doc since `7730a1cb6`, so the full backend run from the second review still applies. `ResponsiveImage.test.tsx` and `organizationOperations.test.ts` pass (27 tests), Prettier and eslint are clean. Migration `0151` still follows `master`'s latest migration (`0150`), and `makemigrations --check` reports no changes.

## New finding

### D. The organisation banner on phones is blurrier than on `master` (fixed)

`frontend/src/components/account/AccountPage.tsx` (`backgroundUrl`)

On small screens the banner used `BACKGROUND_SOURCES_SMALL`, so the 600 variant. The code comment said small screens never need the 1200 file. That is wrong for this layout: the banner box has a fixed height of 305px and `background-size: cover`. On a 390px phone the 3:1 image has to be drawn about 915×305 CSS px, which is 4.6× upscaling of the 600×200 file on a 3× screen. The screenshot was clearly soft. On `master` the original is used and the banner is sharp.

**Fix (`ce4e32287`):** use `BACKGROUND_SOURCES` (1200, then 600, then the original) on every screen size, and remove `BACKGROUND_SOURCES_SMALL`. On a 3× phone the 1200 variant is upscaled about 2.3×, similar to desktop at 2×, and it is still a fraction of the original (232 KB instead of 1.6 MB in the test). Checked in the browser: phone and desktop both load the 1200 variant.

`AccountPage` is also used for user profile pages. They have no variants and still get the original banner, as before.

The fixed 305px height that crops a 3:1 banner on phones is old (since 2023) and not part of #2199.

## Manual test results

Done locally with large synthetic test images (4000×2250 project image, 2000×2000 logo, 4500×1500 banner) and Celery running. The test project and organisation were deleted again afterwards.

| Test                                                                            | Result                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backfill on the local data (`--dry-run`, real run, second run with `--verify`)  | ✅ 104 rows processed, 0 failed, about 13 s. The second run reports all 105 rows complete. The 1200 variants are 4.6 MB against 24.6 MB of originals.                              |
| Create a project with an image                                                  | ✅ 1200, 600 and thumbnail WebP variants are written a few seconds after the save.                                                                                               |
| Project page                                                                    | ✅ The hero `<picture>` lists the 1200 and 600 WebP variants, and the browser picks the 1200 one at 550px on a 2× screen. Similar-project cards and mini org avatars use the thumbnail WebP. |
| Replace the project image                                                       | ✅ The old original, thumbnail and their three variants are deleted, the new variants appear. The PATCH has no `image_variants`.                                                 |
| Edit only the project text                                                      | ✅ Image and variants are unchanged.                                                                                                                                            |
| Create an organisation with logo and banner                                     | ✅ All five variants are written.                                                                                                                                              |
| Organisation page, desktop and phone                                            | ✅ Avatar loads the 600 variant. Banner loads the 1200 variant after the fix for D.                                                                                              |
| Replace the organisation logo                                                   | ✅ The old logo, thumbnail and their variants are deleted, the banner is untouched. The PATCH has no `image_variants`.                                                           |
| Browse cards (projects and organisations)                                       | ✅ The thumbnail WebP loads.                                                                                                                                                    |
| Delete the project and the organisation                                         | ✅ Rows and all files are deleted (only empty directories remain in local file storage).                                                                                        |
| Thumbnail WebP size                                                             | ✅ On the real local rows the thumbnail WebP is about 40% smaller than the JPEG and never larger. (A synthetic noise image was the only case where it was slightly larger.)       |

**Observation, no change:** for an organisation logo narrower than 600px, the 600 and 1200 variants are identical files, because images are not upscaled. It costs only a little storage. Skipping a width when the source is already narrower is a possible follow-up.

## Not tested yet

- Removing a project or organisation image without replacing it.
- The original being shown before the variant task has finished. The task finished before the page was opened, so this could not be observed.
- Saving while Redis or Celery is stopped, and the hourly beat task `regenerate_missing_image_variants` (beat was not running). The unit tests cover both.
- The backfill on a copy of production data, to see the real duration with the default `--sleep`.
