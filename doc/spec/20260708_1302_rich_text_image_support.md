# Rich Text Image Support (v1: project description)

**Status**: DRAFT, ready for IMPLEMENTATION (design decided 2026-11-19, D1–D32; system impact done; implementation is iterative, D32)
**Type**: Full stack: new upload endpoint and image model (backend), image node and upload control in the project description editor (frontend), sanitiser and display changes.
**Date created**: 2026-07-08 (refined 2026-11-19)
**Branch**: PoC branch to be created from `optimize-project-and-organization-images` (PR #2349, D7). Implementation branch to be decided after the PoC.
**Related**: [#2199](https://github.com/climateconnect/climatehub/issues/2199) / PR #2349 "Optimize project and organization images" (WebP variants, open, branch `optimize-project-and-organization-images`, spec `20260916_1136_optimize_project_and_organization_images_decided.md` on that branch). That spec lists rich-text images as out of scope and points here.

**Touches** (areas, not a design):
- Frontend: `frontend/src/components/editProject/ProjectDescriptionEditor.tsx` (used by edit project, share project `EnterDetails.tsx`, and the translation editors `TranslateTexts.tsx` / `TranslateProject.tsx`), `frontend/src/components/project/ProjectContent.tsx` (renders `description_html` via `dangerouslySetInnerHTML`)
- Backend: `backend/climateconnect_api/utility/html.py` (`sanitize_html`, `PROJECT_DESCRIPTION_ALLOWED_TAGS`), `backend/organization/views/project_views.py` (create/edit sanitise `description_html`, 20 000-char cap), `backend/organization/utility/project.py`, new model + endpoint
- Docs: `doc/domain-entities.md`, `doc/api-documentation.md`, `doc/architecture.md`

---

## Problem Statement (What & Why)

Project descriptions are written with a Tiptap rich-text editor (bold, italic, lists, links, YouTube embeds) but cannot contain images. Project owners want to show their work inside the description: progress photos, a map, a flyer, a before/after picture. Today the only image on a project page is the single header image.

Images in the description make projects more convincing and easier to understand, which helps them find supporters and participants.

**What we want (v1)**: in the project description editor, a user can upload **up to 10 images** from their device. The images are stored and optimised by the platform and display well on desktop and mobile.

**Why the design needs care**:
- The platform must be **responsive**. Image sizes that the author picks on desktop must not produce bad results on mobile.
- The project form already sends the project's own images as base64 inside the JSON payload, and that payload is close to its limits. Description images **must not** go into that payload.
- Uploaded images can become unused (removed from the text, project never saved). We need a clear rule for what happens to them, and an ownership model that allows **re-use of uploaded images later** (an "image library") without deciding the visibility rules now.
- The feature will later be used in other rich-text editors (e.g. the organisation description). v1 must not hard-wire it to projects.

---

## Scope

### In scope (v1), decided

- **Upload from device** in the **project description editor** only (create and edit flows).
- **Multiple images per description, max 10** (decision D2).
- Images are **stored and optimised by the platform** (details: Q5–Q7).
- Images **display responsively** on desktop and mobile (details: Q1–Q4, to be tried in the PoC).
- **Alignment of the image block: left, centre, right** (Harald, 2026-11-19; as in the Tiptap image example). Alignment only positions the block in the column; text does not wrap around it. Details: Q4.
- **Reusable design** (decision D3): the editor control, the upload endpoint and the image model are built so other rich-text editors (e.g. organisation description) can use them later without redesign. Only the project description is wired up in v1.

### Out of scope (v1), decided

- **Insert image by URL** (toolbar prompt or pasted Markdown `![alt](url)`). Possible later improvement (decision D1).
- Image library / media manager UI to browse and re-use earlier uploads. v1 only **stores the data** that makes this possible later (Q10, Q11).
- Wiring images into other editors (organisation description, event texts, organiser messages, hub pages).
- Text wrapping around images (float left/right). Alignment (in scope) is not floating: the image stays in its own block.
- CDN delivery / CDN-side image transformation (rejected for cost in #2199).

### Open: scope items that need an explicit decision (not silently added)

These were in the previous draft or follow from the design, but were not part of Harald's feedback. Each is listed in "Decisions still open" as an explicit yes/no.

- ~~Captions~~: decided, in scope (D20).
- ~~Alt text~~: decided, in scope, optional with a nudge (D21).
- ~~Paste and drag & drop~~: decided, out of scope for v1; external images removed on paste (D22).
- ~~Images in the translation editor~~: decided, same behaviour as the original editor (D23).
- ~~Upload rate limit~~: decided, 20 per user per hour, Sentry alert (D24).

---

## Decisions (settled)

| ID | Decision | Source |
|---|---|---|
| D1 | Insert image by URL is **out of scope** for v1. Possible later improvement. | Harald, 2026-11-19 |
| D2 | A description can contain **several images, max 10**. The limit applies **per description field of one entity** (for v1: the project's `description_html`). The limit applies **per language version** (each translation of the description has its own max 10, see D23); it guards against a page overloaded with images. Enforced **in the editor** (upload control is disabled at 10 images, with a short message; uploads that would go over 10 are rejected with a message) **and on the server** (saving a description with more than 10 images is rejected with a clear validation error). The server check is the authoritative one. | Harald, 2026-11-19 |
| D3 | v1 is scoped to the **project description editor**. The editor control, upload endpoint and image model must be **reusable** for other rich-text editors (e.g. organisation description) without redesign. | Harald, 2026-11-19 |
| D4 | Description images use a **separate upload endpoint** and are **not** part of the project JSON payload. | Harald, 2026-11-19 (point 5) |
| D5 | Use the MIT `@tiptap/extension-image` (already a dependency, v3.30.5) or a custom node built on `@tiptap/core`. **No Tiptap Pro / commercial dependency.** | Previous draft, unchanged |
| D6 | The display behaviour (sizing, resize or not) is **tried out in a PoC** before the spec goes to IMPLEMENTATION. | Harald, 2026-11-19 (point 3) |
| D7 | **Start from scratch**. No earlier image PoC exists to continue (see "Earlier proof of concept"). The PoC branch is created **from the PR #2349 branch `optimize-project-and-organization-images`** (not yet merged), so it can reuse the WebP work directly. | Harald, 2026-11-19 (Q5, Q13) |
| D8 | Images are **block images only**: each image is its own block, inserted at the paragraph position of the cursor, never inside a line of text. Reason: inline images make responsive display harder, and users (not experienced in web design) would expect WYSIWYG behaviour that inline images cannot deliver. Keep it simple. | Harald, 2026-11-19 (Q1) |
| D9 | Author picks one of **three preset sizes: small / medium / full** (Q2 option b). Size and alignment are stored on the image node and rendered as **CSS classes** only (no inline width/height styles, no pixel sizes from the editor). How each class displays per device (e.g. on mobile) is decided in CSS, separately (Q3). Free drag-resize (percentage or pixels) is rejected. | Harald, 2026-11-19 (Q2) |
| D10 | Size and alignment are set in a **contextual menu on the selected image** (e.g. a Tiptap bubble menu) with the alignment options (left / centre / right) and the size options (small / medium / full). | Harald, 2026-11-19 (Q2) |
| D11 | Display rules per device (Q3 a + b): **max height** relative to the viewport (about 60–70 % of the screen height, aspect ratio kept) for all sizes; **below a breakpoint (mobile), small and medium render at full column width** (still never upscaled, still capped by max height). Images narrower than the column (e.g. small logos) keep the author's alignment on mobile. A height-capped image narrower than the column is positioned by its alignment. **Exact values (max height %, breakpoint, tablet behaviour) are tuned in the PoC.** All of this lives in CSS, so it can change later without touching stored content. | Harald, 2026-11-19 (Q3) |
| D12 | A newly inserted image defaults to **alignment centre** and **size full**. Small images (narrower than the column) show at natural size, never upscaled. | Harald, 2026-11-19 (Q4) |
| D13 | **Keep the original upload unchanged** (no client-side downscaling or recompression; every resize step costs quality). The **server generates WebP variants** (600 and 1200 px wide, never upscaled; widths to be checked against the real column width) from the original, **reusing the PR #2349 image pipeline** instead of building a second one. Storage cost is not a concern for now. | Harald, 2026-11-19 (Q5) |
| D14 | Variants reach the browser via **`srcset` + `sizes` on the `<img>` in the stored HTML** (Q6 option a). The `<img>` also carries the **image's id** as a data attribute: makes it easy to find where an image is used (usage tracking, orphan detection) and keeps a later switch to render-time expansion (option c) possible without migrating content. The plain `src` fallback is the **1200 px WebP variant**, never the original (size, EXIF/GPS). Variants are generated **synchronously in the upload request** (confirmed by Harald after Archie's analysis: about 0.5–0.8 s locally per photo, expected 1–4 s on Azure); move to Celery behind the same endpoint contract only if staging shows p95 > ~5 s for 20 MB uploads. Implementation details (Archie): only the Pillow helpers of #2349 (`decode_image`, `encode_webp_variant`) are reused, not its orchestration; each variant gets its **own random file name** (not derived from the original's name, so the original's URL cannot be guessed); the endpoint validates type, size and pixels **before** `decode_image` so user upload errors are not logged as Sentry errors. | Harald, 2026-11-19 (Q6) |
| D15 | Upload limits: accepted types **JPEG, PNG, WebP** (no GIF, no SVG, no HEIC in v1). Max **20 MB per image**, checked in the editor (clear message before upload) and enforced on the server, plus decode-bomb protection (Pillow pixel limit). Archie checks request size limits in front of Django (Azure). **Privacy: location and other metadata (EXIF GPS, camera data) are removed from the stored original**, losslessly where possible (no JPEG re-encode), keeping the correct orientation. The original is never linked publicly (D14); variants carry no metadata. | Harald, 2026-11-19 (Q7) |
| D16 | Images are **uploaded immediately** when chosen (Q8 option a), one request per image, not as part of the project save. The editor keeps an **uploading state**; while an upload is in progress the **project form cannot be saved** (short message). Uploads that finish but never end up in the description (e.g. the upload dialog is closed during the upload) are accepted as unused images (Q10). Exact upload UX (dialog with progress vs placeholder in the text) is shaped in the PoC. The upload dialog shows **two phases**: upload progress (percentage, while the file is sent) and then **"Processing image…"** (indeterminate, while the server creates the WebP versions), so the user knows something is happening and does not close the dialog thinking it is stuck. | Harald, 2026-11-19 (Q8) |
| D17 | Images are **uploaded without any usage** (owned by the uploader, D19; Q9 option a). On every save of the entity, the server **parses the stored HTML for image id attributes** (D14) and syncs the references: images that appear get a **usage** for the entity and field (D19) (only images uploaded by the saving user or already linked to this entity), images that no longer appear lose that usage (**unlinked**). The same parsing serves linking, unlinking and "where is this image used". Images used in any language version (translations, D2) count as used. | Harald, 2026-11-19 (Q9) |
| D18 | Unused images (no usage: never linked, or unlinked by D17) are **kept in v1** (image library idea, storage not a concern). A **cleanup job is a follow-up task**, decided once the library direction is clear; v1 stores what it needs (upload date, usage table). **Project deleted**: its images are **unlinked** (not deleted), same as removal from the text. **Uploader account deleted**: images in use are **kept** with the owner reference cleared; unused images are **deleted** (no owner left). | Harald, 2026-11-19 (Q10) |
| D19 | **Ownership is on the user level**: every image has **one owner, the uploading user**. No project- or organisation-level ownership or visibility (shared ownership raises licensing questions: who may use an image uploaded by user A for project B of organisation C elsewhere?). If an image library is ever added, it is per user: the owner decides where to use their images. Possibly never built. **Where an image is used** is recorded in a separate **usage table** (image, entity via explicit nullable FK per entity type, rich-text field), maintained by the save-time sync of D17. This keeps later re-use in several places possible without a model change. Linking rule in v1: an image can be added to an entity's text only if the saving user owns it or it is already used in that entity (so co-admins can keep each other's images). Exact model: Archie. | Harald, 2026-11-19 (Q11) |
| D20 | **Captions are in scope for v1** (must-have, e.g. for image credits). Optional text under the image, part of the image block (block = image + optional caption). Look at the Tiptap site example for the implementation; semantic markup (`<figure>` / `<figcaption>`) preferred over plain divs (Archie). Captions are content and must go through the translation flow like the rest of the description. | Harald, 2026-11-19 (Q12a) |
| D21 | **Alt text is in scope for v1**, edited with the image. **Optional with a nudge**: the field is shown prominently in the upload dialog with a one-line hint (what alt text is, and that it differs from the caption); an image without alt text shows a reminder icon in the editor; saving is not blocked. Editable later in the image's contextual menu (D10). Alt text is content and must be translated like captions. | Harald, 2026-11-19 (Q12b) |
| D22 | **Paste and drag & drop of image files: out of scope for v1**, follow-up (raises extra UX questions: no alt text dialog, multi-file drops, limit overflow). The toolbar button is the only way to add images in v1. **In v1**: when HTML is pasted that contains `<img>` tags pointing to external sources, the editor **removes them on paste** (they would be stripped on save anyway, D1 / Constraints), so the author sees immediately what will be kept. | Harald, 2026-11-19 (Q12c) |
| D23 | **The translation editor behaves exactly like the original editor**: a translator can add, remove, resize, realign and caption images freely; a language version may use **different images** than the original (realistic use case). Max 10 images **per language version** (D2). Automatic (DeepL) translations carry over the original's images as they are (`tag_handling=html`). Usage sync (D17) considers **all language versions**: an image counts as used while it appears in any of them. Images uploaded in the translation editor are owned by the translator (D19). Archie checks that the translation save paths run the same sanitising, limit check and usage sync. | Harald, 2026-11-19 (Q12d) |
| D24 | **Upload rate limit: 20 uploads per user per hour** (one project with 10 images in two languages), via DRF throttling (pattern already used, e.g. `event_feed`). The user gets a clear message when the limit is hit. **Admins are alerted via Sentry**: when a user is throttled, the backend sends a Sentry event (warning level) with the user id, fingerprinted **per user**, so each affected user creates one Sentry issue and triggers the existing Sentry notification. A storage quota per user is a follow-up (with the cleanup job, D18) if misuse shows up. | Harald, 2026-11-19 (Q12e) |
| D25 | **Alt text max 150 characters** (accessibility guidelines suggest under about 125–150), with a character counter in the field, enforced in the editor and on the server. Automatic (DeepL) translations that come out longer are shortened on the server, not rejected (the user did not write them). Also noted: caption text counts towards the 4 000-character visible-text limit; alt text does not (attribute). | Harald, 2026-11-19 (N2) |
| D26 | **Backend memory protection without browser resizing** (originals stay untouched, D13). **JPEG**: pixel limit **about 110 MP**; variants are generated with **reduced-scale JPEG decoding** (Pillow `draft()`, decode at 1/2, 1/4 or 1/8 so the decoded image is just above the largest variant width), so the full-resolution image is never held in memory. **PNG / WebP** (no reduced decoding): pixel limit **about 40 MP**. Metadata stripping works on the bytes and dimensions are read from the header, so neither decodes the image. The editor uploads **one image at a time per user**. Browser-side resizing to 12 MP is the fallback if the PoC still shows memory problems. Note: browsers do not offer the user a size choice on file upload (unlike iOS Mail). | Harald, 2026-11-19 (N3) |
| D27 | **Captions are plain text** in v1 (no bold, italic or links). Links in captions (e.g. licence links for credits) are a possible follow-up. | Harald, 2026-11-19 (N4) |
| D28 | **Lazy loading**: every description `<img>` gets `loading="lazy"`, set by the editor node; the backend HTML sanitiser allows the `loading` attribute (value `lazy` only). Stored width/height (D14) reserve the space. | Harald, 2026-11-19 (N5) |
| D29 | **Alt text in automatic translations: no extra handling for now** (N1 option b). If DeepL leaves `alt` untranslated, auto translations keep the original-language alt text; translators can fix it by hand in the translation editor. Reasons: users mostly read the original language, and rewriting translated HTML is fragile. **PoC reminder: test whether DeepL translates `alt` (one test call), then decide finally.** | Harald, 2026-11-19 (N1, provisional) |
| D30 | **Merge order: PR #2349 merges into `master` first** (N6 option a); #2349 is in review/testing and expected to merge before this feature goes to production. PoC and implementation continue on `poc-image-description` (which already contains #2349) and take in #2349 updates; our PR is opened against `master` after #2349 is merged. Fallback if #2349 testing fails: split the reused helpers (`images.py`) into their own small PR (option c). | Harald, 2026-11-19 (N6) |
| D31 | **Azure checks** (N7), verified 2026-11-19 via `az` (read-only): backend runs on **Linux App Service** (`climate-backend-appservice`), **no Front Door / WAF** in front (Harald). Media container `climate-connect` in `climateprodstorage` has public access level **Blob** (files readable by URL, container not listable). **No URL expiry**: `AZURE_URL_EXPIRATION_SECS` is neither in `settings.py` nor in the App Service settings, so URLs frozen into the HTML stay valid. Remaining for staging testing once the endpoint exists: a **20 MB upload** works end to end, and upload time on a slow connection stays well below the **230 s** App Service timeout. | Harald, 2026-11-19 (N7) |
| D32 | **The PoC becomes production.** It is built to production standards from the start (tests, docs, code review, Definition of Done) on `poc-image-description`, iteratively: open details (display values, upload UX, DeepL alt text) are settled while building, and the spec is updated as they are. | Harald, 2026-11-19 |

---

## Acceptance Criteria (observable outcomes)

1. In the project description editor (share project, edit project and the translation editors), a user can choose an image from their device via a toolbar control (paste / drag & drop not in v1, D22) and repeat this for more images. Each image is uploaded immediately and appears as its own block (D8, D16). While uploading, the user sees upload progress followed by a "Processing image…" state until the server has created the versions, and the project form cannot be saved. A failed upload shows an error and leaves no broken image in the text.
2. Each language version of a description holds at most 10 images (D2). At 10, the editor prevents further uploads and says why. Saving a description with more than 10 images (e.g. via the API) is rejected with a validation error.
3. Description images are uploaded through their own endpoint, independently of the project save request. The project create/edit payload only carries the description HTML that references the images.
4. Uploading works before the project exists (share project flow) and for existing projects (edit flow). On save, images in the description are linked to the project and images removed from all language versions are unlinked (D17).
5. Only JPEG, PNG and WebP up to 20 MB are accepted; other files are rejected with a clear message, in the editor and on the server (D15). More than 20 uploads per user per hour are rejected with a clear message, and admins are notified via Sentry (D24).
5a. The stored original keeps its full quality but contains no location or camera metadata (D15).
6. The server generates 600 and 1200 px WebP versions (never upscaled) via the PR #2349 pipeline. The `<img>` in the description offers them via `srcset`, falls back to the 1200 px version, and carries the image id. The original is never linked publicly (D13, D14).
7. On the project page, images display within the description column on all screen sizes, keep their aspect ratio, are **never enlarged beyond their natural size**, are limited to a maximum height relative to the screen, and do not cause layout jumps while loading. Authors choose size small / medium / full and alignment left / centre / right in a contextual menu (default: full, centre); on mobile, small and medium show at full column width (D9–D12). Exact values come from the PoC.
7a. Each image can have an optional caption shown below it, and optional alt text (with a reminder in the editor when missing) (D20, D21).
8. The project page shows images exactly as the editor did (WYSIWYG), consistent with how YouTube embeds are handled today.
9. The server only keeps `<img>` elements that point to images stored by the platform (Climate Connect storage). Images from other hosts, data URLs, and any attributes outside the allowlist are removed when the description is saved. (Follows from D1. Prevents tracking pixels and hotlinking.)
10. Every stored description image records its owner (the uploader) and, in a usage table, every entity and rich-text field it is used in (D19). Unused images are kept (D18).
11. Automatic (DeepL) translations keep the images of the original description. In the translation editor, images can be added, removed and changed like in the original editor; each language version holds at most 10 images (D23).

---

## Constraints / Non-negotiables

- **No commercial Tiptap dependency** (D5).
- **Not in the project JSON payload** (D4). Prefer a multipart file upload over base64. Base64 adds about 33 % and is the cause of the current payload problem. (No multipart endpoint exists in the backend yet, so this is a new pattern; Archie to confirm.)
- **Storage-agnostic backend**: must work with Azure Blob Storage in staging/production (no `FieldFile.path`), same rule as the WebP spec.
- **Security**: server-side sanitising of `description_html` stays authoritative. Allow `<img>` only with an allowlisted set of attributes and only for platform-hosted sources (AC 9). SVG uploads are not accepted (script risk).
- **Description length cap**: `description_html` is capped at 20 000 characters on the server. Ten images with long storage URLs (and possibly `srcset`) take a noticeable share of that. The design must make sure 10 images plus a full 4 000-character text still fit. (Archie: raise the cap, exclude image markup, or keep the markup short.)
- **Never upscale** small images (Harald, point 3).
- **Responsive**: no layout that only works at one screen width (Harald, point 3).
- Pillow for server-side processing. Reuse the WebP-variant pipeline from PR #2349 instead of building a second one (D13). No client-side downscaling or recompression of description images (D13), so `compressorjs` is not used here.

---

## Domain Context

- **Editor**: `ProjectDescriptionEditor.tsx` uses `mui-tiptap`'s `RichTextEditor` with StarterKit, Youtube, Link and CharacterCount (4 000 visible characters). A YouTube button opens a dialog. Image insertion would be a new toolbar control next to it. `@tiptap/extension-image` is installed but not used.
- **MIT image node facts** (v3.30.5): it can be configured as block or inline (default: block). It has a built-in `resize` option with drag handles, but resizing writes **fixed pixel** `width`/`height` attributes. That is the "fixed sizes" problem from Harald's point 3. No caption, no `srcset`.
- **Where the editor is used**: share project (`EnterDetails.tsx`, project does **not exist yet** until "save as draft" or "publish"), edit project (`EditProjectContent.tsx`), and the translation editors (`TranslateTexts.tsx`, `TranslateProject.tsx`). In the translation editors a user could add or remove images in one language only.
- **Display**: `ProjectContent.tsx` renders `project.description_html` via `dangerouslySetInnerHTML` and reuses the editor's styles for WYSIWYG. There is existing CSS for YouTube iframes (max width, 16:9).
- **Sanitising**: `sanitize_html` (bleach) with `PROJECT_DESCRIPTION_ALLOWED_TAGS`. `<img>` is not allowed today. YouTube iframes are filtered by an src allowlist after bleach. The same approach fits images.
- **Translation**: DeepL is called with `tag_handling=html`, so `<img>` tags pass through into `description_html_translation`.
- **Project images today**: `image` and `thumbnail_image` are sent as base64 data URLs in the project create/edit JSON (`ShareProjectRoot.tsx`, `EditProjectRoot.tsx`), decoded by `get_image_from_data_url`. Client compression via `compressorjs` reduces quality but does not limit pixel dimensions. `DATA_UPLOAD_MAX_MEMORY_SIZE` is 10 MB.
- **WebP work in progress (PR #2349, open)**: generates 600 px and 1200 px WebP variants for project, organisation and profile images with Pillow, in Celery tasks, storage-agnostic. Never upscales, handles EXIF orientation and alpha. Stores variant paths in a JSON field per model. Deletes originals and variants when an image is replaced or its row is deleted. Frontend `<ResponsiveImage>` renders `<picture>` with a WebP `srcset` + `sizes` and falls back to the original. Reusable pieces for us: the Pillow encode helpers (`climateconnect_main/utility/images.py`) and the variant naming and cleanup approach. `<ResponsiveImage>` itself is a React component and cannot be used directly inside HTML rendered via `dangerouslySetInnerHTML`.
- **Ownership context**: a project has several admins (roles) and may belong to an organisation (`parent_organization`). Organisations may later have rich-text descriptions too. The backend has no generic-relation (`ContentType`) usage today.

---

## Design questions (all decided 2026-11-19, see Decisions D7–D24; options kept for reference)

Each question lists the options and trade-offs that were discussed. The decision is noted under each question and in the Decisions table.

### A. Display and sizing (Harald point 3), to be tried in the PoC

#### Q1. Block image or inline at the cursor?

| Option | Pros | Cons |
|---|---|---|
| **a. Block** (own paragraph-level block, inserted after the current paragraph) | Same as the Tiptap upload example. Easy to size relative to the column. Predictable on mobile. Caption fits naturally. | No images inside a line of text (rarely wanted for photos). |
| b. Inline at the cursor | Small icons or logos inside a sentence. | Line-height and wrapping problems. Hard to make responsive. Captions do not fit. |

**Decided: a. Block (D8).** The previous draft said "insert at the cursor". With blocks, the image goes into its own block at the cursor's paragraph position, not inside the text line.

#### Q2. Can the author resize images, and how?

| Option | Pros | Cons |
|---|---|---|
| a. **No resizing.** Every image is "as wide as the column, but never wider than its natural size", with a max height (see Q3) | Simplest. Always responsive. Nothing can look wrong on another device. | Author cannot make a small inline-sized photo next to text, or de-emphasise an image. |
| b. **Preset relative widths** (e.g. small / medium / full = about 1/3, 1/2, full column width), picked from a small menu on the selected image | Responsive (relative). Few states to design and test. Easy to explain. | Less freedom. Needs a mobile rule (Q3). |
| c. Free drag-resize, stored as a **percentage** of the column | Most freedom while still relative. | The thin-on-mobile problem is the worst here. Many in-between states. Custom work (the MIT node stores pixels). |
| d. Free drag-resize in **pixels** (MIT `resize` option as is) | Built in. | Not responsive. Fixed sizes. Contradicts Harald's point 3. |

**Decided: b. Preset sizes as CSS classes (D9), set in a contextual menu (D10). c. and d. rejected.** Original recommendation, for reference: start the PoC with a. (no resizing) plus the max-height rule from Q3, and test b. (presets) as the alternative.** In most cases authors shrink an image because a tall or large image takes too much space. A max height solves that on every device without any author input. If the PoC shows that authors really need "smaller than full width", add presets (b). Do not use c. or d.

#### Q3. The "tall image shrunk on desktop is too thin on mobile" problem

Options (can be combined):
- **a. Max height** relative to the viewport (e.g. about 60–70 % of the screen height). The image keeps its aspect ratio and is centred. This handles tall portrait images on all devices without author input.
- **b. Below a breakpoint (mobile), presets are ignored**: small and medium images become full column width there (still capped by max height and natural size).
- c. Presets with a **minimum rendered width** in pixels (e.g. never narrower than about 280 px).

**Decided: a. + b. (D11); values tuned in the PoC.** Original recommendation: a. always. If presets (Q2b) are chosen, add b. Together they remove the thin-image problem: on mobile everything is column width, and the max height limits portraits.

#### Q4. Small images (never upscale) and alignment

Decided by Harald: never enlarge. Also decided: the author can **align the image block left, centre or right** (stored as an attribute on the image node, rendered as a class, no inline styles). Alignment is only visible when the image is narrower than the column: a small image at natural size, or a preset width (Q2b).

Open questions:
- **Default alignment** for a new image: a. **centred**, b. left like text.
- ~~Alignment on mobile~~: decided, kept for images narrower than the column (D11).
- ~~Alignment control~~: decided, contextual menu on the selected image (D10).
- **Default size** of a new image: full (recommended) or medium.

**Decided: default centred, default size full (D12).** The editor should store the image's natural width and height so the page reserves space while loading (no layout jump) and can cap the width at natural size.

#### PoC: what to try out (Q1–Q4)

On `poc-image-description`, with the real editor and project page, on desktop and on a phone (or emulation at 360–390 px width):
1. Block images, column width, never upscaled, max height. Test with: wide landscape, tall portrait (phone photo), square, a small logo (about 200 px), a screenshot with text.
2. Same set with presets small / medium / full (D9), the contextual menu (D10) and the mobile handling (Q3).
3. Check editor and page look the same (WYSIWYG) and nothing jumps while loading.
4. Check with 10 images in one description: editing performance, page weight with and without variants (Q5).
5. Rough check of the HTML size of 10 images against the 20 000-character cap.
6. Alignment left / centre / right with small images and with presets, on desktop and mobile.
7. **DeepL and alt text (D29)**: one test translation of a description with images. Does DeepL translate `alt`? Then decide finally on N1. **Result (Harald, 2026-11-19): DeepL does not translate `alt`.** Captions are translated. Comparison (2026-11-19, one image block, en→de): with `tag_handling=html` the `<img>` comes back unchanged and `alt` stays English; without it DeepL treats everything as text, translated `alt` too and happened to keep the URLs, but nothing guarantees that. The translation editor's "Automatically translate" button (`/api/translate_many/`) used plain mode for the description; fixed: it now sends `html_keys` and HTML fields are translated with `tag_handling=html`. All automatic translations now behave the same (D29). A safe way to get translated alt texts later: translate only the alt texts in plain mode in a separate request and write them back by image id (N1 option a).
8. Upload of large originals (12, 48, 108 MP JPEG; a large PNG): time and memory with reduced-scale decoding (D26).

The PoC is **not throwaway**: it becomes the production implementation (D32), built with the usual best practices (tests, docs, review). "PoC" means not everything is known yet; we work in iterations and adjust along the way. Findings and changed values are recorded in this spec ("PoC findings" / Log) as they come up.

### B. Storage and optimisation (Harald point 4)

#### Q5. Do we store optimised versions, and which?

| Option | Pros | Cons |
|---|---|---|
| a. Store only a **client-downscaled** image (e.g. long edge capped at about 2 000 px, compressed with `compressorjs`) | Simple. No server processing. | One size for all devices. No WebP for most uploads. The original is lost (fine for v1, limits re-use at larger sizes later). |
| b. **Server generates WebP variants** (e.g. 600 and 1200 px wide, never upscaled), keeps the uploaded file as the fallback/source | Matches the #2199 / PR #2349 approach. Mobile gets 600 px, desktop and retina get 1200 px. Re-use later at other sizes is possible. | More storage (about 3 files per image). Server processing per upload. |
| c. a + b: client caps the upload size, server generates variants | Smaller uploads (faster on mobile networks). Bounded server work. Still variants. | Slightly more moving parts. |

**Decided: b. Keep the original, server generates WebP variants, reuse PR #2349 (D13).** No client-side downscaling. Original recommendation, for reference: c. Client caps dimensions and compresses before upload. The server generates WebP variants using the Pillow helpers from PR #2349. Widths should follow the description column: the content column is at most about 700–800 CSS px on desktop, so 1200 px covers 2x DPR at a sensible size. **Archie to confirm the widths against the real column width.**

#### Q6. How do the variants reach the browser (fits with the WebP WIP?)

The description is stored and rendered as HTML, so the image markup must carry the variants. React `<ResponsiveImage>` from PR #2349 cannot be used inside `dangerouslySetInnerHTML` directly.

| Option | Pros | Cons |
|---|---|---|
| a. **`srcset` + `sizes` on the `<img>` in the stored HTML** (`src` = fallback) | Plain HTML, works everywhere, the browser picks the size. Sanitiser allowlist stays small (`img` with a few attributes). | Variants must exist when the image is inserted (synchronous generation, or the editor waits). URLs are frozen into the HTML (storage host change means rewriting HTML). Longer HTML (length cap). |
| b. `<picture>` with `<source>` in the stored HTML | Same as the WebP WIP's pattern. | Tiptap would need a custom node for `picture`. Larger sanitiser allowlist. Same "frozen URLs" issue. |
| c. HTML stores only an **image reference** (e.g. an id attribute plus a fallback `src`). The server or frontend expands it to `srcset` at render time | Short HTML. Variants can be regenerated or added later. Survives storage changes. Fits the image-library idea. | More work: render-time rewriting (serializer or `html-react-parser`, which is already a dependency). Translations and every other render path must use it too. |

**Decided: a. + image id (D14).** Original recommendation: a. for v1, with the image's id also stored as a data attribute so c. stays possible later without migrating content. To make a. work, the upload endpoint returns the variant URLs in its response, so generation is synchronous for the single uploaded image (see Q7). This differs from PR #2349, which uses Celery because there the images are processed inside the main save request. **Decision for Archie and Harald**: synchronous in the upload request (simple, image is bounded in size) or async via Celery with the editor showing the fallback first.

#### Q7. Upload limits

**Decided (D15).** Notes below kept for reference.


- **Accepted types**: JPEG, PNG, WebP. Open: **GIF** (animated GIFs lose animation when converted) → accept as-is without variants, or reject? Recommendation: reject in v1.
- **Max file size**: originals are uploaded unchanged (D13), so phone photos (often 4–12 MB, sometimes more) arrive at full size. Needs a server limit that fits real phone photos, checked against all request size limits on the way (Django, Azure App Service / proxy). Plus decode-bomb protection (pixel-count limit). To decide.
- **Metadata / privacy**: originals keep their EXIF data, which can include **GPS location** of where the photo was taken. Decide whether the original is ever served publicly (e.g. as the `src` fallback), or only the variants (which are re-encoded without EXIF), or whether metadata is stripped from the stored original.

### C. Upload flow, unused images, ownership (Harald point 5)

#### Q8. When is an image uploaded?

| Option | Pros | Cons |
|---|---|---|
| a. **On insert** (immediately when chosen, editor shows a placeholder until done) | Save request stays small. Image has a final URL right away. Errors are shown per image. Same pattern as the Tiptap upload example. | Images can be uploaded and then never used (Q10). |
| b. On save (editor holds local blobs, uploads all, rewrites `src`, then saves the project) | No unused uploads from abandoned edits. | Complex (rewrite HTML before save, partial failure with up to 10 uploads). Slow save. Lost work if the tab closes. |

**Decided: a. (D16).** Original recommendation: a. on insert. Accept that some uploads end up unused (Q10).

#### Q9. Uploading before the project exists (share project flow)

In the share flow, the description is written before the project is created ("save as draft" / "publish" creates it).

| Option | Pros | Cons |
|---|---|---|
| a. **Upload without a parent**: the image belongs to the uploader only. When the project is saved, the server links every image referenced in `description_html` to the project (only images the saving user uploaded, or that already belong to this project). | Works for both flows. No forced draft. | Images of abandoned share flows stay without a parent (Q10). |
| b. Force-create a draft project before the first image upload | Images always have a parent. | Changes the share flow. Creates drafts the user did not ask for. |

**Decided: a. plus unlinking on save (D17).** Original recommendation: a. The linking on save also covers the edit flow and later editors (organisation description) in the same way.

#### Q10. Unused images (removed from the text, abandoned flows)

| Option | Pros | Cons |
|---|---|---|
| a. **Keep everything** (treat uploads as an image library) | Simplest. Enables re-use later (Harald's idea). Undo, "discard changes" and translations never break. | Storage grows. Platform can be misused as free image hosting (mitigate with Q12e quota). |
| b. Delete immediately when an image is removed from the text | No unused files. | Breaks undo after save, discarded edits, translations, and later re-use. Needs reference counting across all fields. |
| c. **Keep linked images; clean up images that never got a parent** after N days (e.g. 30), via a scheduled job | Library for real content. Abandoned uploads go away. | One scheduled job. Defines "used" as "has a parent". |

**Decided: keep everything in v1, cleanup as follow-up; project delete unlinks; account delete keeps linked images and deletes parentless ones (D18).** Original recommendation: c., with the cleanup job as a follow-up task. v1 stores the data needed for it (upload date, parent nullable). Linked but unused images are kept as the library. **Also decide**: what happens to images when the **project is deleted** (delete with it, like PR #2349's D7 does for project images, or keep for the uploader's library) and when the **uploader's account is deleted** (keep the image, since it is project content, and clear the uploader reference; or delete).

#### Q11. Ownership and visibility model

What each image needs to record so that visibility for re-use can be decided later:
- **Uploader** (user). Always set.
- **Parent entity**, nullable until linked (Q9): for v1 a project. Later an organisation, possibly others.
- **Which rich-text field** of the parent (e.g. "project description"). Allows several rich-text fields per entity later.
- Created timestamp, natural width and height, stored file plus variants, file size.

Visibility for re-use is then derived, not stored. For example: project admins see the project's images; organisation members see images of the organisation and of its projects (via the project's organisation); the uploader sees their own images. **Not decided in v1** (no library UI).

How to model the parent:

| Option | Pros | Cons |
|---|---|---|
| a. **Explicit nullable foreign keys** (project, organisation, …) with a rule "at most one parent" | Database integrity and cascades. Simple queries. Fits the current codebase (no generic relations used). | One column per new parent type (a migration each time). |
| b. Generic relation (content type + object id) | Any entity without schema change. | No database integrity or cascades. New pattern in this codebase. Harder queries for "images of an org and its projects". |

**Decided (D19): owner = uploading user; usage table with explicit FKs per entity type + field identifier (not a parent column on the image, not a generic relation). Visibility for re-use is not derived from projects or organisations; a library, if ever built, is per user.** Original recommendation: a. explicit FKs. **Archie decides the exact model.**

**Who may upload / link**: any logged-in user may upload (needed for the share flow). Linking to a parent on save requires edit rights on that parent, which the existing project edit permissions already check. Image files are public by URL (random names), like project images today. That means images in a draft project are reachable by anyone who has the URL. Same as the current header image, so acceptable.

---

## Earlier proof of concept (Harald point 7)

Searched local branches, remote branches, stashes, worktrees, reflog, PRs and issues (2026-11-19). **There is no earlier image-in-editor PoC.**

- `poc-image-description` (current): identical to `master` (0 own commits).
- `rich_text_image_support`: **0 own commits**, 236 behind `master`. Points at the merge of #2118 (2026-07-08), the day this spec was written. It was created but never used. The spec itself went to `master` directly.
- `poc_rich_text_editor` / `Rich-text-editor-for-project-description` (Jan–Feb 2026, 26–27 commits, 545 behind `master`): the **original rich-text-editor PoC** (mui-tiptap toolbar, SSR fix, character counter, DOMPurify display). It only added `@tiptap/extension-image` to `package.json`. **No image code.** Its result shipped in #2107 (rich-text editor for project description, merged 2026-07-02) and #2113.
- `rich-text-editor-for-project-description` (lowercase, July 2026, 14 commits, 245 behind): the #2107 work, merged.
- Stash `poc_rich_text_editor`: tool configuration only (`.kilo*`, yarn state).
- Remote: no branch for rich-text images. PR #858 / `seif/feature/projectimagecompression` (2021) is the old WebP attempt that #2349 replaces. It is not related to the editor.

**Decided (D7): start from scratch**, with the PoC branch created from the PR #2349 branch `optimize-project-and-organization-images`. Nothing to cherry-pick from older branches. If Harald remembers the PoC on another machine or fork, it was never pushed to `origin`.

---

## AI Agent Insights and Additions

- **Max-height beats resizing for most cases**: the main reason authors resize is "this image is too big". A viewport-relative max height plus "column width, never upscale" handles that on every device, which is why Q2a is the PoC starting point.
- **Presets as maximum widths**: if presets are chosen, treating "small / medium" as a maximum relative width combined with the image's natural width gives "never upscale" for free. Hint for the implementer, not a requirement.
- **Translation editor**: the translation editors reuse `ProjectDescriptionEditor`. Decided (D23): same behaviour, images may differ per language, limit per language.
- **Pasted HTML**: pasting content from other websites can bring external `<img>` tags into the editor. Without URL insert (D1), the editor should drop them, or the server will strip them on save (AC 9). The user should not see images in the editor that disappear after saving.
- **Length cap**: ten images with three absolute Azure URLs each (`src` + `srcset`) can use roughly 5 000–7 000 characters of the 20 000-character `description_html` cap. This is one reason Q6c (reference only) might be worth it later.
- **Dependency on PR #2349**: if the WebP PR merges first, this feature reuses its helpers. If not, the two must not build parallel Pillow pipelines. Coordinate the merge order.
- **Alt text** is close to free (an attribute on the node) and improves accessibility and SEO. Recommendation: include it (Q12b).

---

## System impact

Written by Archie on 2026-11-19. Checked against `poc-image-description` be9f3da92 (= `master` 4baf9fbdf + merge of PR #2349 at 85721257e; the #2349 pipeline files in the working tree are identical to the PR branch) (Django 5.2, Pillow 12.2, bleach 6.3, Tiptap 3.30.5, mui-tiptap 1.30). D1–D24 are taken as decided. The display values from the PoC (max height, breakpoint, tablet) are still open and don't change anything below. **Decisions Harald still has to make are marked N1–N7** and collected at the end.

### Summary

- **New domain objects** (app `climateconnect_api`, one additive migration): **RichTextImage** (one uploaded image: owner, stored original, WebP variants, dimensions) and **RichTextImageUsage** (where an image is used: image + one explicit nullable FK per entity type + rich-text field identifier).
- **New endpoint**: `POST /api/rich-text-images/` (multipart). It doesn't know about projects (D3, D17): it validates, strips metadata, stores the original, generates the 600/1200 WebP variants **synchronously** and returns the id and the variant URLs.
- **Changed save paths**: project create, project edit and both translation save paths run one new step, "resolve description images", **before anything is written**. The step canonicalises every `<img>` from the database, applies the linking rule and the 10-per-language limit. After the writes, a **usage sync** reconciles the usage rows from the persisted HTML of all language versions.
- **Sanitiser**: allowlist gets `figure`, `figcaption`, `img`, plus a post-filter for `<img>` and `class` tokens (like the existing YouTube iframe filter).
- **Frontend**: a custom figure-image node (MIT, built on `@tiptap/core`), an upload dialog, a bubble menu for size/alignment/alt text, an "uploading" signal that blocks the form's save, and shared CSS so the editor and `ProjectContent.tsx` look the same.

### Data model (D17, D18, D19)

**RichTextImage**
| Field | Type | Notes |
|---|---|---|
| id | integer PK | Written into the HTML as `data-image-id` (D14). |
| owner | FK → User, nullable, **SET_NULL** | The uploader (D19). Cleared when the account is deleted and the image is still used (D18). |
| original | image file | Stored original after metadata stripping (D15). Storage-agnostic: no `.path`. |
| variants | JSON | Storage **paths** (not URLs, same as #2349 D1) plus the real pixel size per variant, e.g. `{"600": {"name": …, "width": 600, "height": 400}, "1200": {…}}`. |
| width, height | positive integers | Original size **after applying the orientation** (what the user sees). |
| file_size | positive integer | Bytes of the stored original. |
| format | short text | `jpeg` / `png` / `webp`, detected from the content, not from the file name or the client's MIME type. |
| created_at | datetime | Upload date, needed by the later cleanup job (D18). |

**RichTextImageUsage**
| Field | Type | Notes |
|---|---|---|
| image | FK → RichTextImage, **CASCADE** | Deleting an image removes its usage rows. |
| project | FK → Project, nullable, **CASCADE** | Deleting the project deletes the usage rows, so its images are **unlinked, not deleted** (D18). Later: `organization`, … one nullable FK each (D19). |
| field | short text with choices | v1: `project_description`. Identifies the rich-text field, **not** the language: one row covers all language versions (D17, D23). |
| created_at | datetime | |

- **Constraints**: a unique constraint on (image, project, field) where project is set; a check constraint "exactly one entity FK is set" (v1: project is set; later `num_nonnulls(project, organization, …) = 1`).
- **Indexes**: only the automatic FK indexes and the unique constraint. A `created_at` index for the cleanup job comes with that job.
- **Account deletion (D18)**: a `pre_delete` handler on User deletes the user's images **that have no usage**. Django's SET_NULL then clears the owner on the remaining (used) ones. Note: there is **no self-service account deletion** in the API today. This only covers deletions in the Django admin (and any future delete-account feature).
- **File cleanup**: a `post_delete` handler on RichTextImage deletes the original and all variant files once the transaction commits (same pattern as #2349's `delete_image_files` / `_delete_files_on_commit`).
- **Placement**: `climateconnect_api`, because it's shared by several entity types (D3). It already holds `ContentShares`, which uses the same "nullable FK per entity type" pattern and already depends on `organization`.
- **Migration**: one migration, two new tables, no data migration, no change to existing tables. Safe during a slot swap: old code never touches the new tables. It depends on the latest `organization` migration, which is #2349's `image_variants` migration if #2349 merges first (see merge order).
- **Storage names**: `rich_text_images/<random>.<ext>` for the original. Each variant gets its **own independent random name**. Don't reuse #2349's `_variant_filename`: it derives the variant name from the original's name, so the public variant URL would reveal the original's path minus the extension. That would make the original guessable, which goes against D14 ("original never linked publicly"). No user id in the path either: the paths end up in public HTML.

### Upload endpoint (D4, D15, D16, D24)

- `POST /api/rich-text-images/` (trailing slash, registered in `climateconnect_main/urls.py`). Content type `multipart/form-data`, one file part `image`. **No entity in the request**: the image is uploaded without usage (D17), so the same endpoint serves every future editor (D3). Alt text and caption aren't sent: they live in the HTML.
- **Permissions**: `IsAuthenticated` (any logged-in user, needed for the share flow).
- **Processing order**: throttle → file present → size ≤ 20 MB (`UploadedFile.size`) → read the header only and check format ∈ {JPEG, PNG, WebP} and the **pixel limit** (before decoding any pixels) → strip metadata → decode once → encode the variants → store the original and the variants → create the row → respond.
- **Response 201**:
  ```json
  {
    "id": 4711,
    "width": 1200,
    "height": 800,
    "variants": [
      {"width": 600, "height": 400, "url": "https://…/rich_text_images/<random>.webp"},
      {"width": 1200, "height": 800, "url": "https://…/rich_text_images/<random>.webp"}
    ]
  }
  ```
  `width`/`height` = the largest variant's size (= `min(original, 1200)`). That's the "natural size" the page may show at most (never upscale). The variants are sorted ascending, and the last one is the `src` fallback (D14). **Real pixel widths, never nominal**: a 900 px original gives `600w` and `900w`. A ≤ 600 px original gives a single variant (duplicates are dropped).
- **Errors**: `400` with a `code` (`unsupported_type`, `file_too_large`, `too_many_pixels`, `unreadable_image`) that the frontend maps to translated texts (same pattern as the leave-organization `code`s). `401` if not logged in. `429` when throttled, with `Retry-After`. **User errors must not produce Sentry errors**: #2349's `decode_image` logs every failure at error level and returns `None` (Sentry captures that). The endpoint has to validate before calling it, or the helper needs a variant that raises.
- **Throttle (D24)**: a DRF `UserRateThrottle` subclass with its own scope (e.g. `rich_text_image_upload`), rate `20/hour` in `DEFAULT_THROTTLE_RATES` next to `event_feed`. Counted per user id, stored in the default cache (Redis in production, locmem in tests). Every request that gets past the throttle counts, including uploads rejected later for type or size. That's acceptable.
- **Sentry (D24)**: override the view's `throttled()` and send a `capture_message(..., level="warning")` in a new scope, with a tag `user_id` and **`fingerprint = ["rich-text-image-upload-throttled", "<user id>"]`**. Note: the global `_sentry_before_send` **removes `event["user"]`**, so the user id has to be in the tag and fingerprint, not in the Sentry user context. Recommendation (no new decision): send the event only for the **first** throttled request per user and window (a short cache key). A script hammering the endpoint would otherwise produce one event per request and burn the Sentry quota. The grouping (one issue per user) stays the same.

### Variant generation: synchronous (D14)

**Recommendation: synchronous in the upload request, as planned for the PoC. Not Celery.**

- **Measured** (Pillow 12.2, local Apple Silicon, synthetic photo-like content, decode + 600 and 1200 WebP at q80/method 6): 12 MP JPEG (7 MB) 0.5 s, 24 MP JPEG (14 MB) 0.5 s, **50 MP JPEG (29 MB) 0.8 s**, 12 MP PNG (13 MB) 0.5 s. With JPEG draft decoding (decode at a reduced DCT scale, since we need ≤ 1200 px), the 50 MP case drops to 0.55 s. Expect 2–4× that on App Service vCPUs, plus 3 blob writes. That's **about 1–4 s** for a 20 MB upload, less than the upload transfer itself on most connections.
- **Why #2349 is async and this isn't**: in #2349, images are processed inside the **project save**, several fields at once, and a variant failure must never break the save, because the original remains a valid fallback. Here the editor **needs the variant URLs to write the HTML** (D14), and there is **no fallback to the original** (D14 forbids it). Async would need placeholder nodes, polling and HTML rewriting after the fact.
- **Known cost**: under ASGI (gunicorn + uvicorn workers, 4 per instance), Django runs sync views on **one shared thread per worker process**. Each upload blocks its worker's sync views for the processing time. This happens today already with base64 project images and DeepL calls in the save, so it's acceptable. Peak memory per upload: decoded RGBA ≈ 4 bytes × pixels (50 MP ≈ 200 MB, less with JPEG draft decoding).
- **Fallback trigger**: if staging shows p95 > ~5 s for 20 MB uploads, move processing to Celery and let the editor wait for the variants (the upload dialog stays open). That's a contained change behind the same endpoint contract.

### Lossless metadata stripping (D15)

**Recommendation: a small in-house byte-level filter per format, using Pillow only to build a minimal EXIF block. No new dependency.**

- **JPEG**: walk the marker segments up to SOS and copy the entropy-coded data unchanged (no re-encode). **Drop** APP1 (EXIF **and** XMP, which can also carry GPS), APP13 (IPTC/Photoshop), COM, and APP2 segments that aren't `ICC_PROFILE` (e.g. MPF, which holds secondary images). **Keep** APP0 (JFIF), APP2 `ICC_PROFILE` (colours), APP14 (Adobe colour transform). **Truncate everything after EOI**: phones append extra images, depth/gain maps and, for "motion photos", an MP4 video there. **Orientation**: if the original has an EXIF orientation other than 1, insert one new minimal APP1 with **only** the Orientation tag (Pillow's `Image.Exif` can serialise it). The original stays self-describing for later variant regeneration.
- **PNG**: chunk filter. Drop `eXIf`, `tEXt`, `zTXt`, `iTXt` (XMP lives there), `tIME`. Keep the critical chunks plus `iCCP`/`sRGB`/`gAMA`/`cHRM`/`pHYs`/`tRNS`. An orientation in a PNG `eXIf` is rare. Keep a minimal orientation `eXIf` the same way as for JPEG.
- **WebP**: RIFF chunk filter. Drop the `EXIF` and `XMP ` chunks and clear the matching flags in `VP8X`; keep `ICCP`. If an orientation was present, write a minimal `EXIF` chunk with only Orientation.
- **Variants**: decode with `ImageOps.exif_transpose` (already in #2349's `decode_image`) and encode without metadata. They are upright and carry nothing.
- **Alternatives considered**: `piexif` (JPEG only, no release since 2019, not recommended), exiftool/jpegtran (system binaries, not available on App Service by default, rejected), re-encoding with Pillow (not lossless for JPEG/lossy WebP, contradicts D13/D15).
- **Tests**: fixture photos with GPS, XMP, an MPF/trailer image and orientation 6. Assert no GPS/XMP bytes remain, the pixels decode identically, and the orientation is preserved.

### Request size limits (D15)

- **Browser → backend directly**: the frontend calls `process.env.API_URL` with axios. Next.js isn't in the path, so there's no Next body limit.
- **Django**: `DATA_UPLOAD_MAX_MEMORY_SIZE` (10 MB) **does not count file parts**, so it doesn't block a 20 MB multipart upload. `FILE_UPLOAD_MAX_MEMORY_SIZE` (2.5 MB default) only decides when the file spools to a temp file on local disk. That's fine and needs no change. No Django setting caps the total upload size, so the 20 MB check is done in the view (`UploadedFile.size`). The body has already been received at that point, which is acceptable at 20 MB.
- **gunicorn + uvicorn workers**: no request body limit by default.
- **Azure App Service (Linux)**: the IIS `maxAllowedContentLength` default (≈ 28.6 MB) only applies to Windows plans. For Linux I don't know of a documented body limit below 20 MB, but **this has to be verified**. The hard limit that matters is the front end's **230 s request timeout**: 20 MB at 1 Mbit/s mobile upload takes ~160 s. **Ops checks before go-live**: (1) a 20 MB upload on staging succeeds; (2) whether a WAF/Front Door/Application Gateway sits in front of the backend (WAF body inspection and file-upload limits would need configuring); (3) the blob container's public access level is **"Blob" and not "Container"**: "Container" would allow listing all blobs and expose every original (D14); (4) `AZURE_URL_EXPIRATION_SECS` stays unset: SAS-signed URLs would be frozen into the HTML and expire.

### Sanitiser (`backend/climateconnect_api/utility/html.py`) (AC 9, D14, D20, D21)

- **Allowlist additions**: tags `figure`, `figcaption`, `img`. Attributes: `figure`: `class`; `img`: `src`, `srcset`, `sizes`, `alt`, `width`, `height`, `data-image-id`, `loading` (value `lazy` only, D28); `figcaption`: none.
- **Post-filters** (after bleach, like `_filter_non_youtube_iframes`):
  - `<img>` is kept only if `data-image-id` is a positive integer **and** `src` and every `srcset` URL start with the platform's storage base URL plus `rich_text_images/`. bleach checks URL protocols on `src` but **not on `srcset`**, so this filter is required. Anything else, including data URLs, is removed.
  - `class` on `figure` keeps only the allowlisted tokens (3 sizes, 3 alignments). bleach doesn't filter class values.
- **`sanitize_html` stays pure** (no database, no user). It's the defence in depth for every caller.
- **Canonicalisation (recommended, part of the new "resolve description images" step, not of `sanitize_html`)**: for each `<img data-image-id>`, load the image. If it doesn't exist or the linking rule fails (saving user isn't the owner **and** the image has no usage for this entity, D19), drop the whole `<figure>`. Otherwise **rewrite `src`, `srcset`, `width`, `height` from the database** and keep only `alt`, `sizes` and the classes from the client. So the stored URLs are always server-generated, and a manipulated `srcset` can't get through even if it matched the host. Parsing uses the stdlib HTML parser (bleach's html5lib is vendored). No new dependency.

### Where the checks and the sync hook in (D2, D17, D23)

| Path | Today | Change |
|---|---|---|
| Create, `CreateProjectView.post` (`project_views.py`, `@transaction.atomic`) | Sanitises `description_html` and each translation's `description_html` | Run the **resolve step** (canonicalise + linking rule + **max 10 per language version**) on the original and on each translation in `request.data["translations"]`, **before** `get_project_translations` (DeepL) and `create_new_project`. After the project and its translations are saved: **usage sync**. |
| Edit, `ProjectAPIView.patch` | **Not atomic**. Sets the fields, checks 20 000/4 000, sanitises, `project.save()`, then `edit_translations(...)` | Run the resolve step on `description_html` **and on every `translations[lang].description_html` up front, before `setattr`/`save`**. Today a translation is only sanitised inside `edit_translation`, after the project has been saved, so a validation error there would leave a half-saved project. After `edit_translations`: usage sync. Leave the view non-atomic (wrapping it would hold the transaction open across DeepL calls). The sync is idempotent and repairs itself on the next save. |
| Translations, `climateconnect_api/utility/translation.py` (`edit_translations`, `edit_translation`) | Sanitise manual translations. DeepL output from the (sanitised) original is stored as is. | **No structural change.** The values arrive already canonicalised by the view, and the existing `sanitize_html` calls pick up the new allowlist. DeepL output keeps the original's images (D23). These functions are shared with organisations and user profiles: keep the image step out of them. |
| Create helper, `organization/utility/project.py` (`create_new_project`) | Stores `data["description_html"]` | No change: receives the canonicalised value. |
| `TranslateManyTextsView` (DeepL preview for the translation editor) | Returns DeepL HTML to the client | No change: the result is resolved when the client saves it. |
| Management command `project_translation` and Django admin editing of `description_html` | Write HTML directly | Not hooked (no sync). Acceptable: the command only copies the original's images; the admin is a known bypass of the sanitiser today. |

- **Usage sync** = one function per (entity, field). It reads the **persisted** HTML of the original and all translations, collects the `data-image-id`s, then creates the missing usage rows and deletes the rows for ids that no longer appear. Reading the persisted state, not the request, makes it correct for partial PATCHes and for translations that weren't sent.
- **Limit check**: count `<img data-image-id>` after canonicalisation, per language version. Over 10 → `400` with a clear message, before anything is written (AC 2).
- **The 4 000-character text check** (regex tag strip) counts caption text and doesn't count alt text. That matches the editor's CharacterCount, which also counts caption text (inline content) and not attributes. The translation paths have **no** 20 000/4 000 checks today. Apply both to every language version in the resolve step.

### 20 000-character cap (Constraints)

**Recommendation: keep 20 000.** Measured with a realistic markup (`<figure class="…3 tokens…"><img src srcset(2 URLs) sizes width height alt data-image-id><figcaption>`) and a realistic Azure URL of 155 characters (`https://<account>.blob.core.windows.net/<container>/rich_text_images/<40 hex>.webp`):
- one image without alt/caption: **~670** characters; with 125-character alt and a short credit caption: **~850**;
- 10 images: **6 700–8 500**; plus a full 4 000-character text with formatting and links (≈ 5 000 HTML): **≈ 13 500** total;
- with 255-character alt texts on all 10 images: **≈ 14 800**.

This only holds if alt text has a length limit (alt text isn't counted anywhere today). See **N2**. Excluding image markup from the cap would mean parsing twice and gains nothing. Raising the cap isn't needed.

### DeepL and alt text / captions (D20, D21, D23)

- **Captions** (`<figcaption>` text) are element content and are translated with `tag_handling=html`. The `<img>` tags and their attributes (`src`, `srcset`, `data-image-id`) pass through unchanged.
- **Alt text**: to my knowledge DeepL's HTML handling **does not translate attribute values** (`alt`, `title`). I couldn't verify this against the live API (no call made, to avoid using the account). **Verify in the PoC with one call.** If confirmed, automatic translations keep the alt text in the source language, which **contradicts D21** ("alt text … must be translated like captions"). See **N1**.

### Variant widths vs the real column (D13)

- **Description column**: `TabContentContainer` is an MUI `Container` (max width `lg` = 1200 px) with 16 px padding. That puts the column at **≤ 1 168 CSS px** on wide screens, inside the 80 % main column when "similar projects" is shown. On phones it's 328–398 CSS px.
- **What gets used**: phones at DPR 2–3 → 656–1 194 device px → mostly the **1200** variant. Desktop at 1×: 1200 covers full width. Retina desktop at full width would want ~2 300 px. But the **max height of 60–70 vh** (D11) limits landscape images: a 3:2 image on a 900 px tall viewport renders ≈ 880 px wide, which 1200 covers at ~1.4×. Small/medium on desktop pick 600 at 1×.
- **Recommendation: keep 600/1200** (same as #2349, decided D13). Panoramas at full width on retina desktops are slightly soft. Note: adding a larger variant later means rewriting the stored `srcset` (URLs are frozen in the HTML, D14) or switching to render-time expansion. The `data-image-id` keeps that possible.
- **PoC hint (gotcha)**: with `srcset` + `w` descriptors, the browser computes the image's intrinsic size as *variant width ÷ density*. So "never upscale" must come from the **`width` attribute** (natural size, see the endpoint), and presets work best as **max widths** (`min(preset %, width attribute)`), not as fixed widths. `width` + `height` attributes with `height: auto` also prevent the layout jump (AC 7). `sizes` per size class, e.g. full: `(max-width: <mobile bp>) 100vw, 1168px`.

### Frontend

- **Image node**: `@tiptap/extension-image` renders a bare `<img>` (no `figure`/`figcaption`, no `srcset`/`sizes`/`data-*`, and its resize writes pixel sizes). So: a **custom block node built on `@tiptap/core`** (MIT, D5), modelled on Tiptap's figure example. `renderHTML` → `figure.<classes> > img + figcaption`, and an empty caption renders no `figcaption`. `parseHTML` matches only `figure` containing `img[data-image-id]`. Attributes: image id, src, srcset, sizes, width, height, alt, size (default full), align (default centre) (D12). Caption = the node's content. Plain text only, no marks (D27).
- **Paste (D22)**: no plain image node is registered, so ProseMirror drops a pasted `<img>` without `data-image-id` automatically. A pasted figure from another platform page is kept in the editor and dropped by the server if the linking rule fails.
- **Bubble menu (D10)**: mui-tiptap's `ControlledBubbleMenu` (already used through `LinkBubbleMenu`, no new dependency), shown when the image node is selected: size S/M/Full, align L/C/R, edit alt text, remove. The missing-alt reminder icon (D21) is shown on the node.
- **Upload state (D16)**: recommendation: **dialog-based** upload (pick file → client checks type/size → dialog with preview, alt-text field with the one-line hint, progress → insert the node only on success). This keeps placeholder nodes and broken images out of the HTML (AC 1). Close during upload → the upload finishes as an unused image (D16). The editor counts image nodes on update and disables the button at 10 (D2).
- **Where**: the node, upload dialog, bubble menu and upload API call go into **`frontend/src/components/richText/`** (reusable, D3). `ProjectDescriptionEditor.tsx` registers the node, adds the toolbar button next to YouTube and gets a new optional callback prop, e.g. "uploading changed". The forms that own a save button use it to block saving: `EditProjectContent.tsx`/`EditProjectRoot.tsx`, `EnterDetails.tsx`/`ShareProjectRoot.tsx`, `TranslateProject.tsx`, `TranslateTexts.tsx`. New texts (en/de) for button, dialog, hint, errors (`code`s) and limit messages.
- **Rendering**: `ProjectContent.tsx` keeps `dangerouslySetInnerHTML`. The image CSS (figure classes, max height, mobile rule D11) goes into **one shared style object** used by both the editor's `RichTextFieldProps.sx` and `projectDescriptionStyles`, so they can't drift (WYSIWYG, AC 8).
- **Frontend upload call**: `FormData` through axios (`apiRequest` passes the payload through). The browser sets the multipart boundary. No `Content-Type` override.

### Dependency and merge order with PR #2349 (D7, D13)

- **What is actually reused**: only the pure Pillow helpers in `climateconnect_main/utility/images.py` (`decode_image`: orientation + mode normalisation; `encode_webp_variant`: no upscaling, q80/m6), and the conventions: storage-agnostic I/O, paths not URLs in JSON, deleting files on commit.
- **What doesn't fit**: #2349's orchestration (`IMAGE_VARIANT_CONFIGS`, `ImageVariantsModelMixin`, pre/post-save change detection, `image_variants` per model, the Celery tasks, backfill/repair) is built for **replaceable image fields on existing models**. A RichTextImage is written once and never replaced, so none of that is needed. Two small adaptations: `decode_image` must not log user errors as Sentry errors (validate first, or a raising variant), and the variant naming must not derive from the original's name (see storage names).
- **State (2026-11-19)**: #2349 is merged into the PoC branch `poc-image-description` (be9f3da92), not into `master`. The new migration therefore depends on `organization` `0151_organization_image_variants_project_image_variants`.
- **Recommended order**: **merge #2349 into `master` first**, then create the implementation branch from `master`. The helpers and migration 0151 are then on `master`, and the image PR doesn't carry #2349's diff. If #2349 stalls, extract `images.py` into a tiny separate PR rather than copying it (no parallel Pillow pipeline, Constraints).

### Docs to update during implementation

`doc/domain-entities.md` (two entities), `doc/api-documentation.md` (endpoint, errors, throttle), `doc/architecture.md` (synchronous image processing in the upload request, metadata stripping, rich-text image storage).

### `doc/mosy/` impact (applied; describes the state after implementation)

- `doc/mosy/entities/system-entities.md`: new section "Rich-Text Images" with RichTextImage and RichTextImageUsage; Project and User relationships extended.
- `doc/mosy/flows/core-flows.md`: new flow 12 "Rich-Text Image Upload and Usage Flow"; flow 2 step 2 references it.
- `doc/mosy/architecture_overview.md`: unchanged (no new actor or external service). No sequence-diagram file and no OpenAPI/AsyncAPI spec (same practice as flows 5–11; `doc/mosy/` has none).

### Not affected

Project JSON payload and its base64 header images, `DATA_UPLOAD_MAX_MEMORY_SIZE`, Celery (v1), project listing/preview serializers, organisation and user-profile save paths (until they get images), the project ranking (only checks that a description exists).

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Upload processing blocks an ASGI worker's sync thread | Slower responses for other requests on that worker during uploads | Pixel limit, JPEG draft decoding, throttle. Measure on staging; Celery fallback behind the same contract. |
| Request body / timeout limits in front of Django | 20 MB uploads fail in production only | Staging test with a 20 MB file; WAF/Front Door check; 230 s timeout documented. |
| Public container listing or SAS URLs | Originals exposed / images break when the SAS expires | Ops checks (3) and (4) above. |
| HTML written outside the hooked paths (admin, commands) | Missing usage row → an image counts as unused → deleted on account deletion | Accepted for v1. The cleanup job (follow-up) must re-parse the HTML before deleting anything. |
| Alt text not translated by DeepL | Auto translations show source-language alt text | N1. |

### Decisions for Harald (new, not covered by D1–D24)

- ~~**N1. Alt text in automatic translations.**~~ Provisionally decided (D29): option b, no extra handling; check DeepL behaviour in the PoC, then decide finally.
- ~~**N2. Max length for alt text.**~~ Decided: **150 characters** (D25).
- ~~**N3. Pixel limit for decode-bomb protection.**~~ Decided (D26): JPEG about 110 MP with reduced-scale decoding, PNG/WebP about 40 MP, one upload at a time, no browser resize.
- ~~**N4. Caption formatting.**~~ Decided (D27): plain text only in v1.
- ~~**N5. `loading="lazy"` on description images.**~~ Decided (D28): yes, allowlisted in the sanitiser.
- ~~**N6. Merge order.**~~ Decided (D30): #2349 first; split `images.py` out only if #2349 testing fails.
- ~~**N7. Ops verification owner.**~~ Decided (D31): container level, URL expiry and Front Door checked; 20 MB upload and timeout go into staging testing.

### Concerns about decisions (not reopened, flagged)

- **D13 "reuse the PR #2349 pipeline"** holds for the Pillow helpers only. The variant orchestration of #2349 doesn't fit a write-once image model. This isn't a problem, but it means less reuse than D13's wording suggests.
- **D14 "original never linked publicly"** depends on two things outside the spec: independent variant names (see storage names) and a blob container without public listing (ops check 3).
- **D18 "account deletion"**: there is no account deletion feature in the API today, so the rule only applies to admin deletions until one exists. The usage table is only correct for HTML written through the hooked save paths (see risks).
- **D21 alt-text translation** probably needs extra work (N1).

---

## Implementation notes (backend, 2026-11-19)

Choices made while building, within the decisions above:
- **CSS classes** on `<figure>`: `image-size-small|medium|full` and `image-align-left|center|right`. The server fills in the defaults (`image-size-full image-align-center`, D12) when a class is missing.
- **`variants`** is stored as a JSON **list** of `{name, width, height}`, smallest first (not a dict keyed by width), because a small original has only one variant and a 900 px original has 600 and 900.
- **`sizes`** comes from the editor (validated: allowed characters, max 200 chars); `100vw` if missing or invalid. The exact values are set in the frontend PoC.
- **Alt text** longer than 150 characters is shortened on the server for every save, not only for DeepL output (D25). The editor's counter prevents it for normal input.
- **Captions** are made plain text on the server (tags stripped, whitespace collapsed), D27.
- **`decode_image`** (#2349) was split into a raising `decode_image_or_raise(source_bytes, draft_size=None)` and the existing logging wrapper, so upload errors are 400s and not Sentry errors. #2349 behaviour is unchanged (its tests pass).
- **Linking rule** check uses the image's owner or an existing usage in the same project and field. An image used only in another project can't be copied into this one.

## Implementation notes (frontend, 2026-11-19)

- **Files**: `frontend/src/components/richText/` → `RichTextImageExtension.ts` (Tiptap node, MIT `@tiptap/core`), `RichTextImageView.tsx` (in-editor view with the menu), `RichTextImageUploadDialog.tsx`, `richTextImageUpload.ts` (API call, client checks), `richTextImageStyles.ts` (shared display rules). Wired into `ProjectDescriptionEditor.tsx`; `ProjectContent.tsx` uses the shared styles. Texts in `general_texts.json` (`rich_text_image_*`) so other editors can reuse them.
- **Contextual menu (D10)** is rendered inside the image's node view when the image is selected (click on the image), not as a floating bubble menu. Size S/M/L, alignment, edit alt text, remove. It stays open while changing several settings.
- **Save blocking (D16)** is achieved by the upload dialog: it stays open for the whole upload (upload progress, then "Processing image…") and can only be left with Cancel, which aborts the request. So the form's save button can't be reached during an upload, and the four forms needed no changes.
- **Display values (D11, first PoC values)**: max height `65vh`; small = 33 %, medium = 50 % of the column; below MUI `sm` (600 px) small and medium are full width. The natural size comes from the `width`/`height` attributes (never upscaled); a height-capped image uses `object-fit: contain` with `object-position` following the alignment.
- **`sizes`** per size: full `(max-width: 600px) 100vw, 1168px`, medium `… 584px`, small `… 390px`.
- **Gotchas found while testing**: mui-tiptap's `.ProseMirror img { max-width: 100% }` overrides plain `figure img` rules, so the image rules target `img[data-image-id]`. Inserting while an image is selected, or while the cursor is in an image's caption (which is where it lands right after inserting), replaced that image; the insert command now adds the new image after that block.
- **Verified in the browser** (local dev, 2026-11-19): upload with progress, insert, size/alignment, caption, alt reminder, save → canonical HTML and usage rows, GPS/camera data removed from the original, reload round-trip, project page on desktop and at 500 px width.

## Next Steps (workflow)

1. ~~Harald reviews the problem statement and decides Q1–Q13~~ (done 2026-11-19, D1–D24).
2. ~~System impact analysis (Archie)~~ (done 2026-11-19); follow-up decisions N1–N7 taken (D25–D31).
3. **IMPLEMENTATION** on `poc-image-description` (contains PR #2349), iteratively and to production standards (D32): backend model, endpoint, sanitiser, save-path hooks; frontend figure node, upload dialog, contextual menu, display CSS. Tune display values and check the PoC list (incl. DeepL alt text, large-original uploads) along the way; record findings here.
4. Staging tests incl. 20 MB upload and timeout (D31). PR against `master` after #2349 is merged (D30).

---

## Log

- 2026-07-08: Draft created.
- 2026-11-19: Refined after Harald's feedback. URL insert out of scope (D1). Max 10 images per description, enforced on client and server (D2). v1 = project description, reusable design (D3). Separate upload endpoint (D4). Display, storage and upload questions written up as options with recommendations (Q1–Q12). Searched for the earlier PoC: none exists (Q13). Added PoC plan. Captions, alt text, paste/drop, translation editor and quota moved to explicit decisions.
- 2026-11-19: Added alignment of the image block (left / centre / right) to the v1 scope (Harald). Q4 widened to default alignment, mobile behaviour and control.
- 2026-11-19: Q1 decided: block images only (D8).
- 2026-11-19: Q2 decided: three preset sizes as CSS classes (D9), contextual menu for size and alignment (D10).
- 2026-11-19: Q3 decided: max height + small/medium full width on mobile (D11); values tuned in the PoC.
- 2026-11-19: Q4 decided: default centre + full (D12). Display questions Q1–Q4 settled; values tuned in the PoC.
- 2026-11-19: Q5 decided: keep the original, server WebP variants via the #2349 pipeline, no client downscaling (D13). Q13 decided: start from scratch, PoC branch from the #2349 branch (D7). Q7 reopened for max file size and EXIF/GPS privacy of originals.
- 2026-11-19: Q6 decided: `srcset` in stored HTML + image id data attribute, 1200 px WebP as `src` fallback, sync generation for the PoC (D14).
- 2026-11-19: Q7 decided: JPEG/PNG/WebP, 20 MB, decode-bomb protection, metadata (GPS) stripped from stored originals (D15).
- 2026-11-19: Q8 decided: upload immediately, uploading state blocks form save (D16).
- 2026-11-19: Q9 decided: upload without parent; on save parse image ids to link and unlink (D17).
- 2026-11-19: Q10 decided: keep unused images in v1, cleanup follow-up; project delete unlinks; account delete keeps linked, deletes parentless (D18).
- 2026-11-19: Q11 decided: image owned by uploader (user-level, licensing reasons); usage table for where it is used (D19).
- 2026-11-19: Q12a decided: captions in v1 (D20). Q12b: alt text in v1 (D21).
- 2026-11-19: Q12b decided: alt text optional with a nudge (D21).
- 2026-11-19: Q12c decided: paste / drag & drop out of scope, follow-up; external images removed on paste in v1 (D22).
- 2026-11-19: Q12d decided: translation editor identical to the original editor, images may differ per language, max 10 per language version (D23, D2 updated).
- 2026-11-19: Q12e decided: 20 uploads per user per hour, Sentry alert per throttled user (D24). All brainstorm questions Q1–Q13 decided.
- 2026-11-19: System impact analysis by Archie (model, endpoint, sync variant generation, metadata stripping, size limits, sanitiser, save-path hooks, length cap, DeepL, column widths, frontend, merge order). New decisions N1–N7 open for Harald. `doc/mosy/` updated (entities section 9, flow 12).
- 2026-11-19: N2 decided: alt text max 150 characters (D25).
- 2026-11-19: N3 decided: JPEG 110 MP with reduced-scale decoding, PNG/WebP 40 MP, sequential uploads (D26).
- 2026-11-19: N4 decided: captions plain text (D27).
- 2026-11-19: N5 decided: lazy loading, sanitiser allows `loading="lazy"` (D28).
- 2026-11-19: N1 provisionally decided: no extra alt-text translation step; DeepL check in the PoC (D29).
- 2026-11-19: N6 decided: #2349 merges first, fallback split (D30).
- 2026-11-19: N7 done: Azure checks (container Blob, no URL expiry, no Front Door); 20 MB upload + timeout in staging testing (D31). All N1–N7 decided (N1 provisional until PoC).
- 2026-11-19: D32: the PoC is the production implementation, built iteratively to production standards.
- 2026-11-19: D14 confirmed: synchronous variant generation; reuse of #2349 limited to helpers; independent variant names; validate before decode.
- 2026-11-19: Upload dialog shows upload progress, then "Processing image…" (D16, AC 1). Variants stay at 600/1200 (D13).

- 2026-11-19: Backend implemented (model, migration 0104, upload endpoint, metadata stripping, sanitiser, resolve step, usage sync, docs). Implementation notes added.
- 2026-11-19: Frontend implemented and tried in the browser; frontend implementation notes added.
- 2026-11-19: PoC check: DeepL leaves `alt` untranslated (confirmed by Harald on a real project). N1 final decision pending.
- 2026-11-19: Create, edit, translation and delete flows tested in the browser with a real test user; fixed image replacement when inserting with the cursor in a caption.
- 2026-11-19: `/api/translate_many/` translates fields listed in `html_keys` as HTML; TranslateTexts and TranslateProject send the description as HTML. DeepL comparison recorded under the PoC check.
