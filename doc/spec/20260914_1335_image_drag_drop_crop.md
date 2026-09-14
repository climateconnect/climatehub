# Image Drag-and-Drop with Crop Dialog

> **Issue:** [#2240](https://github.com/climateconnect/climatehub/issues/2240) — UX: Allow image upload via drag & drop

## Overview
A user failed to create a new organisation after repeatedly dragging and dropping an image on the create form — the forms had no drop-zones, so the drag was silently ignored. This spec adds drag-and-drop image upload to the existing click-to-upload flow across 3 components, reusing the existing crop dialog with no new dependencies.

**Scope (from issue):** create/edit project, create/edit organisation, edit profile.

## Decisions (locked)
| Area | Decision |
|---|---|
| Drop zone | Overlays existing imageZone div (click-to-upload area) |
| Multi-file | Single-image only (project.image + thumbnail_image) |
| Crop lib | Reuse UploadImageDialog + convertToJPGWithAspectRatio (react-avatar-editor) |
| State mgmt | Local useState in each component + shared useImageDrop hook |
| Edge cases | Invalid types, oversized, corrupt images, non-image drops |

## Existing Code Map

| File | Role |
|---|---|
| `frontend/src/components/shareProject/AddPhotoSection.tsx` | Project cover image (16:9 ratio, generates thumbnail) |
| `frontend/src/components/account/UserAvatar.tsx` | Profile avatar (1:1 ratio, circular, generates thumbnail) |
| `frontend/src/components/account/EditAccountPage.tsx` | Org/profile background image (3:1 ratio, no thumbnail) |
| `frontend/src/components/dialogs/UploadImageDialog.tsx` | Crop dialog (react-avatar-editor, scale slider) |
| `frontend/public/lib/imageOperations.ts` | `convertToJPGWithAspectRatio`, `getResizedImage`, `whitenTransparentPixels` |

All 3 components share the same 4-step pipeline: hidden file input -> convertToJPGWithAspectRatio -> UploadImageDialog -> canvas.toBlob + set state.

## Task List

### 1. Create useImageDrop hook
- File: `frontend/src/hooks/useImageDrop.ts`
- Accepts `onFileSelected: (file: File | null) => void` and optional `maxSize?: number`
- Returns `{ isDragOver, onDragOver, onDragLeave, onDrop }`
- `onDragOver`: preventDefault + setIsDragOver(true)
- `onDragLeave`: preventDefault + setIsDragOver(false)
- `onDrop`: preventDefault + setIsDragOver(false) + extract first file + validate size + call onFileSelected
- If maxSize exceeded, call onFileSelected(null) and let consumer show error
- If no files in drop, no-op

### 2. Add onImageChange error handling (imageOperations.ts)
- Add `image.onerror` reject to convertToJPGWithAspectRatio (currently hangs on corrupt images)
- Wrap caller try/catch to catch reject and show error

### 3. Wire drag-drop into AddPhotoSection.tsx
- Import useImageDrop
- Replace onImageChange to accept File directly (or keep event signature, adapt)
- Add isDragOver state, apply highlight styles to imageZone
- Add onDragOver/onDragLeave/onDrop to imageZoneWrapper div
- Handle oversized file (>10MB): alert before opening dialog
- Handle invalid file types: existing alert(texts.please_upload_either_a_png_or_a_jpg_file)

### 4. Wire drag-drop into UserAvatar.tsx
- Import useImageDrop
- Add isDragOver highlight to avatar container
- Wire onDrop to onImageChanged
- Max size: 5MB

### 5. Wire drag-drop into EditAccountPage.tsx (background image)
- Import useImageDrop
- Add isDragOver highlight to backgroundContainer
- Wire onDrop to onBackgroundChange
- Max size: 15MB

### 6. Validation
- Run `yarn lint` on frontend
- Run `yarn format` on frontend
- Verify no TypeScript errors

## Testing

### Framework
Jest + jsdom + @testing-library/react (already configured in `jest.config.ts`)

### Test files to create

#### 1. `frontend/src/hooks/useImageDrop.test.ts`
Test the hook in isolation using `renderHook` from @testing-library/react.

| Test | Description |
|---|---|
| returns initial state | `isDragOver` is `false` on first render |
| sets isDragOver true on dragOver | calls `onDragOver`, `isDragOver` becomes `true` |
| sets isDragOver false on dragLeave | calls `onDragLeave`, `isDragOver` becomes `false` |
| calls onFileSelected with file on drop | simulates drop with a File, `onFileSelected` receives the file |
| resets isDragOver after drop | `isDragOver` is `false` after drop |
| takes first file when multiple dropped | drops 2 files, `onFileSelected` gets only the first |
| rejects oversized file | drops file larger than `maxSize`, `onFileSelected` receives `null` |
| accepts file exactly at maxSize | drops file equal to `maxSize`, `onFileSelected` receives the file |
| does nothing on empty drop | drops with no files, `onFileSelected` is not called |

#### 2. `frontend/public/lib/imageOperations.test.ts` (extend existing)
Add tests for the `image.onerror` fix in `convertToJPGWithAspectRatio`.

| Test | Description |
|---|---|
| rejects on corrupt image | mock `Image` to fire `onerror`, expect promise rejection |
| resolves on valid image | mock `Image` to fire `onload` with valid dimensions, expect resolved URL |

#### 3. Component tests (one per component)
Create `.test.tsx` files alongside each component, mocking child components (`UploadImageDialog`, `UserAvatar`, etc.) and testing drag-drop behavior:

**AddPhotoSection.test.tsx**
| Test | Description |
|---|---|
| renders upload button | existing click-to-upload button is present |
| opens dialog on click | clicking the button opens `UploadImageDialog` |
| opens dialog on drop | dropping a valid image opens `UploadImageDialog` |
| shows alert on invalid type | dropping a non-image file shows alert, dialog stays closed |
| shows alert on oversized | dropping >10MB file shows alert, dialog stays closed |
| calls handleSetProjectData on crop confirm | existing behavior preserved |

**UserAvatar.test.tsx**
| Test | Description |
|---|---|
| renders avatar in edit mode | avatar + edit icon present |
| opens dialog on drop | dropping valid image opens `UploadImageDialog` |
| shows alert on oversized | dropping >5MB file shows alert |
| calls onAvatarChanged on crop confirm | existing behavior preserved |

**EditAccountPage.test.tsx** (background image)
| Test | Description |
|---|---|
| renders background container | background area present |
| opens dialog on drop | dropping valid image opens `UploadImageDialog` |
| shows alert on oversized | dropping >15MB file shows alert |
| calls setEditedAccount on crop confirm | existing behavior preserved |

### Test patterns to follow
- Use `jest.mock()` to stub child components (`UploadImageDialog`, `UserAvatar`, `TranslateTexts`)
- Wrap in `ThemeProvider` from @mui/material with the project `theme`
- Use `render` + `fireEvent` from @testing-library/react
- For drag events: `fireEvent.dragOver`, `fireEvent.dragLeave`, `fireEvent.drop` with `dataTransfer.files`
- Mock `URL.createObjectURL` and `URL.revokeObjectURL` in jsdom
- Mock `Image` class for `convertToJPGWithAspectRatio` tests

## Edge Cases
| Case | Behavior |
|---|---|
| Non-image dropped | preventDefault, show alert, don't open dialog |
| Oversized file | Alert before opening dialog |
| Corrupt image | image.onerror fires, catch shows error, loading spinner clears |
| Empty drop | No-op |
| Multiple files dropped | Take first file only |
| Dialog open during drag | Loading spinner shows as before |

## Visual Affordance
The issue reports a user repeatedly dragging without success — the drop zone was invisible. The `isDragOver` state must add a visible highlight (border, opacity change, or overlay) so users know:
- The zone accepts drops (drag-over state)
- The drop was accepted (brief flash or dialog opens)

Reference: [mui/mui-x#2901](https://github.com/mui/mui-x/issues/2901) (MUI feature request for drag-and-drop upload, cited in the issue).

## Size Limits Per Form
| Form | Max Size |
|---|---|
| Project cover (AddPhotoSection) | 10 MB |
| Profile avatar (UserAvatar) | 5 MB |
| Org background (EditAccountPage) | 15 MB |