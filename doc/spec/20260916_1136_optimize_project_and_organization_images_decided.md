# Optimize Project, Organization, and Profile Images (Resized WebP Variants)

**Status:** DRAFT
**Branch:** `optimize-project-and-organization-images` (branched from `master` @ `8a6e9b29`)[cite: 1, 3]
**Supersedes:** `seif/feature/projectimagecompression` (Dec 2021) — see "What the earlier branch commits do" below[cite: 1, 3]
**Created:** 2026-09-07[cite: 1, 3]
**Verified against:** `master` @ `8a6e9b29`, 2026-09-08[cite: 1, 3]
**Issue:** [climatehub#2199](https://github.com/climateconnect/climatehub/issues/2199)[cite: 1, 3]

---

## Problem Statement (What & Why)

Project, organization, and user profile images are stored at whatever resolution the uploader's crop produced and served at that full resolution to every visitor, on every device[cite: 1, 3]. A user who uploads a 4000x2250 photo has a ~4000px-wide JPEG delivered into an `<img>` that is never rendered wider than 550 CSS px on desktop (and up to 1200px in full-bleed headers)[cite: 1, 3]. This makes project, organization, and user profile pages slow to load and wastes bandwidth for users and for our Azure egress bill[cite: 1, 3].

The fix is to generate resized WebP variants server-side at upload time and serve those, falling back to the stored original[cite: 1, 3].

### Why the images are oversized today (root cause, verified)

The client-side pipeline crops but never downscales the main image[cite: 1, 3]:

- `EditProjectOverview.tsx:550` / `AddPhotoSection.tsx` take the crop canvas blob as `image` **as-is** and only derive `thumbnail_image` at 290x160 via `getResizedImage`[cite: 1, 3].
- `UserAvatar.tsx:113` (used for organization avatars and user profiles) does the same with a 120x120 thumbnail[cite: 1, 3].
- `blobFromObjectUrl` (`imageOperations.ts:138`) re-encodes through `compressorjs` at `quality: 0.8`, `convertSize: 500000`[cite: 1, 3]. Compressor's `maxWidth`/`maxHeight` default to `Infinity`, so this **reduces bytes per pixel but never reduces pixel count**[cite: 1, 3].

So `thumbnail_image` is already small; the problem is concentrated in the uncapped `image`, `background_image`, and user profile image fields[cite: 1, 3].

### Current state, verified against `master` @ `8a6e9b29`

**Upload path (base64 data URL -> Django ImageField):**

| Entity | Entry point |
|---|---|
| Project (create) | `backend/organization/utility/project.py:110-112`[cite: 1, 3] |
| Project (edit) | `backend/organization/views/project_views.py:1154-1157`[cite: 1, 3] |
| Organization | `backend/organization/views/organization_views.py:410-418`, `680-687`[cite: 1, 3] |
| UserProfile | `backend/user/views.py` / `backend/user/models.py`[cite: 2, 3] |

All go through `get_image_from_data_url()` (`backend/climateconnect_main/utility/general.py:14`), which base64-decodes into a `ContentFile` named `{token_hex(20)}.{extension}`, where `extension` is taken from the data-URL MIME type[cite: 1, 3]. Because the frontend always encodes via `convertToJPGWithAspectRatio` / `canvas.toBlob(..., "image/jpeg")`, stored files are **`.jpeg`** in practice[cite: 1, 3]. Its `resize=` / `base_width=` arguments exist but **no caller passes them** — every call site uses the default `resize=False`[cite: 1, 3].

**Model fields:**

- `Project.image`, `Project.thumbnail_image` — `backend/organization/models/project.py:38,46`, `upload_to=project_image_path` -> `projects/{id}/{filename}`[cite: 1, 3]
- `Organization.image`, `Organization.thumbnail_image` — `organization.py:32,40` -> `organization_images/{id}/profile/{filename}`[cite: 1, 3]
- `Organization.background_image` — `organization.py:48` -> `organization_images/{id}/background/{filename}`[cite: 1, 3]
- `UserProfile.image`, `UserProfile.background_image` — `backend/user/models.py`[cite: 2, 3]

**Storage:** local filesystem in `development`/`test`; `AzureStorage` (django-storages) everywhere else — `settings.py:254-265`[cite: 1, 3]. This is the single most important constraint below[cite: 1, 3].

**Serving:** listing serializers expose a `SerializerMethodField` named `image` that returns `thumbnail_image.url` and falls back to `image.url` (`serializers/project.py:474-478`, `663-669`)[cite: 1, 3]. The frontend passes every URL through `getImageUrl()` (`frontend/public/lib/imageOperations.ts:9`), which has **39 call sites** — it is the natural single point of interception[cite: 1, 3].

**Measured maximum render sizes:**

| Surface | Source | Max CSS width |
|---|---|---|
| Project detail, desktop | `projectOverviewStyles.ts:59` `inlineImage` | `width: 50%`, `maxWidth: 550`[cite: 1, 3] |
| Project detail, mobile | `projectOverviewStyles.ts:33` `fullWidthImage` | `width: 100%` (layout used below the `md` = 900px breakpoint)[cite: 1, 3] |
| Project card | `ProjectPreview.tsx:163` `CardMedia` | grid cell, ~290px (and it is fed `thumbnail_image`, already 290x160)[cite: 1, 3] |
| Organization avatar | `OrganizationPreviewHeader.tsx:24` | 80x80 (fed a 120x120 thumbnail)[cite: 1, 3] |
| Header Banners | Organization / Profile Header | full-bleed container, ~1200px[cite: 3] |

So `1200` from the issue example is a sound cap: it covers the 550px desktop slot at 2x DPR with room to spare, and caps the mobile and header full-bleed cases at a deliberate ceiling[cite: 1, 3].

### What the earlier branch commits do, and why they cannot ship

An earlier attempt lives on `seif/feature/projectimagecompression` (four commits, Dec 2021, branched from `ef428ade` and 1121 commits behind current `master`)[cite: 1, 3]. It is a useful sketch but not a shippable basis[cite: 1, 3]:

1. **`convert_image_to_webp(source=self.image.path)`** — `FieldFile.path` raises `NotImplementedError` on `AzureStorage`[cite: 1, 3]. This code is a silent no-op in staging and production; it only ever worked on a local dev filesystem[cite: 1, 3].
2. **`except: pass`** in `Project.post_processing()` swallows that `NotImplementedError` (and everything else), which is why the breakage is invisible rather than loud[cite: 1, 3].
3. **No resizing at all** — it converts the original to WebP in place at default quality[cite: 1, 3]. That addresses format but not the actual problem, which is pixel count[cite: 1, 3].
4. **`save()` override runs conversion synchronously on every save**, including saves that do not touch the image (e.g. ranking-cache updates), putting image decoding on the request path[cite: 1, 3].
5. **Frontend `getImageUrl` change** hardcodes `IsWebPCompatibleBrowser = false` (so it is dead code), leaves a `console.log`, and swaps extensions by naive string replace — which produces 404s for every legacy row that has no variant[cite: 1, 3].

**Decision (2026-09-08): work on a fresh branch off `master`, not on that branch.**[cite: 1, 3]

---

## Goals / Scope

- Generate resized **WebP variants** for project, organization, and user profile images at upload time, in a way that works on **Azure Blob Storage**, not just local disk[cite: 1, 3].
- Serve those variants to the frontend for the project detail page, project cards, organization pages, and user profile pages, with a graceful fallback to the stored original[cite: 1, 3].
- **Backfill** variants for existing rows without a second full upload cycle[cite: 1, 3].
- Cut delivered bytes on project, organization, and profile pages measurably (see acceptance criteria)[cite: 1, 3].

**Out of scope:**

- Azure CDN / CDN-side image transformation (explicitly rejected in the issue on cost grounds)[cite: 1, 3].
- Idea images and hub/sector images (covered in follow-up rollout)[cite: 1, 3].
- Rich-text inline images — covered by `doc/spec/20260708_1302_rich_text_image_support.md`[cite: 1, 3].
- Changing the client-side crop/compression UX[cite: 1, 3].

---

## Acceptance Criteria (observable outcomes)

1. Uploading a project, organization, or user profile image produces, in addition to the stored original, a set of resized WebP variants registered in the model's variants map[cite: 1, 3].
2. Variant generation works on `AzureStorage` — verified by an implementation that never calls `FieldFile.path`, plus a test that exercises the code path against a storage backend that raises on `.path`[cite: 1, 3].
3. Variant generation **never fails a save**: a Pillow or storage error is logged (Sentry-visible), and the entity still saves with its original image[cite: 1, 3]. No bare `except:`[cite: 1, 3].
4. A project detail page, organization page, and user profile page load their hero image as WebP when the variant exists, and as the original JPEG when it does not (legacy rows), with no broken images in either case[cite: 1, 3].
5. Variant generation does not run on saves that do not change an image field[cite: 1, 3].
6. A management command backfills variants for existing `Project`, `Organization`, and `UserProfile` rows, is idempotent, and can be re-run safely[cite: 1, 3].
7. Measured: hero image transfer size on a representative project page drops by **>=60%** on rows whose original exceeds 1200px[cite: 1, 3]. Recorded in the PR description with before/after numbers[cite: 1, 3].
8. `make ruff`, `make format`, `make test` pass; `yarn lint`, `yarn check-types`, `yarn test` pass[cite: 1, 3].

---

## Constraints / Non-negotiables

- **Storage-agnostic.** Use `FieldFile.open()` / `storage.save()` / `ContentFile`, never `.path`[cite: 1, 3].
- **Never break a save.** Wrap variant generation in a narrow `try/except` that logs with context[cite: 1, 3]. Explicit exception types, not bare `except`[cite: 1, 3].
- **Do not put image decoding on the request path** for large images[cite: 1, 3]. Dispatch via Celery (`climateconnect_main.celery.app`, task modules per app — see `backend/organization/tasks.py`), using `transaction.on_commit` so the task cannot observe an uncommitted row[cite: 1, 3].
- **Legacy rows must keep working.** Existing `.jpeg` rows have no variant[cite: 1, 3]. URL derivation must not assume a variant exists[cite: 1, 3].
- **Pillow is already a dependency** (`Pillow>=9.3.0`) and supports WebP[cite: 1, 3]. Do not add a new image library[cite: 1, 3].
- Follow repo conventions: backend `snake_case.py`, `make format` before commit, no `git commit` by the agent[cite: 1, 3].
- Documentation is part of the task — update `doc/architecture.md`, `doc/api-documentation.md` (new serializer fields), and `doc/domain-entities.md` (new model fields) in the same change[cite: 1, 3].

---

## Technical Decisions

### D1. Variant Addressing: JSONB column per model

Variants are stored in a single `JSONField` column on each model (`Project`, `Organization`, `UserProfile`)[cite: 1, 2, 3]:

```python
image_variants = models.JSONField(null=True, blank=True, default=dict)
# Structure:
# {
#   "image": {"1200": "projects/12/a3f9..._1200.webp", "600": "projects/12/a3f9..._600.webp"},
#   "thumbnail_image": {"webp": "projects/12/a3f9..._thumb.webp"},
#   "background_image": {"1200": "...", "600": "..."}
# }
```

### D2. Which variant widths? -> 1200px and 600px

- **Main images (`image`, `background_image`):** Generate **1200px** and **600px** WebP variants[cite: 1, 2, 3].
- **Thumbnails (`thumbnail_image`):** Generate a **format-only** WebP conversion without scaling (already capped at source)[cite: 1, 2, 3].

### D3. Also cap the stored original? -> Yes (Separate commit)

New original uploads will be capped at a maximum dimension of 2000px via `get_image_from_data_url`[cite: 1, 3]. This logic is isolated in a **separate commit** so it can be reverted independently[cite: 1, 3]. Existing original files will not be retroactively modified[cite: 1, 3].

### D4. Quality setting -> Quality 80, Method 6

WebP images are generated using `quality=80` and `method=6` via Pillow[cite: 1, 3]. Spot-check visually on real images from the production dataset to ensure lossy-on-lossy re-encoding maintains visual fidelity[cite: 1, 3].

### D5. `<picture>` Element Support

The frontend uses the HTML `<picture>` element to serve variants[cite: 1, 3]. Availability is derived by inspecting the keys present in the serializer's `image_variants` response:

```tsx
const webp1200 = variants?.image?.["1200"];
const webp600 = variants?.image?.["600"];

return (
  <picture>
    {webp1200 && <source srcSet={webp1200} type="image/webp" media="(min-width: 900px)" />}
    {webp600 && <source srcSet={webp600} type="image/webp" />}
    <img src={originalUrl} alt={altText} />
  </picture>
);
```
### D6. Frontend Variant Selection -> `<ResponsiveImage>` component

A shared `<ResponsiveImage>` component is introduced for high-impact surfaces (Project Detail hero, Organization Header, User Profile Header, Project Cards)[cite: 2, 3]. Existing `getImageUrl()` call sites remain unchanged for smaller avatar renders[cite: 2, 3].

---

## Implementation Sketch

1. **`backend/climateconnect_main/utility/images.py`:** Implement `generate_webp_variant(field_file, max_width, quality) -> ContentFile | None` using Pillow and `FieldFile.open()`[cite: 2, 3].
2. **Migrations:** Add `image_variants = models.JSONField(default=dict, blank=True)` to `Project`, `Organization`, and `UserProfile`[cite: 2, 3].
3. **Tasks & Signals:** Dispatch background Celery tasks on image changes via `transaction.on_commit()` to update `image_variants`[cite: 2, 3].
4. **Serializers:** Include `image_variants` payload in listing and detail serializers[cite: 2, 3].
5. **Backfill Command:** Add an idempotent management command to populate variants for existing `Project`, `Organization`, and `UserProfile` rows[cite: 2, 3].
6. **Frontend:** Create `<ResponsiveImage>` component consuming the variant JSON payload and integrate it into key views (`ProjectOverview.tsx`, `ProjectPreview.tsx`, `OrganizationPreviewHeader.tsx`, and User Profile pages)[cite: 2, 3].

---

## Testing

Backend tests require PostgreSQL (5432) and Redis (6379) running (`pdm run python manage.py test <dotted.path> --keepdb`)[cite: 2, 3].

- `generate_webp_variant`: format verification, no upscaling, EXIF orientation, alpha channel handling[cite: 2, 3].
- Storage handling: verify storage backends raising `NotImplementedError` on `.path` function properly[cite: 2, 3].
- Fallback: undecodable images log error and leave original file intact[cite: 2, 3].
- Dispatch: verify Celery tasks fire only on changed image fields[cite: 2, 3].
- Backfill command: verify idempotency and re-run safety[cite: 2, 3].
- Frontend: `<ResponsiveImage>` correctly renders `<source>` elements when variants exist and falls back to `<img>` when missing[cite: 2, 3].

---

## Risks & Trade-offs

- **Backfill cost.** Downloading, re-encoding, and re-uploading existing images from Azure Blob Storage requires worker throttling[cite: 2, 3].
- **Storage growth.** Additional WebP variants increase total storage usage per row until original capping takes effect[cite: 2, 3].
- **Lossy re-encoding.** WebP q80 on JPEG source requires visual spot-checks[cite: 2, 3].

---

## Next Steps

1. Confirm the new branch builds and tests green before writing code (`make test`, `yarn build`, `yarn check-types`)[cite: 2, 3].
2. Measure distribution of stored image dimensions and file sizes in production[cite: 2, 3].
3. Implement per the sketch above in reviewable commits[cite: 2, 3].
4. Update `doc/architecture.md`, `doc/api-documentation.md`, `doc/domain-entities.md`[cite: 2, 3].