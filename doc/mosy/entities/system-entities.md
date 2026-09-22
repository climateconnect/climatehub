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

### EventRegistrationConfig
- **Definition**: Event registration configuration. Presence of this record signals that registration is enabled for an event.
- **Properties**:
  - `max_participants`: PositiveInteger, nullable
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
