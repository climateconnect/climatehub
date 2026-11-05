# Optimize Project and Organization Images (Resized WebP Variants)

**Status:** DRAFT
**Branch:** `optimize-project-and-organization-images` (branched from `master` @ `8a6e9b29`)
**Supersedes:** `seif/feature/projectimagecompression` (Dec 2021) — see "What the earlier branch commits do" below
**Created:** 2026-09-07
**Verified against:** `master` @ `8a6e9b29`, 2026-09-08
**Issue:** [climatehub#2199](https://github.com/climateconnect/climatehub/issues/2199)

---

## Problem Statement (What & Why)

Project and organization images are stored at whatever resolution the uploader's
crop produced and served at that full resolution to every visitor, on every
device. A user who uploads a 4000x2250 photo has a ~4000px-wide JPEG delivered
into an `<img>` that is never rendered wider than 550 CSS px on desktop. This
makes project and organization pages slow to load and wastes bandwidth for
users and for our Azure egress bill.

The fix is to generate resized WebP variants server-side at upload time and
serve those, falling back to the stored original.

### Why the images are oversized today (root cause, verified)

The client-side pipeline crops but never downscales the main image:

- `EditProjectOverview.tsx:550` / `AddPhotoSection.tsx` take the crop canvas
  blob as `image` **as-is** and only derive `thumbnail_image` at 290x160 via
  `getResizedImage`.
- `UserAvatar.tsx:113` (used for organization avatars) does the same with a
  120x120 thumbnail.
- `blobFromObjectUrl` (`imageOperations.ts:138`) re-encodes through
  `compressorjs` at `quality: 0.8`, `convertSize: 500000`. Compressor's
  `maxWidth`/`maxHeight` default to `Infinity`, so this **reduces bytes per
  pixel but never reduces pixel count**.

So `thumbnail_image` is already small; the problem is concentrated in the
uncapped `image` (and organization `background_image`) field.

### Current state, verified against `master` @ `8a6e9b29`

**Upload path (base64 data URL -> Django ImageField):**

| Entity | Entry point |
|---|---|
| Project (create) | `backend/organization/utility/project.py:110-112` |
| Project (edit) | `backend/organization/views/project_views.py:1154-1157` |
| Organization | `backend/organization/views/organization_views.py:410-418`, `680-687` |

All go through `get_image_from_data_url()`
(`backend/climateconnect_main/utility/general.py:14`), which base64-decodes into
a `ContentFile` named `{token_hex(20)}.{extension}`, where `extension` is taken
from the data-URL MIME type. Because the frontend always encodes via
`convertToJPGWithAspectRatio` / `canvas.toBlob(..., "image/jpeg")`, stored files
are **`.jpeg`** in practice. Its `resize=` / `base_width=` arguments exist but
**no caller passes them** — every call site uses the default `resize=False`.

**Model fields:**

- `Project.image`, `Project.thumbnail_image` — `backend/organization/models/project.py:38,46`, `upload_to=project_image_path` -> `projects/{id}/{filename}`
- `Organization.image`, `Organization.thumbnail_image` — `organization.py:32,40` -> `organization_images/{id}/profile/{filename}`
- `Organization.background_image` — `organization.py:48` -> `organization_images/{id}/background/{filename}`

**Storage:** local filesystem in `development`/`test`; `AzureStorage`
(django-storages) everywhere else — `settings.py:254-265`. This is the single
most important constraint below.

**Serving:** listing serializers expose a `SerializerMethodField` named `image`
that returns `thumbnail_image.url` and falls back to `image.url`
(`serializers/project.py:474-478`, `663-669`). The frontend passes every URL
through `getImageUrl()` (`frontend/public/lib/imageOperations.ts:9`), which has
**39 call sites** — it is the natural single point of interception.

**Measured maximum render sizes** (the issue asks us to double-check these):

| Surface | Source | Max CSS width |
|---|---|---|
| Project detail, desktop | `projectOverviewStyles.ts:59` `inlineImage` | `width: 50%`, `maxWidth: 550` |
| Project detail, mobile | `projectOverviewStyles.ts:33` `fullWidthImage` | `width: 100%` (layout used below the `md` = 900px breakpoint) |
| Project card | `ProjectPreview.tsx:163` `CardMedia` | grid cell, ~290px (and it is fed `thumbnail_image`, already 290x160) |
| Organization avatar | `OrganizationPreviewHeader.tsx:24` | 80x80 (fed a 120x120 thumbnail) |

So `1200` from the issue example is a sound cap: it covers the 550px desktop
slot at 2x DPR with room to spare, and caps the mobile full-bleed case at a
deliberate ceiling.

### What the earlier branch commits do, and why they cannot ship

An earlier attempt lives on `seif/feature/projectimagecompression` (four commits,
Dec 2021, branched from `ef428ade` and 1121 commits behind current `master`).
It is a useful sketch but not a shippable basis:

1. **`convert_image_to_webp(source=self.image.path)`** —
   `FieldFile.path` raises `NotImplementedError` on `AzureStorage`. This code
   is a silent no-op in staging and production; it only ever worked on a local
   dev filesystem.
2. **`except: pass`** in `Project.post_processing()` swallows that
   `NotImplementedError` (and everything else), which is why the breakage is
   invisible rather than loud.
2. **No resizing at all** — it converts the original to WebP in place at
   default quality. That addresses format but not the actual problem, which is
   pixel count.
3. **`save()` override runs conversion synchronously on every save**, including
   saves that do not touch the image (e.g. ranking-cache updates), putting image
   decoding on the request path.
4. **Frontend `getImageUrl` change** hardcodes `IsWebPCompatibleBrowser = false`
   (so it is dead code), leaves a `console.log`, and swaps extensions by naive
   string replace — which produces 404s for every legacy row that has no variant.

**Decision (2026-09-08): work on a fresh branch off `master`, not on that branch.**
Since every one of the three changed files has to be discarded, merging `master`
into it would reconcile 1121 commits to preserve nothing. It is also actively
hazardous: `master` renamed `imageOperations.js` to `.ts` while that branch
modifies the `.js`, so the merge risks resurrecting a stale `imageOperations.js`
alongside the live `.ts` — an unpleasant module-resolution bug. Because the repo
squash-merges, those four commits would never reach `master`'s history anyway.

The old branch is **left in place, not deleted** (still at `d5003157` on origin)
as the record of the first attempt; the new PR should reference it as superseded.
The reusable idea is the shape (`Pillow` + WebP + a post-save hook), not the code.

---

## Goals / Scope

- Generate resized **WebP variants** for project and organization images at
  upload time, in a way that works on **Azure Blob Storage**, not just local disk.
- Serve those variants to the frontend for the project detail page, project
  cards, and organization pages, with a graceful fallback to the stored original.
- **Backfill** variants for existing rows without a second full upload cycle.
- Cut delivered bytes on project and organization pages measurably (see
  acceptance criteria).

**Out of scope:**

- Azure CDN / CDN-side image transformation (explicitly rejected in the issue on
  cost grounds).
- User profile images (`UserProfile.image` / `background_image`), `Idea` images,
  and hub images. The same mechanism should be reusable for them, but rolling
  them out is a follow-up.
- Rich-text inline images — covered by
  `doc/spec/20260708_1302_rich_text_image_support.md`.
- Changing the client-side crop/compression UX.

---

## Acceptance Criteria (observable outcomes)

1. Uploading a project image produces, in addition to the stored original, a
   resized WebP variant set; the same holds for organization `image`,
   `thumbnail_image`, and `background_image`.
2. Variant generation works on `AzureStorage` — verified by an implementation
   that never calls `FieldFile.path`, plus a test that exercises the code path
   against a storage backend that raises on `.path`.
3. Variant generation **never fails a save**: a Pillow or storage error is
   logged (Sentry-visible), and the entity still saves with its original image.
   No bare `except:`.
4. A project detail page and an organization page load their hero image as
   WebP when the variant exists, and as the original JPEG when it does not
   (legacy rows), with no broken images in either case.
5. Variant generation does not run on saves that do not change an image field.
6. A management command backfills variants for existing `Project` and
   `Organization` rows, is idempotent, and can be re-run safely.
7. Measured: hero image transfer size on a representative project page drops by
   a target we agree on before merge (proposal: **>=60%** on rows whose original
   exceeds 1200px). Recorded in the PR description with before/after numbers.
8. `make ruff`, `make format`, `make test` pass; `yarn lint`, `yarn check-types`,
   `yarn test` pass.

---

## Constraints / Non-negotiables

- **Storage-agnostic.** Use `FieldFile.open()` / `storage.save()` /
  `ContentFile`, never `.path`. This is the defect that made the 2021 attempt a
  no-op in production.
- **Never break a save.** Wrap variant generation in a narrow `try/except` that
  logs with context. Explicit exception types, not bare `except`.
- **Do not put image decoding on the request path** for large images. Dispatch
  via Celery (`climateconnect_main.celery.app`, task modules per app — see
  `backend/organization/tasks.py` for the established pattern), using
  `transaction.on_commit` so the task cannot observe an uncommitted row (see
  `backend/agent.md`). `CELERY_TASK_ALWAYS_EAGER = True` in the test env
  (`settings.py:669`) keeps tests synchronous.
- **Legacy rows must keep working.** Millions of existing `.jpeg` rows have no
  variant. URL derivation must not assume a variant exists.
- **Pillow is already a dependency** (`Pillow>=9.3.0`) and supports WebP. Do not
  add a new image library.
- Follow repo conventions: backend `snake_case.py`, `make format` before commit,
  no `git commit` by the agent.
- Documentation is part of the task — update `doc/architecture.md`,
  `doc/api-documentation.md` (new serializer fields), and
  `doc/domain-entities.md` (new model fields) in the same change.

---

## Design Decisions To Settle Before Implementation

These are the choices that materially change the work. Each has a recommendation.

### D1. How are variants addressed? (highest-impact decision)

Four possible shapes, judged on four axes: cost on the read path, how a
"no variant here" is expressed, how well a **backfill script** works against it,
and extensibility/integrity.

- **(a) Convention-based URL rewriting** — store nothing; the frontend derives
  `..._1200.webp` from the original URL. This is what the 2021 branch attempted.
  **Rejected:** nothing records *whether* a variant exists, so every legacy row
  404s and the knowledge of naming and widths leaks into the client.
- **(b) Explicit `ImageField`s** — `image_webp_1200`, `image_webp_600`,
  `thumbnail_image_webp`, … At D2's proposed widths: **+3 columns on `Project`,
  +5 on `Organization`** (29 -> 32 and 24 -> 29 fields), 2 migrations.
- **(c) Generic `ImageVariant` model** — one table keyed by
  `(content_type, object_id, field_name, width, format)` via a
  `GenericForeignKey`. One migration ever; new widths/formats are rows.
- **(d) JSONB column per model** *(the middle option — (b)'s read path with
  (c)'s extensibility)* — one `JSONField` per model holding the whole variant
  map:
  ```python
  image_variants = models.JSONField(null=True, blank=True, default=dict)
  # {"image": {"1200": "projects/12/a3f9…_1200.webp", "600": "…"},
  #  "thumbnail_image": {"webp": "…"}}
  ```
  **2 columns total** instead of 8, no join, and a new width is a new key rather
  than a migration.

| Axis | (b) fields | (c) `ImageVariant` | (d) JSONB |
|---|---|---|---|
| Extra queries on read | none | +1 prefetch (`GenericPrefetch`; Django 5.2.17 confirmed installed) | none |
| "no variant" is… | `""` / `null` | *absence of a row* — only knowable if prefetched | key absent |
| Backfill work query | `filter(image_webp_1200="")` | `Exists()` subquery per (field, width, format) | JSONB path filter |
| New width / format | migration per model | new rows, no migration | new key, no migration |
| Columns added | 8 | 0 (+1 table) | 2 |
| Orphan risk on delete | none (no new rows) | **no DB-level FK; orphan rows leak, and each leaks an Azure blob** | none |
| Precedent in this repo | `ImageField` everywhere; `resize_images.py` | **none — `GenericForeignKey` is used nowhere** | `JSONField(default=dict)` at `organization/models/registration_field.py:38` |

**Backfill findings (this is the axis that was expected to favour (c), and does not):**

- We have already written this script once. `climateconnect_api/management/commands/resize_images.py`
  backfills a derived image field using **exactly the (b) query shape** —
  `UserProfile.objects.filter(thumbnail_image__exact="").exclude(image="")`. It is
  also already storage-agnostic (hands the `FieldFile` to `Image.open()`, never
  touches `.path`), which is the pattern the 2021 branch got wrong. Note it is
  **currently dead code**: it calls `Image.ANTIALIAS`, removed in Pillow 10, and
  the installed Pillow is 12.2.0 — its resize branch raises `AttributeError`.
- Under all three shapes the work query is idempotent and self-shrinking (the
  queryset *is* the work queue) and gives per-variant granularity for free.
  **(b)'s query is the simplest of the three**, so the backfill does not argue
  for (c).
- (c) does buy two things a maintenance script genuinely wants: somewhere to
  record a **permanent failure** (so a corrupt source is not retried every run)
  and a `source_hash` for **staleness detection**. Both are cheap to replicate:
  failures via a `--skip-ids` flag or a log (a corrupt file fails fast at
  `Image.open()`), and staleness via variant filenames carrying the source stem —
  because `get_image_from_data_url` mints a fresh `secrets.token_hex(20)` per
  upload (`general.py:18`), a replaced original **always** gets a new stem, so a
  stem mismatch *is* the staleness signal.
- Governing principle: the backfill runs a handful of times; the read path runs
  on every page view of what our own caching spec calls the slowest public
  endpoint on the site. Do not shape the model around the rare operation —
  especially when the rare operation is already easier under (b).

**Recommendation: (b).** Scope today is 5 image fields across 2 models, so its
cost is bounded and known (8 columns, 2 migrations), while its three benefits —
zero read-path cost, a trivially honest fallback, and no new orphan class — land
exactly where this codebase is measurably weakest. (c) is rejected primarily on
integrity: a `GenericForeignKey` has no database FK at all, and we have a live
incident (`doc/spec/20260814_1845_clean_up_orphaned_notification_references.md`,
2026-08-14) in which orphan rows exist *despite* declared `on_delete=CASCADE`,
because deletion does not go through one canonical path. Each orphaned
`ImageVariant` would also strand an Azure blob nobody ever deletes.

**Flip conditions — revisit before implementing:**

- If profiles, ideas, hubs and sectors come into scope **now** rather than later,
  the count is ~40 columns vs. one table and **(c) wins on volume**. (There are
  20 `ImageField`/`FileField`s in the codebase today; only 5 are in scope here.)
- If **D2 settles on three or more widths per field**, (b) gets unwieldy fast and
  **(d) becomes the better middle** — same read path, one column per model, and
  widths become a backend-only decision. Settle D2 before locking D1.

### D2. Which variant widths?

The issue proposes 400 and 1200. Measured against actual render sizes:

- **1200** is well justified — covers `maxWidth: 550` at 2x and caps the mobile
  full-bleed case.
- **400** is nearly a no-op for `thumbnail_image`, which the client already
  caps at 290x160 (project) / 120x120 (org avatar) — a 400px variant would
  never downscale it. Its only benefit there is **format** (JPEG -> WebP).

**Recommendation:** generate `1200` and `600` for `image` and
`background_image`; for `thumbnail_image`, generate a **format-only** WebP
conversion with no resize (it is already small). `600` rather than `400` covers
a 290px card at 2x DPR. Confirm with the team before implementing.

### D3. Also cap the stored original?

Storing a 4000px original we will never serve costs Azure storage and makes
every backfill slower. Capping the original on upload (e.g. at 2000px) is a
one-line change to the `get_image_from_data_url` call sites — its `resize=` /
`base_width=` parameters already exist and are unused.

**Recommendation:** yes, cap new uploads, but as a **separate commit** so it can
be reverted independently. Do not retroactively shrink existing originals — they
are the only source we have for regenerating variants.

### D4. Quality setting

The issue suggests `quality=80`. Note the frontend has *already* re-encoded at
JPEG q0.8, so we are compressing a lossy source. WebP q80 on a q80 JPEG source
is usually still a clear win, but this should be spot-checked visually on a few
real project photos before we settle on a number.

**Recommendation:** start at `quality=80`, `method=6`, and validate on real
images from the production dataset.

### D5. `<picture>` element, or just serve WebP?

The issue's example uses `<picture>` + `<source>` for browser fallback. WebP
support is now effectively universal (all evergreen browsers since ~2020). The
`<picture>` wrapper is therefore about **missing-variant** fallback, not
**browser** fallback — a different problem, better solved by D1(b)'s nullable
field.

**Recommendation:** keep `<picture>` anyway — it is nearly free and it makes the
"variant exists" / "variant missing" distinction explicit in the markup. But
drive it off the serializer field being non-null, not off a browser check. The
2021 `IsWebPCompatibleBrowser` flag should not come back.

### D6. Where does variant selection live on the frontend?

`getImageUrl()` has 39 call sites and no size context, so it cannot pick a
variant on its own. Options: extend its signature with an optional width;
introduce a small `<ResponsiveImage>` component; or have each call site read
the new serializer field directly.

**Recommendation:** a `<ResponsiveImage>` component for the handful of large
surfaces (project detail hero, org header/background, project card), leaving
`getImageUrl` untouched for the other ~35 avatar-sized call sites.

---

## Implementation Sketch

Once D1-D6 are settled:

1. **`backend/climateconnect_main/utility/images.py`** (new): a storage-agnostic
   `generate_webp_variant(field_file, max_width, quality) -> ContentFile | None`.
   Open via `field_file.open()`, `Image.open()`, `thumbnail((w, w), LANCZOS)`,
   save into `io.BytesIO()` as WebP, return a `ContentFile`. Replaces the
   branch's `convert_image_to_webp` in `general.py`.
2. **Migrations** adding the nullable variant fields to `Project` and
   `Organization` (per D1(b)).
3. **`backend/organization/tasks.py`**: a task that regenerates variants for one
   entity, following the existing `@app.task(bind=True, max_retries=3, ...)`
   pattern in that file.
4. **Dispatch:** on the create/edit paths listed above, detect an actually
   changed image field and enqueue via `transaction.on_commit(lambda: ....delay(...))`.
   Prefer this over a blanket `save()` override — the 2021 override fired on
   every save including ranking-cache writes.
5. **Serializers:** expose the variant URLs. Keep the existing `image`
   `SerializerMethodField` contract unchanged so nothing breaks; add the
   variants alongside it.
6. **Management command** for backfill, batched, resumable, `--dry-run`. Model
   it on `climateconnect_api/management/commands/resize_images.py`, which solves
   the same shape of problem and is already storage-agnostic — but do not reuse
   its body: it calls `Image.ANTIALIAS`, removed in Pillow 10 (installed: 12.2.0),
   so it is dead code today. Worth deleting or fixing in passing. Be explicit
   about overwrite behaviour: Django's storage uniquifies colliding filenames and
   `AZURE_OVERWRITE_FILES` is not configured, so a crashed and re-run backfill can
   otherwise strand duplicate blobs (`a3f9…_1200_xk29d.webp`) in Azure.
7. **Frontend:** `<ResponsiveImage>` consuming the new fields, wired into
   `ProjectOverview.tsx` (both `fullWidthImage` and `inlineImage`),
   `ProjectPreview.tsx`, and the organization page header.

---

## Testing

Backend tests need PostgreSQL (5432) and Redis (6379) running; run with
`pdm run python manage.py test <dotted.path> --keepdb`.

- `generate_webp_variant`: correct output format, `thumbnail()` never upscales a
  smaller source, EXIF orientation handled, transparency handled (PNG source
  with alpha -> the existing pipeline whitens transparent pixels client-side,
  but a direct API upload could still carry alpha).
- Save path: a storage double whose `.path` raises `NotImplementedError` still
  produces a variant (this is the regression test for the 2021 defect).
- Failure path: a corrupt/undecodable image logs and leaves the entity saved
  with its original.
- Dispatch: no task enqueued on a save that does not change an image field.
- Backfill command: idempotent, skips rows that already have variants.
- Frontend: `<ResponsiveImage>` renders the WebP source when present and only
  the original `<img>` when the variant field is `null`.

---

## Risks & Trade-offs

- **Backfill cost.** Every existing project and organization image must be
  downloaded from Azure, decoded, re-encoded, and re-uploaded. Needs to be
  throttled so it does not saturate the worker or the storage account. Estimate
  the row count before running.
- **Storage growth.** Variants add files rather than replacing them. Two
  variants per image field roughly doubles image storage before D3's cap starts
  offsetting it. Quantify against the current container size.
- **Double lossy compression** (D4) — validate visually, do not assume.
- **Wide models.** `Project` and `Organization` are already large; D1(b) makes
  them larger. Accepted deliberately in exchange for a simpler fallback story;
  D1(c) is the escape hatch if we extend to four more entities.

---

## Next Steps

1. **Team review of this spec** — in particular D1 (addressing scheme), D2
   (widths), and the acceptance-criteria target in (7).
2. Confirm the new branch builds and tests green *before* writing any new code
   (`make test` needs PostgreSQL and Redis up; `yarn build`, `yarn check-types`).
3. Measure the current state: distribution of stored image dimensions and file
   sizes in production, to size the win and the backfill.
4. Implement per the sketch above, in reviewable commits.
5. Update `doc/architecture.md`, `doc/api-documentation.md`,
   `doc/domain-entities.md`.
