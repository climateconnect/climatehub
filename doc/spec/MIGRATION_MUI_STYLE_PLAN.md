# Migration plan: remove `@mui/styles` (makeStyles / withStyles)

Tracks GitHub issue [#2290](https://github.com/climateconnect/climatehub/issues/2290) — follow-up to the MUI v7 upgrade (PR #2241). Working branch: `migrate-away-from-mui-style`.

## 1. Goal and acceptance criteria (from the issue)

- Zero `@mui/styles` imports in `frontend/`.
- `@mui/styles` removed from `frontend/package.json` (and `yarn.lock`).
- `StylesThemeProvider` bridge removed from `pages/_app.tsx` and from all tests.
- `ServerStyleSheets` in `pages/_document.tsx` replaced by an emotion SSR solution.
- All `makeStyles` / `withStyles` converted to `styled()` or the `sx` prop.
- All `useTheme` imports come from `@mui/material/styles`.
- `yarn build`, `yarn lint`, `yarn check-types` and `yarn test` pass.

Per the issue and CLAUDE.md: migrate incrementally, one PR per batch; remove the provider bridge **only after** the last `makeStyles` call is gone. Do not add new `makeStyles` usage.

## 2. Current-state inventory (measured on this branch)

All numbers are for `frontend/` (`src`, `pages`, `public`).

| Item                                                                    | Count                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files importing `@mui/styles` (total)                                   | **316**                                                                                                                                                                                                                                                                                  |
| …of which use `makeStyles`                                              | 269 (~48.6k lines in those files)                                                                                                                                                                                                                                                        |
| …of which use `withStyles`                                              | 5 (`general/StyledMenu.tsx`, `general/StyledMenuItem.ts`, `general/StepsTracker.tsx`, `communication/notifications/Notification.tsx`, `NotificationsBox.tsx`)                                                                                                                            |
| …of which only wrap tests in `StylesThemeProvider`                      | 43 `*.test.tsx` files                                                                                                                                                                                                                                                                    |
| `useTheme` imported from `@mui/styles`                                  | 9 files (`DatePicker`, `AddTeam`, `EventRegistrationSection/Step`, `EnterDetails`, `AddSummarySection`, `OrganizersContainer`, `EnterTextDialog`)                                                                                                                                        |
| Other type/utility imports                                              | `StyleRules` in `public/styles/projectOverviewStyles.ts` (used by `ProjectOverview.tsx`, `EditProjectOverview.tsx`); `ClassNameMap` in `public/texts/texts.ts`                                                                                                                           |
| `makeStyles` files with props-based styles (`useStyles(props)`)         | ~103 call sites                                                                                                                                                                                                                                                                          |
| Files using `theme.breakpoints`                                         | ~108                                                                                                                                                                                                                                                                                     |
| `className={classes.a + " " + classes.b}` / template-string composition | ~159 sites                                                                                                                                                                                                                                                                               |
| `*ClassName={classes.x}` passed into custom components                  | ~31 sites                                                                                                                                                                                                                                                                                |
| Existing `sx=` / `styled(` usage (good reference examples)              | 29 files with `sx=`; `styled(` essentially unused                                                                                                                                                                                                                                        |
| JSS-only features                                                       | `$ruleRef` in 2 files (`general/RadioButtons.tsx`: `"$root.Mui-focusVisible &"`; `shareProject/ShareProjectCallToAction.tsx`: `animation: "$fadeRise …"` + keyframes); `LoadingContainer.tsx` also has keyframes; 0 uses of `fallbacks`, `[[ ]]` array values, `@global`, `createStyles` |
| Infrastructure                                                          | `_app.tsx` (nested `StylesThemeProvider` inside `ThemeProvider` inside `StyledEngineProvider injectFirst`, plus `declare module "@mui/styles/defaultTheme"`), `layouts/LayoutWrapper.tsx` (same module augmentation), `_document.tsx` (`ServerStyleSheets`)                              |
| Tests                                                                   | 59 test files, jest + jsdom; no visual-regression tooling                                                                                                                                                                                                                                |

Distribution by directory (files importing `@mui/styles`), used to size batches: `project` 41 (+7 `Buttons`), `shareProject` 29, `general` 26, `hub` 25 (+3 `description`), `organization` 14, `communication/chat` 13, `auth` 13, `staticpages` 12 (+7 `donate`), `dialogs` 11, `pages/` 9, `landingPage` 8, `profile` 7, `editProject` 7, `account` 7, `donation/donorForest` 6, remaining ~60 spread over ~30 small directories.

Largest/riskiest files: `header/Header.tsx` (1053 lines), `account/EditAccountPage.tsx` (943), `project/ProjectPageRoot.tsx` (933), `project/ProjectRegistrationsContent.tsx` (788), `project/EventRegistrationModal.tsx` (754), `general/TranslateTexts.tsx` (639).

### Documentation drift found

- `frontend/agent.md:45` says "Use `styled()` from `@mui/styles` or `@emotion/styled`" — wrong; fix to `@mui/material/styles` (do this in Phase 0).
- CLAUDE.md "Styling" bullet says the codebase is migrating; update it when the migration finishes (Phase 5).

## 3. Key technical decisions

1. **Target API**: `styled()` from `@mui/material/styles` for components with several rules or reused elements; `sx` for one-off MUI/DOM elements. Never import `@emotion/styled` directly in new code (keeps theme typing).
2. **Theme typing**: `Theme` from `@mui/material/styles` already carries the project's palette augmentations (e.g. `palette.background.default_contrastText`), so no new typing work is needed once the `@mui/styles/defaultTheme` augmentations are deleted.
3. **Class-name pass-through props** (`containerClassName`, `className={classes.x}` into custom components): custom components keep accepting `className`. For a component that needs to be styled from outside, wrap it with `styled(Component)(...)` (requires the component to spread `className` onto its root) rather than inventing `sx` plumbing. Only introduce an `sx?: SxProps<Theme>` prop when the component is a thin wrapper around an MUI element. Decide per component; keep the existing prop name unless it is dead.
4. **Props-based styles** (`makeStyles<Theme, Props>` / `useStyles({..})`): use `styled` with transient props (`$`-prefixed or `shouldForwardProp`) so non-DOM props are not forwarded. For one-off cases use an `sx` callback or conditional objects.
5. **SSR**: Spike in Phase 0 and pick one:
   - (preferred) `@mui/material-nextjs` Pages Router integration (`AppCacheProvider` in `_app`, `documentGetInitialProps` in `_document`); it also replaces `StyledEngineProvider injectFirst`, or
   - hand-rolled `@emotion/cache` + `@emotion/server` `createEmotionServer` in `_document` (the long-standing MUI Next.js example).
     Verify: no FOUC, CSS order relative to `devlink/css/*` and `devlink-patches.css` (imported in `_app.tsx`) is unchanged, and `view-source:` shows emotion `<style data-emotion>` tags. New dependencies need user sign-off (see Open questions).
6. **Bridge stays until the end**. The two providers in `_app.tsx` remain so un-migrated components keep working. Removing `StylesThemeProvider` from tests is safe per-file once that component tree has no `makeStyles`, but do it in the final cleanup PR for simplicity unless a batch's tests are being touched anyway.

## 4. Conversion recipes

Use these mechanical transforms so reviewers can check diffs quickly.

**A. Static rules, one element each** → `sx` or `styled`

```tsx
// before
const useStyles = makeStyles((theme) => ({ root: { padding: theme.spacing(2) } }));
const classes = useStyles();
<div className={classes.root} />
// after (single use)
<Box sx={{ p: 2 }} />   // or  sx={(theme) => ({ padding: theme.spacing(2) })}
// after (reused / many rules)
const Root = styled("div")(({ theme }) => ({ padding: theme.spacing(2) }));
```

**B. Responsive** — keep identical breakpoints:
`[theme.breakpoints.down("sm")]: {…}` works unchanged inside `styled()` and inside `sx` callbacks. Prefer `styled` when the rule has `theme.breakpoints` (108 files) to avoid callback noise.

**C. Props-based** (e.g. `GoBackButton`, `OrganizationAvatar`, `MiniOrganizationPreview`, `Footer`, `DonorForestEntry`)

```tsx
const BackButton = styled(Button, {
  shouldForwardProp: (p) => p !== "hubSlug",
})<{ hubSlug?: string }>(({ theme, hubSlug }) => ({
  color:
    hubSlug === PRIO1_SLUG
      ? theme.palette.background.default
      : theme.palette.primary.contrastText,
  height: 54,
  [theme.breakpoints.down("sm")]: {
    /* … */
  },
}));
```

Dynamic values that change on every render (e.g. `image` URL in `DonorForestEntry`) should go through `sx`/inline `style`, not new styled-prop variants, to avoid generating a class per value.

**D. Several classes in one component** (`classes.a`, `classes.b`, …): create one styled component per element (names describe the element, e.g. `Header`, `NavLink`) or a typed `const styles = { a: {...}, b: {...} } satisfies Record<string, SxProps<Theme>>` when elements are MUI components that take `sx`.

**E. Class composition** (`classes.a + " " + classes.b`, ~159 sites): replace with a single styled element with conditional props, or `sx={[styleA, cond && styleB]}` (array form). No `clsx` in the repo — do not add one.

**F. `classes={{ root: classes.x }}` on MUI components**: move styles to `sx` / `styled(MuiComp)` targeting the slot (e.g. `"& .MuiInputBase-root"`) or use the component's `slotProps`.

**G. JSS-specific syntax**

- `$ruleRef` (`RadioButtons.tsx`, `ShareProjectCallToAction.tsx`): `"$root.Mui-focusVisible &"` → `"&.Mui-focusVisible"` on the right element or `[`.${radioClasses.focusVisible} &`]`; `animation: "$fadeRise …"`→`keyframes`from`@mui/material/styles` (`import { keyframes } from "@mui/material/styles"`), referenced directly in the style object. Same for `LoadingContainer.tsx` keyframes.
- `@font-face` (1 file) → move to `GlobalStyles` or the existing global CSS; verify which file first.
- JSS auto-appends `px` to numbers; emotion/MUI does too — but check `lineHeight`, `flex`, `opacity`, `zIndex` stay unitless (same in both).

**H. `withStyles` (5 files)**: convert to `styled(Component)(...)` — `StyledMenu`, `StyledMenuItem`, `StepsTracker`, `Notification`, `NotificationsBox`. `StyledMenu`/`StyledMenuItem` are used widely; keep exported names and prop surface unchanged.

**I. `useTheme`**: only change the import to `import { useTheme } from "@mui/material/styles";` (9 files). Mechanical — can ride along in any batch, or do in one tiny PR.

**J. Shared style helper** `public/styles/projectOverviewStyles.ts` (`StyleRules` return type, consumed by `ProjectOverview.tsx` and `EditProjectOverview.tsx`): convert to a `Record<string, CSSObject>`/`SxProps` map or fold into `styled` components inside `ProjectOverview`; update both consumers in the same PR.

**K. `ClassNameMap` in `public/texts/texts.ts`**: change to `Record<string, string>` (or drop the optional `classes` field if unused — check callers).

## 5. Phased plan

Every phase = at least one PR off `master`. Use a branch name like `mui-styles/<batch>` (the current branch `migrate-away-from-mui-style` can host Phase 0). Commit messages follow repo style (short imperative, issue ref `#2290`).

### Phase 0 — Prep (one PR, no visual changes)

1. Fix `frontend/agent.md` styling guidance.
2. Add a progress-tracking script (e.g. `frontend/scripts/count-mui-styles.sh` or a one-liner in the PR description): `grep -rlF "@mui/styles" src pages public | wc -l` (target 0). Record the starting number (316).
3. Add an ESLint guard so no _new_ usage appears: `no-restricted-imports` for `@mui/styles` and `@mui/styles/*` in `.eslintrc.js`, set to **error** with a temporary `overrides` file allowlist, or **warn** if allowlisting 316 files is too noisy. Tighten to error with no allowlist in Phase 5. (Confirm with the user which style is preferred.)
4. SSR spike (decision 5): prove the chosen emotion SSR setup works **alongside** the existing `ServerStyleSheets` (emotion + JSS coexist), run `yarn build && yarn start`, and compare page source/CSS order. Land this change only if coexistence is clean; otherwise defer `_document` replacement to Phase 5 and just document findings in the PR.
5. Capture baselines: for ~15 representative pages (home, a hub page, browse, project page, event project page, share project wizard, profile, account/settings, org page, chat inbox, login/signup, donate, faq, calendar) at desktop (1440) and mobile (390) widths, in both locales where text differs. Use `yarn dev` + the browser tooling to save screenshots to the PR or a scratch folder. These are the manual visual diff reference since there is no visual-regression suite.

#### Phase 0 results (status: steps 1–3 done, step 4 findings recorded, step 5 pending)

- **Step 1 done**: `frontend/agent.md` styling guidance corrected.
- **Step 2 done**: `frontend/scripts/count-mui-styles.sh` (`--list`, `--json`, default = count). Baseline: **316**.
- **Step 3 done**: `no-restricted-imports` for `@mui/styles` / `@mui/styles/*` is an **error** in `.eslintrc.js`, with an `overrides` allowlist read from `frontend/scripts/mui-styles-allowlist.json` (316 files; paths with `[brackets]` are escaped so they match literally). Verified: a new file importing `@mui/styles/makeStyles` fails lint; `yarn lint` is otherwise unchanged (0 errors, 3 pre-existing warnings). **Workflow for every migration PR**: after migrating files, regenerate the list with `scripts/count-mui-styles.sh --json > scripts/mui-styles-allowlist.json`. In Phase 4 delete the `overrides` block and the JSON file.
- **Step 4 findings** (production build of the unmodified code, inspected with curl and in Chrome; no code change landed, no new dependency added):
  - Emotion SSR already works without any extraction: MUI/`sx` styles are emitted as inline `<style data-emotion>` tags in `<body>`. JSS output from `ServerStyleSheets` is one `<style id="jss-server-side">` in `<head>` (production class names are `jssNN`, **not** `makeStyles-*`), placed after the Next CSS `<link>`.
  - After hydration the order in `<head>` becomes: emotion tags (moved to the front by `injectFirst`) → `/fonts/openSans.css` → Next CSS bundle (devlink CSS, `devlink-patches.css`) → JSS tags. So today JSS rules beat emotion rules and the Next/devlink CSS at equal specificity; migrated rules will be emotion rules that sit **before** the devlink CSS. Migrated rules can therefore lose to any devlink/global class rule with equal specificity. This is the main visual risk of the migration: during Phase 2 check pages that mix devlink components and migrated components, and fix with higher specificity rather than `!important`.
  - Pages I fetched server-render only a "Loading..." shell, so SSR output is not a useful per-page CSS check; verify styles in the browser after hydration.
  - Deleting `ServerStyleSheets` in Phase 3 should be safe for emotion output since it is not needed for it. Whether `@mui/material-nextjs` (`AppCacheProvider`, new dependency) is worth adopting for style ordering could not be evaluated without installing it; neither it nor `@emotion/server` is currently in `node_modules`. Default plan: remove `ServerStyleSheets` and keep `StyledEngineProvider injectFirst`; revisit only if the ordering check in Phase 2/3 shows problems.
- **Step 5 decided** — no baseline screenshots and no new test dependencies (no Playwright). Instead, do manual visual checks on `http://localhost:3000` in each batch (see "Baseline capture notes"). Note the Chrome automation tool cannot set an exact viewport (`resize_window` is unreliable), so responsive checks need to be done by hand in a normal browser window or devtools device mode.

**Baseline capture notes** (learned while attempting step 5)

- Run the frontend on **port 3000**: the backend CORS whitelist (`CORS_ORIGIN_WHITELIST` in `backend/climateconnect_main/settings.py`) only allows `http://localhost:3000`; from any other port all client-side API calls fail and e.g. `/browse` shows "Could not find any Projects".
- `yarn dev` and `yarn build`/`yarn start` share `frontend/.next`; running both clobbers the dev server (500 `MODULE_NOT_FOUND` for `chunks/vendor-chunks/@mui.js`). To build without disturbing a dev server, build a copy of `frontend/` (rsync without `node_modules`/`.next`, symlink `node_modules`).
- Public pages to capture at 1440 and 390 px (local data slugs): `/browse`, `/hubs/prio1`, `/hubs/potsdam`, `/hubs/em`, `/projects/baksopk`, `/projects/balkonien-2` (event), `/organizations/drag-drop`, `/profiles/fatimaa-ashourabadi`, `/donate`, `/faq`, `/about`, `/login`, `/signup`, `/donorforest`, `/hubs/prio1/events`. Logged-in pages (share project wizard, account/settings, edit profile, inbox/chat, manage members) need a test login and are tracked separately.

### Phase 1 — Mechanical, low-risk (1–2 PRs)

- `useTheme` import swap (9 files).
- `StyleRules` / `ClassNameMap` type replacements (recipes J, K).
- `withStyles` conversions (recipe H, 5 files) — `StyledMenu` consumers need a quick smoke test.
  Gate: `yarn check-types`, `yarn lint`, `yarn test`.

#### Phase 1 results

- `useTheme` now imported from `@mui/material/styles` in 9 files (in `CustomHubSelection.tsx` the combined `makeStyles, useTheme` import was split; `makeStyles` stays until its batch).
- `StyleRules` (in `public/styles/projectOverviewStyles.ts`) → `Record<string, CSSObject>`; `ClassNameMap` (in `public/texts/texts.ts`) → `Record<string, string>`.
- `withStyles` removed everywhere (0 left): `StyledMenu`, `StyledMenuItem`, `NotificationsBox`, the `StyledMenuItem` in `Notification.tsx`, and `CustomConnector` in `StepsTracker.tsx` are now `styled(...)` components (slots targeted via `menuClasses` / `menuItemClasses` / `stepConnectorClasses`). `Notification.tsx` and `StepsTracker.tsx` still use `makeStyles` and remain on the allowlist.
- Verified: `yarn check-types`, `yarn lint` (0 errors, same 3 existing warnings), `yarn test` (59 suites, 848 tests) pass. Computed styles checked in the browser (notifications menu) and with a throwaway jsdom test (menu paper width, consumer `classes.paper` still applied, selected menu item colours, stepper connector colours/offsets).
- Known pre-existing issue left alone (out of scope): `StyledMenu` and `NotificationsBox` pass the MUI v4 prop `getContentAnchorEl`, which React reports as an unknown DOM prop warning. Remove it in the batch that migrates those components' consumers.
- `@mui/styles` importing files: 316 → 310 (allowlist regenerated).

#### Phase 2.1 results (small directories)

- Migrated 27 component files: `browse` (3), `communication/contactcreator`, `dashboard`, `faq` (3), `feedback` (2), `filter` (3), `indexPage/FilterSection`, `ideas` (2), `footer` (2), `pageNav` (2), `richText/OrganizerMessageEditor`, `shareContent` (3), `search/LocationSearchBar`, `manageMembers`, `snackbarActions`. `@mui/styles` importing files: 310 → 283.
- Three test files in these directories (`BrowseContentBase.test.tsx`, `browse/__tests__/BrowsePage.remount.test.tsx`, `search/LocationSearchBar.test.tsx`) still wrap with `StylesThemeProvider`; they stay on the allowlist until Phase 3.
- Verified: `yarn check-types`, `yarn lint` (0 errors, same 3 warnings), `yarn test` (59 suites, 848 tests). A throwaway jsdom render of ~17 converted components (footers, page navs, filters in desktop and overlay mode, feedback, idea icons, FAQ, log-in action) produced no new React console errors (no `$`-prop leakage); the throwaway test files were deleted. **Not checked in a real browser** (port 3000 was occupied by another dev server) — see the checklist below.
- Decisions worth knowing about when reviewing:
  - `Filters.tsx`: the `classes` object that was threaded through sub-components is gone; each element is its own `styled` component with `$`-prefixed props. `LocationSearchBar`'s `inputClassName` / `textFieldClassName` (which land on the `Autocomplete` root and `InputProps.className`, i.e. `.MuiOutlinedInput-root`) are replaced by descendant selectors in `LocationFieldWrapper`. The radius `SelectField` receives its `sx` twice now (once as CSS on its root via `styled`, once forwarded); harmless but a candidate for cleanup.
  - `PageNav.tsx`: removed `linkClassName={classes.link}` passed to `HubLinks` (it was only read when `showAllProjectsButton` is set, which `PageNav` never sets) and unused rules (`path`, `flexContainer`, `rightSideContainer`, `allProjectsLink`, `wasseraktions*`).
  - `MobilePageNav.tsx`: `textDecoration: "none !important"` kept as in the original.
  - `LocationSearchBar.tsx`: removed the unused `hideHelperText` destructuring (still in `Props`).
  - `FilteredFaqContent.tsx`: dropped the misspelled, ineffective `marginBottm`.
- **Manual visual checklist for this batch** (run on `http://localhost:3000`, desktop and a narrow window):
  - Browse page: filter bar — location field and radius select join seamlessly (square inner corners, no inner border); location 330 px wide on desktop and flexible in the mobile filter overlay; radius select 100 px on desktop and 33 % on mobile; a filled filter shows a 2 px primary outline; multi-select button keeps its grey border on hover; mobile search bar and "Filter" button (black borders/labels, white-ish background when `applyBackgroundColor`).
  - Upcoming events band (above/below `lg`: negative-margin bleed; below 450 px the "Event calendar" label hides); event calendar "no items" text.
  - Dashboard: hover dropdown menus; contact-creator card header alignment.
  - Footers (small and large): with/without `textColor` / `showOnScrollUp`, the `md` column layout, newsletter box corner at `lg`+; pages that pass a `className` into `Footer` / `PageNav` (emotion vs remaining JSS order).
  - Mobile bottom nav (`MobilePageNav`): active tab, no underline on hover/focus.
  - FAQ: question text at `sm`; feedback tab on the right edge and the feedback dialog; idea rating heart fill; log-in snackbar button stays white; manage-members pages (search bar width 800, member card grid); share dialog / QR download; organizer message editor error border.

### Phase 2 — `makeStyles` batches (≈12–14 PRs, 15–25 files each)

Order from lowest to highest blast radius, so patterns are settled before the big components. Suggested batches (adjust to actual diff size; keep each reviewable):

| #    | Scope                                                                                                                                                                                                                      | Approx. files                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2.1  | small directories: `snackbarActions`, `richText`, `manageMembers`, `indexPage`, `dashboard`, `communication/contactcreator`, `feedback`, `footer`, `pageNav`, `search`, `ideas`, `faq`, `filter`, `shareContent`, `browse` | ~30                                                                     |
| 2.2  | `general` (26) — most reused; migrate leaf widgets first, `StyledMenu*`/`TranslateTexts` last                                                                                                                              | 26                                                                      |
| 2.3  | `dialogs` + `layouts` + `header`                                                                                                                                                                                           | ~21 (Header.tsx is large — consider its own PR)                         |
| 2.4  | `auth` + `account`                                                                                                                                                                                                         | ~20                                                                     |
| 2.5  | `profile` + `organization` + `communication/*` (chat, notifications)                                                                                                                                                       | ~39 → split in two                                                      |
| 2.6  | `landingPage` + `indexPage/hubsSubHeader` + `staticpages` (+ `donate`) + `donation/donorForest`                                                                                                                            | ~37 → split in two                                                      |
| 2.7  | `hub` + `hub/description`                                                                                                                                                                                                  | 28                                                                      |
| 2.8  | `calendar` + `eventCalendar`                                                                                                                                                                                               | 9                                                                       |
| 2.9  | `editProject` + `shareProject`                                                                                                                                                                                             | 36 → split in two (`ShareProjectCallToAction` has `$ruleRef`/keyframes) |
| 2.10 | `project` (41) + `project/Buttons` (7) — highest complexity; split into 3 PRs (display components, registration/event modals, `ProjectPageRoot`+`Overview`)                                                                | 48                                                                      |
| 2.11 | `pages/*` (9 files)                                                                                                                                                                                                        | 9                                                                       |

Per-batch procedure (follow for every PR):

1. `git grep -lF "makeStyles" <dir>` to list targets; open each file and its direct children/consumers (to catch `className` pass-through).
2. Convert using the recipes above; keep JSX structure, text and logic untouched. No drive-by refactors.
3. Remove the now-unused `Theme`/`makeStyles` imports; keep `Theme` only if still referenced.
4. Run, from `frontend/`: `yarn format` (or prettier on changed files), `yarn lint`, `yarn check-types`, `yarn test`.
5. Visual check: run `yarn dev` (backend + services per CLAUDE.md) and compare each affected page against the Phase 0 baselines at 1440 and 390 px; check hover/focus/active states, dialogs/menus, and hub themes (a hub with custom theme via `fetchHubTheme`).
6. Update the progress counter in the PR description (e.g. `316 → 289`).
7. Open PR titled `Migrate <scope> away from @mui/styles (#2290)`; body: counts, list of recipes used, screenshots of anything non-trivial, "bridge intentionally left in place".

Things to watch in every batch:

- **CSS specificity / order**: `makeStyles` + `StyledEngineProvider injectFirst` vs emotion `styled`. Overrides of MUI defaults should still win with `styled`/`sx`; if a rule loses to a devlink or global CSS rule, fix specificity rather than adding `!important`.
- **Hash class names**: JSS generated `makeStyles-root-123`. Grep `makeStyles-` and `Mui` selectors in CSS/tests (`devlink-patches.css`, `*.test.tsx`) before assuming nothing depends on them.
- **Conditional spacing from props** (`theme.spacing` + props): keep arithmetic identical.
- **Hooks order**: removing `useStyles()` must not change hook ordering of surrounding code.
- **Server vs client**: `styled` is SSR-safe; do not read `window` in style callbacks.

### Phase 3 — Remove the bridge (one PR, after `grep -rF "makeStyles" src pages public` returns nothing)

1. Delete `StylesThemeProvider` import and wrapper from `pages/_app.tsx`; delete `declare module "@mui/styles/defaultTheme"` blocks from `_app.tsx` and `layouts/LayoutWrapper.tsx` (and the stale comment block around lines ~317–330 of `_app.tsx`).
2. Remove `StylesThemeProvider` from the 43 test files (mechanical; keep MUI `ThemeProvider`). Search: `grep -rl StylesThemeProvider src`.
3. Replace `ServerStyleSheets` in `pages/_document.tsx` with the emotion SSR approach chosen in Phase 0 (drop the `Children`/`sheets.getStyleElement()` plumbing).
4. If using `@mui/material-nextjs`, drop `StyledEngineProvider injectFirst` in favour of `AppCacheProvider`; re-verify CSS order against `devlink` CSS.

### Phase 4 — Remove the dependency (same or tiny follow-up PR)

1. `yarn remove @mui/styles`; confirm `yarn.lock` no longer lists it (and check `@types` / peer-dep warnings).
2. Tighten ESLint guard: remove the allowlist/warn level so any `@mui/styles` import errors.
3. `grep -rn "@mui/styles" . --include='*.{ts,tsx,js,json}' --exclude-dir=node_modules` returns nothing.

### Phase 5 — Verify and document

1. Full gate: `yarn lint`, `yarn check-types`, `yarn test`, `yarn build` (production build + `yarn start`), plus a final smoke pass over the Phase 0 page list in both locales and with at least one custom hub theme.
2. Compare bundle size (`yarn analyze-bundle`, see `UPGRADE-REVIEW.md`) before/after as a sanity check (expect a small reduction).
3. Docs: update `frontend/agent.md` (styling section), CLAUDE.md "Styling" bullet (remove "migrating away… don't add new makeStyles" → state that `styled`/`sx` is the only approach), and add a short note to `doc/architecture.md` if it mentions styling. No API/model changes, so `api-documentation.md`/`domain-entities.md`/`doc/mosy/flows/` need no changes.
4. Close #2290 referencing the PR series.

## 6. Risks and mitigations

| Risk                                                        | Mitigation                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Silent visual regressions (no visual-regression tests)      | Phase 0 baselines; per-batch screenshot comparison at 1440/390 px; small PRs                      |
| Specificity/order differences between JSS and emotion       | Keep bridge until last; rely on `injectFirst`/cache ordering; no `!important` workaround          |
| `className` pass-through breakage                           | Search for every `*ClassName` prop and consumer when converting a component (recipe 3, ~31 sites) |
| SSR flash of unstyled content                               | Phase 0 spike + `view-source` check; final production build check                                 |
| Huge components (Header, ProjectPageRoot, EditAccountPage…) | Own PRs; convert rule-by-rule; second reviewer                                                    |
| Merge conflicts with ongoing feature work                   | Short-lived branches; rebase often; batch by directory; communicate in PR description             |
| Tests rely on JSS class names                               | `git grep "makeStyles-"` before each batch                                                        |
| Hub theming (`fetchHubTheme` / `hubTheme`) differences      | Test one non-default hub per batch touching hub-visible components                                |

## 7. Progress tracker

Update this table in each PR.

| Phase                                      | Status      | `@mui/styles` files remaining |
| ------------------------------------------ | ----------- | ----------------------------- |
| 0 Prep                                     | ✅          | 316                           |
| 1 Mechanical (useTheme, types, withStyles) | ✅          | 310                           |
| 2.1–2.11 `makeStyles` batches              | 🔄 2.1 done | 283                           |
| 3 Remove bridge + SSR                      | ☐           |                               |
| 4 Remove dependency + lint guard           | ☐           | 0                             |
| 5 Verify + docs                            | ☐           | 0                             |

## 8. Open questions for the maintainers

1. SSR approach: adopt `@mui/material-nextjs` (new dependency) or keep dependency-free with manual `@emotion/server`?
2. Lint guard: hard error + allowlist file, or warning until Phase 4?
3. Batch size preference (suggested ~15–25 files) and whether Header/`ProjectPageRoot` should be split further.
4. Is a visual-regression tool (e.g. Playwright snapshots) worth adding before the large batches, or are manual screenshots sufficient?
