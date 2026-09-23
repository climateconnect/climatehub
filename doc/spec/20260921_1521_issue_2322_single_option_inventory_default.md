# Single-option inventory fields default to the only option

**Status**: DRAFT
**Type**: Frontend - feature
**Date created**: 2026-09-21
**GitHub Issue**: [climatehub#2322](https://github.com/climateconnect/climatehub/issues/2322) - When an inventory field of an event registration only has one option select it as default

**Depends on**:
- [frontend/src/components/project/RegistrationInventoryField.tsx](../../frontend/src/components/project/RegistrationInventoryField.tsx) - inventory option select plus quantity input
- [frontend/src/components/project/RegistrationFieldAnswersForm.tsx](../../frontend/src/components/project/RegistrationFieldAnswersForm.tsx) - form state and validation for custom fields
- [frontend/src/components/project/EventRegistrationModal.tsx](../../frontend/src/components/project/EventRegistrationModal.tsx) - registration dialog wiring and payload submission
- [frontend/src/types.ts](../../frontend/src/types.ts) - RegistrationField and RegistrationFieldOption shapes
- [frontend/public/texts/project_texts.tsx](../../frontend/public/texts/project_texts.tsx) - inventory related copy
- [backend/organization/serializers/event_registration.py](../../backend/organization/serializers/event_registration.py) - inventory answer validation reference, no change expected

---

## Problem Statement

Some events offer an inventory with only one kind of item. Example from the issue is balcony solar where only one type of solar module is available. There is still an inventory record, but there is no real choice to make.

Today the guest must still open a dropdown and pick the single entry before the quantity input appears. This was observed on the local example at http://localhost:3000/projects/grad-jetzt-test : opening REGISTER shows the dialog titled Register for Event with the prompt With how many people are you attending plus a dropdown showing Please select an option with the single entry Numbe of people (200 available). Only after picking that entry does the quantity field appear.

The extra selection step adds friction without adding information. It is one more click and one more chance for confusion, especially on mobile and for guests using assistive technology. Guests may wonder whether they missed an alternative when only one row exists.

### Why it matters

- Removes a pointless choice for a common organiser pattern where only one inventory type exists.
- Lets the guest go straight to entering the amount, which is the only real input.
- Keeps the stored answer identical to a manual selection, so reporting and capacity logic stay consistent.

---

## User Stories

- As a guest registering for an event with a single-option inventory field, I want the only option to appear already selected, so I can enter the amount directly without opening a dropdown.
- As an organiser offering only one inventory type, I want guests to see that item as fixed text with a quantity input, so the form looks intentional and not broken.
- As a guest registering on mobile or with a screen reader, I want fewer controls when there is no choice, so the flow is faster and clearer.

---

## Acceptance Criteria

### Single-option display

- [ ] **AC-1**: When an inventory field has exactly one option with a usable id, the guest sees the option title as fixed text instead of a dropdown (no select UI when there is nothing to choose), and the quantity input is visible immediately on modal open without any prior selection.
- [ ] **AC-2**: The fixed text shows the same label the dropdown would have shown, including remaining amount info when present, for example Vegetarian (48 available). No placeholder row such as Please select an option is shown for single-option fields.
- [ ] **AC-3**: Strict count rule: only a field with exactly one option row triggers the single-option UI. A field with two or more option rows keeps the dropdown even when only one of them is still available (remaining_amount > 0) — guests keep seeing which options are sold out, and freed-up capacity from cancellations becomes visible without a UI mode switch.
- [ ] **AC-4**: Validation and submit payload are unchanged apart from the prefilled option. Quantity starts empty (no prefill with 1 — the guest makes a conscious choice). Required single-option field with empty quantity blocks submit with please_enter_quantity. Quantity above min of max_amount_per_guest and remaining_amount blocks submit with quantity_exceeds_max. Optional single-option field with empty quantity submits no answer for that field.
- [ ] **AC-5**: Sold-out single option (remaining_amount == 0) shows fixed text with a sold-out suffix and offers no usable quantity input. Required field: registration cannot be completed (submit blocked for the guest — effectively closed for them). Optional field: guest may still submit with no answer for that field. Server capacity errors still surface per field.
- [ ] **AC-6**: Accessibility and layout match the existing field. Fixed text uses plain text elements, keeps title plus required marker plus description, keeps max per guest helper, and keeps error text placement. No empty select control remains in the accessibility tree for single-option fields.

### State, validation, and payload

- [ ] **AC-7**: The single option id flows through the same answer path as a manual selection. The submitted answer contains field plus value_option equal to the single option id plus value_number equal to the entered quantity, so backend validation, capacity accounting, and reporting treat it exactly like a manual pick.
- [ ] **AC-8**: Client state initializes the option id from the field options when the form mounts, without requiring user interaction. Analytics for first custom field interaction still fire on real user input, not on the automatic default.
- [ ] **AC-9**: A prefilled single option can still become invalid between page load and submit. If the option disappears from the field options or its remaining_amount drops to 0, the fixed text reflects sold out state and submit is blocked client side, or the backend capacity error surfaces as a field error, never as an unhandled state.

### Tests

- [ ] **AC-10**: New or updated Jest tests cover: single-option field renders fixed text with no select element and shows the quantity input immediately; multi-option and zero-option fields keep the dropdown; validate returns the single option id plus entered quantity; required single-option field with no quantity blocks submit; optional single-option field with no quantity submits no answer.

---

## Constraints

- Frontend-only. No backend, API, serializer, migration, or data model changes. The stored answer shape stays field plus value_option plus value_number.
- Preserve the current dropdown behavior for anything that is not exactly one option with a usable id. Zero options and two or more options must render as today.
- Follow the existing validation UI pattern in the registration form: inline fieldErrors plus serverErrors plumbing plus quantity_exceeds_max versus please_enter_quantity copy, not a new mechanism.
- Translation keys must exist in English and German per frontend i18n conventions. Reuse the existing inventory copy where possible.
- Frontend verification must include TypeScript compile plus tests plus lint, since compile errors are common in this area.
- Scope is inventory fields only. Do not change option_select or time_slot_select behavior even when they have one option.

---

## Directional hints

A small frontend branch is enough. Where RegistrationInventoryField renders its native select today, it can render a plain text element with the resolved option label when the sorted options array has length one, keeping the quantity row and error placement the same. Where RegistrationFieldAnswersForm owns the inventory state, it can seed inventoryValues for that field id from the single option id on mount or on fields change, while still resetting quantity when the option id changes. Keep the payload builder untouched so the prefilled answer serializes through the current value_option plus value_number path.

Decided (2026-09-21 review): sold-out single option shows fixed text with a sold-out suffix and no usable quantity input. Required field blocks submit (registration effectively closed for the guest); optional field allows submit with no answer for that field. This mirrors the disabled-option semantics of the dropdown without inventing a separate empty state.

---

## AI Agent Insights and Additions

### Confirmed against current code

- RegistrationInventoryField owns the select plus quantity input split. Quantity only renders after selectedOption resolves, which is why single-option guests currently see a dropdown first and the quantity field only after picking. This is the exact friction in the issue.
- RegistrationFieldAnswersForm owns inventoryValues keyed by field id and builds the value_option plus value_number payload. Any default must land in that state, otherwise the UI can look selected while validate still reports please_select_inventory_option.
- EventRegistrationModal passes the field list and the inventory copy through unchanged, so no modal change is needed beyond what the two components above expose. Backend EventRegistrationSubmissionSerializer already requires value_option plus value_number for inventory, so a prefilled single id satisfies the existing contract with no backend work.

### Watchouts found while reading the code

- Do not count placeholder or disabled rows as choices. Only options with a usable id count toward the exactly-one rule, and a single option with remaining_amount 0 needs the sold out handling in AC-5, not a silent auto-select into an unusable quantity.
- Do not fire the custom field analytics event for the automatic default. RegistrationFieldAnswersForm guards onFirstInteraction with a ref, so seeding state on mount must bypass notifyFirstInteraction and only call it from real change handlers.
- inventoryValues resets quantity to undefined when the option id changes. For a stable single option this is harmless, but the seed logic must not loop-reset quantity on every render or the guest can never complete the field.
- Only inventory gets this treatment. RegistrationOptionSelectField and RegistrationTimeSlotField share the select pattern but are explicitly out of scope, so keep the single-option branch local to the inventory component and its form state.

---

## System impact

### Mosy assessment (Archie, 2026-09-21)

- Actors: Member registering for an event (authenticated guest completing the form). No new actors. Organiser / Team Admin unaffected.
- Action: Register for event with custom inventory answer — existing action, unchanged semantics. Only the presentation of the option choice changes when there is nothing to choose.
- Entities: `RegistrationField`, `RegistrationFieldOption`, `RegistrationFieldAnswer` — no changes. No new attributes, no relationship changes, no migration.
- Flows: No change to `doc/mosy/flows/core-flows.md`. Flow 5 (Event Registration Field Management) is organiser-side field setup and is unaffected. Guest submission is not currently modeled as a Mosy flow, so no flow update is required.
- Technical components and APIs: Guest-facing registration form only. Submission contract unchanged — answer still stored as field plus value_option plus value_number, satisfying the existing backend validation and capacity accounting.
- Metrics: `event_registration_custom_fields_started` unchanged. The automatic default must not count as first interaction; the event still fires on real user input only.
- Produced events: None. Triggered by: existing registration dialog open.

### Backend

- None. No model, serializer, view, migration, or API contract changes.

### Frontend

- Guest-facing inventory presentation only: single-option fields show the option as fixed text with the quantity input visible immediately. Multi-option and zero-option fields keep the current dropdown behavior.

### Mosy doc updates required

- None. No updates to `system-entities.md`, `core-flows.md`, `architecture_overview.md`, or metrics docs. No new flow, entity, or API spec entry.

### Risks

- Low. Strict exactly-one-option rule avoids mode switching for multi-option fields. Main edge is the sold-out single option, already decided in AC-5 (required blocks, optional submits with no answer).

---

## Log

- 2026-09-21 - User review decisions: (1) plain text confirmed — no select UI when there is no choice; (2) quantity stays empty, no prefill — conscious choice; (3) strict exactly-one-option rule, multi-option fields keep the dropdown so sold-out options stay visible and cancellations can free capacity; (4) sold-out single: required blocks registration, optional shows 'sold out' and submits with no answer.
- 2026-09-21 - Spec drafted from GitHub issue climatehub#2322. Current dropdown-first behavior confirmed by reading RegistrationInventoryField and RegistrationFieldAnswersForm and by opening the local example at grad-jetzt-test and clicking REGISTER to see the single Please select an option dropdown before the quantity input. Frontend-only scope set with backend contract unchanged. Awaiting user review before implementation.
- 2026-09-21 17:50 CEST - Archie system impact approved by user. No doc/mosy/ changes required. Archie: analysis complete, returning control to Taskie.
