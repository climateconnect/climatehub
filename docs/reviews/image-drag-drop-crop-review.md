# Code Review: Image Drag-and-Drop with Crop Dialog

**Branch:** `image-drag-drop`
**Spec:** [`doc/spec/20260914_1335_image_drag_drop_crop.md`](../../doc/spec/20260914_1335_image_drag_drop_crop.md) ([#2240](https://github.com/climateconnect/climatehub/issues/2240))
**Reviewed against:** `master`
**Date:** 2026-09-15
**Reviewer:** Claude (code-review agent, forked)

---

## Summary

This review covers the session's full diff implementing drag-and-drop and clipboard-paste image upload across the app, on top of the existing click-to-upload flow. The change is additive: a shared `useImageDrop` hook handles drag/paste/keyboard events, and four components wire it in without touching the existing crop-dialog/image-processing pipeline.

The review found 6 real issues — 4 accessibility regressions and 1 maintainability root cause introduced by this session's own changes, plus 1 test/spec coverage gap. All 6 were fixed in the same session; this document records what was reviewed and what changed as a result.

---

## Scope

| Component | File | Role |
|---|---|---|
| Shared hook | `frontend/src/hooks/useImageDrop.ts` | Drag/paste/keyboard handlers, `isDragOver` state |
| Project cover (create) | `frontend/src/components/shareProject/AddPhotoSection.tsx` | 16:9 crop, generates thumbnail |
| Profile avatar | `frontend/src/components/account/UserAvatar.tsx` | 1:1 circular crop, generates thumbnail |
| Org/profile background | `frontend/src/components/account/EditAccountPage.tsx` | 3:1 crop, no thumbnail |
| Project cover (edit) | `frontend/src/components/editProject/EditProjectOverview.tsx` (`InputImage`) | 16:9 crop, generates thumbnail — a separate, near-duplicate implementation from `AddPhotoSection`, missed in the first pass and added after the user reported edit-project didn't work |
| Image processing | `frontend/public/lib/imageOperations.ts` | `image.onerror` fix so a corrupt file rejects instead of hanging |

Also reviewed: the corresponding `.test.tsx`/`.test.ts` files for all of the above, and the spec document itself.

---

## Issues

### [ACCESSIBILITY] Focused drop zone loses its keyboard equivalent once an image is set

**Files:** `frontend/src/components/account/UserAvatar.tsx`, `frontend/src/components/account/EditAccountPage.tsx`

Both components made their drop zone `tabIndex={0}` and paste-active unconditionally (correct — paste should be able to replace an existing image), but gated `onKeyDown`, `role`, and `aria-label` on "no image set yet":

```tsx
<div
  tabIndex={0}
  onPaste={onPaste}
  onKeyDown={avatarImage.imageUrl ? undefined : onZoneKeyDown}
  role={avatarImage.imageUrl ? undefined : "button"}
  aria-label={avatarImage.imageUrl ? undefined : texts.edit_avatar}
  ...
>
```

**Problem:** Once an avatar/background image exists, the zone is still in the tab order (paste must keep working) but Enter/Space do nothing and it has no accessible name — a keyboard-only user has no discoverable way to replace an existing image, contradicting the spec's own AC8 ("must support Enter/Space as a click-equivalent").

**Fix applied:** Made `onKeyDown`/`role`/`aria-label` unconditional in both components. Mouse-click behavior was left untouched (it already had its own reason to be gated — a mouse click on the container needs to not fire when the click actually landed on the overlaid remove-icon; Enter has no such ambiguity).

---

### [ACCESSIBILITY] Drop-zone wrapper duplicates an already-accessible native button

**Files:** `frontend/src/components/shareProject/AddPhotoSection.tsx`, `frontend/src/components/editProject/EditProjectOverview.tsx`

These two components' drop zone wraps a real, already-focusable MUI `<Button>` (the "Upload Image" / "Change Image" button). The zone div was given `tabIndex={0}`, `role="button"`, `aria-label`, and its own `onKeyDown`:

```tsx
<div tabIndex={0} role="button" aria-label={...} onKeyDown={onZoneKeyDown} ...>
  ...
  <Button onClick={onUploadImageClick}>Upload Image</Button>
</div>
```

**Problem:** Two consecutive tab stops (the outer div, then the inner button) both trigger the same file picker — a nested-interactive-element ARIA anti-pattern that's confusing for keyboard and screen-reader users.

**Fix applied:** Removed `role`, `aria-label`, and `onKeyDown` from the outer zone in both components, keeping only `tabIndex={0}` (still required so the zone can receive a paste event) and `onPaste`. The real `<Button>` remains the sole, correctly-labeled keyboard target.

---

### [MAINTAINABILITY] Keyboard-equivalence handler duplicated across all 4 components

**File:** `frontend/src/hooks/useImageDrop.ts`

The spec's own "Decisions" table says drag/paste logic belongs in the shared hook, but the Enter/Space-triggers-click handler was copy-pasted verbatim into `AddPhotoSection`, `UserAvatar`, `EditAccountPage`, and `EditProjectOverview` instead of living in `useImageDrop` alongside `onDragOver`/`onDragLeave`/`onDrop`/`onPaste`.

**Problem:** This is exactly how the first two findings' inconsistency happened — a fix applied to three call sites and missed on the fourth would have gone unnoticed.

**Fix applied:** Added an optional `onActivate` option to `useImageDrop`, and the hook now returns `onKeyDown` (fires `onActivate` on Enter/Space, no-op if `onActivate` wasn't passed). `UserAvatar` and `EditAccountPage` pass `onActivate` and wire `onKeyDown` unconditionally; `AddPhotoSection` and `EditProjectOverview` omit `onActivate` entirely (per the previous finding, their zone shouldn't be a keyboard target). The four local `onZoneKeyDown`/`onBackgroundZoneKeyDown` copies were deleted.

---

### [TEST-COVERAGE] AC8's "paste non-image is a no-op" case only tested for one of four components

**File:** `doc/spec/20260914_1335_image_drag_drop_crop.md`, and the corresponding `.test.tsx` files

The spec's own component-test tables (and the tests actually written) only listed/verified "pasting non-image clipboard content is a no-op" for `AddPhotoSection`; `UserAvatar`, `EditAccountPage`, and `EditProjectOverview` had no equivalent test.

**Problem:** A regression that made one of the other three components mishandle a non-image paste (e.g. show an error, as with an invalid drop) would have gone undetected.

**Fix applied:** Added the missing test to all three, plus regression tests locking in the two fixes above:
- `UserAvatar`/`EditAccountPage`: a new test asserting Enter still opens the file picker when an avatar/background image is already set (directly regression-tests the first finding).
- `AddPhotoSection`/`EditProjectOverview`: a new test asserting the zone is `tabIndex={0}` but *not* `role="button"`, and that there is exactly one "Upload Image" button in the zone (regression-tests the second finding).
- The shared hook got direct unit tests for the new `onActivate`/`onKeyDown` API (Enter, Space, other keys ignored, safe no-op when `onActivate` isn't passed).

Spec updated: AC8 now documents the two drop-zone patterns explicitly (zone-triggers-picker vs. zone-wraps-a-button) and why they need different keyboard treatment; all four component test tables now list the no-op paste test and a keyboard-access test.

---

## Minor Notes

- The nested-interactive-element issue in `AddPhotoSection`/`EditProjectOverview` is a pattern to watch for generally in this codebase — a `<label htmlFor>` wrapping a visible `<input>` plus a `<Button>` is already a fully keyboard-accessible control; adding `tabIndex`/`role="button"` to an ancestor for an unrelated reason (here, enabling paste) needs to be done carefully to avoid re-announcing the same action twice.
- `EditProjectOverview`'s `InputImage` remains a separate implementation from `AddPhotoSection` rather than a shared component — this was a deliberate choice (see the spec's "What Changes" section) to avoid refactoring beyond what the drag-drop/paste task required, not an oversight.

---

## Verdict

**All findings fixed in this session.** Final state: 881 tests passing across 63 suites, `eslint` clean (only 3 pre-existing, unrelated warnings), `tsc --noEmit` clean. No outstanding action items.
