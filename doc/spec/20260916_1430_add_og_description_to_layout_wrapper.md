# Add `og:description` to LayoutWrapper

**Status**: DRAFT
**Type**: Frontend — improvement
**Date created**: 2026-09-16

---

## Problem Statement

`LayoutWrapper` renders `og:title`, `og:image`, and `og:type` but never renders `<meta property="og:description">`, even when a `description` prop is provided. This means every page that passes a description to `WideLayout` has a `<meta name="description">` tag but no corresponding Open Graph description — social sharing previews on platforms that rely on `og:description` (Facebook, LinkedIn, WhatsApp, Signal, Slack, Discord, iMessage, etc.) fall back to scraping the page body or show nothing.

Additionally, `Layout` and `FixedHeightLayout` only forward `title` to `LayoutWrapper`, silently dropping `description` and `image`. Pages using these layouts (settings, login, activate, chat, manage members, etc.) can never have custom descriptions or images in their meta tags, even if the page has meaningful content.

### Current state

| Tag | Rendered by `LayoutWrapper`? | Notes |
|-----|------------------------------|-------|
| `<title>` | ✅ | With locale-aware suffix |
| `<meta name="description">` | ✅ | Falls back to default |
| `<meta property="og:title">` | ✅ | Falls back to default |
| `<meta property="og:description">` | ❌ | **Never rendered** |
| `<meta property="og:image">` | ✅ | Falls back to default image |
| `<meta property="og:type">` | ✅ | Always "website" |
| `twitter:*` | ❌ | Not in scope (deprecated platform) |

### What already works

- **Dynamic entity pages** (projects, profiles, organizations): pass `title`, `description`, and `image` from entity data to `WideLayout` — these will benefit immediately once `og:description` is added.
- **Hub landing pages**: pass `title` and `image` from `hubData` to `WideLayout`.
- **Webflow pages** (about, press, team, donate, etc.): get OG tags from Webflow's `headContent` injected into a separate `<Head>` block. The `LayoutWrapper` `<Head>` renders second and may override some tags. These pages already have their own `og:description` from Webflow, so this change has no negative effect on them.
- **Static pages with `WideLayout`** (hubs listing, faq, inbox): pass `title` and sometimes `description` via `WideLayout` props.

### What's broken today

- **`og:description` missing everywhere**: even pages that pass a `description` prop (donate, press, team, project pages, org pages) don't get `og:description` in the HTML.
- **`Layout` and `FixedHeightLayout` drop `description` and `image`**: pages using these layouts (settings, login, activate, chat, manage members, edit profile, create org, edit project) can never have custom meta descriptions.

---

## User Stories

- As a user sharing a ClimateHub page link on social media or in a chat app, I want the preview to show a meaningful description, so recipients know what the page is about before clicking.
- As a developer adding a new page, I want all layout components to consistently forward `title`, `description`, and `image` to the meta tag system, so I don't have to remember which layout supports which props.

---

## Acceptance Criteria

### `og:description` in LayoutWrapper

- [ ] **AC-1**: `LayoutWrapper` renders `<meta property="og:description" content={...} />` when a `description` prop is provided
- [ ] **AC-2**: When `description` is not provided, `og:description` falls back to the same default description used by `<meta name="description">` (i.e. `texts.defaultDescription`)
- [ ] **AC-3**: The `og:description` tag appears in the rendered HTML for pages that pass `description` to `WideLayout` (verify on project pages, org pages, donate, press)

### `Layout` and `FixedHeightLayout` prop forwarding

- [ ] **AC-4**: `Layout` forwards `description` and `image` props to `LayoutWrapper` (in addition to the existing `title`)
- [ ] **AC-5**: `FixedHeightLayout` forwards `description` and `image` props to `LayoutWrapper` (in addition to the existing `title`)
- [ ] **AC-6**: Existing pages using `Layout` or `FixedHeightLayout` that do NOT pass `description`/`image` continue to work unchanged (default fallback behavior)

### Verification

- [ ] **AC-7**: `yarn tsc` passes with no new type errors
- [ ] **AC-8**: `yarn lint` passes with no new warnings
- [ ] **AC-9**: Spot-check 3 pages in browser dev tools: homepage (default fallback), a project page (entity description), donate page (Webflow — should not be broken)

---

## Constraints

- No changes to `twitter:*` meta tags (out of scope)
- No changes to how Webflow pages inject their own meta tags via `headContent`
- No changes to the title suffix logic
- No changes to the default fallback values in `general_texts.json`
- `og:description` content must exactly match the `<meta name="description">` content (same prop, same fallback) — no separate logic
- This is a frontend-only change; no backend impact

---

## Directional hints

The change in `LayoutWrapper` is small: add one `<meta property="og:description">` tag next to the existing `<meta name="description">` tag, using the same `description` variable (which already handles the fallback to `texts.defaultDescription`).

For `Layout` and `FixedHeightLayout`, the change is passing through the `description` and `image` props to `LayoutWrapper` — the same pattern `WideLayout` already uses. Check the prop types and spread/forward accordingly.

No new components, hooks, or utilities needed.

---

## System impact

### Frontend

- `frontend/src/components/layouts/LayoutWrapper.tsx`: add `<meta property="og:description">` tag (one line, next to existing `<meta name="description">`)
- `frontend/src/components/layouts/layout.tsx`: forward `description` and `image` props to `LayoutWrapper`
- `frontend/src/components/layouts/fixed_height_layout.tsx` (or equivalent): forward `description` and `image` props to `LayoutWrapper`

### Non-changes

- No backend changes
- No new dependencies
- No migration
- No changes to `WideLayout`, `WebflowPage`, or any page file
- No changes to text files or navigation_texts.json

### Risks

- **Webflow double-Head interaction**: Webflow pages render two `<Head>` blocks. The `LayoutWrapper` `<Head>` renders second and already overrides `<meta name="description">` and `og:title`. Adding `og:description` to `LayoutWrapper` means it will now also override any `og:description` from Webflow's `headContent`. This is **correct behavior** — the `LayoutWrapper` description (from page props or default) should take precedence, matching how `description` and `og:title` already work. Verify on `/about` and `/press` that the og:description content matches the description content.
- **Layout prop type changes**: if `Layout` or `FixedHeightLayout` use TypeScript interfaces for their props, the interfaces need updating. Existing callers that don't pass the new props are unaffected (optional props).

---

## Log

- 2026-09-16 14:30 UTC — Task created. Problem identified during meta audit of climatehub.org: `og:description` never rendered by `LayoutWrapper`, and `Layout`/`FixedHeightLayout` don't forward `description`/`image`. Spec drafted.
