# Environment Variables Documentation

This document provides a comprehensive reference for all environment variables used in the Climate Connect platform, organized by frontend and backend.

## Table of Contents

1. [Backend Environment Variables](#backend-environment-variables)
   - [Core Django Settings](#core-django-settings)
   - [Database Configuration](#database-configuration)
   - [Redis & Celery](#redis--celery)
   - [Email & Mailjet](#email--mailjet)
   - [Azure Storage](#azure-storage)
   - [External Services](#external-services)
   - [Feature Flags](#feature-flags)
   - [Monitoring & Logging](#monitoring--logging)
2. [Frontend Environment Variables](#frontend-environment-variables)
   - [API Configuration](#api-configuration)
   - [Environment Settings](#environment-settings)
   - [Feature Configuration](#feature-configuration)
   - [External Integrations](#external-integrations)
3. [Environment Setup](#environment-setup)
4. [Environment Variable Checklist](#environment-variable-checklist)
5. [Troubleshooting](#troubleshooting)
6. [Additional Resources](#additional-resources)
7. [Version History](#version-history)

---

## Backend Environment Variables

Backend environment variables are stored in `.backend_env` file in the `backend/` directory.

### Core Django Settings

#### SECRET_KEY
- **Required**: ✅ Yes
- **Type**: String
- **Description**: Django secret key used for cryptographic signing (sessions, passwords, tokens)
- **Example**: `"XXX/YYY"`
- **Generation**: `openssl rand -base64 32`
- **Security**: Never commit to version control. Must be unique per environment.

#### DEBUG
- **Required**: ✅ Yes
- **Type**: Boolean (string)
- **Description**: Enables Django debug mode with detailed error pages
- **Values**: `"true"` | `"false"`
- **Default**: Should be `"false"`
- **Development**: `"true"`
- **Production**: `"false"` (CRITICAL: never enable in production)

#### ALLOWED_HOSTS
- **Required**: ✅ Yes
- **Type**: Comma-separated string
- **Description**: List of host/domain names that Django will serve
- **Example**: `"localhost,climateconnect.earth,api.climateconnect.earth"`
- **Development**: `"localhost"`
- **Production**: Include all production domains

#### ENVIRONMENT
- **Required**: ✅ Yes
- **Type**: String
- **Description**: Specifies the runtime environment
- **Values**: `"development"` | `"test"` | `"production"`
- **Usage**: Controls feature toggles, storage backend, and error reporting
- **Development**: `"development"`
- **Production**: `"production"`

#### FRONTEND_URL
- **Required**: ✅ Yes
- **Type**: String (URL)
- **Description**: Base URL of the frontend application for CORS and email links
- **Example**: `"http://localhost:3000"` (dev), `"https://climateconnect.earth"` (prod)
- **Usage**: Used in email templates, CORS settings, and redirects

#### MEDIA_ROOT
- **Required**: ✅ Yes
- **Type**: String (absolute path)
- **Description**: Absolute filesystem path to directory for user-uploaded files
- **Example**: `"/Users/CC/Development/climateconnect/backend/media/"`
- **Production**: Not used if Azure Blob Storage is configured
- **Permissions**: Directory must be writable by Django process

#### STATIC_ROOT
- **Required**: ⚠️ Conditional (production)
- **Type**: String (absolute path)
- **Description**: Absolute path to directory for collected static files
- **Example**: `"/Users/CC/Development/climateconnect/backend/media/static"`
- **Usage**: Target for `python manage.py collectstatic` command
- **Production**: Required when not using Azure Storage

#### AUTO_VERIFY
- **Required**: ❌ No
- **Type**: Boolean (string)
- **Description**: Automatically verify user emails without sending verification email
- **Values**: `"true"` | `"True"` | `"TRUE"` | any other value (false)
- **Default**: `False`
- **Development**: `"true"` (skip email verification)
- **Production**: `False` (require email verification)

---

### Database Configuration

#### DATABASE_NAME
- **Required**: ✅ Yes
- **Type**: String
- **Description**: PostgreSQL database name
- **Example**: `"climateconnect-dev"` (dev), `"climateconnect-prod"` (prod)

#### DATABASE_USER
- **Required**: ✅ Yes
- **Type**: String
- **Description**: PostgreSQL username
- **Example**: `"postgres"`, `"climateconnect_user"`

#### DATABASE_PASSWORD
- **Required**: ✅ Yes
- **Type**: String
- **Description**: PostgreSQL user password
- **Example**: `"secure_password_here"`
- **Security**: Use strong passwords in production. Store securely.

#### DATABASE_HOST
- **Required**: ✅ Yes
- **Type**: String (hostname or IP)
- **Description**: PostgreSQL server hostname or IP address
- **Development**: `"localhost"` or `"127.0.0.1"`
- **Production**: Database server hostname or IP
- **Docker**: Service name from docker-compose (e.g., `"db"`)

#### DATABASE_PORT
- **Required**: ❌ No
- **Type**: String (port number)
- **Description**: PostgreSQL server port
- **Default**: `"5432"`
- **Example**: `"5432"`, `"5499"` (custom)

---

### Redis & Celery

#### REDIS_HOST
- **Required**: ⚠️ Conditional (if using separate config)
- **Type**: String (hostname or IP)
- **Description**: Redis server hostname
- **Example**: `"localhost"`, `"redis"`
- **Usage**: Used to construct channel layer config

#### REDIS_PORT
- **Required**: ⚠️ Conditional (if using separate config)
- **Type**: String (port number)
- **Description**: Redis server port
- **Default**: `"6379"`
- **Example**: `"6379"`

#### REDIS_PASSWORD
- **Required**: ❌ No
- **Type**: String
- **Description**: Redis authentication password
- **Default**: `""` (no password)
- **Production**: Should be set for security

#### REDIS_URL
- **Required**: ✅ Yes (if not using separate REDIS_HOST/PORT)
- **Type**: String (URL)
- **Description**: Complete Redis connection URL
- **Format**: `"redis://[password@]hostname[:port][/db]"`
- **Example**: `"redis://localhost"`, `"redis://localhost:6379/0"`
- **Usage**: Used for caching and channel layers

#### CELERY_BROKER_URL
- **Required**: ✅ Yes
- **Type**: String (URL)
- **Description**: Celery message broker URL (typically Redis)
- **Format**: `"redis://[password@]hostname[:port][/db]"`
- **Example**: `"redis://127.0.0.1"`, `"redis://localhost:6379/0"`
- **Usage**: Queue for background tasks

#### CACHE_BACHED_RANK_REQUEST
- **Required**: ❌ No
- **Type**: Boolean (string)
- **Description**: Enable caching for project ranking calculations
- **Values**: `"true"` | any other value (false)
- **Default**: `"false"`
- **Performance**: Set to `"true"` to cache expensive ranking queries

---

### Email & Mailjet

#### EMAIL_HOST
- **Required**: ⚠️ Conditional (if sending emails)
- **Type**: String (hostname)
- **Description**: SMTP server hostname
- **Example**: `"smtp.mailjet.com"`

#### EMAIL_HOST_USER
- **Required**: ⚠️ Conditional (if sending emails)
- **Type**: String
- **Description**: SMTP authentication username
- **Example**: `"your-mailjet-api-key"`

#### EMAIL_HOST_PASSWORD
- **Required**: ⚠️ Conditional (if sending emails)
- **Type**: String
- **Description**: SMTP authentication password
- **Example**: `"your-mailjet-secret"`

#### EMAIL_PORT
- **Required**: ⚠️ Conditional (if sending emails)
- **Type**: String (port number)
- **Description**: SMTP server port
- **Common**: `"25"` (plain), `"587"` (TLS), `"465"` (SSL)

#### MJ_APIKEY_PUBLIC
- **Required**: ⚠️ Conditional (if using Mailjet)
- **Type**: String
- **Description**: Mailjet public API key
- **Usage**: Mailjet service authentication

#### MJ_APIKEY_PRIVATE
- **Required**: ⚠️ Conditional (if using Mailjet)
- **Type**: String
- **Description**: Mailjet private API key (secret)
- **Usage**: Mailjet service authentication
- **Security**: Never expose publicly

#### CLIMATE_CONNECT_SUPPORT_EMAIL
- **Required**: ❌ No
- **Type**: String (email)
- **Description**: Support email address for user communications
- **Example**: `"support@climateconnect.earth"`
- **Usage**: "Reply-to" address in automated emails

#### CLIMATE_CONNECT_CONTACT_EMAIL
- **Required**: ❌ No
- **Type**: String (email)
- **Description**: General contact email address
- **Example**: `"contact@climateconnect.earth"`

#### MAILJET_NEWSLETTER_LIST_ID
- **Required**: ⚠️ Conditional (if using newsletter)
- **Type**: String
- **Description**: Mailjet list ID for newsletter subscribers
- **Usage**: Adding users to newsletter mailing list

#### Email Template IDs

All email template variables follow the pattern: `{TEMPLATE_NAME}_TEMPLATE_ID[_DE]`

**English Templates**:
- `EMAIL_VERIFICATION_TEMPLATE_ID` - Email verification on signup
- `NEW_EMAIL_VERIFICATION_TEMPLATE_ID` - Email change verification
- `RESET_PASSWORD_TEMPLATE_ID` - Password reset
- `LOGIN_CODE_EMAIL_TEMPLATE_ID` - OTP login code (passwordless flow). **Default: blank.** When blank, no email is sent and the raw 6-digit code is logged to the Celery worker console at `WARNING` level (`[LOGIN CODE] No Mailjet template configured. OTP for <email>: <code>`). This is intentional for local development — no Mailjet account needed. Set this to a real template ID in staging/production.
- `FEEDBACK_TEMPLATE_ID` - User feedback submission
- `PRIVATE_MESSAGE_TEMPLATE_ID` - Private chat message notification
- `GROUP_MESSAGE_TEMPLATE_ID` - Group chat message notification
- `PROJECT_COMMENT_TEMPLATE_ID` - Comment on project
- `PROJECT_MENTION_TEMPLATE_ID` - Mention in project
- `PROJECT_COMMENT_REPLY_TEMPLATE_ID` - Reply to project comment
- `PROJECT_FOLLOWER_TEMPLATE_ID` - New project follower
- `PROJECT_LIKE_TEMPLATE_ID` - Project liked
- `PROJECT_JOIN_REQUEST_TEMPLATE_ID` - Project join request
- `ORGANIZATION_FOLLOWER_TEMPLATE_ID` - New organization follower
- `ORG_PUBLISHED_NEW_PROJECT_TEMPLATE_ID` - Organization published project
- `IDEA_COMMENT_TEMPLATE_ID` - Comment on idea
- `IDEA_COMMENT_REPLY_TEMPLATE_ID` - Reply to idea comment
- `IDEA_MENTION_TEMPLATE_ID` - Mention in idea
- `JOINED_IDEA_TEMPLATE` - User joined idea discussion
- `EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID` - Event registration confirmation (issue #1845)
- `EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID` - Organiser-to-guests email (issue #1866)
- `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID` - Admin cancellation notification to guest (issue #1872)

**German Templates** (append `_DE` to template name):
- All above templates have German variants with `_DE` suffix
- Example: `PROJECT_COMMENT_TEMPLATE_ID_DE`

**Event registration confirmation template variables** (define in both EN and DE Mailjet templates):
| Variable | Content |
|---|---|
| `FirstName` | User's first name (falls back to username) |
| `EventTitle` | Display name of the event |
| `EventUrl` | Full, language-aware URL to the event page (e.g. `/projects/slug` EN, `/de/projects/slug` DE) |
| `StartDate` | Localised start date — timezone resolved from user location → project location → UTC; EN British format `"30 March 2026 at 14:00 (CET)"`, DE format `"30. März 2026 um 14:00 Uhr (MEZ)"`, or `"TBD"` |
| `OrganiserName` | Organisation name, or user's full name / username; empty string if no owner |
| `LocationName` | `"Online"` for online events, location name for in-person events, or empty string |

**Organiser-to-guests email template variables** (define in both EN and DE Mailjet templates, `EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID`):
| Variable | Content |
|---|---|
| `FirstName` | Recipient's first name (falls back to username) |
| `EventTitle` | Display name of the event (localised for the recipient) |
| `EventUrl` | Language-aware link to the event page |
| `OrganiserName` | Organisation name, or organiser's full name / username |
| `OrganizerSubject` | The subject entered by the organiser |
| `OrganizerMessage` | HTML body entered by the organiser (sanitised; rendered with triple-brace in Mailjet template) |

**Admin cancellation notification template variables** (define in both EN and DE Mailjet templates, `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID`):
| Variable | Content |
|---|---|
| `FirstName` | Guest's first name (falls back to username) |
| `EventTitle` | Display name of the event (localised for the guest) |
| `EventUrl` | Language-aware link to the event page |
| `OrganiserName` | Organisation name, or organiser's full name / username |
| `OrganizerMessage` | The plain-text cancellation message provided by the admin |

The email envelope `Subject` header is set directly to the organiser-provided subject (no wrapping platform prefix). These templates must be created in Mailjet and their IDs configured before any organiser emails will be delivered.

**Template Configuration**:
- **Required**: ⚠️ Conditional (per template type used)
- **Type**: String (Mailjet template ID)
- **Example**: `"1234567"`
- **Usage**: Specify which Mailjet template to use for each notification type

---

### Azure Storage

Azure Blob Storage is used in production for media file storage.

#### AZURE_ACCOUNT_NAME
- **Required**: ⚠️ Conditional (if ENVIRONMENT is not "development" or "test")
- **Type**: String
- **Description**: Azure Storage account name
- **Example**: `"climateconnectstorage"`

#### AZURE_ACCOUNT_KEY
- **Required**: ⚠️ Conditional (if using Azure Storage)
- **Type**: String
- **Description**: Azure Storage account access key
- **Security**: Highly sensitive credential. Never commit to version control.

#### AZURE_CONTAINER
- **Required**: ⚠️ Conditional (if using Azure Storage)
- **Type**: String
- **Description**: Azure Blob Storage container name
- **Example**: `"media"`, `"climateconnect-media"`

#### AZURE_HOST
- **Required**: ⚠️ Conditional (if using Azure Storage)
- **Type**: String
- **Description**: Azure Storage host domain
- **Default**: `"blob.core.windows.net"`
- **Example**: `"blob.core.windows.net"`

---

### External Services

#### LOCATION_SERVICE_BASE_URL
- **Required**: ✅ Yes
- **Type**: String (URL)
- **Description**: Base URL for geocoding API (OpenStreetMap Nominatim)
- **Example**: `"https://..."`
- **Usage**: Geocoding addresses to coordinates, location search

#### LOCATIONIQ_API_KEY
- **Required**: ❌ No (falls back to Nominatim if unset)
- **Type**: String
- **Default**: `""`
- **Description**: API key for LocationIQ, the primary provider for location autocomplete
  (`/api/location_autocomplete/`). Kept server-side and never exposed to the browser.
- **Example**: `"pk.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`
- **Usage**: An empty key makes the backend skip LocationIQ entirely and use Nominatim
  (`LOCATION_SERVICE_BASE_URL`) for autocomplete, so the feature degrades gracefully rather than
  breaking. `initial_dev_setup.sh` writes the key (empty) into a fresh `backend/.backend_env`, so a
  new dev environment works out of the box on Nominatim and only needs the value filled in to
  exercise LocationIQ.

#### LOCATIONIQ_DAILY_BUDGET
- **Required**: ❌ No (no cap when unset)
- **Type**: Integer (string)
- **Default**: unset — **the daily cap is disabled**
- **Description**: Maximum number of LocationIQ calls per UTC day. Once today's count crosses it,
  the backend stops calling LocationIQ and falls through to Nominatim for the rest of the day.
- **Example**: `"5000"`
- **Usage**: IP-agnostic backstop that protects the shared account quota — per-IP rate limits alone
  can't do that. Set it to your plan's daily allowance with headroom. The count comes from
  `AutocompletePeriodStats` (provider `locationiq`) and measures **upstream calls**, not HTTP requests.

> **Naming**: `LOCATIONIQ_*` settings are provider-specific (credential, endpoint, timeout, the
> account rate limit, the quota backstop) — swapping geocoders would change them. `LOCATION_PROXY_*`
> settings belong to the autocomplete proxy layer itself (rendezvous queue, pending-sentinel
> lifecycle, result cache, per-IP limits) and would be unchanged by such a swap; they also govern
> the Nominatim fallback path.

#### LOCATION_PROXY_RESULT_TTL_S
- **Required**: ❌ No
- **Type**: Integer (string)
- **Default**: `86400` (24 hours)
- **Description**: How long a successful autocomplete result stays cached in Redis. The TTL is
  *sliding*: every cache hit resets it back to this value, but never beyond
  `LOCATION_PROXY_MAX_CACHE_AGE_S` from when the entry was first fetched.
- **Usage**: Raise it to spend less LocationIQ quota, lower it to pick up upstream data changes
  sooner. Failed lookups are unaffected — they use the much shorter `LOCATION_PROXY_NEGATIVE_TTL_S`.

#### LOCATION_PROXY_MAX_CACHE_AGE_S
- **Required**: ❌ No
- **Type**: Integer (string)
- **Default**: `172800` (48 hours)
- **Description**: Absolute ceiling on a cached result's age. Once an entry is this old it is
  discarded and re-fetched no matter how often it has been read.
- **Usage**: The guarantee that a renamed place or a corrected boundary self-heals without anyone
  clearing the cache by hand. Must be ≥ `LOCATION_PROXY_RESULT_TTL_S` to have any effect — settings
  load emits a `RuntimeWarning` if it isn't, because the combination silently makes the sliding
  result TTL unreachable rather than failing outright.

#### LOCATION_PROXY_CACHE_MAX_ENTRIES
- **Required**: ❌ No
- **Type**: Integer (string)
- **Default**: `1000` (~7 MB — cached entries are ~7 KB once polygons are stripped)
- **Description**: Hard cap on how many autocomplete queries are cached. Enforced by an explicit
  LRU index (`locationiq:lru`), evicting the least recently *read* entry.
- **Usage**: Redis is shared with the Celery broker and the Channels layer, so this bounds the
  cache's footprint there. Raising it lowers LocationIQ spend (more prefix queries stay cached);
  lower it if the Redis tier is tight. `0` disables the cap entirely — not recommended.

All three of the cache settings above are read with the `int_env()` helper in `settings.py`, so
declaring one with an empty value (`LOCATION_PROXY_RESULT_TTL_S=`) falls back to its default instead of
raising `ValueError` at import and refusing to boot.

Related non-env settings live in `climateconnect_main/settings.py` and are tuned in code, not per
environment: `LOCATIONIQ_MAX_RATE` (Celery `rate_limit`, 2/s — should be `1/s` while the
`LOCATIONIQ_AUTOCOMPLETE` toggle is off in production, since the Nominatim fallback then carries
all proxy traffic from a single server IP; note `LOCATION_PROXY_SENTINEL_TTL_S` and
`LOCATION_PROXY_STALE_PENDING_S` are derived from it), `LOCATION_PROXY_PENDING_CAP`,
`LOCATION_PROXY_SENTINEL_TTL_S`, `LOCATION_PROXY_STALE_PENDING_S`, `LOCATION_PROXY_NEGATIVE_TTL_S`,
`LOCATION_PROXY_STATS_TTL_S`, and the two per-IP limits. Several of them are interdependent — see
`doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` before changing any.

Whether the backend calls LocationIQ at all is controlled by the `LOCATIONIQ_AUTOCOMPLETE` feature
toggle rather than by an environment variable — see `FEATURE_TOGGLE_ENVIRONMENT` below and
`doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md`.

#### FEATURE_TOGGLE_ENVIRONMENT
- **Required**: ❌ No
- **Type**: String
- **Values**: `"development"` | `"staging"` | `"production"`
- **Default**: falls back to `ENVIRONMENT` (with `"test"` mapped to `"development"`)
- **Description**: Which column of the `FeatureToggle` table **backend** code reads. Frontend
  toggle reads are unaffected — those detect the environment from the request host.
- **Usage**: Set it explicitly to `"staging"` on the staging slot. That slot runs the same
  artifact, and therefore the same `ENVIRONMENT` value, as production, so without this override a
  backend toggle read on staging resolves against the *production* column. Kept separate from
  `ENVIRONMENT` so that changing it does not also flip the Celery SSL configuration, which keys off
  `ENVIRONMENT == "production"`.
- **Note**: a value outside the three listed emits a `RuntimeWarning` at settings load. Without it
  the failure is near-silent — every backend toggle read falls back to its default, which looks
  exactly like the toggles being switched off.

#### DEEPL_API_KEY
- **Required**: ⚠️ Conditional (if using translation features)
- **Type**: String
- **Description**: DeepL API key for automated translations
- **Example**: `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"`
- **Usage**: Machine translation of user content

---

### Feature Flags

#### USER_CHUNK_SIZE
- **Required**: ❌ No
- **Type**: Integer (string)
- **Description**: Chunk size for batch user operations
- **Default**: `100`
- **Example**: `"100"`, `"500"`
- **Usage**: Processing users in batches for performance

---

### Monitoring & Logging

#### SENTRY_DSN
- **Required**: ❌ No
- **Type**: String (DSN URL)
- **Description**: Sentry Data Source Name for error tracking
- **Format**: `"https://<key>@<organization>.ingest.sentry.io/<project>"`
- **Usage**: Send exceptions and errors to Sentry
- **Production**: Highly recommended for error monitoring

#### SENTRY_ENVIRONMENT
- **Required**: ⚠️ Conditional (if using Sentry)
- **Type**: String
- **Description**: Environment name for Sentry error grouping
- **Example**: `"development"`, `"staging"`, `"production"`
- **Usage**: Filter errors by environment in Sentry dashboard

---

## Frontend Environment Variables

Frontend environment variables are stored in `.env` file in the `frontend/` directory.

### API Configuration

#### API_HOST
- **Required**: ✅ Yes
- **Type**: String (hostname)
- **Description**: Backend API hostname (without protocol or path)
- **Development**: `"localhost"`
- **Production**: `"api.climateconnect.earth"` or similar
- **Usage**: Constructing API URLs

#### API_URL
- **Required**: ✅ Yes
- **Type**: String (URL)
- **Description**: Complete backend API base URL
- **Format**: `"http://hostname:port"` or `"https://hostname"`
- **Development**: `"http://127.0.0.1:8000"`
- **Production**: `"https://api.climateconnect.earth"`
- **Usage**: All API requests are prefixed with this URL

#### BASE_URL_HOST
- **Required**: ✅ Yes
- **Type**: String (hostname)
- **Description**: Frontend application hostname (without protocol)
- **Development**: `"localhost"`
- **Production**: `"climateconnect.earth"` or similar
- **Usage**: Constructing absolute URLs for sharing, canonical links

#### BASE_URL
- **Required**: ❌ No
- **Type**: String (URL)
- **Description**: Complete frontend base URL (alternative to BASE_URL_HOST)
- **Example**: `"https://climateconnect.earth"`

#### SOCKET_URL
- **Required**: ✅ Yes
- **Type**: String (WebSocket URL)
- **Description**: WebSocket server URL for real-time chat
- **Format**: `"ws://hostname"` or `"wss://hostname"`
- **Development**: `"ws://localhost"`
- **Production**: `"wss://climateconnect.earth"` or `"wss://api.climateconnect.earth"`
- **Protocol**: Use `ws://` for HTTP, `wss://` for HTTPS

---

### Environment Settings

#### ENVIRONMENT
- **Required**: ✅ Yes
- **Type**: String
- **Description**: Specifies the runtime environment
- **Values**: `"development"` | `"staging"` | `"production"`
- **Development**: `"development"`
- **Production**: `"production"`
- **Usage**: Feature toggles, analytics, error reporting

#### PORT
- **Required**: ❌ No
- **Type**: Integer (string)
- **Description**: Port for Next.js development server
- **Default**: `3000`
- **Example**: `"3000"`, `"3001"`
- **Usage**: `yarn dev` will use this port if specified

---

### Feature Configuration

#### ENABLE_DEVLINK
- **Required**: ❌ No
- **Type**: Boolean (string)
- **Description**: Enable Webflow Devlink components
- **Values**: `"true"` | `"false"`
- **Default**: `"false"`
- **Development**: Can be `"true"` if using Webflow
- **Production**: Should match design system setup

#### CUSTOM_HUB_URLS
- **Required**: ❌ No
- **Type**: Comma-separated string
- **Description**: List of custom hub URL slugs
- **Format**: `"hub1,hub2,hub3"` (no spaces)
- **Example**: `"prio1,perth"`
- **Usage**: Identify hubs with special routing or behavior

#### LOCATION_HUBS
- **Required**: ❌ No
- **Type**: Comma-separated string
- **Description**: List of location-based hub slugs
- **Format**: `"location1,location2,location3"` (no spaces)
- **Example**: `"erlangen,wuerzburg,marburg"`
- **Usage**: Enable location-specific features for these hubs

#### DONATION_CAMPAIGN_RUNNING
- **Required**: ❌ No
- **Type**: Boolean (string)
- **Description**: Show donation campaign banner/features
- **Values**: `"true"` | `"false"`
- **Default**: `"false"`
- **Usage**: Toggle visibility of donation CTAs

---

### External Integrations

#### WEBFLOW_API_TOKEN
- **Required**: ⚠️ Conditional (if using Webflow integration)
- **Type**: String
- **Description**: Webflow API authentication token
- **Usage**: Fetch content from Webflow CMS
- **Security**: Keep secure, rate limits apply

#### WEBFLOW_SITE_ID
- **Required**: ⚠️ Conditional (if using Webflow integration)
- **Type**: String
- **Description**: Webflow site identifier
- **Example**: `"12345678"`
- **Usage**: Identify which Webflow site to fetch content from

#### GOOGLE_ANALYTICS_CODE
- **Required**: ❌ No
- **Type**: String
- **Description**: Google Analytics tracking ID
- **Format**: `"UA-XXXXXXXXX-X"` or `"G-XXXXXXXXXX"`
- **Example**: `"G-ABCD123456"`
- **Production**: Enable for analytics tracking
- **Development**: Leave unset to avoid polluting analytics

#### FRONTEND_SENTRY_DSN
- **Required**: ❌ No
- **Type**: String (DSN URL)
- **Description**: Sentry Data Source Name for frontend error tracking
- **Format**: `"https://<key>@<organization>.ingest.sentry.io/<project>"`
- **Usage**: Send frontend errors and exceptions to Sentry
- **Production**: Highly recommended

#### LATEST_NEWSLETTER_LINK
- **Required**: ❌ No
- **Type**: String (URL)
- **Description**: URL to latest newsletter issue
- **Example**: `"https://newsletter.climateconnect.earth/latest"`
- **Usage**: Display link to current newsletter

#### LETS_ENCRYPT_FILE_CONTENT
- **Required**: ❌ No
- **Type**: String
- **Description**: Content for Let's Encrypt verification file
- **Usage**: SSL certificate validation (deployment-specific)

---

## Environment Setup

### Backend Setup

1. **Create environment file**:
   ```bash
   cd backend
   cp .backend_env.example .backend_env
   ```

2. **Edit `.backend_env`**:
   - Set `SECRET_KEY` (generate with `openssl rand -base64 32`)
   - Configure database credentials
   - Set `DEBUG=true` for development
   - Set `AUTO_VERIFY=true` to skip email verification
   - Configure Redis URL

3. **Minimal development configuration**:
   ```bash
   FRONTEND_URL="http://localhost:3000"
   SECRET_KEY="<generated-secret-key>"
   ALLOWED_HOSTS="localhost"
   ENVIRONMENT="development"
   MEDIA_ROOT="/absolute/path/to/backend/media"
   DEBUG="true"
   AUTO_VERIFY="true"

   DATABASE_NAME="climateconnect-dev"
   DATABASE_USER="postgres"
   DATABASE_PASSWORD="your_password"
   DATABASE_HOST="localhost"
   DATABASE_PORT="5432"

   REDIS_URL="redis://localhost"
   CELERY_BROKER_URL="redis://localhost"

   LOCATION_SERVICE_BASE_URL="https://..."

   CACHE_BACHED_RANK_REQUEST="true"
   ```

### Frontend Setup

1. **Create environment file**:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **Edit `.env`**:
   ```bash
   API_HOST="localhost"
   API_URL="http://127.0.0.1:8000"
   BASE_URL_HOST="localhost"
   SOCKET_URL="ws://localhost"
   ENVIRONMENT="development"
   ```

3. **Optional settings**:
   - Add `CUSTOM_HUB_URLS` if testing custom hubs
   - Add `LOCATION_HUBS` if testing location-based features
   - Add `ENABLE_DEVLINK="true"` if using Webflow components

---

## Environment Variable Checklist

### Backend - Required for Development
- [ ] `SECRET_KEY`
- [ ] `DEBUG`
- [ ] `ALLOWED_HOSTS`
- [ ] `ENVIRONMENT`
- [ ] `FRONTEND_URL`
- [ ] `MEDIA_ROOT`
- [ ] `DATABASE_NAME`
- [ ] `DATABASE_USER`
- [ ] `DATABASE_PASSWORD`
- [ ] `DATABASE_HOST`
- [ ] `REDIS_URL`
- [ ] `CELERY_BROKER_URL`
- [ ] `LOCATION_SERVICE_BASE_URL`

### Backend - Required for Production
- [ ] All development requirements
- [ ] `AUTO_VERIFY` (set to false)
- [ ] `AZURE_ACCOUNT_NAME`
- [ ] `AZURE_ACCOUNT_KEY`
- [ ] `AZURE_CONTAINER`
- [ ] `STATIC_ROOT`
- [ ] Email configuration (Mailjet keys + template IDs)
- [ ] `CLIMATE_CONNECT_SUPPORT_EMAIL`
- [ ] `REDIS_PASSWORD`
- [ ] `SENTRY_DSN`
- [ ] `SENTRY_ENVIRONMENT`

### Frontend - Required for Development
- [ ] `API_HOST`
- [ ] `API_URL`
- [ ] `BASE_URL_HOST`
- [ ] `SOCKET_URL`
- [ ] `ENVIRONMENT`

### Frontend - Required for Production
- [ ] All development requirements
- [ ] `GOOGLE_ANALYTICS_CODE` (recommended)
- [ ] `FRONTEND_SENTRY_DSN` (recommended)

---

## Troubleshooting

### Backend

**Database connection errors**:
- Verify PostgreSQL is running
- Check `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`
- Verify user credentials
- Ensure PostGIS extension is installed

**Redis connection errors**:
- Verify Redis is running
- Check `REDIS_URL` format
- Verify `REDIS_PASSWORD` if set
- Test connection: `redis-cli ping`

**Email not sending**:
- Check Mailjet credentials (`MJ_APIKEY_PUBLIC`, `MJ_APIKEY_PRIVATE`)
- Verify template IDs exist in Mailjet dashboard
- Check Celery worker is running
- Review Celery logs for task failures

**Media uploads failing**:
- In development: Verify `MEDIA_ROOT` directory exists and is writable
- In production: Verify Azure credentials and container name
- Check `ENVIRONMENT` setting matches configuration

### Frontend

**API requests failing**:
- Verify backend is running
- Check `API_URL` matches backend URL
- Verify CORS settings in backend
- Check auth token in cookies

**WebSocket connection failing**:
- Verify `SOCKET_URL` protocol (`ws://` or `wss://`)
- Check backend WebSocket routing
- Verify token is being sent in connection params
- Review browser console for errors

**Environment variables not loading**:
- Verify `.env` file exists in `frontend/` directory
- Check `next.config.js` includes variable in `env` array
- Restart Next.js dev server after changing `.env`
- Use `process.env.VARIABLE_NAME` in code

---

## Additional Resources

- **Backend setup**:[ `/backend/local-env-setup.md`](../backend/local-env-setup.md)
- **Architecture**: [`/doc/architecture.md`](architecture.md)
- **Domain entities**: [`/doc/domain-entities.md`](domain-entities.md)
- **Django settings**: [`/backend/climateconnect_main/settings.py`](../backend/climateconnect_main/settings.py)
- **Next.js config**: [`/frontend/next.config.js`](../frontend/next.config.js)

---

## Version History

- **2025-11-27**: Initial documentation
- **2026-03-30**: Added `EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID` and `EVENT_REGISTRATION_CONFIRMATION_TEMPLATE_ID_DE` for event registration confirmation emails (issue #1845). `StartDate` template variable is now timezone- and language-localised (user location → project location → UTC; `timezonefinder` dependency added via PDM).
- **2026-04-01**: Added `EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID` and `EVENT_ORGANIZER_MESSAGE_TEMPLATE_ID_DE` for organiser-to-guests emails (issue #1866, spec `20260401_1100_organizer_send_email_to_guests.md`). Both templates default to `""` (empty string) — no emails will be delivered until configured in Mailjet and set in the environment.
- **2026-04-09**: Added `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID` and `ADMIN_CANCEL_REGISTRATION_TEMPLATE_ID_DE` for admin-cancellation notification emails sent to guests (issue #1872, spec `20260407_1000_organizer_cancel_guest_registration.md`). Both templates default to `""` (empty string) — no emails will be delivered until configured in Mailjet and set in the environment.
