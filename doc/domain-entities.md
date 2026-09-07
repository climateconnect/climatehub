# Climate Connect Domain Entities Documentation

## Overview

This document provides comprehensive documentation of the main domain entities in the Climate Connect platform. The platform is built on Django and follows a modular app-based architecture with PostgreSQL/PostGIS for data storage.

---

## Table of Contents

1. [Core User & System Entities](#1-core-user--system-entities-climateconnect_api)
2. [Organization & Project Entities](#2-organization--project-entities-organization)
3. [Messaging Entities](#3-messaging-entities-chat_messages)
4. [Hub Entities](#4-hub-entities-hubs)
5. [Idea Entities](#5-idea-entities-ideas)
6. [Location Entities](#6-location-entities-location)
7. [Climate Match Entities](#7-climate-match-entities-climate_match)
8. [Auth Entities](#8-auth-entities-auth_app)
9. [Cross-Cutting Patterns](#9-cross-cutting-patterns)
10. [Entity Relationship Summary](#10-entity-relationship-summary)
11. [Key Design Principles](#11-key-design-principles)

---

## 1. Core User & System Entities (climateconnect_api)

### UserProfile

**Summary**: Extended user profile containing biographical information, skills, location, and preferences.

**Description**: The central entity representing a Climate Connect user. Extends Django's built-in User model with climate action-specific fields including biography, availability for collaboration, skills, location, email preferences, and verification status. Users can specify their time commitment, language preferences, and hub affiliations.

**Relationships**:
- **OneToOne**: Django `User` (authentication)
- **ForeignKey**: `Location` (geographic location), `Availability` (time commitment), `Language` (preferred language)
- **ManyToMany**: `Skill` (user skills), `Hub` (related_hubs - hubs user follows)
- **Referenced by**: `UserProfileTranslation`, `UserProfileSectorMapping`, `ProjectMember`, `OrganizationMember`, `Donation`, `Notification`, `UserBadge`

**Auth fields (added US-2)**:
- `auth_method` — `password` (default) or `otp`. Determines which login flow the user is routed to. Exposed via API in Phase B US-9.

---

### Skill

**Summary**: Technical and non-technical skills that users possess and projects require.

**Description**: Represents abilities and competencies in the climate action space. Skills can be hierarchical with parent-child relationships, allowing for skill categorization (e.g., "Programming" as parent, "Python" as child). Used to match users with relevant projects and organizations.

**Relationships**:
- **ForeignKey**: `Self` (parent_skill - hierarchical structure)
- **ManyToMany with**: `UserProfile` (user skills), `Project` (required project skills)

---

### Badge & UserBadge

**Summary**: Gamification system for recognizing user achievements and contributions.

**Description**: Badges reward users for various platform activities and milestones. Special `DonorBadge` variant recognizes financial contributions with amount and duration thresholds. `UserBadge` links users to their earned badges.

**Relationships**:
- **Badge** → Extended by `DonorBadge`
- **UserBadge**:
  - **ForeignKey**: `User`, `Badge`
  - Creates many-to-many relationship between users and badges

---

### Donation & DonationGoal

**Summary**: Financial contribution tracking and fundraising campaign management.

**Description**: `DonationGoal` represents fundraising campaigns with monetary targets and optional hub affiliation. `Donation` records individual contributions, supporting both one-time and recurring donations with payment tracking.

**Relationships**:
- **DonationGoal**:
  - **ForeignKey**: `Hub` (optional - hub-specific fundraising)
  - **Referenced by**: `Donation`
- **Donation**:
  - **ForeignKey**: `User` (donor), `DonationGoal` (optional - associated campaign)

---

### Notification & UserNotification

**Summary**: Multi-channel notification system for platform events.

**Description**: Comprehensive notification system supporting 18 notification types including messages, comments, follows, likes, membership requests, and content updates. `UserNotification` tracks per-user notification state and read status. `EmailNotification` logs email deliveries.

**Supported notification types**:
- Chat messages
- Project/Post/Idea comments
- Project follows, likes, and publications
- Organization follows
- Membership requests
- Idea support

**Relationships**:
- **Notification**:
  - **ForeignKey**: `MessageParticipants`, `ProjectComment`, `PostComment`, `IdeaComment`, `IdeaSupporter`, `ProjectFollower`, `ProjectLike`, `Post`, `MembershipRequests`, `OrganizationFollower`, `OrgProjectPublished`
- **UserNotification**:
  - **ForeignKey**: `User`, `Notification`
- **EmailNotification**:
  - **ForeignKey**: `User`, `Notification`

---

### Language

**Summary**: Internationalization support for multilingual content.

**Description**: Defines supported platform languages with locale information. Used throughout the system to enable translation of user-facing content. Currently supports English and German with extensibility for additional languages.

**Relationships**:
- **Referenced by**: All translation models (`ProjectTranslation`, `OrganizationTranslation`, `HubTranslation`, etc.), `UserProfile`, `Organization`, `Project`, `Hub`, `Idea`

---

### Availability

**Summary**: Time commitment levels for collaboration.

**Description**: Predefined options for how much time users can dedicate to projects or organizations (e.g., "5-10 hours/week", "Full-time volunteer"). Used in membership and matching algorithms.

**Relationships**:
- **Referenced by**: `UserProfile`, `ProjectMember`, `OrganizationMember`, `MembershipRequests`

---

### Role

**Summary**: Permission levels for member access control.

**Description**: Defines access permissions for project and organization members. Three main levels: read-only, read-write, and all (admin). Controls what actions members can perform within their teams.

**Relationships**:
- **Referenced by**: `ProjectMember`, `OrganizationMember`, `Participant` (chat)

---

### Feedback & ContentShares

**Summary**: User feedback collection and social media sharing tracking.

**Description**: `Feedback` captures user suggestions and bug reports. `ContentShares` tracks when users share projects, organizations, ideas, or profiles on social platforms (10 types: Facebook, Twitter, WhatsApp, LinkedIn, Email, etc.).

**Relationships**:
- **Feedback**: ForeignKey to `User`
- **ContentShares**: ForeignKey to `Project`, `Organization`, `Idea`, `User`

---

## 2. Organization & Project Entities (organization)

### Organization

**Summary**: Climate action organizations, companies, NGOs, and groups.

**Description**: Represents organizational entities working on climate solutions. Organizations can have parent-child relationships (e.g., chapters), belong to multiple hubs, have members with defined roles, publish projects, and be categorized by sectors and tags. Supports multilingual content via translations.

**Relationships**:
- **ForeignKey**: `Self` (parent_organization - hierarchical structure), `Location`, `Language`
- **ManyToMany**: `Hub` (hubs and related_hubs - primary and followed hubs)
- **Referenced by**: `OrganizationTranslation`, `OrganizationMember`, `OrganizationTagging`, `OrganizationSectorMapping`, `OrganizationFollower`, `ProjectParents`, `ProjectCollaborators`, `HubSupporter`, `Idea`, `ContentShares`

---

### Project

**Summary**: Climate action projects, events, and initiatives.

**Description**: Core entity representing climate projects with three types: project (ongoing work), event (time-bound activities), and idea (proposals). Projects have lifecycle status (idea, in-progress, finished, cancelled, recurring), location, hub affiliations, and ranking for discovery. Can have parent organization or user, collaborating organizations, members, followers, and tagged categorization.

**Key features**:
- Ranking algorithm for visibility
- Geographic and hub-based discovery
- Collaborative memberships with roles
- Engagement tracking (followers, likes)
- Rich-text descriptions via Tiptap (HTML stored in `description_html`)

**Key fields**:
- `description` (legacy) — plain-text description, max 4800 chars. Kept for backwards compatibility; no longer written to by new code.
- `description_html` — rich-text HTML description produced by the Tiptap editor. Supports bold, italic, lists, links, blockquotes, and YouTube embeds. Validated at 4000 stripped characters / 20000 full-HTML characters. Sanitized server-side with a dedicated allowlist (`PROJECT_DESCRIPTION_ALLOWED_TAGS`).

**Relationships**:
- **ForeignKey**: `ProjectStatus`, `Location`, `Language`
- **ManyToMany**: `Hub` (related_hubs)
- **Referenced by**: `ProjectTranslation`, `ProjectParents`, `ProjectMember`, `ProjectCollaborators`, `ProjectSectorMapping`, `ProjectComment`, `Post`, `ProjectFollower`, `ProjectLike`, `OrgProjectPublished`, `ContentShares`, `EventRegistrationConfig`, `ProjectTagging` (**deprecated** — see [ProjectTags & OrganizationTags](#projecttags--organizationtags))

---

### ProjectStatus

**Summary**: Lifecycle stages for projects.

**Description**: Predefined status values representing project maturity and activity state. Statuses include: idea (conceptual), in-progress (active development), finished (completed), cancelled (discontinued), and recurring (ongoing events).

**Relationships**:
- **Referenced by**: `Project`

---

### ProjectMember & OrganizationMember

**Summary**: User membership in projects and organizations with role-based access.

**Description**: Defines relationships between users and the projects/organizations they participate in. Each membership has a role (permissions), availability commitment, and timestamps. Enforces uniqueness constraint to prevent duplicate memberships.

**Relationships**:
- **ProjectMember**:
  - **ForeignKey**: `User`, `Project`, `Role`, `Availability`
  - **Unique**: (user, project)
- **OrganizationMember**:
  - **ForeignKey**: `User`, `Organization`, `Role`, `Availability`
  - **Unique**: (user, organization)

---

### MembershipRequests

**Summary**: Join requests for projects and organizations.

**Description**: Handles the workflow for users requesting to join projects or organizations. Tracks request status (pending, approved, rejected), proposed availability commitment, and optional introduction message. Used to manage team growth and vet new members.

**Relationships**:
- **ForeignKey**: `User`, `Project` (nullable), `Organization` (nullable), `Availability`
- **Referenced by**: `Notification` (notifies admins of requests)

---

### Post & PostComment

**Summary**: Project updates and discussions.

**Description**: `Post` represents news updates, progress reports, and announcements published by project members. `PostComment` enables community discussion on these updates. Both support translations, soft deletion (deleted_by tracking), and threaded conversations via parent comment relationships.

**Relationships**:
- **Post**:
  - **ForeignKey**: `Project`, `User` (author), `User` (deleted_by)
  - **Referenced by**: `PostTranslation`, `PostComment`, `Notification`
- **PostComment** (extends abstract `Comment`):
  - **ForeignKey**: `Post`, `Self` (parent_comment - threading), `User` (author), `User` (deleted_by)
  - **Referenced by**: `CommentTranslation`, `Notification`

---

### ProjectComment

**Summary**: Comments on projects for feedback and discussion.

**Description**: User-generated comments on project pages. Supports threaded discussions via parent-child relationships, translations, soft deletion, and triggers notifications to project members.

**Relationships**:
- **ForeignKey**: `Project`, `Self` (parent_comment), `User` (author), `User` (deleted_by)
- **Referenced by**: `CommentTranslation`, `Notification`

---

### ProjectFollower & OrganizationFollower

**Summary**: User subscriptions to projects and organizations.

**Description**: Enables users to follow projects and organizations for updates. Followers receive notifications when followed entities publish new content, reach milestones, or make announcements.

**Relationships**:
- **ProjectFollower**:
  - **ForeignKey**: `User`, `Project`
  - **Referenced by**: `Notification`
- **OrganizationFollower**:
  - **ForeignKey**: `User`, `Organization`
  - **Referenced by**: `Notification`

---

### ProjectLike

**Summary**: User appreciation for projects.

**Description**: Simple engagement mechanism allowing users to "like" projects. Aggregated likes contribute to project ranking and visibility in discovery algorithms.

**Relationships**:
- **ForeignKey**: `User`, `Project`
- **Referenced by**: `Notification`

---

### ProjectTags & OrganizationTags

**Summary**: Hierarchical categorization system for projects and organizations. **`ProjectTags` / `ProjectTagging` are deprecated** — see the deprecation note below. `OrganizationTags` (organization *types*) is current and unaffected.

**Description**: Tag taxonomies for content categorization. Both support parent-child relationships for hierarchical organization (e.g., "Renewable Energy" → "Solar", "Wind"). `ProjectTagging` and `OrganizationTagging` create many-to-many relationships with uniqueness constraints.

**Relationships**:
- **ProjectTags** (deprecated):
  - **ForeignKey**: `Self` (parent_tag)
  - **ManyToMany with**: `Project` (via `ProjectTagging`), `Hub` (filter_parent_tags)
- **OrganizationTags**:
  - **ForeignKey**: `Self` (parent_tag)
  - **ManyToMany with**: `Organization` (via `OrganizationTagging`)

#### Deprecation: project tags are being replaced by Sector

> ⚠️ Use [Sector](#sector) for anything new.

As of v2.5 the project tag taxonomy is **retired at the code level but retained in the
database**. `ProjectTags` and `ProjectTagging` are no longer read or written by any
application code and are **not exposed through any API** — see
[api-documentation.md](./api-documentation.md#deprecated-and-removed-project-tag-surface) for
the endpoints and fields that were removed.

The models and their tables are kept deliberately, because:

1. `organization/management/commands/create_proj_sector_mappings.py` reads `ProjectTagging`
   to derive the `ProjectSectorMapping` rows. The tables cannot be dropped until that
   migration has been run everywhere.
2. The Climate Match ranking SQL (`climate_match/utility/sort_resources.py`) still joins
   `organization_projecttagging` and `hubs_hub_filter_parent_tags` to compute the hub
   relevancy score. Because nothing writes `ProjectTagging` any more, projects created after
   v2.5 score `0` on that axis — this must be repointed at `ProjectSectorMapping` /
   `Hub.sectors` before the tables can go.

Retirement order: **stop writing** (done, v2.5) → **stop reading** (blocked on Climate Match)
→ **drop the tables**. `Hub.filter_parent_tags` and `ProjectTags.parent_tag` go with them.

---

### Sector

**Summary**: Climate action sectors and focus areas.

**Description**: Represents broad climate solution categories like Energy, Transportation, Agriculture, Built Environment, etc. Sectors can relate to each other (relates_to_sector) for cross-cutting themes. Used to categorize users, projects, and organizations, and filter content in hubs.

**Relationships**:
- **ForeignKey**: `Self` (relates_to_sector)
- **ManyToMany with**: `Project` (via `ProjectSectorMapping`), `Organization` (via `OrganizationSectorMapping`), `UserProfile` (via `UserProfileSectorMapping`), `Hub`

---

### ProjectParents & ProjectCollaborators

**Summary**: Project ownership and collaboration relationships.

**Description**: `ProjectParents` links projects to their parent entity (organization or individual user). `ProjectCollaborators` tracks organizations collaborating on projects, enabling multi-stakeholder initiatives.

**Relationships**:
- **ProjectParents**:
  - **ForeignKey**: `Project`, `Organization` (nullable), `User` (nullable)
- **ProjectCollaborators**:
  - **ForeignKey**: `Project`, `Organization`

---

### EventRegistrationConfig

**Summary**: Online registration settings for event-type projects.

**Description**: Stores registration configuration for a `Project` of type `event`. The presence of an `EventRegistrationConfig` row is the sole source of truth for whether online registration is enabled — no separate boolean flag on `Project` is needed. Both `max_participants` and `registration_end_date` are nullable to support draft events where settings have not yet been finalised; all constraints are enforced on publish (`is_draft=false`). `EventRegistrationConfig` records only exist on published events — published events cannot revert to draft, so draft-mode guards are not applied on the edit endpoint.

**Key rules**:
- Only valid for projects of type `event`; rejected with 400 for other project types
- `registration_end_date` must be ≤ the event's `end_date`
- `max_participants` must be > 0
- Required fields (`max_participants`, `registration_end_date`) are enforced on publish; skipped when saving as draft
- `status` controls the explicit registration lifecycle (see table below); organiser may set `open` or `closed`; `full` is reserved for the system when capacity is reached
- `"ended"` is a **computed read-only value** returned by the API (never stored in DB) — see status table below

**Fields**:
| Field | Type | Notes |
|---|---|---|
| `project` | OneToOneField | FK → `Project`, CASCADE delete |
| `max_participants` | PositiveIntegerField | Nullable (draft allowed); must be > 0 |
| `registration_end_date` | DateTimeField (TIMESTAMPTZ) | Nullable (draft allowed); must be ≤ event `end_date`; stored in UTC |
| `status` | CharField (enum) | `open` (default) / `closed` / `full` — see status table below |
| `notify_admins` | BooleanField | Default `True`; organiser toggle for admin notification emails on registration changes |
| `last_guest_email_sent_at` | DateTimeField (TIMESTAMPTZ) | Nullable; timestamp of the last bulk email sent to event guests; used to filter "new guests only" recipients |
| `created_at` | DateTimeField | Auto-set on creation |
| `updated_at` | DateTimeField | Auto-updated on save |

**Registration status values** (`RegistrationStatus`):
| Value | Stored in DB | Set by | Meaning |
|---|---|---|---|
| `open` | ✅ | Default / organiser | Accepting sign-ups (subject to `registration_end_date` and `max_participants`) |
| `closed` | ✅ | Organiser (via API) | Manually closed before the end date; organiser can re-open |
| `full` | ✅ | System (on last accepted signup, same transaction) | Capacity reached; blocked until a cancellation drops count below `max_participants` |
| `ended` | ❌ (computed) | API serializer | Returned when stored status is `open` but `registration_end_date` has passed — never written to DB; underlying stored value remains `open` |

**Effective "accepting signups?" check**: `status == open AND now() < registration_end_date`

> **Note**: clients should treat `ended`, `closed`, and `full` equally as "not accepting sign-ups".

**Relationships**:
- **OneToOne**: `Project` (related_name: `registration_config`, CASCADE delete)
- **Referenced by**: `EventRegistration` (related_name: `registrations`)

**Model location**: `organization/models/event_registration.py`

**Serializer location**: `organization/serializers/event_registration.py`

**Serializers**:
| Serializer | Purpose |
|---|---|
| `EventRegistrationConfigSerializer` | Read (project detail/list) and write (create via `POST /api/projects/`). Returns computed `"ended"` status via `to_representation`. On detail responses, includes nested `fields` (RegistrationFieldSerializer with options). |
| `EditEventRegistrationConfigSerializer` | Write only — `PATCH /api/projects/{slug}/registration-config/`. Allows organiser to update `max_participants`, `registration_end_date`, **and `status`** (`"open"` or `"closed"` only). `"full"` and `"ended"` are rejected on write. `status = "open"` is additionally blocked when the event is at or over capacity (see below). Enforces answer-lock: text properties (description, title, option title, start_time, end_time) are immutable once registrants have submitted answers. |
| `EventRegistrationSerializer` | Read — `GET /api/projects/{slug}/registrations/`. Returns all registrations (active + cancelled) with `field_answers` (nested array of `[field, value_boolean, value_option, value_number]` sorted by field order). |
| `EventRegistrationSubmissionSerializer` | Write — validates `POST /api/projects/{slug}/registrations/` payload including custom field answers. Per-field type validation (checkbox → value_boolean, option_select/time_slot_select → value_option, inventory → value_option + value_number with quantity checks). |
| `RegistrationFieldSerializer` | Nested read/write for custom fields. Type-specific settings validation. Publish-time validation (non-empty description for checkbox, required title + at least one option for option_select/inventory/time_slot_select, time slot start/end in future with end > start, inventory available_amount + max_amount_per_guest required). |

**Edit endpoint**: `PATCH /api/projects/{slug}/registration-config/` — dedicated endpoint for organiser/admin to update registration settings on an existing `EventRegistrationConfig`. Requires edit rights (organiser or team admin). Returns `404` if no `EventRegistrationConfig` exists. `status` is writable (`"open"` or `"closed"`); `"full"` and `"ended"` return 400. Two reopen guards apply when `status = "open"` is requested:

1. **Deadline guard** — returns 400 when `effective_status == "ended"` (deadline has passed); organiser must extend `registration_end_date` first.
2. **Fully-booked guard** — returns 400 when participant count ≥ effective `max_participants` (considering the new value if `max_participants` is also being changed in the same request); organiser must increase `max_participants` first (or include a higher value in the same PATCH).

Auto-adjustment of `status` from `max_participants` changes is skipped when `status` is explicitly provided — the organiser's intent takes priority.

---

### EventRegistration

**Summary**: Records a user's registration for an event, with soft-delete lifecycle.

**Description**: Join table between `User` and `EventRegistrationConfig`. One row per registered user per event. The `unique_together` constraint on `(user, registration_config)` enforces at both the application layer and DB level that the same user cannot have more than one row per event. Rows are **never deleted** — instead they are soft-deleted by setting `cancelled_at` and `cancelled_by`.

Available seat count is computed on-the-fly from the **active** registrations (`cancelled_at IS NULL`) rather than maintained as a denormalised counter, to avoid update-anomaly races. The count is only queried on the project **detail** endpoint (guarded by the `include_seat_count` serializer context flag) — not on the list endpoint — to prevent N+1 queries.

**Registration lifecycle**:
```
Active       — cancelled_at IS NULL, cancelled_by IS NULL
Cancelled    — cancelled_at IS NOT NULL, cancelled_by = user who cancelled
Re-registered — cancelled_at reset to NULL, cancelled_by reset to NULL (row reused)
```

**Key rules**:
- A user can register for the same event only once per row (idempotent endpoint returns 200 on re-registration if already active; returns 201 and resets the row if previously self-cancelled)
- Registrations are only accepted when `effective_status == "open"` (i.e. stored `status == "open"` **and** `registration_end_date` has not yet passed). The guard in `EventRegistrationsView` uses `_compute_effective_status()` — a single function that covers `closed`, `full`, and `ended` states with contextual error messages per state.
- When the last available seat is taken, `EventRegistrationConfig.status` is atomically promoted to `"full"` in the same transaction
- Seat locking uses `SELECT FOR UPDATE` on `EventRegistrationConfig` to prevent race conditions at capacity
- **Only active registrations count against capacity** — all `available_seats` computations filter by `cancelled_at IS NULL`
- Member cancellation (`DELETE /api/projects/{slug}/registrations/`) is blocked once the event has started (`start_date ≤ now()`)
- After a member cancellation that frees a seat, `EventRegistrationConfig.status` reverts from `"full"` to `"open"` atomically
- `cancelled_by` distinguishes self-cancellation (member may re-register) from admin-cancellation (member blocked from re-registering until an admin explicitly reinstates them)

**Fields**:
| Field | Type | Notes |
|---|---|---|
| `user` | ForeignKey | FK → `User`, CASCADE delete, related_name: `event_registrations` |
| `registration_config` | ForeignKey | FK → `EventRegistrationConfig`, CASCADE delete, related_name: `registrations` |
| `registered_at` | DateTimeField | Auto-set on creation; read-only |
| `cancelled_at` | DateTimeField | `NULL` = active; non-null = soft-deleted. Reset to `NULL` on re-registration |
| `cancelled_by` | ForeignKey (nullable) | FK → `User`, SET_NULL, related_name: `cancelled_registrations`. `NULL` when active. Set to the cancelling user (member or admin) on cancellation. Reset to `NULL` on re-registration |
| `cancellation_reason` | TextField (nullable) | Optional plain-text message provided by the guest at self-cancellation. `NULL` when no message given. **Not** reset on re-registration — persists as a record of the last cancellation reason |

**Constraints & indexes**:
| Type | Fields | Name |
|---|---|---|
| `unique_together` | `(user, registration_config)` | Prevents duplicate rows (one row per user per event) |
| Index | `registration_config` | `idx_ep_event_registration` — fast participant count / lookup by event |
| Index | `user` | `idx_ep_user` — fast lookup of all events a user registered for |

**Relationships**:
- **ForeignKey**: `User` (related_name: `event_registrations`, CASCADE delete)
- **ForeignKey**: `EventRegistrationConfig` (related_name: `registrations`, CASCADE delete)
- **ForeignKey (nullable)**: `User` (cancelled_by, related_name: `cancelled_registrations`, SET_NULL)
- **Referenced by**: `RegistrationFieldAnswer` (related_name: `field_answers`)

**Model location**: `organization/models/event_registration.py`

**Migration**: `organization/migrations/0124_add_cancelled_fields_to_eventregistration.py` — adds `cancelled_at` and `cancelled_by` columns (nullable, no backfill required). `organization/migrations/0143_eventregistration_cancellation_reason.py` — adds `cancellation_reason` (nullable, no backfill required)

---

### RegistrationField

**Summary**: Custom fields organisers can add to their event registration form.

**Description**: Defines a custom field on an event's registration form. Up to 15 fields per event. Each field has a type, order, required flag, organiser-facing label (max 30 chars), and type-specific settings stored as JSON. The `label` is auto-generated on creation (localised field type + sequential number) and can be edited by the organiser. Field types: `checkbox` (boolean), `option_select` (single-select dropdown), `inventory` (option + quantity with capacity limits), `time_slot_select` (time slot with optional per-slot capacity).

**Fields**:
| Field | Type | Notes |
|---|---|---|
| `registration_config` | ForeignKey | FK → `EventRegistrationConfig`, CASCADE delete, related_name: `fields` |
| `field_type` | CharField (enum) | `checkbox` / `option_select` / `inventory` / `time_slot_select` |
| `order` | PositiveIntegerField | Position in the form; unique per config |
| `is_required` | BooleanField | Default `False` |
| `label` | CharField, max 30 | Organiser-facing label for export/display; unique per config |
| `settings` | JSONField | Type-specific: checkbox stores `description` (sanitised HTML); option_select/inventory/time_slot_select store `title` and optionally `description` |
| `created_at` | DateTimeField | Auto-set on creation |
| `updated_at` | DateTimeField | Auto-updated on save |

**Constraints**:
- `UniqueConstraint(fields=["registration_config", "order"])` — one field per position
- `UniqueConstraint(fields=["registration_config", "label"])` — unique labels within an event

**Relationships**:
- **ForeignKey**: `EventRegistrationConfig` (related_name: `fields`, CASCADE delete)
- **Referenced by**: `RegistrationFieldOption` (related_name: `options`), `RegistrationFieldAnswer` (related_name: `answers`)

**Model location**: `organization/models/registration_field.py`

---

### RegistrationFieldOption

**Summary**: Selectable options within option_select, inventory, and time_slot_select registration fields.

**Description**: Defines a single option for multi-choice registration fields. For `option_select` fields, it's a simple selectable label. For `inventory` fields, it has capacity limits (`available_amount` stock, `max_amount_per_guest` limit). For `time_slot_select` fields, it has `start_time` and `end_time`. The `remaining_amount` is computed on-the-fly as `available_amount - booked_count`.

**Fields**:
| Field | Type | Notes |
|---|---|---|
| `field` | ForeignKey | FK → `RegistrationField`, CASCADE delete, related_name: `options` |
| `title` | CharField, max 200 | Display label; defaults to `""` |
| `order` | PositiveIntegerField | Position; unique per field |
| `available_amount` | PositiveIntegerField | Nullable; capacity limit for inventory fields |
| `max_amount_per_guest` | PositiveIntegerField | Nullable; max quantity per registrant for inventory fields |
| `start_time` | DateTimeField | Nullable; slot start for time_slot_select fields |
| `end_time` | DateTimeField | Nullable; slot end for time_slot_select fields |

**Constraints**:
- `UniqueConstraint(fields=["field", "order"])` — one option per position per field

**Relationships**:
- **ForeignKey**: `RegistrationField` (related_name: `options`, CASCADE delete)
- **Referenced by**: `RegistrationFieldAnswer` (related_name: `answers`)

**Model location**: `organization/models/registration_field.py`

---

### RegistrationFieldAnswer

**Summary**: A registrant's response to a custom registration field.

**Description**: Stores the value a user submitted for a custom registration field when they register for an event. Created/updated/deleted atomically via `sync_registration_answers()` when the registration endpoint is called. One answer per field per registration (enforced by `unique_together`). The value columns are polymorphic: `value_boolean` for checkbox, `value_option` FK for option_select/inventory/time_slot_select, and `value_number` for inventory quantity.

**Fields**:
| Field | Type | Notes |
|---|---|---|
| `registration` | ForeignKey | FK → `EventRegistration`, CASCADE delete, related_name: `field_answers` |
| `field` | ForeignKey | FK → `RegistrationField`, CASCADE delete, related_name: `answers` |
| `value_boolean` | BooleanField | Nullable; stores checkbox answers |
| `value_option` | ForeignKey (nullable) | FK → `RegistrationFieldOption`, CASCADE delete, related_name: `answers`; stores option_select, inventory option, and time_slot_select answers |
| `value_number` | PositiveIntegerField | Nullable; stores inventory quantity |
| `created_at` | DateTimeField | Auto-set on creation |
| `updated_at` | DateTimeField | Auto-updated on save |

**Constraints**:
- `unique_together = [("registration", "field")]` — one answer per field per registration

**Relationships**:
- **ForeignKey**: `EventRegistration` (related_name: `field_answers`, CASCADE delete)
- **ForeignKey**: `RegistrationField` (related_name: `answers`, CASCADE delete)
- **ForeignKey**: `RegistrationFieldOption` (related_name: `answers`, CASCADE delete)

**Model location**: `organization/models/event_registration.py`

**Migration**: `organization/migrations/0127_add_registrationfieldanswer.py` (initial), `0134_registrationfieldanswer_value_number.py` (added `value_number`)

---

## 3. Messaging Entities (chat_messages)

### MessageParticipants

**Summary**: Chat conversations between users.

**Description**: Represents a chat conversation, either one-on-one or group messaging. Can be associated with an idea for collaboration discussions. Tracks conversation creator and creation timestamp.

**Relationships**:
- **ForeignKey**: `User` (created_by), `Idea` (related_idea - nullable)
- **Referenced by**: `Message`, `MessageReceiver`, `Participant`, `Notification`

---

### Message

**Summary**: Individual messages in conversations.

**Description**: Single message within a chat conversation. Contains message content, sender, timestamps, and optional reply-to reference. Delivered to all conversation participants via `MessageReceiver` tracking. System-originated messages (e.g. event-registration cancellations) are tagged with `origin_type` / `origin_id` so clients can render context without embedding the origin entity in the `Message` response.

**Fields**:
| Field | Type | Notes |
|---|---|---|
| `content` | TextField | Message body (plain text) |
| `sender` | ForeignKey → `User` | Author of the message |
| `sent_at` | DateTimeField (nullable) | When the message was sent |
| `origin_type` | CharField (max 32) | Context tag for system-originated messages. `""` (default) = no context; `"event_registration"` = generated by event-registration cancellation; `"project"` / `"organization"` / `"hub"` reserved for future use. Server-set only |
| `origin_id` | PositiveIntegerField (nullable) | PK of the origin entity identified by `origin_type`. Server-set only |

**Relationships**:
- **ForeignKey**: `MessageParticipants` (conversation), `User` (sender)
- **Referenced by**: `MessageReceiver`

---

### MessageReceiver & Participant

**Summary**: Message delivery tracking and conversation membership.

**Description**: `MessageReceiver` tracks message delivery state and read status for each recipient. `Participant` defines conversation membership with roles (creator, admin, member) and enforces user-conversation uniqueness.

**Relationships**:
- **MessageReceiver**:
  - **ForeignKey**: `User` (recipient), `Message`
- **Participant**:
  - **ForeignKey**: `User`, `MessageParticipants` (chat), `Role`
  - **Unique**: (user, chat)

---

## 4. Hub Entities (hubs)

### Hub

**Summary**: Regional or sector-based community hubs.

**Description**: Community spaces organized by geography (location hubs), climate sector (sector hubs), or custom themes. Hubs aggregate relevant projects, organizations, ideas, and members. Support parent-child relationships for hub hierarchies, custom statistics, visual theming, ambassadors, and organizational supporters. Used throughout the platform for content filtering and community building.

**Hub types**:
- **Location**: Geographic communities (cities, regions, countries)
- **Sector**: Thematic communities (energy, transport, agriculture)
- **Custom**: Special-interest communities

**Relationships**:
- **ForeignKey**: `Self` (parent_hub - hierarchy), `Language`
- **ManyToMany**: `HubStat` (displayed statistics), `Sector`, `Location`, `ProjectTags` (filter_parent_tags — **deprecated**, retired with the project tag taxonomy)
- **ManyToMany with**: `UserProfile` (related_hubs), `Organization` (hubs, related_hubs), `Project` (related_hubs)
- **Referenced by**: `HubTranslation`, `HubTheme`, `HubAmbassador`, `HubSupporter`, `DonationGoal`, `Idea`, `UserQuestionAnswer`

---

### HubStat

**Summary**: Statistics displayed on hub pages.

**Description**: Configurable statistics showcasing hub impact and activity (e.g., "150 Projects", "5,000 Members", "20 Organizations"). Supports translations for multilingual hubs.

**Relationships**:
- **ForeignKey**: `Language`
- **ManyToMany with**: `Hub`
- **Referenced by**: `HubStatTranslation`

---

### HubAmbassador & HubSupporter

**Summary**: Hub community leaders and organizational sponsors.

**Description**: `HubAmbassador` designates users as community leaders and representatives for hubs. `HubSupporter` recognizes organizations providing resources or endorsement to hubs. Both enhance hub credibility and community engagement.

**Relationships**:
- **HubAmbassador**:
  - **ForeignKey**: `User`, `Hub`
- **HubSupporter**:
  - **ForeignKey**: `Hub`, `Organization`, `Language`
  - **Referenced by**: `HubSupporterTranslation`

---

### HubTheme

**Summary**: Visual customization for hub branding.

**Description**: Defines custom color schemes for hubs including primary color, secondary color, background, and header. Uses `HubThemeColor` for color palette definitions. OneToOne relationship ensures each hub has a single theme.

**Relationships**:
- **OneToOne**: `Hub`
- **ForeignKey**: `HubThemeColor` (primary, secondary, background_default, header_background)

---

## 5. Idea Entities (ideas)

### Idea

**Summary**: Climate action proposals and concepts from users.

**Description**: Represents early-stage climate action ideas that haven't yet become full projects. Ideas can be shared within specific hubs, have geographic scope, support comments and ratings, and gather supporters. Users or organizations can propose ideas which may eventually evolve into projects. Includes status tracking and multilingual support.

**Relationships**:
- **ForeignKey**: `User` (creator), `Organization` (proposing org - nullable), `Hub` (main hub and hub_shared_in), `Location`, `Language`
- **Referenced by**: `IdeaTranslation`, `IdeaComment`, `IdeaRating`, `IdeaSupporter`, `MessageParticipants`, `ContentShares`

---

### IdeaComment

**Summary**: Discussion threads on ideas.

**Description**: User comments on idea proposals. Supports threaded discussions, translations, soft deletion, and notifications to idea creators and participants.

**Relationships**:
- **ForeignKey**: `Idea`, `Self` (parent_comment - threading), `User` (author), `User` (deleted_by)
- **Referenced by**: `CommentTranslation`, `Notification`

---

### IdeaRating

**Summary**: User ratings for idea quality and feasibility.

**Description**: Allows users to rate ideas on various dimensions (e.g., impact potential, feasibility, innovation). Aggregated ratings help surface high-quality ideas for funding or project development.

**Relationships**:
- **ForeignKey**: `Idea`, `User`

---

### IdeaSupporter

**Summary**: Users endorsing ideas.

**Description**: Tracks users who support an idea, demonstrating community interest and validation. High supporter counts may attract resources or transition ideas to projects. Triggers notifications to idea creators.

**Relationships**:
- **ForeignKey**: `User`, `Idea`
- **Referenced by**: `Notification`

---

## 6. Location Entities (location)

### Location

**Summary**: Geographic locations with PostGIS spatial support.

**Description**: Represents any geographic location from exact addresses to cities, regions, or countries. Uses PostgreSQL PostGIS extension for spatial queries and geofencing. Stores geometry as multi_polygon and centre_point for mapping and proximity searches. Integrates with OpenStreetMap (osm_id) and Google Places (place_id) for data enrichment.

**Key features**:
- Hierarchical address structure (address → city → state → country)
- Spatial data types for geographic queries
- Multi-polygon support for region boundaries
- Centroid calculation for distance queries

**Relationships**:
- **Referenced by**: `LocationTranslation`, `UserProfile`, `Organization`, `Project`, `Idea`, `Hub` (ManyToMany)

### AutocompleteRequestLog

**Summary**: One row per outgoing autocomplete request to a geocoding provider.

**Description**: Lightweight usage log for the location autocomplete proxy. A row is written every
time the backend actually calls an upstream provider — cached and de-duplicated queries cost no
quota and are deliberately not logged, so these counts track **provider consumption rather than
user traffic**. A Celery Beat task (`aggregate_autocomplete_stats`, every 10 minutes) rolls unprocessed
rows into `AutocompletePeriodStats`, marks them processed, and deletes rows older than 7 days.

**Key fields**:
- `provider` — `nominatim` or `locationiq`; which upstream served the request
- `minute_key` — epoch minutes, for grouping
- `processed` — whether the aggregation task has consumed this row
- `created_at` — used for both aggregation bucketing and cleanup

### AutocompletePeriodStats

**Summary**: Aggregated autocomplete request metrics per period **and provider**.

**Description**: One row per `(period_type, period_key, provider)` — so a single day has one row for
LocationIQ and one for Nominatim. Written only by `aggregate_autocomplete_stats`, read by
`GET /api/autocomplete_stats/` and by the `LOCATIONIQ_DAILY_BUDGET` guard, which uses today's
LocationIQ total to stop calling LocationIQ once the daily allowance is spent.

**Key fields**:
- `period_type` / `period_key` — `day` (`2026-08-03`), `week` (`2026-W32`), or `month` (`2026-08`)
- `provider` — part of the uniqueness constraint, not just a label
- `total_requests`, `avg_req_per_second`
- `peak_req_per_second` — the highest number of requests that arrived **within a single second**,
  counted per provider. This is the figure to watch against LocationIQ's 2 req/s ceiling; it is
  deliberately not a per-minute average, and Nominatim fallback traffic must not inflate it.

---

## 7. Climate Match Entities (climate_match)

### Question

**Summary**: Questionnaire questions for climate matching algorithm.

**Description**: Represents survey questions used to match users with relevant projects, organizations, and hubs. Questions have dynamic answer types defined via ContentType (multiple choice, text, scale, etc.) and support translations. Used in intelligent matching algorithms.

**Relationships**:
- **ForeignKey**: `Language`, `ContentType` (answer_type - polymorphic answer format)
- **Referenced by**: `QuestionTranslation`, `Answer`, `UserQuestionAnswer`

---

### Answer

**Summary**: Predefined answer options for questions.

**Description**: Possible answers for multiple-choice and scale-type questions. Linked to metadata that weights answers for matching algorithms. Supports translations for multilingual questionnaires.

**Relationships**:
- **ForeignKey**: `Question`, `Language`
- **ManyToMany**: `AnswerMetaData` (weighting for matching)
- **Referenced by**: `AnswerTranslation`, `UserQuestionAnswer`

---

### AnswerMetaData

**Summary**: Weighting data for intelligent matching.

**Description**: Contains metadata that weights user answers for matching algorithms. Links answers to specific resources (projects, organizations, sectors, skills) via ContentType polymorphic relationships. Enables sophisticated matching logic.

**Relationships**:
- **ForeignKey**: `ContentType` (resource_type - polymorphic to match targets)
- **ManyToMany with**: `Answer`, `UserQuestionAnswer`

---

### UserQuestionAnswer

**Summary**: User responses to climate match questionnaire.

**Description**: Records user answers to questionnaire questions. Can store predefined answers or free-text responses. Hub-scoped to enable different matching profiles for different communities. Links to metadata for matching algorithm processing.

**Relationships**:
- **ForeignKey**: `User`, `Question`, `Answer` (predefined_answer - nullable), `Hub`
- **ManyToMany**: `AnswerMetaData` (answers - weighted metadata)

---

## 8. Auth Entities (auth_app)

> Added in US-2 (Auth Unification epic). Pure data layer — no API endpoints yet.

### LoginToken

**Summary**: Short-lived operational token used in the OTP (passwordless) login flow.

**App**: `auth_app`  
**Table**: `auth_app_logintoken`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | Prevents ID enumeration |
| `user` | FK → `auth.User`, nullable | Set after lookup; null for unrecognised emails (enumeration prevention) |
| `email` | EmailField, indexed | Address the code was sent to |
| `token_hash` | CharField(64) | SHA-256 hash of the raw 6-digit code — raw code never stored |
| `session_key` | CharField(64), unique | 32-byte hex random value; ties the token to the browser tab |
| `expires_at` | DateTimeField, indexed | `now + 15 minutes` |
| `used_at` | DateTimeField, nullable | Set on first successful use; null = not yet used |
| `attempt_count` | PositiveSmallIntegerField | Default 0; token locked at 5 failed attempts |
| `created_at` | DateTimeField, auto | Creation timestamp |

**Key rules**:
- One active token per email at a time (enforced in service/view layer).
- Raw code never persisted — only its hash.
- `session_key` is the security anchor, stored in browser `sessionStorage`.

**Retention** (via `cleanup_login_tokens` Celery task, every 30 min):
- Used tokens deleted 24 h after `used_at`.
- Unused expired tokens deleted 1 h after `expires_at`.

---

### LoginAuditLog

**Summary**: Append-only audit table for security monitoring of OTP login events.

**App**: `auth_app`  
**Table**: `auth_app_loginauditlog`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `user` | FK → `auth.User`, nullable | Null if email not found |
| `email` | EmailField, indexed | Email used in the attempt |
| `outcome` | CharField(choices) | `requested` / `verified` / `failed` / `expired` / `exhausted` / `resent` |
| `ip_address` | GenericIPAddressField, nullable | Anonymised (last octet zeroed for IPv4, GDPR) |
| `user_agent` | TextField, nullable | Optional user-agent string |
| `created_at` | DateTimeField, auto, indexed | Event timestamp |

**Key rules**:
- Append-only — rows must never be mutated after writing.
- IP anonymisation applied in the view/service layer before saving.
- Django Admin is read-only; no add/change/delete permissions.

**Retention** (via `cleanup_login_audit_logs` Celery task, daily at 03:00 UTC):
- Entries purged after 90 days.

---

## 9. Cross-Cutting Patterns

### Translation Support

Most user-facing entities have corresponding translation models to support internationalization:
- `ProjectTranslation`, `OrganizationTranslation`, `HubTranslation`, `IdeaTranslation`
- `PostTranslation`, `CommentTranslation`
- `QuestionTranslation`, `AnswerTranslation`
- `LocationTranslation`, `HubStatTranslation`, `HubSupporterTranslation`

All translation models follow the pattern:
- **ForeignKey**: Parent entity, `Language`
- **Unique constraint**: (parent, language)

### Soft Deletion

Comments and Posts use soft deletion via `deleted_by` ForeignKey to User, preserving data integrity while hiding deleted content.

### Notification System

Many entities trigger notifications when actions occur:
- `Project`, `Organization` → follows, likes, publications
- `Comment` entities → replies and mentions
- `MembershipRequests` → approval workflows
- `Message` → chat notifications
- `IdeaSupporter` → endorsements

### Hub Integration

Hubs are a central organizing principle connecting:
- Users (via `UserProfile.related_hubs`)
- Projects and Organizations (via `related_hubs` ManyToMany)
- Ideas (via `main_hub` and `hub_shared_in`)
- Donations (via `DonationGoal.hub`)
- Climate Match (via `UserQuestionAnswer.hub`)
- Geographic and sector filters

### Skill & Role-Based Access

- `Skill` connects users to projects for matching
- `Role` governs permissions in projects, organizations, and chats
- `Availability` defines time commitment across memberships

---

## 9. Entity Relationship Summary

### Core Relationships

```
User (Django auth)
├── UserProfile (OneToOne)
│   ├── Skills (ManyToMany)
│   ├── Location (ForeignKey)
│   ├── Hubs (ManyToMany - related_hubs)
│   ├── Availability (ForeignKey)
│   └── Sectors (ManyToMany via UserProfileSectorMapping)
│
├── ProjectMember (user participation)
│   ├── Project (ForeignKey)
│   ├── Role (ForeignKey)
│   └── Availability (ForeignKey)
│
├── OrganizationMember (user participation)
│   ├── Organization (ForeignKey)
│   ├── Role (ForeignKey)
│   └── Availability (ForeignKey)
│
├── Idea (creator)
├── Donation (donor)
├── Message (sender)
├── Comments (author)
├── Notifications (recipient)
└── Badges (via UserBadge)

Organization
├── Location (ForeignKey)
├── Parent Organization (ForeignKey Self)
├── Hubs (ManyToMany - primary and related)
├── Sectors (ManyToMany via OrganizationSectorMapping)
├── Tags (ManyToMany via OrganizationTagging)
├── Members (OrganizationMember)
├── Projects (via ProjectParents)
└── Followers (OrganizationFollower)

Project
├── Location (ForeignKey)
├── Status (ForeignKey)
├── Skills Required (ManyToMany)
├── Hubs (ManyToMany - related_hubs)
├── Sectors (ManyToMany via ProjectSectorMapping)
├── Tags (ManyToMany via ProjectTagging) [DEPRECATED - not exposed via API]
├── Parent (Organization or User via ProjectParents)
├── Collaborators (Organizations via ProjectCollaborators)
├── Members (ProjectMember)
├── Posts (updates)
├── Comments (ProjectComment)
├── Followers (ProjectFollower)
├── Likes (ProjectLike)
└── EventRegistrationConfig (OneToOne - event type only, nullable)
    ├── Fields: max_participants, registration_end_date, status, notify_admins
    ├── RegistrationField (ForeignKey - custom form fields)
    │   ├── Fields: field_type, order, is_required, label, settings
    │   └── RegistrationFieldOption (ForeignKey - selectable options)
    │       ├── Fields: title, order, available_amount, max_amount_per_guest, start_time, end_time
    │       └── Referenced by RegistrationFieldAnswer.value_option
    └── EventRegistration (ForeignKey - registered users)
        ├── Fields: user, registered_at, cancelled_at, cancelled_by
        └── RegistrationFieldAnswer (ForeignKey - custom field responses)
            ├── Fields: field, value_boolean, value_option, value_number
            ├── FK → RegistrationField
            └── FK → RegistrationFieldOption

Hub
├── Parent Hub (ForeignKey Self)
├── Locations (ManyToMany)
├── Sectors (ManyToMany)
├── Stats (ManyToMany HubStat)
├── Filter Tags (ManyToMany ProjectTags) [DEPRECATED - retired with project tags]
├── Theme (OneToOne HubTheme)
├── Ambassadors (HubAmbassador)
├── Supporters (HubSupporter)
└── Associated Content:
    ├── Users (via UserProfile.related_hubs)
    ├── Projects (via related_hubs)
    ├── Organizations (via hubs/related_hubs)
    ├── Ideas (via main_hub/hub_shared_in)
    └── Donation Goals (via hub)

Idea
├── Creator (User ForeignKey)
├── Organization (ForeignKey - optional)
├── Main Hub (ForeignKey)
├── Hub Shared In (ForeignKey)
├── Location (ForeignKey)
├── Comments (IdeaComment)
├── Ratings (IdeaRating)
└── Supporters (IdeaSupporter)

MessageParticipants (Chat)
├── Creator (User ForeignKey)
├── Related Idea (ForeignKey - optional)
├── Messages (Message)
├── Participants (Participant with Roles)
└── Message Receivers (MessageReceiver)

ClimateMatch
├── Question
│   ├── Answers (predefined options)
│   │   └── AnswerMetaData (ManyToMany - matching weights)
│   └── UserQuestionAnswer (user responses)
│       ├── Hub (ForeignKey - scoped matching)
│       └── AnswerMetaData (ManyToMany - selected weights)
```

---

## 10. Key Design Principles

1. **Multilingual First**: Dedicated translation tables for all user-facing content
2. **Hub-Centric**: Hubs organize and filter all major content types
3. **Geographic Awareness**: PostGIS integration for spatial queries and location-based discovery
4. **Flexible Relationships**: Organizations can own projects, users can create projects independently
5. **Engagement Tracking**: Followers, likes, comments, and supporters across entities
6. **Permission Model**: Role-based access control for collaborative entities
7. **Notification System**: Event-driven notifications for platform activity
8. **Soft Deletion**: Preserve data integrity for comments and posts
9. **Hierarchical Structures**: Parent-child relationships for organizations, hubs, tags, skills, sectors
10. **Matching Intelligence**: ClimateMatch system with weighted metadata for user-project-organization matching

---

## Total Entity Count

- **Core Domain Models**: 80+ entities
- **Translation Support Tables**: 14 models
- **Mapping/Junction Tables**: 15+ models for many-to-many relationships
- **Total**: 100+ database tables

This architecture supports a comprehensive climate action platform with social networking, project management, real-time messaging, gamification, multilingual support, and intelligent matching capabilities.

## Version History

- **2025-11-27**: Initial documentation
- **2026-03-19**: Added `EventRegistrationConfig` entity (GitHub issue #43). New 1-to-1 relationship on `Project` (event type only) for online registration settings (`max_participants`, `registration_end_date`). Updated `Project` relationships and Entity Relationship Summary tree.
- **2026-03-19**: Added `status` field to `EventRegistrationConfig` (`RegistrationStatus` enum: `open`/`closed`/`full`). Prepares for use cases: organiser manually closing registration and system auto-closing when capacity is reached.
- **2026-03-30**: Added `EventRegistration` entity (GitHub issue #1845). Join table recording which users have registered for an event. Includes `select_for_update` seat-locking, `unique_together` constraint, and two DB indexes. `EventRegistrationConfig.status` is atomically promoted to `"full"` when the last seat is taken. Updated `EventRegistrationConfig` relationships section and ER tree.
- **2026-03-31**: Added computed `"ended"` status to `EventRegistrationConfig` API responses (issue #1848). Returned by `EventRegistrationConfigSerializer.to_representation` via `_compute_effective_status` when stored status is `open` but `registration_end_date` has passed — never written to DB. Updated `RegistrationStatus` table to include `ended`. Removed draft-mode guard from `EditEventRegistrationConfigSerializer` (published events cannot revert to draft; guard was dead code). Updated `EventRegistrationConfigSerializer` description — write path is create-only (`POST /api/projects/`); `registration_config` handling removed from `PATCH /api/projects/{slug}/`.
- **2026-03-31**: `status` is now organiser-writable via `PATCH /api/projects/{slug}/registration-config/` (issue #1851). `EditEventRegistrationConfigSerializer` accepts `"open"` and `"closed"`; `"full"` and `"ended"` are rejected with 400 (system-managed). Reopen guard in `validate()` returns 400 when `effective_status == "ended"` — organiser must extend `registration_end_date` first. `full` → `open` organiser override is permitted. When `status` is explicitly included in the PATCH body, auto-adjustment from `max_participants` changes is skipped (organiser intent takes priority). `EventRegistrationsView` guard consolidated to a single `_compute_effective_status()` check with contextual error messages per status value. `RegistrationStatus.ENDED` added as a Python-side-only enum constant (never stored in DB).
- **2026-03-31**: Added fully-booked reopen guard to `EditEventRegistrationConfigSerializer.validate()`. `status = "open"` is now rejected with 400 when participant count ≥ effective `max_participants` (uses the new `max_participants` value if it is being changed in the same PATCH). This prevents an organiser from reopening a `closed` or `full` registration when the event has no available seats — they must increase capacity first. An organiser can still reopen a booked-out event by including a higher `max_participants` value in the same request. Shared `participant_count` sentinel prevents double-querying when both fields are present in a single PATCH.
- **2026-04-02**: Renamed models for clarity: `EventRegistration` (config) → `EventRegistrationConfig`; `EventParticipant` (sign-up record) → `EventRegistration`. Updated related_names (`event_registration` → `registration_config`, `participants` → `registrations`, `event_participations` → `event_registrations`). API JSON key renamed `event_registration` → `registration_config`. Endpoints renamed: `POST /register/` → `POST /registrations/`, `PATCH /registration/` → `PATCH /registration-config/`. Views renamed: `RegisterForEventView` + `ListEventRegistrationsView` → combined `EventRegistrationsView`; `EditEventRegistrationSettingsView` → `EditRegistrationConfigView`.
- **2026-04-09**: Added soft-delete to `EventRegistration` (issues #1850, #1872). Two new nullable columns: `cancelled_at` (DateTimeField) and `cancelled_by` (ForeignKey → User, SET_NULL). All seat-count queries now filter `cancelled_at IS NULL`. Lifecycle: Active (both NULL) → Cancelled (both set) → Re-registered (both reset to NULL). `cancelled_by == user` means self-cancellation (re-registration allowed); `cancelled_by != user` means admin-cancellation (re-registration blocked). New endpoints: `DELETE /api/projects/{slug}/registrations/` (member self-cancel, issue #1850) and `DELETE /api/projects/{slug}/registrations/{id}/` (admin cancel guest, issue #1872). `EventRegistrationSerializer` now includes `id` and `cancelled_at`; `GET /registrations/` returns all rows (active + cancelled). `GET /projects/{slug}/my_interactions/` extended with `has_attended` (bool) and `admin_cancelled` (bool); `is_registered` now filtered by `cancelled_at IS NULL`. New email helper `send_guest_cancellation_notification` uses Mailjet templates `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID` / `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID_DE`.
- **2026-05-20**: Added `RegistrationField` and `RegistrationFieldOption` entities (issue #1880). Custom registration fields let organisers add checkbox and option-select questions to their event registration form. `RegistrationField` has `field_type` (checkbox, option_select), `order`, `is_required`, `settings` (JSON). Up to 5 fields per event. `RegistrationFieldOption` stores selectable options with `title` and `order`. Both have unique constraints and CASCADE deletes. Added to `EventRegistrationConfig` relationships. Updated ER tree.
- **2026-05-24**: Added `RegistrationFieldAnswer` entity (issue #2004). Stores registrant responses to custom fields. Polymorphic value columns: `value_boolean` (checkbox), `value_option` FK (option_select/inventory/time_slot_select), `value_number` (inventory quantity). Synced atomically via `sync_registration_answers()` on registration POST. `unique_together = [("registration", "field")]`. Updated ER tree. `EventRegistration` now has `field_answers` reverse relationship.
- **2026-05-25**: Added `inventory` and `time_slot_select` field types to `RegistrationField.field_type` choices (issues #1995, #2006). `RegistrationFieldOption` extended with `available_amount`, `max_amount_per_guest` (inventory capacity) and `start_time`, `end_time` (time slot bounds). `RegistrationFieldAnswer` extended with `value_number` for inventory quantity. Updated `RegistrationField` description to document all four field types.
- **2026-05-26**: Added `label` field to `RegistrationField` (max 30 chars, unique per config) and `notify_admins` field to `EventRegistrationConfig` (default `True`). Labels are auto-generated on creation and organiser-editable for export display. `notify_admins` controls whether team admins receive notification emails on registration changes.
- **2026-06-10**: Added `last_guest_email_sent_at` field to `EventRegistrationConfig` (DateTimeField, nullable, indexed). Records when the last non-test bulk email was sent to event guests; used to filter "new guests only" recipients. Frontend toggle allows organisers to send emails only to guests who registered after the last bulk send.
- **2026-07-02**: Added `description_html` field to `Project` (TextField, nullable) and `description_html_translation` to `ProjectTranslation` (TextField, nullable). Project descriptions now use rich-text HTML produced by a Tiptap editor, supporting bold, italic, lists, links, blockquotes, and YouTube embeds. The legacy `description` field is kept (read-only) for backwards compatibility. ICS calendar attachments use `short_description` (plain text) instead of the HTML description. Updated `Project` entity documentation with key fields and rich-text feature.
