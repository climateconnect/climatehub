# Fix crash creating/editing a project when the user has no organizations

**Status**: DRAFT
**Type**: Frontend — bugfix
**Date created**: 2026-09-15
**GitHub Issue**: [climatehub#2286](https://github.com/climateconnect/climatehub/issues/2286) — "Bug: Error when creating and editing a project and user is not in any organisation"
**Assignee (issue)**: fateme-ramezanpour

**Depends on**:
- [frontend/pages/share.tsx](../../frontend/pages/share.tsx) — `getUserOrganizations` (copy 1)
- [frontend/pages/editProject/[projectUrl].tsx](../../frontend/pages/editProject/%5BprojectUrl%5D.tsx) — `getUserOrganizations` (copy 2), `parseProject`
- [frontend/public/lib/organizationOperations.ts](../../frontend/public/lib/organizationOperations.ts) — `getUserOrganizations` (copy 3, already imported elsewhere)
- [frontend/src/components/shareProject/ShareProject.tsx](../../frontend/src/components/shareProject/ShareProject.tsx) — step 1 org toggle/select + "NEXT STEP"
- [frontend/src/components/shareProject/OrganizersContainer.tsx](../../frontend/src/components/shareProject/OrganizersContainer.tsx) — "Add Team" step, renders `MiniOrganizationPreview`
- [frontend/src/components/organization/MiniOrganizationPreview.tsx](../../frontend/src/components/organization/MiniOrganizationPreview.tsx) — crashes on `organization.url_slug` when `organization` is undefined
- [frontend/src/components/editProject/EditProjectContent.tsx](../../frontend/src/components/editProject/EditProjectContent.tsx) — org switch + dropdown on the edit page
- [frontend/src/components/general/SelectField.tsx](../../frontend/src/components/general/SelectField.tsx) — does not currently forward `error`/`helperText`
- [frontend/src/components/dashboard/Dashboard.tsx](../../frontend/src/components/dashboard/Dashboard.tsx) — existing consumer of `organizationOperations.ts`'s `getUserOrganizations`, must not regress

---

## Problem Statement

Users who are not a member of any organization hit uncaught `TypeError`s when creating or editing a project, because `getUserOrganizations()` resolves to `null` (not `[]`) when the user has no organizations, and several call sites index into the result without a null guard.

### Reproduction

**Scenario 1 — create project flow (`/share`)**
1. Log in as a user with no organization memberships.
2. Go to `/share`.
3. Toggle to "Organisation's project" — the organization dropdown is empty (no options).
4. Click "NEXT STEP" — nothing stops the user from proceeding despite no organization being selected.
5. Fill in the required fields and continue to the "Add Team" step.
6. Crash: `TypeError: Cannot read properties of undefined (reading 'url_slug')` in `MiniOrganizationPreview.tsx`.

**Scenario 2 — edit project flow (`/editProject/[projectUrl]`)**
1. Create a project as a personal project (as the same no-org user).
2. Go to `/editProject/[projectUrl]`.
3. Toggle the "Personal project" switch to organization mode.
4. Crash: `TypeError: Cannot read properties of null (reading '0')` in `EditProjectContent.tsx`.

### Root cause (confirmed against current code)

`getUserOrganizations()` is implemented **three times**, and all three return `null` instead of `[]` when the user has no organizations:

- [frontend/pages/share.tsx](../../frontend/pages/share.tsx) lines 151–169
- [frontend/pages/editProject/[projectUrl].tsx](../../frontend/pages/editProject/%5BprojectUrl%5D.tsx) lines 242–260
- [frontend/public/lib/organizationOperations.ts](../../frontend/public/lib/organizationOperations.ts) lines 42–59 (also short-circuits to `null` if there's no auth token)

Downstream code assumes the value is always an array:

- **`EditProjectContent.tsx`**, `handleSwitchChange` (~line 133): when toggling from personal to organization mode, it falls back to `project?.project_parents?.parent_organization ?? userOrganizations[0] ?? null`. If `userOrganizations` is `null` (not `[]`), `userOrganizations[0]` throws `Cannot read properties of null (reading '0')` — this is the exact crash in Scenario 2.
- **`EditProjectContent.tsx`**, the organization `<SelectField>` (~line 178): `controlledValue` falls back to `userOrganizations[0]` unguarded, and its `onChange` calls `userOrganizations.find(...)` unguarded. Both throw if `userOrganizations` is `null`. This can also crash on **initial render** for a no-org user editing a project that already has a parent organization (before any click), since the "is org" branch renders immediately.
- **`ShareProject.tsx`** already guards the `null` case for the dropdown options (`organizationOptions = !userOrganizations ? [] : ...`), but `onChangeSwitch` (~line 79) sets `parent_organization: project.is_organization_project ? null : organizationOptions[0]`. For a no-org user, `organizationOptions[0]` is `undefined`, and **nothing validates this before "NEXT STEP"** — `onClickNextStep` calls `goToNextStep()` unconditionally (~line 94).
- **`OrganizersContainer.tsx`** ("Add Team" step) then renders `<MiniOrganizationPreview organization={projectData.parent_organization} />` when `!projectData.isPersonalProject` (~line 92). With `parent_organization` still `undefined`, `MiniOrganizationPreview.tsx` dereferences `organization.url_slug` (~line 80) → crash. This is the exact crash in Scenario 1.

### Why it matters

- Any user who hasn't joined an organization cannot create or edit an org-flagged project without hitting a fatal client-side error — a hard blocker, not a cosmetic bug.
- The bug is trivially reproducible for a large share of users (anyone who hasn't joined an org yet).
- Three duplicated, drifted copies of the same fetch function make this class of bug likely to resurface and to be fixed inconsistently.

---

## User Stories

- As a user with no organization memberships, when I try to create a project as an organization project without selecting one, I want a clear validation message telling me to pick an organization, instead of a crash later in the flow.
- As a user with no organization memberships editing a personal project, when I toggle to "organization project", I want to see the (empty) organization dropdown with guidance, and a validation error if I try to save without selecting one — not a crash.
- As a developer, I want a single source of truth for fetching the current user's organizations so the "no organizations" case is handled consistently everywhere it's used.

---

## Acceptance Criteria

- [ ] **AC-1** (Scenario 1 fix): On the `/share` step 1 form, toggling to "Organisation's project" with no organization memberships shows the organization dropdown (empty) with explanatory help text. Clicking "NEXT STEP" without a selected organization shows a clear inline validation error and does **not** advance to the next step.
- [ ] **AC-2** (Scenario 2 fix): On `/editProject/[projectUrl]`, toggling the personal/organization switch never throws, regardless of whether `userOrganizations` is `null`/`[]`/populated. If the user has no organizations, the dropdown is shown (empty) with the same help text as AC-1, and attempting to save without a selected organization shows a clear inline validation error instead of submitting.
- [ ] **AC-3**: `getUserOrganizations()` exists in exactly one place — [frontend/public/lib/organizationOperations.ts](../../frontend/public/lib/organizationOperations.ts) — and returns `[]` (never `null`) when the user has no organizations or is logged out. The two duplicate copies in `pages/share.tsx` and `pages/editProject/[projectUrl].tsx` are removed and replaced with the shared import.
- [ ] **AC-4**: All current callers of the shared `getUserOrganizations` (including [Dashboard.tsx](../../frontend/src/components/dashboard/Dashboard.tsx)) continue to work correctly with the new `[]`-on-empty contract (i.e., no caller relies on receiving `null` to distinguish "no orgs" from "not fetched yet").
- [ ] **AC-5**: `MiniOrganizationPreview` is never invoked with an `undefined`/`null` `organization` for the "responsible organization" preview in `OrganizersContainer.tsx` — either by fixing the upstream data (AC-1/AC-2 validation prevents the empty-org state from ever reaching this step) and/or by guarding the component itself against a missing `organization` prop as defense in depth.
- [ ] **AC-6**: `EditProjectContent.tsx`'s `SelectField` for parent organization never calls `userOrganizations[0]` or `userOrganizations.find(...)` on a non-array value.
- [ ] **AC-7**: Existing users who **do** have organizations see no behavior change (dropdown pre-fills with their first/previously-selected org, switch behaves as before).
- [ ] **AC-8**: Validation error copy exists in both supported locales (English and German), per project i18n conventions.
- [ ] **AC-9**: New/updated Jest tests cover: shared `getUserOrganizations` returning `[]` for empty/no-token cases; `ShareProject` blocking "NEXT STEP" with no org selected and no crash when `userOrganizations` is `[]`/`null`/`undefined`; `EditProjectContent` switch toggle and save-validation with no organizations, without crashing.

---

## Constraints

- Frontend-only; no backend/API changes required.
- Preserve current behavior for users who already belong to at least one organization.
- Follow the project's existing validation UI pattern used elsewhere in the share/edit flows (inline `errors`/`fieldErrors` state + `RequiredFieldsNotice`/helper text, e.g. as in [EnterDetails.tsx](../../frontend/src/components/shareProject/EnterDetails.tsx)) rather than introducing a new validation mechanism.
- `SelectField` ([frontend/src/components/general/SelectField.tsx](../../frontend/src/components/general/SelectField.tsx)) does not currently forward `error`/`helperText` to the underlying MUI `TextField` — needs to be extended (additively, no breaking changes to existing usages) to support displaying the new validation message.
- Translation keys must be added for both English and German (Django/Next i18n convention used elsewhere in `frontend/public/texts/project_texts.tsx`).

---

## Recommended approach (per issue)

1. **Consolidate `getUserOrganizations()`** into the single implementation in `organizationOperations.ts`, changing its empty-result branch to return `[]` instead of `null` (and treating "no auth token" as `[]` as well, to keep the return type a plain array everywhere). Update `pages/share.tsx` and `pages/editProject/[projectUrl].tsx` to import and use this shared function, removing their local copies.
2. **Add validation, not just null-guards**:
   - `ShareProject.tsx` step 1: before calling `goToNextStep()`, if `project.is_organization_project` (or equivalent org-mode flag) is true and no `parent_organization` is selected, set an inline error and abort navigation.
   - `EditProjectContent.tsx`: guard the switch handler and the `SelectField`'s `controlledValue`/`onChange` against a non-array `userOrganizations` (defensive, now unreachable once step 1 above is enforced, but still cheap insurance since `EditProjectContent` is reused across create/edit contexts). Add equivalent validation before the edit form can be saved with organization mode selected and no organization chosen.
3. **Defense in depth**: guard `MiniOrganizationPreview` against a missing `organization` prop (e.g., render nothing or a placeholder) so a future regression degrades gracefully instead of crashing the whole page.
4. Extend `SelectField` to accept and forward optional `error`/`helperText` props for the new inline validation message.

---

## AI Agent Insights and Additions

### Confirmed against current code (this repo, not upstream `climatehub`)

The reported crash sites have already drifted from the exact line numbers in the issue (this codebase has since been refactored, e.g. `EditProjectContent.tsx`'s switch handler already has partial optional chaining). However, the underlying defect is still present and reproducible today:

- `handleSwitchChange` in `EditProjectContent.tsx` still crashes with `Cannot read properties of null (reading '0')` when `userOrganizations` is `null`, because only `project?.project_parents?.parent_organization` is guarded, not `userOrganizations` itself.
- `ShareProject.tsx` already null-guards its own `organizationOptions` derivation, but has no validation gate before `goToNextStep()`, so the empty-org case still reaches `OrganizersContainer.tsx` → `MiniOrganizationPreview.tsx` and crashes there, matching Scenario 1 exactly.

### Field naming inconsistency to watch

`ShareProject.tsx` uses `is_organization_project` / `isPersonalProject` (mixed snake/camel case, both set together in `onChangeSwitch`), while `EditProjectContent.tsx` uses `is_personal_project` only. `OrganizersContainer.tsx` reads `projectData.isPersonalProject`. Any validation added must check the field(s) actually read by the step it's added to — don't assume the two flows share a single flag name.

### Where to add the "no organizations" empty-state help text

Both `ShareProject.tsx` and `EditProjectContent.tsx` render the organization `SelectField` only when in "organization" mode; an empty-options empty state with explanatory text (e.g., "You don't belong to any organization yet — create or join one first") should be shown in place of/alongside the dropdown in both places, per the issue's expected behavior for Scenario 2 ("show the organisation dropdown with the help text").

### Test coverage gaps found

- No existing test file for `ShareProject.tsx`'s "NEXT STEP" validation or for `organizationOperations.ts`'s `getUserOrganizations`.
- `EditProjectContent.tsx` has no existing coverage for the switch-toggle-with-no-orgs path — this is the exact crash path and should be the priority regression test.

---

## System impact

*(to be filled by Archie)*

---

## Log

- 2026-09-15 — Spec drafted from GitHub issue climatehub#2286. Root cause independently confirmed by reading current frontend code (line numbers differ from the issue due to prior refactors, but the defect and both reported crashes reproduce as described). Recommended approach mirrors the issue's suggested fix and refactor. Awaiting user review before implementation.
