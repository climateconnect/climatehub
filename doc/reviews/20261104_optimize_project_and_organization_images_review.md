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
