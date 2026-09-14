# Image Drag-and-Drop with Crop Dialog

> **Issue:** [#2240](https://github.com/climateconnect/climatehub/issues/2240) — UX: Allow image upload via drag & drop

## Overview
A user failed to create a new organisation after repeatedly dragging and dropping an image — the forms had no visible drop-zones, so the drag was silently ignored. This feature adds drag-and-drop as an alternative to clicking to upload images on 3 forms: create/edit project, create/edit organisation, and edit profile.

**Principle:** Drag-and-drop is a convenience layer on top of the existing click-to-upload flow. The crop dialog, image processing, and data model stay exactly as they are. Nothing is replaced — only augmented.

## Acceptance Criteria

### 1. Click-to-upload still works everywhere
Nothing about the existing upload experience breaks. On all 3 forms: clicking to upload, cropping, confirming, thumbnail generation, and removing images all behave exactly as before. This includes the 3 different image types with their different cropping behavior:
- **Project cover** — 16:9 crop ratio, generates a thumbnail
- **Profile avatar** — 1:1 circular crop, generates a thumbnail
- **Organisation background** — 3:1 crop ratio, no thumbnail

### 2. Drag-and-drop opens the same crop dialog
Dragging a valid image onto the form opens the same crop dialog that clicking would open. The crop dialog behaves identically — same ratio, same controls, same result on confirm. The user cannot tell whether the image came from a click or a drag.

### 3. Invalid drops are rejected gracefully
Dropping a non-image file shows an error instead of silently doing nothing. Dropping multiple files uses only the first. Dropping nothing is a no-op.

### 4. Corrupt images don't freeze the UI
A corrupt or truncated image file produces an error and clears the loading state instead of hanging forever.

### 5. Mobile devices are unaffected
Touch devices don't support drag-and-drop, so click-to-upload is the only path on mobile. The drag-drop code must not interfere with tap-to-upload on touch screens.

### 6. Users can see where to drop
While dragging over the upload area, a visible highlight shows it is an active drop target. The highlight disappears when the drag leaves or completes. The drop zone looks different from non-drop areas.

### 7. No new dependencies
No new npm packages. The existing crop dialog (`react-avatar-editor`) and image processing pipeline are reused unchanged.

## Decisions (locked)
| Area | Decision |
|---|---|
| Drop zone | Overlays the existing click-to-upload area on each form |
| Multi-file | Single-image only, matching the existing data model |
| Crop dialog | Reuse the existing `UploadImageDialog` as-is |
| State management | Shared hook for drag-drop logic, local state in each component |
| Size limits | **Not part of this feature** — handled separately (see Out of Scope) |

## What Changes
Three existing components gain drag-drop support by adding a small shared hook that handles drag events. Each component keeps its existing click-to-upload code untouched — the hook is additive.

| Component | Form | Image type |
|---|---|---|
| `AddPhotoSection` | Create/edit project | Cover image (16:9, generates thumbnail) |
| `UserAvatar` | Edit profile | Avatar (1:1 circular, generates thumbnail) |
| `EditAccountPage` | Create/edit organisation, edit profile | Background image (3:1, no thumbnail) |

All three already share the same flow: select file → pre-crop to target ratio → open crop dialog → confirm → store result. The drag-drop change replaces only the first step (how the file is selected).

## Out of Scope
- **File size validation** — enforcing limits is a separate task. The backend already has its own limits (`DATA_UPLOAD_MAX_MEMORY_SIZE`); this feature does not add frontend size checks.
- **New crop libraries** — the existing crop dialog is reused.
- **Multi-file upload** — single-image only.
- **Clipboard paste** — not part of this issue.

## Visual Affordance
The root cause of the original issue was that users could not see where to drop. The drop zone must be visually distinguishable in three states:

| State | Appearance |
|---|---|
| Idle (no drag in progress) | Same as before — the existing upload area looks unchanged |
| Drag-over (cursor is over the zone) | A visible highlight: border, opacity change, or overlay that makes the area stand out |
| After drop | Highlight disappears; the crop dialog opens or the existing error flow runs |

The highlight must not be a CSS `:hover` effect (which only fires on mouse hover, not during a drag). It must respond to actual drag events.

Each of the 3 forms needs its own highlight style appropriate to its layout:
- **Project cover** — highlight the dashed-border image zone
- **Profile avatar** — highlight the circular avatar container
- **Organisation background** — highlight the background image area

## Testing
Tests are derived from the acceptance criteria above. Test files should be created alongside each component.

### Unit tests
- **Shared drag-drop hook** — tests for: initial state, drag-over toggling, drag-leave toggling, drop calls callback with file, drop with multiple files takes first, drop with no files is a no-op
- **Image processing** — tests for: corrupt image rejects instead of hanging, valid image resolves

### Component tests (one per component)
Each component test file covers the relevant acceptance criteria:

**AddPhotoSection (project cover)**
| Test | Covers |
|---|---|
| Renders upload button and click opens dialog | AC1 |
| Clicking to upload and cropping sets the image | AC1 |
| Dragging valid image opens the crop dialog | AC2 |
| Crop confirm sets the image identically to click path | AC2 |
| Dropping non-image shows error, dialog stays closed | AC3 |
| Drag-over highlight appears and disappears | AC6 |

**UserAvatar (profile avatar)**
| Test | Covers |
|---|---|
| Renders avatar in edit mode, click opens dialog | AC1 |
| Clicking to upload and cropping sets the avatar | AC1 |
| Dragging valid image opens the crop dialog | AC2 |
| Crop confirm sets the avatar identically to click path | AC2 |
| Dropping non-image shows error | AC3 |
| Drag-over highlight appears and disappears | AC6 |

**EditAccountPage (organisation background)**
| Test | Covers |
|---|---|
| Renders background area, click opens dialog | AC1 |
| Clicking to upload and cropping sets the background | AC1 |
| Dragging valid image opens the crop dialog | AC2 |
| Crop confirm sets the background identically to click path | AC2 |
| Dropping non-image shows error | AC3 |
| Drag-over highlight appears and disappears | AC6 |

### Mobile test
- On a simulated touch/mobile viewport, clicking the upload area still opens the file picker and the crop dialog (AC5)