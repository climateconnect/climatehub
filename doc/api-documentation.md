# ClimateConnect API Documentation

This guide explains how to access and use the ClimateConnect REST API for local development and integration purposes.

## Table of Contents
- [API Overview](#api-overview)
- [Getting an Authentication Token](#getting-an-authentication-token)
- [Using the API with Swagger UI](#using-the-api-with-swagger-ui)
- [Using the API with Postman](#using-the-api-with-postman)
- [Using the API with curl](#using-the-api-with-curl)
- [API Authentication](#api-authentication)
- [Common Endpoints](#common-endpoints)
- [Troubleshooting](#troubleshooting)

---

## API Overview

The ClimateConnect API is built with Django REST Framework and provides endpoints for:
- **Projects**: Browse, create, and manage climate action projects
- **Organizations**: Discover and manage climate organizations
- **Members**: Find climate activists and collaborators
- **Hubs**: Access location-based and sector-based climate hubs
- **Ideas**: Share and discover climate action ideas
- **Messaging**: Private and group chat functionality

**Base URLs:**
- **Local Development**: `http://localhost:8000`
- **Production**: `https://api.climateconnect.earth`

**API Documentation:**
- **Local Swagger UI**: http://localhost:8000/api/docs/
- **Local OpenAPI Schema**: http://localhost:8000/api/schema/

---

## Getting an Authentication Token

Many API endpoints require authentication using a Knox token. Here's how to obtain one:

### Option 1: Using Django Shell (Recommended for Development)

1. **Start the Django shell:**
   ```bash
   cd backend
   python manage.py shell
   ```

2. **Create a token for your user:**
   ```python
   from django.contrib.auth.models import User
   from knox.models import AuthToken

   # Get your user (replace 'your_username' with your actual username)
   user = User.objects.get(username='your_username')

   # Create a token
   instance, token = AuthToken.objects.create(user)

   # Print the token
   print(f"\nYour API Token: {token}\n")
   print("Save this token - you won't be able to see it again!")
   ```

3. **Copy and save the token** that is displayed. You'll need it for API requests.

### Option 2: Using the Login API Endpoint

1. **Send a POST request to the login endpoint:**
   ```bash
   curl -X POST http://localhost:8000/login/ \
     -H "Content-Type: application/json" \
     -d '{"email": "your@email.com", "password": "your_password"}'
   ```

2. **Extract the token from the response:**
   ```json
   {
     "token": "your_authentication_token_here",
     "user": { ... }
   }
   ```

### Token Properties

- **Format**: Knox tokens are long alphanumeric strings (e.g., `9f0ae9d697dd662288d5b018fb8a9c629a4868b07e3efbc91d179da0e2a8494c`)
- **Validity**: Tokens are valid for 120 days by default
- **Security**: Never commit tokens to version control or share them publicly

---

## Using the API with Swagger UI

Swagger UI provides an interactive interface to explore and test the API.

### Accessing Swagger UI

1. **Start the Django development server** (if not already running):
   ```bash
   cd backend
   make start
   ```

2. **Open Swagger UI in your browser:**
   ```
   http://localhost:8000/api/docs/
   ```

### Authenticating in Swagger UI

1. **Click the "Authorize" button** (🔓 lock icon) at the top right of the Swagger UI page

2. **Enter your token** in the following format:
   ```
   Token your_authentication_token_here
   ```
   
   Example:
   ```
   Token 9f0ae9d697dd662288d5b018fb8a9c629a4868b07e3efbc91d179da0e2a8494c
   ```

3. **Click "Authorize"** then **"Close"**

4. **The lock icon will now be closed (🔒)** indicating you're authenticated

### Testing Endpoints

1. **Browse available endpoints** in the Swagger UI interface

2. **Click on any endpoint** to expand it

3. **Click "Try it out"** to enable the test interface

4. **Fill in any required parameters**

5. **Click "Execute"** to send the request

6. **View the response** below the Execute button, including:
   - HTTP status code
   - Response body (JSON)
   - Response headers

### Example: Listing Projects

1. Navigate to `GET /api/projects/`
2. Click "Try it out"
3. (Optional) Add query parameters like `?page=1&hub=erlangen`
4. Click "Execute"
5. See the list of projects in the response

---

## Using the API with Postman

Postman is a popular API client for testing and development.

### Importing the OpenAPI Schema

1. **Open Postman**

2. **Click "Import"** in the top left

3. **Choose "Link"** tab

4. **Enter the schema URL:**
   ```
   http://localhost:8000/api/schema/
   ```

5. **Click "Continue"** then **"Import"**

6. **All API endpoints** will now be available in your Postman collections

### Setting Up Authentication

#### Option A: Collection-Level Authorization (Recommended)

1. **Right-click the imported collection** → **Edit**

2. **Go to the "Authorization" tab**

3. **Select Type:** `API Key`

4. **Configure:**
   - **Key**: `Authorization`
   - **Value**: `Token your_authentication_token_here`
   - **Add to**: `Header`

5. **Click "Save"**

All requests in the collection will now automatically include your token.

#### Option B: Request-Level Authorization

For individual requests:

1. **Select a request**

2. **Go to the "Headers" tab**

3. **Add a new header:**
   - **Key**: `Authorization`
   - **Value**: `Token your_authentication_token_here`

### Testing Endpoints

1. **Select an endpoint** from the imported collection

2. **Review the pre-filled URL and parameters**

3. **Click "Send"**

4. **View the response** in the lower panel

### Example: Getting Your Profile

1. Select `GET {{baseUrl}}/api/my_profile/`
2. Ensure authorization is configured
3. Click "Send"
4. Your profile data will appear in the response

---

## Using the API with curl

For command-line API testing, use curl:

### Basic Authenticated Request

```bash
curl -H "Authorization: Token your_authentication_token_here" \
  http://localhost:8000/api/my_profile/
```

### POST Request Example (Creating a Project)

```bash
curl -X POST http://localhost:8000/api/projects/ \
  -H "Authorization: Token your_authentication_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Community Solar Project",
    "description_html": "<p>Installing solar panels in our <strong>neighborhood</strong></p>",
    "location": {
      "city": "Berlin",
      "country": "Germany"
    }
  }'
```

### GET Request with Query Parameters

```bash
curl -H "Authorization: Token your_authentication_token_here" \
  "http://localhost:8000/api/projects/?page=1&search=solar&hub=berlin"
```

---

## API Authentication

### Authentication Methods

ClimateConnect API supports two authentication methods:

1. **Knox Token Authentication** (recommended for API access)
   ```
   Authorization: Token your_token_here
   ```

2. **Session Authentication** (used by the frontend)
   - Automatically handled by Django sessions
   - Uses cookies for authentication

### Public vs. Authenticated Endpoints

#### Public Endpoints (No token required)

- `GET /api/projects/` - List projects
- `GET /api/organizations/` - List organizations
- `GET /api/members/` - List members
- `GET /api/hubs/` - List hubs
- `GET /api/about_faq/` - FAQ content
- `GET /api/schema/` - OpenAPI schema
- `GET /api/docs/` - Swagger UI

#### Authenticated Endpoints (Token required)

- `GET /api/my_profile/` - Your profile
- `POST /api/projects/` - Create project
- `PUT /api/projects/{slug}/` - Update project
- `POST /api/send_message/` - Send chat message
- `GET /api/notifications/` - Your notifications
- Most `POST`, `PUT`, `PATCH`, `DELETE` operations

### Checking If Authentication Is Required

In Swagger UI, endpoints with a 🔒 lock icon require authentication.

---

## Common Endpoints

### Auth

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/check-email` | POST | No | Check whether an email is new or returning (US-2b) |
| `/api/auth/request-token` | POST | No | Request a 6-digit OTP login code by email (US-3) |
| `/api/auth/verify-token` | POST | No | Verify the OTP code and receive a Knox auth token (US-4) |

#### POST `/api/auth/verify-token` — Verify OTP code and issue Knox token

Validates the 6-digit code the user received by email and, on success, issues an authenticated Knox token. This is the final step of the OTP login flow. Also serves the new-user account verification use case: when a new user completes signup and verifies their inbox via OTP, `is_profile_verified` is set to `True` atomically with the Knox token issuance.

**Authentication**: Not required (`AllowAny`).

**Request body**:
```json
{
  "session_key": "a3f8...64-char hex string",
  "code": "123456"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `session_key` | string | Yes | The `session_key` returned by `POST /api/auth/request-token` |
| `code` | string | Yes | The 6-digit code from the email |

**Success response** (200 OK):
```json
{
  "token": "<knox raw token>",
  "expiry": "2026-08-19T09:00:00Z",
  "user": { ... }
}
```
The `user` object uses the same `PersonalProfileSerializer` shape as `POST /login/`. The Knox `token` is a long alphanumeric string; `expiry` is an ISO 8601 datetime.

**Validation order**: checks are enforced sequentially — expired → already used → attempt limit → code hash. The first failing check returns immediately.

**Error responses**:
| Status | `detail` | Condition |
|--------|----------|-----------|
| 400 Bad Request | Field error | `session_key` or `code` missing or blank |
| 401 Unauthorized | `"Invalid or expired session."` | `session_key` not found |
| 401 Unauthorized | `"This code has expired. Please request a new one."` | Token `expires_at` is in the past |
| 401 Unauthorized | `"Invalid or expired session."` | Token already used (`used_at` is set) |
| 401 Unauthorized | `"Too many failed attempts. Please request a new code."` | `attempt_count ≥ 5` before submission |
| 401 Unauthorized | `"Invalid code. N attempt(s) remaining."` | Wrong code; N attempts left |
| 401 Unauthorized | `"Too many failed attempts. Please request a new code."` | Wrong code pushed `attempt_count` to 5 |
| 401 Unauthorized | `"Invalid or expired session."` | Race condition: concurrent request consumed the same token first |

**Security notes**:
- Code comparison uses `hmac.compare_digest` (constant-time) to prevent timing attacks.
- Failed attempts are incremented with a DB-level `F("attempt_count") + 1` expression to avoid read-modify-write races.
- The single-use guard uses `UPDATE … WHERE used_at IS NULL` and checks affected rows — if two concurrent requests both pass the checks, only the first one gets a Knox token; the second receives 401.
- IP address is anonymised (last octet zeroed for IPv4) before being stored in `LoginAuditLog`.

**Audit logging**: `LoginAuditLog` is written on every call regardless of outcome (`verified`, `failed`, `expired`, `exhausted`).

**New-user verification**: if `UserProfile.is_profile_verified` is `False` at success time, it is set to `True` before the Knox token is created. No separate email-link verification step is needed.

**curl example**:
```bash
curl -X POST http://localhost:8000/api/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{"session_key": "a3f8...", "code": "123456"}'
```

---

### Projects

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/projects/` | GET | No | List all projects |
| `/api/projects/` | POST | Yes | Create a new project |
| `/api/projects/{slug}/` | GET | No | Get project details |
| `/api/projects/{slug}/` | PATCH | Yes | Update a project |
| `/api/projects/{slug}/members/` | GET | No | List project members |
| `/api/projects/{slug}/registrations/` | POST | Yes | Register authenticated user for event |
| `/api/projects/{slug}/registration-config/` | PATCH | Yes | Update event registration settings (organiser only) |
| `/api/projects/{slug}/registrations/` | GET | Yes | List all registrations for an event (organiser/admin only) |
| `/api/projects/{slug}/registrations/` | DELETE | Yes | Cancel own registration (member self-cancellation) |
| `/api/projects/{slug}/registrations/{id}/` | PATCH | Yes | Cancel a specific guest's registration (organiser/admin only) |
| `/api/projects/{slug}/registrations/email/` | POST | Yes | Send email to all active guests (organiser/admin only) |
| `/api/event-registration-origin/{registration_id}/` | GET | Yes | Resolve event context for an event-registration-origin chat message (issue #2102) |

#### Deprecated and removed: project tag surface

As of **v2.5** the project tag taxonomy (`ProjectTags` / `ProjectTagging`) has been retired
from the API and replaced by [sectors](./domain-entities.md#sector). The models and their tables still exist —
see the deprecation note in
[domain-entities.md](./domain-entities.md#deprecation-project-tags-are-being-replaced-by-sector)
for why — but **nothing in the API reads or writes them any more**.

| Removed | Where | Behaviour now | Replacement |
|---|---|---|---|
| `GET /api/projecttags/` | endpoint | `404 Not Found` | `GET /api/sectors/` |
| `tags` | response field on `GET /api/projects/{slug}/` | absent from the payload | `sectors` |
| `tags` | response field on `GET /api/projects/` (and every other project-card response) | absent from the payload | `sectors` |
| `project_tags` | request field on `POST /api/create_project/` | **silently ignored** — still returns `201` | `sectors` |
| `project_tags` | request field on `PATCH /api/projects/{slug}/` | **silently ignored** — still returns `200` | `sectors` |
| `?category=` | query param on `GET /api/projects/` | **silently ignored** — returns the *unfiltered* list | `?sectors=` |

> ⚠️ **These removals fail open, not loud.** A client that still sends `project_tags` gets a
> success response with the tags silently discarded, and a bookmarked or search-indexed
> `GET /api/projects/?category=Energy` URL now returns *all* projects rather than an error.
> If you are debugging "my categories disappeared", this is the cause — it is not data loss.

**Note on `sectors` casing**: the read and write paths key off different `Sector` columns —
`?sectors=` filters on the sector **`name`** (e.g. `?sectors=Energy`), while the
`POST /api/create_project/` and `PATCH /api/projects/{slug}/` bodies expect the sector
**`key`** (e.g. `"sectors": ["energy"]`). `GET /api/sectors/` returns both.

#### Project description (`description_html`)

The project description uses rich-text HTML stored in `description_html`. The legacy `description` field (plain text) is kept for backwards compatibility but is no longer written to by new code.

**Accepted HTML tags** (server-sanitized): `p`, `strong`, `b`, `em`, `i`, `u`, `a`, `br`, `ul`, `ol`, `li`, `blockquote`, `div[data-youtube-video]`, `iframe` (YouTube-nocookie embeds only).

**Validation**:
- 20 000 characters on raw HTML (hard cap)
- 4 000 characters on stripped text content (soft cap, matches the frontend character counter)

**Translation**: `description_html` is auto-translated via DeepL with `tag_handling=html`. Translations are stored in `ProjectTranslation.description_html_translation` and returned in the `translations` array on the edit endpoint. The 4 000-char stripped limit is not enforced on translations (German text can exceed it).

**Display**: the project detail page renders `description_html` directly via `dangerouslySetInnerHTML`. YouTube iframes are rendered natively by the browser.

#### Event Registration (`registration_config`)

Event-type projects expose an optional nested `registration_config` object on all project endpoints. For non-event projects the field is always `null`.

**Response shape — detail** (`GET /api/projects/{slug}/`):
```json
{
  "registration_config": {
    "max_participants": 100,
    "registration_end_date": "2026-06-01T23:59:00Z",
    "status": "open",
    "available_seats": 42,
    "notify_admins": true,
    "fields": [
      {
        "id": 1,
        "field_type": "checkbox",
        "order": 0,
        "is_required": true,
        "label": "Waiver",
        "settings": { "description": "<p>I agree to the <b>terms</b></p>" },
        "options": [],
        "has_answers": false
      },
      {
        "id": 2,
        "field_type": "option_select",
        "order": 1,
        "is_required": false,
        "label": "T-shirt",
        "settings": { "title": "Select your size" },
        "options": [
          { "id": 10, "title": "S", "order": 0, "has_answers": false },
          { "id": 11, "title": "M", "order": 1, "has_answers": false },
          { "id": 12, "title": "L", "order": 2, "has_answers": false }
        ],
        "has_answers": false
      },
      {
        "id": 3,
        "field_type": "inventory",
        "order": 2,
        "is_required": false,
        "label": "Workshop",
        "settings": { "title": "Choose a workshop", "description": "Select workshop and quantity" },
        "options": [
          {
            "id": 20, "title": "Solar Panel Assembly", "order": 0,
            "available_amount": 10, "max_amount_per_guest": 2, "remaining_amount": 8,
            "has_answers": false
          }
        ],
        "has_answers": false
      },
      {
        "id": 4,
        "field_type": "time_slot_select",
        "order": 3,
        "is_required": false,
        "label": "Pickup time",
        "settings": { "title": "Select a pickup window" },
        "options": [
          {
            "id": 30, "title": "10:00–12:00", "order": 0,
            "start_time": "2026-06-01T10:00:00Z", "end_time": "2026-06-01T12:00:00Z",
            "has_answers": false
          }
        ],
        "has_answers": false
      }
    ]
  }
}
```
`available_seats` is `null` when `max_participants` is `null` (unlimited capacity). `fields` is only present in the detail response (not in list responses). `remaining_amount` is computed as `available_amount - booked_count` and only present for inventory options.

**Response shape — list** (`GET /api/projects/`):
```json
{
  "registration_config": {
    "max_participants": 100,
    "registration_end_date": "2026-06-01T23:59:00Z",
    "status": "open",
    "available_seats": null,
    "notify_admins": true
  }
}
```
`available_seats` is always `null` in list responses to avoid a `COUNT(*)` query per row. `fields` is omitted from list responses.

Returns `null` when registration is not enabled.

**Request body** (`POST /api/projects/` and `PATCH /api/projects/{slug}/`):
```json
{
  "registration_config": {
    "max_participants": 100,
    "registration_end_date": "2026-06-01T23:59:00Z",
    "status": "closed"
  }
}
```
Omitting the `registration_config` key entirely on `PATCH` leaves existing settings untouched.

**Validation rules**:
| Rule | Enforced when |
|---|---|
| Only allowed for `project_type = event` | Always |
| `max_participants` must be > 0 | Always (when value is provided) |
| `registration_end_date` must be ≤ event `end_date` | Always (when both are present) |
| Both fields are required | On publish (`is_draft=false`) only |
| Both fields are optional / nullable | When saving as draft (`is_draft=true`) |
| `status` must be `open` or `closed` (not `full`) | Always on write |

**Registration status** (`status` field):
| Value | Who sets it | Meaning |
|---|---|---|
| `open` | Default / organiser | Accepting sign-ups (subject to `registration_end_date` and `max_participants`) |
| `closed` | Organiser via `PATCH` | Manually closed before the end date; can be re-opened with `"status": "open"` |
| `full` | System only | Capacity reached — cannot be set via the API directly |
| `ended` | Computed (read-only) | `registration_end_date` has passed while the stored status was `open` — returned by the API but never stored in the DB |

Effective "accepting signups?" check: `status == "open" AND now() < registration_end_date`

> **Note**: `ended` is a computed value derived from the stored `open` status and a past `registration_end_date`. It is never written to the database — the underlying stored status remains `open`. Clients should treat `ended`, `closed`, and `full` equally as "not accepting sign-ups".

**Timezone**: `registration_end_date` follows the same convention as `Project.start_date` / `end_date`. Send ISO 8601 strings with an explicit offset or `Z` suffix (e.g. `"2026-06-01T23:59:00Z"`); the backend stores and compares in UTC.

**Feature toggle**: The registration UI is gated behind the `EVENT_REGISTRATION` feature toggle. The API fields are always present (additive, no breaking changes).

#### POST `/api/projects/{slug}/registrations/` — Register for an event

Registers the authenticated user as a participant for an event that has `EventRegistrationConfig` enabled. Optionally includes answers to custom registration fields.

**Authentication**: Required (401 if unauthenticated)

**Re-registration**: if the user previously cancelled their own registration (`cancelled_by == user`), `POST` resets `cancelled_at` and `cancelled_by` to `null` on the existing row and re-activates the registration (201 Created). If the registration was cancelled by an admin (`cancelled_by != user`), re-registration is blocked (403 Forbidden).

**Request body** (all fields optional):
```json
{
  "answers": [
    { "field": 1, "value_boolean": true },
    { "field": 2, "value_option": 11 },
    { "field": 3, "value_option": 20, "value_number": 2 },
    { "field": 4, "value_option": 30 }
  ]
}
```

| Answer field | Type | Used by field_type | Notes |
|---|---|---|---|
| `field` | integer | all | The `id` of the `RegistrationField` |
| `value_boolean` | boolean | `checkbox` | Required for checkbox fields |
| `value_option` | integer | `option_select`, `inventory`, `time_slot_select` | The `id` of the selected `RegistrationFieldOption` |
| `value_number` | integer | `inventory` | Quantity; must be ≥ 1 and ≤ `max_amount_per_guest` for the selected option |

**Validation**: per-field type validation (checkbox requires `value_boolean`, option_select/time_slot_select require `value_option`, inventory requires `value_option` + `value_number`). Required fields are enforced. Inventory quantity must not exceed `max_amount_per_guest` or `remaining_amount`. Previous answers are replaced atomically on re-registration.

**Success responses**:
| Status | Condition |
|---|---|
| 201 Created | First-time registration or re-registration after self-cancellation |
| 200 OK | Idempotent — user already has an active registration; no duplicate created |

**Error responses**:
| Status | Condition |
|---|---|
| 400 Bad Request | Registration is `closed` or `full` |
| 400 Bad Request | `registration_end_date` has passed |
| 400 Bad Request | Project has no `EventRegistrationConfig` record |
| 400 Bad Request | Custom field validation failed (missing required field, invalid option, quantity exceeded) |
| 401 Unauthorized | Request is not authenticated |
| 403 Forbidden | Registration was cancelled by an admin — member may not self-re-register |
| 404 Not Found | `{slug}` does not match any project |

**Response body** (both 200 and 201):
```json
{
  "registered": true,
  "available_seats": 41
}
```
`available_seats` is `null` for unlimited-capacity events (`max_participants = null`). Only active (non-cancelled) registrations count against capacity.

**Race-condition safety**: The `EventRegistrationConfig` row is locked with `SELECT FOR UPDATE` inside `@transaction.atomic`. Concurrent last-seat registrations are serialised — at most `max_participants` `EventRegistration` rows are ever active at the same time.

**FULL promotion**: When a registration fills the last seat, `EventRegistrationConfig.status` is atomically updated to `"full"` in the same transaction, so subsequent registrations are rejected immediately (no extra COUNT query needed on the hot path).

**Confirmation email**: A Celery task (`send_event_registration_confirmation_email`) is dispatched via `transaction.on_commit` after the commit succeeds. It sends an email via Mailjet using the `EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID` template (EN) or `EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID_DE` template (DE), selected based on the user's language preference. **Both templates must be created in the Mailjet dashboard before emails will be sent** — see `doc/environment-variables.md` for required template variables. Not dispatched on idempotent re-registrations (200 OK).

#### DELETE `/api/projects/{slug}/registrations/` — Cancel own registration (issue #1850)

Allows the authenticated member to cancel their own registration for an upcoming event. This is a **soft delete** — the `EventRegistration` row is kept and `cancelled_at` / `cancelled_by` are set. The member may re-register later (unless an admin cancels their re-registration).

**Authentication**: Required (401 if unauthenticated).

**Request body** (optional): `{ "message": "<string>" }` — plain-text reason (max 1000 chars) the guest wants to share with the organiser. If provided and non-empty (after stripping), it is stored on the registration as `cancellation_reason` and dispatched as a private chat message to the event organiser (tagged `origin_type="event_registration"`, `origin_id=<registration id>`). If absent, blank, or whitespace-only, the cancellation proceeds with no message.

**Success response**: 204 No Content (no body).

**Error responses**:
| Status | Condition |
|---|---|
| 400 Bad Request | Event `start_date` has already passed |
| 400 Bad Request | `message` is not a string |
| 400 Bad Request | `message` exceeds 1000 characters |
| 401 Unauthorized | Request is not authenticated |
| 404 Not Found | `{slug}` does not match any project |
| 404 Not Found | Project has no `EventRegistrationConfig` record |
| 404 Not Found | User has no active registration for this event |

**Chat message dispatch**: When a non-empty `message` is supplied, the chat message is created by the Celery task `send_cancellation_chat_message`, dispatched via `transaction.on_commit`. A broker/dispatch failure is logged at ERROR but does not roll back the cancellation (already committed, returns 204). `cancellation_reason` is stored atomically with the soft-delete inside the same transaction.

**OPEN recovery**: if the event was at full capacity (`status = "full"`) and this cancellation frees a seat, `EventRegistrationConfig.status` is atomically reverted to `"open"`.

**Seat count**: all places that compute `available_seats` filter by `cancelled_at IS NULL` so cancelled registrations never hold capacity.

#### GET `/api/event-registration-origin/{registration_id}/` — Resolve event context for a cancellation chat message (issue #2102)

Resolves the event referenced by an `event_registration` chat message so the frontend can render a context banner without embedding project data in the `Message` response.

**Authentication**: Required (401 if unauthenticated).

**Authorization**: The requesting user must be a participant of a chat that contains a message with `origin_type = "event_registration"` and `origin_id = {registration_id}`, **or** a project admin/editor of the related event. Returns 403 otherwise.

**Success response** (200 OK):
| Field | Type | Notes |
|---|---|---|
| `event_name` | string | Name of the event |
| `event_url_slug` | string | URL slug used to build `/projects/{event_url_slug}` |

**Error responses**:
| Status | Condition |
|---|---|
| 401 Unauthorized | Request is not authenticated |
| 403 Forbidden | User is neither a chat participant nor a project admin for the related event |
| 404 Not Found | `{registration_id}` does not match any `EventRegistration` |

#### PATCH `/api/projects/{slug}/registration-config/` — Edit registration settings (issue #1851)

Allows an event organiser (or team admin) to update `max_participants`, `registration_end_date`, and/or `status` on an event that already has `EventRegistrationConfig` enabled.

**Authentication**: Required (401 if unauthenticated). Requires edit rights on the project (organiser or team admin role) — 403 if unauthorised.

**Editable fields**:
| Field | Type | Notes |
|---|---|---|
| `max_participants` | Positive integer or `null` | Must be ≥ 1 and ≥ current participant count; `null` = unlimited |
| `registration_end_date` | ISO 8601 datetime | Must be > `now()` and ≤ event `end_date` |
| `status` | `"open"` or `"closed"` | Organiser may manually open or close registration; `"full"` and `"ended"` are system-managed and are rejected with 400 |
| `notify_admins` | boolean | Whether team admins receive notification emails on registration changes |
| `fields` | array | Full replacement of custom registration fields (see below) |

**Status change rules**:
| Transition | Allowed | Notes |
|---|---|---|
| `open` → `closed` | ✅ | Organiser manually closes registration |
| `closed` → `open` | ✅ | Organiser reopens — only if capacity is still available (see below) |
| `full` → `open` | ✅ | Only if current participant count < effective `max_participants` after this PATCH |
| `open/closed` → `full` | ❌ | System-managed only |
| `open/closed` → `ended` | ❌ | Computed read-only value — rejected with 400 |
| `open` when `effective_status == "ended"` | ❌ | Deadline has passed — extend `registration_end_date` first |
| `closed/full` → `open` when event is at capacity | ❌ | Event is fully booked — increase `max_participants` first (or include a higher value in the same request) |

**Idempotency**: setting `status` to its current stored value returns `200 OK` without any DB change.

**Automatic status adjustment** (triggered only when `max_participants` is in the request body AND `status` is NOT explicitly provided):
| Condition | Result |
|---|---|
| Stored status is `full` and new `max_participants` > current registrations | Auto-set to `open` (capacity raised above filled seats) |
| Stored status is `full` and `max_participants` set to `null` (unlimited) | Auto-set to `open` (unlimited capacity) |
| Stored status is `open` and new `max_participants` == current registrations | Auto-set to `full` (capacity lowered to exactly match filled seats) |

> **Priority**: if `status` is explicitly provided, it takes precedence over auto-adjustment logic. For example, `{"status": "open", "max_participants": 10}` with 10 current registrations results in `open`, not `full`.

**Request body** (all fields optional — PATCH semantics):
```json
{
  "max_participants": 80,
  "registration_end_date": "2026-07-01T18:00:00Z",
  "status": "closed"
}
```

**Success response** (200 OK):
```json
{
  "max_participants": 80,
  "registration_end_date": "2026-07-01T18:00:00Z",
  "status": "closed",
  "available_seats": 75
}
```

**Error responses**:
| Status | Condition |
|---|---|
| 400 Bad Request | `registration_end_date` is in the past |
| 400 Bad Request | `registration_end_date` is after the event's `end_date` |
| 400 Bad Request | `max_participants` is 0 or negative |
| 400 Bad Request | `max_participants` is below the current participant count |
| 400 Bad Request | `status` is `"full"` or `"ended"` (system-managed) |
| 400 Bad Request | `status = "open"` when `effective_status == "ended"` (deadline has passed — extend `registration_end_date` first) |
| 400 Bad Request | `status = "open"` when participant count ≥ effective `max_participants` (event is fully booked — increase `max_participants` first, or include a higher value in the same request) |
| 401 Unauthorized | Request is not authenticated |
| 403 Forbidden | Authenticated user without edit rights on the project |
| 404 Not Found | `{slug}` does not match any project |
| 404 Not Found | Project exists but has no `EventRegistrationConfig` record |

**Validation note**: guards are only applied to fields explicitly included in the request body. A PATCH that sends only `max_participants` does not re-validate the stored `registration_end_date`, and vice versa.

**Existing endpoint unchanged**: `PATCH /api/projects/{slug}/` is not affected.

**Custom registration fields** (`fields` array):

The `fields` key accepts a full replacement of the custom field set. Each entry in the array is an object with:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | integer | No (omit for new fields) | Existing field ID; omit to create a new field |
| `field_type` | string | Yes | `"checkbox"`, `"option_select"`, `"inventory"`, or `"time_slot_select"` |
| `order` | integer | Yes | Position in the form (0-indexed) |
| `is_required` | boolean | No | Default `false` |
| `label` | string | Yes | Max 30 chars; unique per event; organiser-facing label for export |
| `settings` | object | Yes | Type-specific (see below) |
| `options` | array | Conditional | Required for `option_select`, `inventory`, `time_slot_select` |

**Settings by field type**:
| field_type | settings shape |
|---|---|
| `checkbox` | `{ "description": "<p>HTML description</p>" }` |
| `option_select` | `{ "title": "Select an option" }` |
| `inventory` | `{ "title": "Choose an option", "description": "Optional description" }` |
| `time_slot_select` | `{ "title": "Select a time slot", "description": "Optional description" }` |

**Options** (for `option_select`, `inventory`, `time_slot_select`):
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | integer | No (omit for new options) | Existing option ID |
| `title` | string | Yes | Display label |
| `order` | integer | Yes | Position (0-indexed) |
| `available_amount` | integer | inventory only | Total capacity for this option |
| `max_amount_per_guest` | integer | inventory only | Max quantity per registrant |
| `start_time` | ISO 8601 datetime | time_slot only | Slot start |
| `end_time` | ISO 8601 datetime | time_slot only | Slot end; must be after `start_time` |

**Answer-lock**: once any registrant has submitted answers to a field, its text properties (`settings.description`, `settings.title`, option `title`, `start_time`, `end_time`) become immutable — attempts to change them return 400. The field can still be reordered, have its `is_required` toggled, or have new options added (for inventory/time_slot).

**Max 5 fields** per event. Fields omitted from the array are deleted (CASCADE removes associated options and answers). Fields included with an `id` are updated. Fields without an `id` are created.

#### GET `/api/projects/{slug}/registrations/` — List event registrations (organiser view)

Returns **all** `EventRegistration` rows (active and cancelled) for an event that has `EventRegistrationConfig` enabled.
Intended for organisers / team admins to review their guest list and manage cancellations.

**Authentication**: Required (401 if unauthenticated). Requires organiser or team admin role (`role_type` in `["all", "read write"]`) — 403 if unauthorised.

**No pagination**: all rows are returned in a single response. Client-side paging is provided by the MUI DataGrid in the frontend.

**Default ordering**: `registered_at` ascending (chronological).

**Success response** (200 OK):
```json
[
  {
    "id": 42,
    "user_first_name": "Alice",
    "user_last_name": "Smith",
    "user_url_slug": "alice-smith",
    "user_thumbnail_image": "https://.../thumb_alice.jpg",
    "registered_at": "2026-05-10T14:23:00Z",
    "cancelled_at": null,
    "field_answers": [
      { "field": 1, "value_boolean": true, "value_option": null, "value_number": null },
      { "field": 2, "value_boolean": null, "value_option": 11, "value_number": null },
      { "field": 3, "value_boolean": null, "value_option": 20, "value_number": 2 },
      { "field": 4, "value_boolean": null, "value_option": 30, "value_number": null }
    ]
  },
  {
    "id": 43,
    "user_first_name": "Bob",
    "user_last_name": "Jones",
    "user_url_slug": "bob-jones",
    "user_thumbnail_image": null,
    "registered_at": "2026-05-11T09:00:00Z",
    "cancelled_at": "2026-05-15T10:30:00Z",
    "field_answers": []
  }
]
```
- `id` — the `EventRegistration` primary key, used for admin-cancellation (`PATCH /registrations/{id}/`).
- `cancelled_at` — `null` for active registrations; ISO 8601 timestamp for cancelled ones.
- `user_thumbnail_image` is `null` when the participant has no profile image.
- `field_answers` — array of custom field responses, sorted by field order. Each entry contains `field` (field ID), `value_boolean`, `value_option` (option ID), and `value_number`. Only the value relevant to the field type is non-null.

**Error responses**:
| Status | Condition |
|---|---|
| 401 Unauthorized | Request is not authenticated |
| 403 Forbidden | Authenticated user without edit rights on the project |
| 404 Not Found | `{slug}` does not match any project |
| 404 Not Found | Project exists but has no `EventRegistrationConfig` record |

**Query optimisation**: the queryset uses `select_related("user__user_profile")` — all participant data is fetched in a single SQL JOIN, regardless of participant count.

#### PATCH `/api/projects/{slug}/registrations/{id}/` — Admin cancel guest registration (issue #1872)

Allows an event organiser or team admin to cancel a specific guest's registration. This is a **soft delete** — `cancelled_at` and `cancelled_by` are set on the row. The guest cannot self-re-register after an admin cancellation.

**Authentication**: Required (401 if unauthenticated). Requires organiser or team admin role — 403 if unauthorised.

**Request body** (optional):
```json
{ "message": "Unfortunately, your registration has been cancelled due to capacity changes." }
```
When `message` is provided (non-empty), a cancellation notification email is sent to the guest via `send_guest_cancellation_notification`. If absent or blank, no email is sent. The cancellation is committed regardless of email delivery — an email failure is logged but does not roll back the cancellation.

**Success response**: 204 No Content (no body).

**Error responses**:
| Status | Condition |
|---|---|
| 400 Bad Request | Registration `{id}` is already cancelled |
| 401 Unauthorized | Request is not authenticated |
| 403 Forbidden | Authenticated user without edit rights on the project |
| 404 Not Found | `{slug}` does not match any project |
| 404 Not Found | Project has no `EventRegistrationConfig` record |
| 404 Not Found | `{id}` does not exist or does not belong to this project |

**OPEN recovery**: if the event was at full capacity (`status = "full"`) and this cancellation frees a seat, `EventRegistrationConfig.status` is atomically reverted to `"open"`.

**Notification email**: uses Mailjet templates `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID` (EN) / `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID_DE` (DE). No email is sent if these are not configured — see `doc/environment-variables.md`.

#### POST `/api/projects/{slug}/registrations/email/` — Send organiser email to guests

Sends a plain-text email authored by the organiser to all active registered guests
(`is_test=false`) or a single test copy to the authenticated organiser (`is_test=true`).

**Authentication**: Required (401 if unauthenticated). Requires organiser or team admin role — 403 if unauthorised.

**Request body**:
```json
{
  "subject": "Important update about the event",
  "message": "Hi everyone, we have an important update…",
  "is_test": false,
  "send_to_new_guests_only": false
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `subject` | string | Yes | max 200 chars, non-blank |
| `message` | string | Yes | non-blank |
| `is_test` | boolean | No | defaults to `false` |
| `send_to_new_guests_only` | boolean | No | defaults to `false`; when `true`, only guests who registered after `EventRegistrationConfig.last_guest_email_sent_at` receive the email. Ignored when `is_test=true` or when no prior bulk email has been sent (NULL timestamp). |

**Success response** (200 OK):
```json
{ "sent_count": 42 }
```
`sent_count` is the number of unique recipients (active guests + team admins, deduplicated). For `is_test=true` it is always `1`. Bulk delivery is asynchronous (Celery task); the HTTP response returns immediately.

After a successful non-test bulk send, `EventRegistrationConfig.last_guest_email_sent_at` is set to the current timestamp. This enables future "new guests only" sends to filter recipients correctly.

When `is_test=true`, the subject is prefixed with `[TEST] ` so the organiser can identify the test email in their inbox.

**Error responses**:
| Status | Condition |
|--------|-----------|
| 400 Bad Request | `subject` or `message` is blank or missing |
| 400 Bad Request | `subject` exceeds 200 characters |
| 401 Unauthorized | Request is not authenticated |
| 403 Forbidden | Authenticated user without edit rights on the project |
| 404 Not Found | `{slug}` does not match any project |
| 404 Not Found | Project exists but has no `EventRegistrationConfig` record |

**Implementation notes**:
- Bulk send dispatches `send_organizer_message_to_guests` Celery task with a pre-computed snapshot of `user_id` values for **active (non-cancelled)** registrations only, isolating it from concurrent registration changes.
- Test send is synchronous — one email, inline in the HTTP request.
- Uses Mailjet templates `EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID` (EN) and `EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID_DE` (DE). No emails are sent until these are configured — see `doc/environment-variables.md`.

### Organizations

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/organizations/` | GET | No | List all organizations |
| `/api/organizations/` | POST | Yes | Create an organization |
| `/api/organizations/{slug}/` | GET | No | Get organization details |
| `/api/organizations/{slug}/members/` | GET | No | List organization members |

### Members

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/members/` | GET | No | List all members |
| `/api/member/{url_slug}/` | GET | No | Get member profile |
| `/api/my_profile/` | GET | Yes | Get your own profile |
| `/api/edit_profile/` | POST | Yes | Update your profile |

### Hubs

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/hubs/` | GET | No | List all hubs |
| `/api/hubs/{hub_slug}/` | GET | No | Get hub details |

### Ideas

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/ideas/` | GET | No | List all ideas |
| `/api/ideas/` | POST | Yes | Create a new idea |
| `/api/ideas/{url_slug}/` | GET | No | Get idea details |

### Location

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/location_autocomplete/` | GET | No | Autocomplete search (LocationIQ, Nominatim fallback) — **polling endpoint, see below** |
| `/api/get_location/` | POST | No | Resolve a saved location by OSM identifiers, creating it if unknown |
| `/api/autocomplete_request_count/` | POST | No | Fire-and-forget counter for browser-side Nominatim calls |
| `/api/autocomplete_stats/` | GET | Yes (staff) | Per-provider request statistics |

> The last two were called `/api/nominatim_request_count/` and `/api/nominatim_stats/` until both
> started covering LocationIQ as well. The old paths still resolve to the same views so that a
> browser holding a pre-rename JS bundle keeps reporting its Nominatim calls; they are deprecated
> and can be dropped once those bundles have aged out.

#### `GET /api/location_autocomplete/` — asynchronous, must be polled

Unlike every other endpoint here, this one **does not always return results on the first call.**
Upstream lookups are rate-limited (LocationIQ allows 2 req/s account-wide), so a cache miss is
queued to a Celery worker and answered later. Clients must handle `202` by re-requesting the same
URL until it returns `200`.

**Gated by the `LOCATIONIQ_AUTOCOMPLETE` feature toggle.** When it is off, the reference client
does not call this endpoint at all — it calls `nominatim.openstreetmap.org` directly from the
browser and reports the request to `/api/autocomplete_request_count/`, exactly as it did before the
LocationIQ migration. The endpoint itself keeps working while the toggle is off (clients running a
cached JS bundle still reach it) but never calls LocationIQ; it serves the Nominatim fallback
instead. See `doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md`.

**Caching.** Successful results are cached in Redis for 24 hours on a sliding TTL — every hit
resets the 24 hours, capped at 48 hours from the first fetch, after which the entry is re-fetched.
The cache holds at most `LOCATION_PROXY_CACHE_MAX_ENTRIES` queries (default 1000), evicting the least
recently read. Failed lookups are cached for seconds only, so a provider outage self-corrects
rather than being served as an empty result all day.

**Query parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `q` | yes | Search text. Outside 3–200 characters the endpoint returns `[]` without doing any work. |
| `countrycodes` | no | ISO 3166-1 alpha-2 code(s), comma-separated, to restrict results |

The `Accept-Language` header selects the language of the returned names and is part of the cache
key, so `en` and `de` results never mix.

**Responses**

| Status | Body | Meaning |
|--------|------|---------|
| `200` | array of results (possibly empty) | Ready — either cached or fetched inline |
| `202` | `{"status": "pending"}` | Queued; poll the same URL again |
| `429` | `{"detail": "..."}` | Rate limited (per IP). Transient — back off and retry |
| `503` | `{"detail": "Service busy, please retry."}` | Too many lookups in flight. Transient |

`429` and `503` are **not errors to surface to users** — they mean "try again shortly". The
reference client (`frontend/src/components/search/LocationSearchBar.tsx`) polls on `202` with a
fast-first, backing-off schedule (250ms, 500ms, then 1s intervals) and gives up after ~6.75s.

**Results carry geometry types, not geometry.** Each result's `geojson.coordinates` is `null` for
anything that isn't a `Point` — polygons can be megabytes and autocomplete only ever displays
names. The geometry *type* is preserved. Full geometry is restored server-side when a location is
first saved, so the database is unaffected; clients must not rely on autocomplete for coordinates.

Example:

```bash
curl "http://localhost:8000/api/location_autocomplete/?q=berlin" -H "Accept-Language: de"
# -> 202 {"status": "pending"}
# ...poll the same URL...
# -> 200 [{"display_name": "Berlin, Deutschland", "geojson": {"type": "MultiPolygon", "coordinates": null}, ...}]
```

#### `GET /api/autocomplete_stats/` — per-provider usage

Requires Django staff access. Statistics are stored per (period, provider), so every period reports
combined totals plus a `providers` breakdown. `total_requests` and `avg_req_per_second` are summed
across providers; **`peak_req_per_second` is the maximum, not the sum** — it means "most requests
seen within one second", provider specific. This per-provider `locationiq` peak is the number to watch against LocationIQ's 2 req/s
limit.

Counts track **upstream provider calls**, not incoming HTTP requests: cached and de-duplicated
queries cost no quota and are deliberately not counted.

Because of that, the no-parameter response also carries a `cache` array with the last 7 days of
autocomplete cache hits and misses. Without it a working result cache and a drop in traffic look
identical here, since only upstream calls reach `AutocompletePeriodStats`.

- **`misses`** — lookups that had to go upstream. Counted once per lookup that actually spends an
  upstream call, never once per poll: at enqueue time for the normal queued path, or inside the
  inline fetch used when the broker is down or an abandoned lookup is reclaimed. A reclaimed lookup
  legitimately counts a second miss, because it really is a second upstream call for that query.
- **`hits`** — answers served from cache with no upstream call. The `202`-poll that *collects* a
  freshly computed result is **not** counted: it is the tail of the lookup that produced it, not a
  saved call. (Without that exclusion every cold query would add one artificial hit and `hit_rate`
  could never fall below ~0.5.)
- Negative-cached failures count as neither.

`hit_rate` is `null` on a day with no autocomplete traffic at all. The array is `null` if Redis
can't be reached — the rest of the response comes from Postgres and is still served.

| Param | Default | Description |
|-------|---------|-------------|
| `period_type` | — | `day`, `week`, or `month`. Omit to get the newest of each. |
| `limit` | `1` | Number of **periods** to return (max 365). Only with `period_type`. |

```jsonc
// GET /api/autocomplete_stats/
{
  "cache": [
    { "day": "2026-08-04", "hits": 812, "misses": 96, "hit_rate": 0.8943 },
    { "day": "2026-08-03", "hits": 640, "misses": 88, "hit_rate": 0.8791 }
    // ...7 days total, newest first
  ],
  "day": {
    "period_key": "2026-08-03",
    "total_requests": 140,
    "avg_req_per_second": 0.0016,
    "peak_req_per_second": 5,
    "providers": {
      "nominatim": { "total_requests": 100, "avg_req_per_second": 0.0011, "peak_req_per_second": 5 },
      "locationiq": { "total_requests": 40, "avg_req_per_second": 0.0005, "peak_req_per_second": 2 }
    }
  },
  "week": { "...": "..." },
  "month": { "...": "..." }
}
```

---

## Troubleshooting

### Common Issues

#### "Invalid token" Error

**Problem**: API returns `401 Unauthorized` or "Invalid token"

**Solutions**:
- Verify you're using the correct token format: `Token your_token_here`
- Ensure there's a space between "Token" and your actual token
- Check that the token hasn't expired (default: 120 days)
- Generate a new token if needed

#### "Authentication credentials were not provided"

**Problem**: Endpoint requires authentication but no token was sent

**Solutions**:
- Add the `Authorization` header to your request
- In Swagger UI, click "Authorize" and enter your token
- In Postman, configure authorization in the Headers or Authorization tab

#### "Profile not found" Error

**Problem**: `GET /api/my_profile/` returns "Profile not found"

**Explanation**: The user account exists but doesn't have an associated UserProfile yet.

**Solution**: Create a UserProfile through the Django admin or signup flow.

#### CORS Errors (Browser)

**Problem**: Browser shows CORS policy errors

**Explanation**: Cross-Origin Resource Sharing (CORS) restrictions apply when calling the API from a different domain.

**Solution**: For local development, the backend is configured to allow `http://localhost:3000`. For other origins, update `CORS_ORIGIN_WHITELIST` in `settings.py`.

#### Connection Refused

**Problem**: Cannot connect to `http://localhost:8000`

**Solutions**:
- Ensure the Django development server is running: `cd backend && make start`
- Check if another process is using port 8000: `lsof -ti:8000`
- Verify you're using the correct URL (localhost vs. 127.0.0.1)

---

## Additional Resources

- **API Schema (OpenAPI)**: http://localhost:8000/api/schema/ - Download the full API specification
- **Django REST Framework**: https://www.django-rest-framework.org/ - API framework documentation
- **Knox Authentication**: https://github.com/jazzband/django-rest-knox - Token authentication documentation
- **ClimateConnect Repository**: https://github.com/climateconnect/climateconnect - Source code and issues

---

## Need Help?

If you encounter issues or have questions about the API:

1. Check the [ClimateConnect GitHub Issues](https://github.com/climateconnect/climateconnect/issues)
2. Review the backend code in `backend/climateconnect_api/views/`
3. Ask in the development team channels

---

**Last Updated**:  
July 13, 2026 - Changed validation to allow up to 15 custom fields.

