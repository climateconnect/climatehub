# System Entities

This document defines the core system entities for Climate Connect, serving as the "Data Model" view of the Mosy Framework.

## 1. Identity & Access

### User
- **Definition**: The central actor on the platform. Extends Django's authentication user.
- **Properties**:
  - `id`: UUID
  - `email`: String (Unique)
  - `first_name`: String
  - `last_name`: String
  - `bio`: Text
  - `is_verified`: Boolean
  - `verification_status`: Enum
- **Relationships**:
  - Has One `UserProfile` (Extended attributes).
  - Has Many `UserBadge` (Gamification).
  - Has Many `Skill` (Capabilities).
  - Belongs to `Location`.
  - Owns Many `RichTextImage` (uploads for rich-text descriptions).

### Role
- **Definition**: Access control definition for members of groups.
- **Properties**:
  - `name`: String (e.g., "Admin", "Member")
  - `permissions`: JSON/Bitmask
- **Relationships**:
  - Used by `ProjectMember`, `OrganizationMember`, `Participant`.

### Availability
- **Definition**: Time commitment level a user can pledge.
- **Properties**: `label` (e.g., "5-10 hours/week").
- **Relationships**: Referenced by `UserProfile`, `MembershipRequests`.

## 2. Climate Action (Core Domain)

### Organization
- **Definition**: Legal entity or group (NGO, Company) acting on the platform.
- **Properties**:
  - `name`: String
  - `type`: Enum (NGO, Startup, Corporate)
  - `description`: Text
  - `logo`: ImageURL
- **Relationships**:
  - Has Many `Project` (Owner).
  - Has Many `OrganizationMember` (Staff/Volunteers).
  - Has Many `Hub` (Affiliations).
  - Has Many `Sector` (Focus areas).

### Project
- **Definition**: A specific initiative, event, or campaign to address climate issues.
- **Properties**:
  - `title`: String
  - `status`: Enum (Idea, In-Progress, Finished, Cancelled)
  - `description`: Text
  - `start_date`: Date
  - `end_date`: Date
- **Relationships**:
  - Owned by `Organization` or `User`.
  - Located at `Location`.
  - Requires `Skill` (Matching).
  - Has Many `ProjectMember` (Team).
  - Has Many `Post` (Updates).
  - Has One `EventRegistrationConfig` (Registration configuration, introduced in [#1820](https://github.com/climateconnect/climateconnect/issues/1820)).
  - Has Many `RichTextImageUsage` (images used in its description, any language version).

### EventRegistrationConfig
- **Definition**: Event registration configuration. Presence of this record signals that registration is enabled for an event.
- **Properties**:
  - `max_participants`: PositiveInteger, nullable
  - `max_seats_per_registration`: PositiveInteger (default 1) — maximum seats one registration may book (introduced in [#2348](https://github.com/climateconnect/climatehub/issues/2348))
  - `registration_end_date`: DateTimeField, nullable
  - `status`: Enum (`open`, `closed`, `full`)
  - `notify_admins`: Boolean (default true)
- **Relationships**:
  - OneToOneFK → `Project`
  - Has Many `EventRegistration` (User sign-up records)
  - Has Many `RegistrationField` (Custom registration fields)

### EventRegistration
- **Definition**: A user's registration record for an event. One row per user per event.
- **Properties**:
  - `registered_at`: DateTimeField
  - `number_of_seats`: PositiveInteger (default 1) — seats booked by this registration; 1 for all rows predating [#2348](https://github.com/climateconnect/climatehub/issues/2348)
  - `cancelled_at`: DateTimeField, nullable (NULL = active registration)
  - `cancelled_by`: FK → User, nullable (self-cancel vs admin-cancel distinction)
  - `cancellation_reason`: TextField, nullable (optional guest-provided reason at self-cancellation; persists across re-registration)
- **Relationships**:
  - FK → `User`
  - FK → `EventRegistrationConfig`
  - Has Many `RegistrationFieldAnswer` (Custom field responses)
  - UNIQUE constraint: `(user, registration_config)`

### RegistrationField (introduced in [#1880](https://github.com/climateconnect/climateconnect/issues/1880))
- **Definition**: A custom field on an event's registration form.
- **Properties**:
  - `field_type`: Enum (`checkbox`, `option_select`, `inventory`, `time_slot_select`)
  - `order`: PositiveIntegerField (position in the form)
  - `is_required`: BooleanField
  - `label`: CharField, max 30 chars (organiser-facing label for export/display)
  - `settings`: JSONField (type-specific settings: checkbox stores HTML description, option_select/inventory/time_slot_select store title + description)
- **Relationships**:
  - FK → `EventRegistrationConfig` (CASCADE delete)
  - Has Many `RegistrationFieldOption` (for option_select, inventory, time_slot_select fields)
  - Has Many `RegistrationFieldAnswer` (registrant's answers)

### RegistrationFieldOption (introduced in [#1880](https://github.com/climateconnect/climateconnect/issues/1880))
- **Definition**: A selectable option within option_select, inventory, or time_slot_select `RegistrationField`.
- **Properties**:
  - `title`: CharField, max 200 chars (display label; defaults to "")
  - `order`: PositiveIntegerField
  - `available_amount`: PositiveIntegerField, nullable (capacity limit for inventory fields)
  - `max_amount_per_guest`: PositiveIntegerField, nullable (max quantity per registrant for inventory fields)
  - `start_time`: DateTimeField, nullable (for time_slot_select fields)
  - `end_time`: DateTimeField, nullable (for time_slot_select fields)
- **Relationships**:
  - FK → `RegistrationField` (CASCADE delete)
  - UNIQUE constraint: `(field, order)`

### RegistrationFieldAnswer
- **Definition**: A registrant's answer to a custom `RegistrationField`. Stored when a user submits their event registration.
- **Properties**:
  - `value_boolean`: BooleanField, nullable (for checkbox fields)
  - `value_option`: FK → `RegistrationFieldOption`, nullable (for option_select, inventory, and time_slot_select fields)
  - `value_number`: PositiveIntegerField, nullable (quantity for inventory fields)
  - `created_at`: DateTimeField
  - `updated_at`: DateTimeField
- **Relationships**:
  - FK → `EventRegistration` (CASCADE delete, related_name: `field_answers`)
  - FK → `RegistrationField` (CASCADE delete, related_name: `answers`)
  - FK → `RegistrationFieldOption` (CASCADE delete, related_name: `answers`)
  - UNIQUE constraint: `(registration, field)`

### MembershipRequest
- **Definition**: A request from a user to join a Project or Organization.
- **Properties**:
  - `status`: Enum (Pending, Approved, Rejected)
  - `message`: Text
- **Relationships**:
  - Links `User` to `Project` OR `Organization`.

## 3. Community & Hubs

### Hub
- **Definition**: A community space organized by geography (City/Country) or sector (Topic).
- **Properties**:
  - `name`: String
  - `slug`: String (URL identifier)
  - `type`: Enum (Location, Sector, Custom)
- **Relationships**:
  - Parent `Hub` (Hierarchy).
  - Has Many `HubAmbassador` (Leaders).
  - Has Many `Project` (Aggregated content).

### HubTheme
- **Definition**: Visual customization for a specific Hub.
- **Properties**: `primary_color`, `header_image`.
- **Relationships**: Belongs to `Hub`.

### Sector
- **Definition**: Climate focus area (e.g., Energy, Transport).
- **Properties**: `name`.
- **Relationships**: Used to categorize `Project`, `Organization`, `User`.

## 4. Innovation & Ideas (deprecated)

### Idea
- **Definition**: An early-stage proposal or concept that is not yet a full project.
- **Properties**:
  - `title`: String
  - `summary`: Text
  - `impact_potential`: Text
- **Relationships**:
  - Created by `User`.
  - Shared in `Hub`.
  - Has Many `IdeaSupporter` (Endorsements).
  - Has Many `IdeaRating` (Feasibility scores).

## 5. Communication

### MessageParticipants (Conversation)
- **Definition**: A chat container (thread) for users.
- **Properties**: `created_at`.
- **Relationships**:
  - Has Many `Participant` (Users).
  - Has Many `Message`.
  - Can relate to `Idea` (Context).

### Message
- **Definition**: A single text unit in a conversation.
  - **Properties**: `content`, `sent_at`, `origin_type` (context tag: `""` / `event_registration` / `project` / `organization` / `hub`; server-set), `origin_id` (PK of origin entity, nullable).
- **Relationships**:
  - Sent by `User`.
  - Belongs to `MessageParticipants`.

### Notification
- **Definition**: System alert for a user (18+ types).
- **Properties**: `type`, `is_read`.
- **Relationships**:
  - Target `User`.
  - Triggered by `Event` (Comment, Like, Follow).

## 6. Geography

### Location
- **Definition**: Spatial reference point using PostGIS.
- **Properties**:
  - `address`: String
  - `coordinates`: Point/MultiPolygon (PostGIS)
  - `osm_id`: String (OpenStreetMap reference)
  - `city`, `country`: String
- **Relationships**: Referenced by almost all core entities (`Project`, `User`, `Hub`).

## 7. Platform Configuration

### FeatureToggle
- **Definition**: A feature flag system for enabling/disabling features across environments.
- **Properties**:
  - `name`: String (Unique, uppercase with underscores, e.g., "NEW_DASHBOARD")
  - `description`: Text (Description of what this feature controls)
  - `production_is_active`: Boolean
  - `staging_is_active`: Boolean
  - `development_is_active`: Boolean
  - `created_at`: DateTime
  - `updated_at`: DateTime
- **Relationships**: None (standalone configuration entity)
- **Usage**: Used to control feature availability without deployment. Supports environment-specific toggling (production, staging, development).

## 8. Donations

### DonationGoal
- **Definition**: A crowdfunding target shown as a progress bar ("current/goal") on hub crowdfunding pages during its period. Managed in the Django admin.
- **Properties**:
  - `name` (+ German translation), `description`: String
  - `start_date`, `end_date`: DateTime (period, inclusive at both ends)
  - `current_amount`, `goal_amount`: Positive integer (counted in units)
  - `unit`: String (display unit, optional)
  - call-to-action text (+ German translation) and link: String (optional)
  - Twingle project id mapping: String (optional, e.g. `tw6a3547480226a`; blank = manual only). Introduced in [#2388](https://github.com/climateconnect/climatehub/issues/2388)
  - Unit price: Decimal, € per month, > 0, default 7. Introduced in [#2388](https://github.com/climateconnect/climatehub/issues/2388)
  - `twingle_last_delivery_at`: DateTime (nullable, read-only in admin). Last validly signed Twingle delivery for the mapped project, counted or not; liveness check. Introduced in [#2388](https://github.com/climateconnect/climatehub/issues/2388)
- **Relationships**: Optionally belongs to `Hub`.
- **Rules**:
  - At most one goal per Twingle project id (unique constraint on non-blank values).
  - `current_amount` is edited by admins and incremented by the Twingle webhook (flow 11). The Twingle project mapping and the unit price aren't exposed by the public API.

## 9. Rich-Text Images

Images inside rich-text descriptions. v1: project description only; built to serve other rich-text fields (e.g. organisation description) without redesign. Spec: `doc/spec/20260708_1302_rich_text_image_support.md`.

### RichTextImage
- **Definition**: One uploaded image. Uploaded before and independently of the entity save; owned by the uploading user, not by a project or organisation.
- **Properties**:
  - `original`: Image file. The upload unchanged except for losslessly removed metadata (GPS, camera data); orientation kept. Never linked publicly.
  - `variants`: JSON. Storage paths and real pixel sizes of the WebP variants (600 and 1200 px wide, never upscaled).
  - `width`, `height`: Positive integers (original, after orientation).
  - `file_size`: Positive integer (bytes); `format`: `jpeg` / `png` / `webp` (detected from content).
  - `created_at`: DateTime (upload date).
- **Relationships**:
  - FK → `User` (owner), nullable, SET_NULL.
  - Has Many `RichTextImageUsage`.
- **Rules**:
  - Referenced in stored HTML by its id (`data-image-id` on the `<img>`); the `<img>` carries the variant URLs (`srcset`, `src` = largest variant).
  - Unused images (no usage) are kept; a cleanup job is a follow-up.
  - When the owner's account is deleted, unused images are deleted and used images are kept with the owner cleared.
  - Deleting an image deletes its original and variant files.

### RichTextImageUsage
- **Definition**: Records that an image appears in one rich-text field of one entity, in any of its language versions.
- **Properties**:
  - `field`: Choice (v1: `project_description`).
  - `created_at`: DateTime.
- **Relationships**:
  - FK → `RichTextImage` (CASCADE).
  - FK → `Project`, nullable (CASCADE: deleting the project unlinks its images, the images stay). Further entity types get their own nullable FK.
- **Rules**:
  - Exactly one entity FK is set. UNIQUE `(image, project, field)`.
  - Maintained only by the save-time sync: after each save the usages are reconciled with the image ids found in the persisted HTML of the original and all translations.
  - An image may be added to an entity's text only if the saving user owns it or it is already used in that entity.
