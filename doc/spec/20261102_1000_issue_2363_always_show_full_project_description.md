# Always show the full project description

**Status**: READY FOR IMPLEMENTATION
**Type**: Frontend — UI simplification (removal of a feature)
**Date created**: 2026-11-02

**Issue**: [#2363 – Always show the full project description](https://github.com/climateconnect/climatehub/issues/2363)

**Depends on**:
- `frontend/src/components/project/ProjectContent.tsx`
- `frontend/src/components/project/ProjectContent.test.tsx`

---

## Problem Statement

On the project detail page (projects, ideas and events all render through `ProjectContent`) the description is clamped to 6 lines with a "Show more" / "Show less" toggle. Some users never notice the toggle and read only a truncated description. The clamp used to hide a long text above other content; that content no longer exists below the description, so truncating buys nothing and costs readability.

The requested solution: remove the "read more" behaviour from the project detail page and always render the full description.

## Current Behaviour

In `ProjectContent.tsx`:

- `DescriptionBody` takes a `$clamped` prop; when true it applies `display: -webkit-box`, `WebkitLineClamp: 6`, `overflow: hidden` (with an emotion `label: "descriptionClamped"`).
- State `showFullDescription` (default `false`) and `isOverflowing`, a `descRef`, and a `useLayoutEffect` with a `ResizeObserver` measure `scrollHeight > clientHeight` to decide whether the toggle is shown.
- `ExpandButton` renders `texts.show_more` / `texts.show_less` with `StyledExpandMoreIcon` / `StyledExpandLessIcon`.

## Requirements

1. The description on the project detail page is always rendered in full, for all project types (project, idea, event), on all viewports.
2. No "Show more" / "Show less" control is rendered for the description.
3. No visual change otherwise: the description keeps `projectDescriptionStyles` (editor-matching typography, empty-paragraph handling, list padding, 16:9 iframes, word-break).
4. The "no description yet" placeholder behaviour is unchanged.

### Out of scope

- Other `show_more` uses: `FaqSection.tsx`, `ProjectSideBar.tsx`, `HubContent.tsx`, `Post.tsx` are unrelated and stay unchanged.
- Project preview cards and list views that shorten `short_description` — a different field and a different surface.
- Texts `show_more` / `show_less` in `public/texts/general_texts.json`: still used by `FaqSection`, so they stay.
- No backend, API, model or translation changes.

## Implementation

All changes are in `frontend/src/components/project/ProjectContent.tsx`.

**Remove**
- `$clamped` prop and the clamped style block from `DescriptionBody`. `DescriptionBody` can then be a plain `styled("div")` with `projectDescriptionStyles(theme)` (the `shouldForwardProp` override is no longer needed). Alternatively drop `DescriptionBody` and render `dangerouslySetInnerHTML` directly inside `DescriptionWrapper`; prefer keeping `DescriptionBody` for a minimal diff.
- State `showFullDescription`, `isOverflowing`, `descRef`, `handleToggleFullDescriptionClick`, and the whole `useLayoutEffect`/`ResizeObserver` block.
- The `ExpandButton` JSX block after `DescriptionWrapper`.
- Now-unused styled components `ExpandButton`, `StyledExpandLessIcon`, `StyledExpandMoreIcon`, and imports `ExpandLessIcon`, `ExpandMoreIcon`, `useRef`, `useLayoutEffect`. Drop `Button` from the `@mui/material` import and `useState` only if nothing else uses them (verify with `yarn lint` / `yarn check-types`).

**Keep**
- `DescriptionWrapper` and `projectDescriptionStyles` as they are.

## Tests

In `ProjectContent.test.tsx`, delete the `describe("show more / show less")` block. Those tests no longer apply (and were mostly vacuous in JSDOM, since layout is not computed). Replace with:

- Long description (`"<p>" + "a".repeat(1000) + "</p>"`): the full text is in the document; `queryByText(/show more/i)` and `queryByText(/show less/i)` are not in the document; no element whose class contains `descriptionClamped` exists.
- Short description: same no-toggle assertion.

Existing "description rendering" tests stay unchanged.

## Documentation

No update required in `doc/` (no model, API, env var or architecture change; the project page is not described in `doc/mosy/flows/` at this level of detail).

## Acceptance Criteria

- [ ] A project, idea and event with a long description show all of it on the detail page, with no truncation at desktop and mobile widths.
- [ ] No "Show more" / "Show less" button appears on the project detail page.
- [ ] Description with images/YouTube iframes, lists and blank lines renders as before.
- [ ] FAQ "show more/less" and other pages are unaffected.
- [ ] `yarn lint`, `yarn check-types` and `yarn jest src/components/project/ProjectContent.test.tsx` pass, with no unused imports left behind.

## Risks / Notes

- Very long descriptions will push the content below them (discussion preview, tabs) further down the page. The issue accepts this explicitly; no mitigation is planned.
- The `ProjectContent` change affects every consumer of the component, which is intended.
