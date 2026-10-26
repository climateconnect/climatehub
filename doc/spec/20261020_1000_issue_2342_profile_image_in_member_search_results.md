# Show profile image (and location) in member search results

**Status**: READY FOR IMPLEMENTATION
**Type**: Frontend — UI enhancement
**Date created**: 2026-10-20

**Issue**: [#2342 – Include profile image when showing member search results](https://github.com/climateconnect/climatehub/issues/2342)

**Depends on**:
- `frontend/src/components/search/AutoCompleteSearchBar.tsx`
- `frontend/src/components/profile/MiniProfilePreview.tsx`
- `frontend/src/components/communication/chat/UserSearchField.tsx`
- `frontend/src/components/shareProject/AddTeam.tsx`
- `frontend/src/components/manageMembers/ManageMembers.tsx`
- `frontend/src/components/communication/InputWithMentions.tsx`
- Backend `ListMemberProfilesView` (`GET /api/members/?search=`), `UserProfileStubSerializer` (no change needed)

---

## Problem Statement

Member search dropdowns show only `first_name + " " + last_name`. When several members share a name (or one person has multiple accounts), users cannot tell the results apart and may start a chat with, or add to a project team, the wrong person.

The issue says "in places where we offer a member search" without naming them. Every place that queries `/api/members/?search=` was audited; there are four:

| # | Component | Where the user sees it | Row today |
|---|---|---|---|
| 1 | `UserSearchField` | `/inbox` – new chat | name only |
| 2 | `AddTeam` | `/share` – team step | name only |
| 3 | `ManageMembers` | `/manageProjectMembers/<slug>`, `/manageOrganizationMembers/<slug>`, chat member management overlay (group chat) | name only |
| 4 | `InputWithMentions` | `@mention` suggestions in project comments and posts (`CommentInput`) | name only (`display` + `id`) |

(`OrganizersContainer` searches organizations, not members, and is out of scope.)

Places 1–3 are MUI `Autocomplete` dropdowns and build the option row by hand (duplicated three times):

```tsx
// UserSearchField.tsx, AddTeam.tsx and ManageMembers.tsx — duplicated
const renderSearchOption = ({ key, ...props }, option) => (
  <li key={key} {...props}>
    <IconButton size="large"><AddCircleOutlineIcon /></IconButton>
    {option.first_name + " " + option.last_name}
  </li>
);
```

### What the API already returns

`/api/members/` uses `UserProfileStubSerializer`, which returns `id`, `first_name`, `last_name`, `url_slug`, `thumbnail_image`, `location` (translated name string or `null`) and `badges`. **No backend change is required.**

Once a member is selected, `MiniProfilePreview` already renders avatar + name from the same object, so the selected-member chips already work with images; only the dropdown rows lack them.

---

## User Stories

- As a user starting a chat, I want to see each result's profile picture so I can recognise the person I mean.
- As a project owner adding team members, I want to see the picture and location of each result so I can distinguish members with the same name.
- As an organization or project admin managing members, or a user managing a group chat, I want the same picture and location in the search results.
- As a user writing a comment, I want to see who I am about to @mention, so I do not tag the wrong person with the same name.

---

## Acceptance Criteria

1. Each row in the member search dropdown shows the member's avatar (`thumbnail_image`, falling back to the MUI default avatar when missing) next to the name.
2. Each row shows the member's location as secondary text below the name when `location` is set; no empty line when it is `null`.
3. The existing add (`+`) icon and click/keyboard selection behaviour are unchanged.
4. Applies to **all** member search usages: chat user search (`UserSearchField`), project team search (`AddTeam`), member management search (`ManageMembers`, used for project members, organization members and group chat members) and the @mention suggestion list (`InputWithMentions`).
   - The mention list has no `+` icon (selection inserts a mention, it does not add a member); each suggestion shows avatar, name and location.
5. Rows are not links inside the dropdown (selecting a row must add the member, not navigate to the profile).
6. Long names/locations are truncated with an ellipsis; the row does not grow taller than ~56px on mobile (360px viewport).
7. No new user-facing strings (location is data from the API).
8. No `@mui/styles` usage; styling via `styled()` / `sx`.

---

## Proposed Solution

### 1. Shared option renderer

Create `frontend/src/components/search/MemberSearchOption.tsx`, a small presentational component used by the three Autocomplete call sites, replacing the duplicated inline `renderSearchOption`:

```tsx
<li key={key} {...props}>
  <IconButton size="large"><AddCircleOutlineIcon /></IconButton>
  <MiniProfilePreview profile={option} nolink size="medium" title={option.location} />
</li>
```

Reuse of `MiniProfilePreview` with `nolink` gives avatar, badge and name, and its existing `title` prop renders the location as secondary text. This is the "existing component that shows profile names with images" the issue suggests, so no new avatar markup is needed.

### 2. Call sites

- `UserSearchField.tsx`: replace the local `renderSearchOption` with `MemberSearchOption`.
- `AddTeam.tsx`: same.
- `ManageMembers.tsx`: same (covers project members, organization members and chat member management, which all render this component).
- `InputWithMentions.tsx`: `react-mentions` does not use MUI `Autocomplete`, so `MemberSearchOption` does not apply. Extend `lookupUsers` to also return `thumbnail_image`, `first_name`, `last_name` and `location` per suggestion and pass `renderSuggestion` to `<Mention>`, rendering `MiniProfilePreview` (`nolink`, `size="medium"`, `title={location}`). `display`/`id` stay unchanged so the stored mention markup is not affected. The existing `li` padding/hover styles in `messageInput` keep applying. Also drop the leftover `console.log(response.data.results)` there.

`MiniProfilePreview` currently uses `@mui/styles` `makeStyles`. That is not in scope; if it has been migrated by the time this is implemented, no change is needed here (see the @mui/styles removal issue #2290). The new wrapper itself must use `styled()`/`sx`.

### 3. Backend

None. Optionally note that `/api/members/` responses are cached (`cache_page`), so image changes appear after cache expiry; this is existing behaviour.

---

## Open Questions

1. ~~**Location display**~~ **Resolved**: the issue author gave positive feedback, so location is shown (AC 2).
2. Should unverified or hub-restricted members be searchable? Out of scope; unchanged.

---

## Testing

- Jest/RTL test for `MemberSearchOption`: renders name; renders `img` when `thumbnail_image` is set; renders location text only when present; does not render an anchor.
- Test for the mention suggestion renderer: shows avatar, name and location; selecting still inserts `@@@<url_slug>^^<name>@@@^^^` markup.
- Manual: all four searches (`/inbox` new chat, `/share` team step, manage project/organization members and group chat members, `@` in a comment) with (a) a member with image + location, (b) one without image, (c) one without location, (d) two members with identical names; check at 360px width.
- `yarn lint`, `yarn check-types`, `yarn test`.

## Documentation

- No API/model change, so `doc/api-documentation.md` and `doc/domain-entities.md` are unaffected.
- No new user flow; `doc/mosy/flows/` unchanged.
