# Fix `RangeError: Invalid Date` in TimeSlotFieldEditor

**Status**: DRAFT
**Type**: Frontend — bugfix
**Date created**: 2026-08-18

**Sentry**: [CLIMATEHUB-FRONTEND-1V](https://climate-connect-ggmbh.sentry.io/issues/CLIMATEHUB-FRONTEND-1V)

**Depends on**:
- `frontend/src/components/shareProject/TimeSlotFieldEditor.tsx`
- `frontend/src/components/general/DatePicker.tsx`
- MUI `DateTimePicker` (`@mui/x-date-pickers`)

---

## Problem Statement

When a user edits a time slot's end date on the event registration form and selects/enters a date that is **before the start date**, the application crashes with `RangeError: Invalid Date`. The error originates at `TimeSlotFieldEditor.tsx:106` where `.toISOString()` is called on an invalid Dayjs object.

### Root cause

MUI's `DateTimePicker` enforces a `minDateTime` constraint (set to the start date) via its character-editing pipeline (`applyCharacterEditing` → `updateSectionValue` → `publishValue`). When the user enters a value that violates this constraint, MUI fires `onChange` with an **invalid Dayjs object** — not `null`, but an object where `isValid()` returns `false`.

The handler code only checks for null:

```typescript
// TimeSlotFieldEditor.tsx:106
return { ...o, [field]: value ? value.toISOString() : null };
//                             ^^^^ truthy — invalid Dayjs is an object
```

Since the invalid Dayjs object is truthy, it passes the `value ?` check and `.toISOString()` throws.

### Data flow

```
User types end date before start date
  → MUI DateTimePicker (minDateTime constraint violated)
    → onChange fires with invalid Dayjs object
      → DatePicker.tsx:44 — handleChange(value) passes it through unvalidated
        → TimeSlotFieldEditor.tsx:207 — handleOptionDateTimeChange(index, "end_time", value)
          → Line 106: value.toISOString() 💥 RangeError: Invalid Date
```

### Impact

- **60 occurrences** in 23 minutes from a single user actively editing (2026-08-17 13:30–13:53 UTC)
- **1 affected user** (DE, Limburg an der Lahn, locale `de-DE`)
- **Page**: `/projects/[projectId]` (project edit page, event type)
- **Severity**: error (unhandled, Sentry `auto.browser.global_handlers.onerror`)
- **Status**: unresolved, escalating

### Secondary issue: `maxDateTime` not enforced on DateTimePicker

`DatePicker.tsx:67-71` creates `dateTimePickerArgs` with only `minDateTime` but omits `maxDateTime`. The `maxDate` prop passed from `TimeSlotFieldEditor` (line 217: `maxDate={eventEndDate}`) is silently dropped for the `enableTime=true` variant, meaning users can select end times after the event end date without any constraint.

```typescript
// DatePicker.tsx:67-71
const dateTimePickerArgs = {
    ...commonArgs,
    value: dateValue,
    minDateTime: minDayjsDate,
    // ← maxDateTime is missing
};
```

---

## User Stories

- As an event organizer editing time slots, I want the end date picker to reject dates before the start date without crashing the page.
- As an event organizer, I want clear feedback when I enter an invalid end date (e.g., before the start date) rather than a blank crash.
- As an event organizer, I want the end date/time picker to also enforce the event's end date as a maximum constraint.

---

## Acceptance Criteria

1. **No crash on invalid date input**: Entering an end date before the start date (or any other date that MUI flags as invalid) does not produce `RangeError: Invalid Date`. The invalid value is handled gracefully.
2. **Invalid dates treated as empty**: An invalid Dayjs value from the picker is treated as `null` (not persisted to the options array).
3. **`maxDateTime` enforced**: The end time `DateTimePicker` respects the `maxDate` constraint (event end date) by passing `maxDateTime` in `dateTimePickerArgs`.
4. **Existing tests still pass**: All tests in `TimeSlotFieldEditor.test.tsx` continue to pass.
5. **New test coverage**: Tests cover the scenario where `handleOptionDateTimeChange` receives an invalid Dayjs object (does not crash, stores `null`).

---

## Non-Goals

- Adding user-facing validation messages for "end date must be after start date" (that is a UX enhancement, separate from this crash fix).
- Changing MUI's `DateTimePicker` behavior or replacing the picker component.
- Fixing date validation across other date picker usages in the app (scope limited to `TimeSlotFieldEditor` / `DatePicker`).

---

## Suggested Scope of Changes

### 1. `TimeSlotFieldEditor.tsx` — primary fix (line 106)

Add `isValid()` guard before calling `.toISOString()`:

```typescript
// Before:
return { ...o, [field]: value ? value.toISOString() : null };

// After:
return { ...o, [field]: value && value.isValid() ? value.toISOString() : null };
```

This is the minimal fix that prevents the crash. Invalid Dayjs values from MUI will be stored as `null`, which the existing UI already handles (empty date field).

### 2. `DatePicker.tsx` — defense in depth (line 43)

Filter invalid values before forwarding to the parent handler:

```typescript
// Before:
const handleDateChange = (value) => {
    handleChange(value);
};

// After:
const handleDateChange = (value) => {
    handleChange(value?.isValid?.() ? value : null);
};
```

This prevents any `DatePicker` consumer from receiving an invalid Dayjs object.

### 3. `DatePicker.tsx` — secondary fix (line 67-71)

Add `maxDateTime` to `dateTimePickerArgs`:

```typescript
const dateTimePickerArgs = {
    ...commonArgs,
    value: dateValue,
    minDateTime: minDayjsDate,
    maxDateTime: maxDayjsDate,  // ← add this
};
```

### 4. `TimeSlotFieldEditor.test.tsx` — new test case

Add a test that calls `handleOptionDateTimeChange` with an invalid Dayjs object and verifies no crash occurs and the option value is stored as `null`.

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/components/shareProject/TimeSlotFieldEditor.tsx` | Add `isValid()` guard on line 106 |
| `frontend/src/components/general/DatePicker.tsx` | Filter invalid values in `handleDateChange` (line 43); add `maxDateTime` to `dateTimePickerArgs` (line 71) |
| `frontend/src/components/shareProject/TimeSlotFieldEditor.test.tsx` | Add test for invalid Dayjs handling |
