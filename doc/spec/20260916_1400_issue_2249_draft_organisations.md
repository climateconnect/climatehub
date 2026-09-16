# Allow creating an organisation as draft

**Issue:** [climateconnect/climatehub#2249](https://github.com/climateconnect/climatehub/issues/2249)
**Status:** DRAFT
**Branch:** `draft-organisation`
**Created:** 2026-09-16

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
- Create/edit forms share one root component,
  `frontend/src/components/organization/EditOrganizationRoot.tsx`, used by
  `frontend/pages/createorganization.tsx` and
  `frontend/pages/editOrganization/[organizationUrl].tsx`.

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

## Proposed Implementation

### Backend

- Add `is_draft = models.BooleanField(default=False, help_text="Whether organization is public or just a private draft", verbose_name="Is Draft?")`
  to `Organization`, with a single additive migration (same shape as
  `0040_project_is_draft.py`).
- `CreateOrganizationView.post()`: parse `is_draft` from the request body the
  same way `CreateProjectView.post()` does
  (`backend/organization/views/project_views.py:718`), and relax required-field
  validation when `is_draft` is true, mirroring
  `backend/organization/views/project_views.py:721-732`.
- `OrganizationAPIView.patch()`: accept `is_draft` in the payload and treat it
  as a one-way draft → published transition. Recommend the stricter,
  serializer-validated approach used by `EventRegistrationConfig`
  (explicitly reject a PATCH that tries to set `is_draft: True` on an
  already-published organisation) rather than the plain project pattern,
  which silently coerces any submitted value to `False`.
- Add `is_draft=False` to the querysets in `ListOrganizationsAPIView`,
  `ListFeaturedOrganizations`, `ListOrganizationsForSitemap`, and any
  hub/organisation-picker queryset that reuses `Organization.objects` for
  public listing purposes.
- Leave `OrganizationReadWritePermission` as-is (SAFE_METHODS always allowed)
  for parity with the existing project behaviour, unless the team decides to
  close that gap as part of this change (see Open Questions).

### Frontend

- Add `is_draft: boolean` to the `Organization` type
  (`frontend/src/types.ts:182-187`), and to any other organisation-shaped
  type used across the create/edit/preview components.
- Add a draft-ribbon indicator to `OrganizationPreview.tsx` (and, if drafts
  can appear there, `MiniOrganizationPreview.tsx`), mirroring
  `ProjectPreview.tsx:168-171`/`70-82`, including redirecting card clicks to
  the edit page instead of the public page while the organisation is a draft.
- In `EditOrganizationRoot.tsx` (shared create/edit root): add a "Save as
  draft" action on create, and on edit relabel the submit button to "Publish"
  while `is_draft` is true, plus a "save draft changes" action that PATCHes
  without flipping `is_draft` — mirroring `ShareProjectRoot.tsx`/
  `EditProjectRoot.tsx`/`NavigationButtons.tsx`.
- Add draft-specific copy to `DeleteOrganizationDialog.tsx`, mirroring
  `DeleteProjectButton.tsx`.

## Open Questions

1. **Org picker while drafting a project:** should an admin be able to select
   their *own* draft organisation as a project's parent organisation before
   the org is published? Filtering the shared listing endpoint by default
   would hide it from that picker too. If this is needed, the picker will
   need a separate "include my draft orgs" code path rather than reusing the
   public listing endpoint unmodified.
2. **Permission gap parity:** should `OrganizationReadWritePermission` keep
   the same "no view-level ACL, `SAFE_METHODS` always pass" behaviour as
   projects (obscurity-through-omission only), or should organisations get an
   explicit check blocking non-member direct access to a draft org's detail
   page? The issue text ("unavailable for use elsewhere on the platform")
   suggests stronger enforcement than what projects currently have.
3. **Publish-transition validation:** adopt the stricter
   `EventRegistrationConfig`-style validated transition (reject `is_draft:
   True` on an already-published org), or match the simpler/looser project
   pattern for consistency with the rest of the codebase?

## Testing Plan

- Backend unit tests: create org as draft with missing optional/required
  fields succeeds; draft org excluded from `ListOrganizationsAPIView`,
  `ListFeaturedOrganizations`, `ListOrganizationsForSitemap`; draft org's own
  admin can still `GET`/`PATCH` it; publish transition flips `is_draft` to
  `False` and the org then appears in listings; a PATCH attempting to set
  `is_draft: True` on a published org is rejected (per Open Question 3's
  resolution).
- Frontend: create-organisation flow renders and wires up the "Save as draft"
  action; edit flow shows "Publish" for a draft org and a normal "Save" for a
  published one; draft indicator renders on the org's own card/preview.
- Manual validation: create a draft org, confirm it does not show up in
  browse/search/sitemap, confirm the admin can still see/edit it, publish it,
  confirm it now appears everywhere expected.
