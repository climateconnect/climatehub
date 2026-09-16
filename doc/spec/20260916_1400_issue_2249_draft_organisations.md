# Allow creating an organisation as draft

**Issue:** [climateconnect/climatehub#2249](https://github.com/climateconnect/climatehub/issues/2249)
**Status:** IMPLEMENTED (backend + frontend)
**Branch:** `draft-organisation`
**Created:** 2026-09-16
**Updated:** 2026-09-16 — backend and frontend implemented; see
[Implementation](#implementation) for what was actually built and
[Open Questions](#open-questions) for how each was resolved.

## Problem Statement

Organisations are published immediately on creation — there is no way to save
work-in-progress organisation profiles privately before they are ready for
public view. Projects already support this via a `is_draft` flag: a project
can be created as a draft, edited privately, and published later. Organisation
admins have asked for the same capability for organisations (issue #2249,
reported by @HaraldWalker):

1. Allow creating an organisation as draft, similar to how projects can be
   created as draft.
2. Display draft organisations with a draft banner.
3. Enable organisation admins to edit draft organisations.
4. Permit organisation admins to publish draft organisations.

Draft organisations must stay unpublished and unavailable for use elsewhere on
the platform (search, browse, sitemap, featured lists, org pickers, etc.)
until explicitly published, mirroring how draft projects are already filtered
out of listings.

## Current State (Projects, for reference)

Projects implement this today with a plain boolean, not a status enum:

- Model field: `backend/organization/models/project.py:172-176` —
  `is_draft = models.BooleanField(default=False, ...)`, added via a single
  additive migration (`backend/organization/migrations/0040_project_is_draft.py`).
- Draft projects are excluded from public listing/search/sitemap querysets by
  adding `is_draft=False` alongside `is_active=True`, in ~9 separate places
  (`backend/organization/views/project_views.py` — `ListProjectsView`,
  `ListEventsView`, `EventCalendarCountsView`, `ListUpcomingEventsView`,
  `ListFeaturedProjects`, `ListProjectsForSitemap`, `SimilarProjects`;
  `backend/organization/views/event_calendar_feed_views.py:68`;
  `backend/organization/utility/organization.py:191`;
  `backend/organization/views/organization_views.py:1018`
  (`ListOrganizationProjectsAPIView`); `backend/organization/utility/project.py:301`;
  `backend/climateconnect_api/views/user_views.py:486`).
- `ProjectReadWritePermission` (`backend/organization/permissions.py:33-66`)
  allows any `GET` unconditionally (`SAFE_METHODS` always pass) — there is no
  explicit ACL blocking a non-member from viewing a draft project's detail
  page directly. Draft privacy for detail pages relies entirely on the project
  being omitted from listings/search/sitemap ("obscurity through omission"),
  not on a view-level permission check.
- Publishing is a one-way PATCH: `ProjectAPIView.patch`
  (`backend/organization/views/project_views.py:1178-1180`) sets
  `project.is_draft = False` whenever `is_draft` is present in the request
  body, regardless of its value — there is no supported way to go back to
  draft via this endpoint.
- Frontend: draft banner is a CSS ribbon in `ProjectPreview.tsx:168-171`
  (`draftTriangle`/`draftText`), which also redirects card clicks to the edit
  page instead of the public page (`ProjectPreview.tsx:142-144`). Create flow
  has a dedicated "Save as draft" button
  (`frontend/src/components/shareProject/ShareProjectRoot.tsx:284-302`,
  button rendered by `frontend/src/components/general/NavigationButtons.tsx:217-231`).
  Edit flow relabels the submit button to "Publish" when editing a draft
  (`frontend/src/components/editProject/EditProjectRoot.tsx:399,429`) and adds
  a separate "save as draft" action while a draft is still being edited
  (lines 183-249). `is_draft: boolean` is declared directly on the project
  types in `frontend/src/types.ts:41,124` (no shared enum).

A more rigorously validated variant of this pattern exists for
`EventRegistrationConfig` (`backend/organization/serializers/event_registration.py:790-940`),
which explicitly rejects flipping `is_draft` back to `True` once published,
in the serializer rather than silently ignoring the client value. This is a
better template than the plain project pattern if we want to close that gap
for organisations.

## Current State (Organisations)

- Model: `backend/organization/models/organization.py` — `Organization` has no
  draft/status field of any kind today.
- `OrganizationReadWritePermission`
  (`backend/organization/permissions.py:87-121`) mirrors
  `ProjectReadWritePermission` exactly (same `SAFE_METHODS`-always-allowed
  shape), so it has the same latent "no view-level ACL" characteristic.
- `ListOrganizationsAPIView.get_queryset()`
  (`backend/organization/views/organization_views.py:128-130`) is
  `Organization.objects.all()` — no filtering at all today, so every created
  organisation is immediately public and searchable.
- Other unfiltered organisation listings: `ListFeaturedOrganizations`
  (line 1044, filters only by `rating`), `ListOrganizationsForSitemap`
  (line 1056), and `LookUpOrganizationAPIView` (line 580, name-uniqueness
  lookup used during org creation).
- The organisation picker used when assigning a project's parent organisation
  (`frontend/src/components/shareProject/OrganizersContainer.tsx`) queries the
  same list endpoint, so it would automatically stop offering draft
  organisations once the listing endpoint is filtered — see Scope/Open
  Questions below for whether an org's own admin should still be able to pick
  their own draft org.
- Serializers `OrganizationSerializer` and `OrganizationCardSerializer`
  (`backend/organization/serializers/organization.py:52-,230-252`) have no
  draft-related field or conditional exposure logic.
- Frontend `Organization` type (`frontend/src/types.ts:182-187`) is minimal
  today (`location`, `name`, `thumbnail_image`, `url_slug`) and will need
  `is_draft` added.
- Card components with no draft-indicator today: `OrganizationPreview.tsx`,
  `MiniOrganizationPreview.tsx`, `OrganizationPreviews.tsx`,
  `OrganizationPreviewsFixed.tsx`.
- Create and edit are **separate** component trees (not a shared root, as
  first assumed): `frontend/pages/createorganization.tsx` drives its own
  multi-step flow (`EnterBasicOrganizationInfo.tsx` → `EnterDetailledOrganizationInfo.tsx`
  → translate step), while `frontend/pages/editOrganization/[organizationUrl].tsx`
  uses `frontend/src/components/organization/EditOrganizationRoot.tsx`. Both
  trees funnel into the same shared form component,
  `frontend/src/components/account/EditAccountPage.tsx`, at their respective
  final step (also used for personal profile editing).
- The generic `frontend/src/components/general/Form.tsx` component (step 1 of
  org creation, and unrelated flows like password reset) renders one
  `type="submit"` button per form with fields marked via the native HTML
  `required` attribute — there is no built-in way to add a second action that
  bypasses that validation.

## Desired Outcome

An organisation admin can:

- Save a new organisation as a draft instead of publishing it immediately.
- See a clear "Draft" indicator on their draft organisation's card/page.
- Continue editing a draft organisation freely (drafts should not need to pass
  the full validation that a published organisation does, matching how draft
  projects skip most required-field validation on save).
- Publish the draft when ready, after which it becomes visible everywhere a
  normal organisation would be.

Until published, the organisation must not appear in: organisation search
results, the organisation browse/directory page, featured organisations,
hub-related organisation lists, the sitemap, or the organisation picker used
when linking a project/other entity to an organisation.

## Scope

### In Scope

- `Organization.is_draft` boolean field + migration (additive, default
  `False`, no backfill required).
- `is_draft=False` filtering added to every organisation listing/search
  queryset enumerated above (`ListOrganizationsAPIView`,
  `ListFeaturedOrganizations`, `ListOrganizationsForSitemap`, and any other
  place that lists/searches organisations for public consumption, e.g. hub
  pages and the project's organisation picker).
- `is_draft` handling on `CreateOrganizationView` (create-as-draft, skipping
  strict validation the same way `CreateProjectView` does today) and on
  `OrganizationAPIView.patch` (edit-while-draft, and the draft → published
  one-way transition).
- Frontend: `is_draft` added to the `Organization` type; a draft indicator on
  organisation card components; a "Save as draft" action in the create flow;
  a "Publish" action (relabelled submit button) plus a "save draft changes"
  action in the edit flow — mirroring the existing project components
  (`ProjectPreview.tsx`, `ShareProjectRoot.tsx`, `EditProjectRoot.tsx`,
  `NavigationButtons.tsx`).
- Draft-aware copy for organisation deletion
  (`frontend/src/components/organization/DeleteOrganizationDialog.tsx`),
  mirroring `DeleteProjectButton.tsx`'s draft-specific delete text.
- Regression/unit tests for the new filtering, permission, and publish-flow
  behaviour.

### Out of Scope

- Redesigning draft/publish as anything other than a boolean (no multi-stage
  review/approval workflow).
- Retroactively closing the pre-existing "`SAFE_METHODS` bypass" gap in
  `ProjectReadWritePermission`/project draft handling — see Open Questions for
  whether to fix it for organisations only, or leave organisations at parity
  with the current (weaker) project behaviour.
- Any change to how projects handle drafts.
- General organisation-model/serializer refactors unrelated to draft support.

## Acceptance Criteria

1. A new organisation can be created with `is_draft: true` and is saved
   without needing to satisfy the full set of required-field validations that
   a published organisation needs.
2. A draft organisation does not appear in: the organisation
   browse/search/directory results, `ListFeaturedOrganizations`, the sitemap,
   hub-related organisation listings, or the organisation picker shown when
   linking a project to an organisation.
3. A draft organisation is visible with a "Draft" indicator to its own
   admins/members (on their org card and detail/edit page).
4. Organisation admins/members with write access can edit a draft
   organisation's fields freely.
5. Organisation admins/members with write access can publish a draft
   organisation (`is_draft: true → false`); this transition is one-way — a
   published organisation cannot be reverted to draft through this flow.
6. After publishing, the organisation immediately appears in the listings it
   was previously excluded from (subject to normal listing criteria such as
   `rating` for featured).
7. Existing (non-draft) organisation create/edit/list/search flows are
   unaffected.
8. Regression tests cover: draft creation with incomplete fields, draft
   exclusion from each listing endpoint touched, edit-while-draft, and the
   one-way publish transition (including that a client cannot set
   `is_draft: true` on an already-published organisation via this endpoint).

## Implementation

Both the backend and frontend described below have been implemented on the
`draft-organisation` branch, with automated test coverage. Where the original
proposal below left a design decision open, the choice actually made is
called out and cross-referenced to [Open Questions](#open-questions).

### Backend

- Added `is_draft = models.BooleanField(default=False, help_text="Whether organization is public or just a private draft", verbose_name="Is Draft?")`
  to `Organization` (`backend/organization/models/organization.py`), with a
  single additive migration `backend/organization/migrations/0147_organization_is_draft.py`
  (same shape as `0040_project_is_draft.py`).
- `CreateOrganizationView.post()`: parses `is_draft` from the request body the
  same way `CreateProjectView.post()` does, and only requires `name` when
  `is_draft` is true. This required guarding several previously-unconditional
  field accesses (`source_language`, `translations`, `team_members`) that
  would otherwise `KeyError` once those fields stop being required.
- `OrganizationAPIView.patch()`: accepts `is_draft` in the payload as a
  one-way draft → published transition, and **explicitly rejects** a PATCH
  that tries to set `is_draft: true` on an already-published organisation
  (400) — the stricter `EventRegistrationConfig`-style option, resolving
  [Open Question 3](#open-questions) in favour of validation over the
  plain project pattern's silent coercion.
- Added `is_draft=False` filtering to `ListOrganizationsAPIView`,
  `ListFeaturedOrganizations`, and `ListOrganizationsForSitemap`.
- **Bonus fix found during implementation:** `ListMemberOrganizationsView`
  (`/api/member/<slug>/organizations/`, the public endpoint backing the "your
  organisations" section of a profile page) had **zero** draft filtering at
  all, unlike its already-fixed project sibling `ListMemberProjectsView`. Now
  mirrors that pattern: the profile owner sees their own draft orgs, every
  other viewer (including anonymous) does not.
  (`backend/climateconnect_api/views/user_views.py`)
- Added `is_draft` to `OrganizationSerializer.Meta.fields` (inherited by
  `EditOrganizationSerializer`) and `OrganizationCardSerializer.Meta.fields`
  so the frontend can read draft status.
- `OrganizationReadWritePermission` was left unchanged — resolving
  [Open Question 2](#open-questions) in favour of parity with the existing
  (weaker) project behaviour rather than adding a new view-level ACL.
- Tests added: `TestCreateOrganizationViewDraft`,
  `TestOrganizationDraftListingFiltering`, `TestOrganizationPublishTransition`
  (`backend/organization/tests/test_organization_views.py`), and
  `TestListMemberOrganizationsViewDraftFiltering`
  (`backend/climateconnect_api/tests/test_user_views.py`).

### Frontend

- `is_draft?: boolean` added to the `Organization` type
  (`frontend/src/types.ts`).
- `parseOrganization()` (`frontend/public/lib/organizationOperations.ts`) was
  silently dropping `is_draft` from API responses — fixed to pass it through,
  since without this every `is_draft`-aware UI path (edit root, detail page)
  would always have read `undefined`.
- `OrganizationPreview.tsx`: draft-ribbon indicator adapted from
  `ProjectPreview.tsx`'s CSS technique (resized for the org card's circular
  avatar layout instead of a rectangular banner image), and card clicks route
  to `/editOrganization/{slug}` instead of the public org page while draft.
  This card is what renders in the "your organisations" section of a user's
  own profile (`ProfileRoot.tsx`) — exactly where the `ListMemberOrganizationsView`
  backend fix above matters.
- Added a generic secondary-action extension to two **shared, reusable**
  components rather than special-casing organisations inside them:
  - `EditAccountPage.tsx` (org create step 2, org edit, and personal profile
    editing): new `onSecondarySubmit` / `secondarySubmitMessage` /
    `loadingSecondarySubmit` props, rendered as a plain (non-submit) button
    in the existing "extra action button" slot (previously only used for
    "Check Translations"). The button is hidden entirely while
    `editedAccount.name` is empty/whitespace, rather than being shown and
    then erroring on click.
  - `Form.tsx` (org create step 1, and unrelated forms like password reset):
    same trio of props, plus `secondarySubmitEnabledField` — the button only
    renders once that named field's live value is non-empty (trimmed), which
    lets it react to keystrokes without lifting state out of `Form`'s
    internal state.
- `EnterBasicOrganizationInfo.tsx` (step 1) and
  `EnterDetailledOrganizationInfo.tsx` (step 2) wire a `handleSaveAsDraft` /
  `loadingSubmitDraft` pair into `Form` / `EditAccountPage` respectively, with
  `secondarySubmitEnabledField="organizationname"` on step 1.
- `pages/createorganization.tsx`: two draft-save handlers, since step 1 and
  step 2 use different form shapes:
  - `handleSaveAsDraftFromBasicInfo` (step 1) — bypasses the checks in
    `handleBasicInfoSubmit` that normally block progressing to step 2
    (parent-org consistency, location validity), sending just `name` plus
    whatever else (parent org / location / types) is already filled in.
  - `handleSaveAsDraft` (step 2) — reuses the existing
    `parseOrganizationForRequest` pipeline with `is_draft: true`.

  Both use a `hasResolvableLocation()` check (place_id, or a full OSM
  composite key) rather than the existing `isLocationValid()` helper, because
  `isLocationValid({})` returns `true` — sending an empty/partial location
  object would crash the backend's location lookup with an uncaught
  `ValidationError`. On success, both redirect to `/editOrganization/{slug}`
  with a "saved as draft" message, instead of the member-management page
  used after a normal (non-draft) creation.
- `EditOrganizationRoot.tsx` (edit flow): `saveChanges` takes an `isDraftSave`
  flag. A draft save only requires `name` and PATCHes without touching
  `is_draft`; the main submit always runs full validation and, if the org was
  still a draft, sets `is_draft: false` (one-way) and shows a "published"
  success message instead of the normal "edited" one. The delete button and
  confirmation dialog read "Delete Draft" instead of "Delete organisation"
  while the org is still a draft, mirroring `DeleteProjectButton.tsx` —
  `DeleteOrganizationDialog.tsx` itself needed no changes, since it was
  already fully prop-driven.
- Both "Save as draft" buttons were styled to match the project's version in
  `NavigationButtons.tsx` exactly (`color="grey"`, disabled while a save is
  in flight) rather than the initially-used `color="secondary"`.
- New text keys added to `organization_texts.tsx` (EN+DE): `save_as_draft`,
  `save_changes_as_draft`, `publish`, `delete_draft`,
  `your_organization_has_been_published_great_work`,
  `you_have_successfully_saved_your_organization_as_a_draft`,
  `organization_name_required_to_save_as_draft`.
- Tests added: `EditOrganizationRoot.test.tsx` extended with a "draft
  publishing" suite (publish transition, draft-save, delete-label
  switching); new `Form.test.tsx` covering the secondary-button gating,
  loading state, and click behaviour (no test file existed for this shared
  component before).

## Open Questions

1. **Org picker while drafting a project — still open, not addressed.** Should
   an admin be able to select their *own* draft organisation as a project's
   parent organisation before the org is published? Filtering the shared
   listing endpoint by default hides it from that picker too
   (`OrganizersContainer.tsx`), and this implementation did not add a
   separate "include my draft orgs" code path. Left for a follow-up if
   needed.
2. **Permission gap parity — resolved: keep parity with projects.**
   `OrganizationReadWritePermission` was left unchanged (`SAFE_METHODS`
   always pass, no view-level ACL). Draft privacy for direct detail-page
   access still relies entirely on omission from listings/search/sitemap,
   same as projects today. Revisit only if this becomes an actual reported
   issue.
3. **Publish-transition validation — resolved: stricter than projects.**
   Implemented the `EventRegistrationConfig`-style validated transition:
   `OrganizationAPIView.patch()` rejects a PATCH that tries to set
   `is_draft: true` on an already-published organisation (400), rather than
   the plain project pattern's silent coercion of any submitted value to
   `false`.

## Testing Plan

### Implemented and passing

- Backend (`backend/organization/tests/test_organization_views.py`,
  `backend/climateconnect_api/tests/test_user_views.py`): draft creation with
  only `name` succeeds and non-draft creation still enforces full validation;
  draft exclusion from `ListOrganizationsAPIView`, `ListFeaturedOrganizations`,
  `ListOrganizationsForSitemap`; draft org's own admin can still `GET`/`PATCH`
  it; publish transition flips `is_draft` to `false` and a redundant
  draft→draft PATCH is a no-op; a PATCH attempting to set `is_draft: true` on
  a published org is rejected; `ListMemberOrganizationsView` shows a draft
  org only to its own profile owner (not other viewers, not anonymous). Full
  existing backend suite (785+ tests) re-run clean.
- Frontend (`EditOrganizationRoot.test.tsx`, `Form.test.tsx`): submit button
  reads "Publish" and a "Save draft" action appears for a draft organisation
  (and not for a published one); publishing sets `is_draft` to `false` and
  redirects with the published message; saving as draft leaves `is_draft`
  untouched and redirects to the user's profile; delete button/dialog swap
  between "Delete Draft" and "Delete organisation" correctly; the generic
  `Form.tsx` secondary button is hidden with an empty or whitespace-only
  gating field, appears once filled, and is disabled with a loader while
  saving. `tsc --noEmit`, `eslint`, and the full frontend suite (840 tests)
  all pass.

### Not automated — manual/visual verification still outstanding

- No end-to-end browser click-through of the full
  signup → create-draft → publish flow was performed (would require standing
  up the full authenticated stack). The draft-ribbon CSS on `OrganizationPreview.tsx`
  has not been visually inspected in a real browser, only reasoned about by
  analogy to the already-shipped `ProjectPreview.tsx` ribbon.
- No dedicated test file exists for `pages/createorganization.tsx` or
  `EnterBasicOrganizationInfo.tsx` (none existed before this change either);
  the step-1 "save as draft" path (`handleSaveAsDraftFromBasicInfo`) is
  covered by type-checking and manual code review only, not automated tests.
