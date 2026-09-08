# Climate Connect Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Data Architecture](#data-architecture)
6. [Infrastructure & DevOps](#infrastructure--devops)
7. [Communication Patterns](#communication-patterns)
8. [Authentication & Security](#authentication--security)
9. [Real-Time Features](#real-time-features)
10. [Background Processing](#background-processing)
11. [Internationalization](#internationalization)
12. [Development Environment](#development-environment)
13. [Deployment Considerations](#deployment-considerations)
14. [Appendix](#appendix-key-integration-points)
15. [Summary](#summary)

---

## System Overview

Climate Connect is a full-stack online climate action platform that connects activists, organizations, and projects to facilitate collaboration on climate solutions. The platform enables users to discover and share projects, join organizations, communicate in real-time, and participate in climate-focused communities organized by geography and sector.

### Key Capabilities

- **User Profiles**: Extended profiles with skills, availability, location, and climate interests
- **Project Management**: Create, discover, and manage climate action projects. A project can also be an event or an idea. 
- **Organization Management**: Register and manage climate organizations with membership and permissions
- **Community Hubs**: Geographic and sector-based communities with custom branding
- **Real-Time Messaging**: Chat for user-to-user and group communication
- **Social Features**: Follow, like, comment, and share functionality
- **Gamification**: Badge system for recognizing contributions and achievements
- **Donations**: Fundraising campaigns and contribution tracking
- **Multilingual Support**: English and German with extensible i18n framework
---

## High-Level Architecture

### Architecture Style

**Monorepo with Decoupled Frontend and Backend**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (Port 3000)                 │  │
│  │  - Server-Side Rendering (SSR)                           │  │
│  │  - React 17 + Material-UI v5                             │  │
│  │  - TypeScript (partial migration)                        │  │
│  │  - Universal Cookies (auth token)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ │
                    HTTP/HTTPS│ │WebSocket (WS/WSS)
                              ▼ ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Django REST API (Port 8000)                     │  │
│  │  - Django 3.2 + Django REST Framework                    │  │
│  │  - RESTful API endpoints                                 │  │
│  │  - Knox token authentication                             │  │
│  │  - ASGI (async) + WSGI (sync) support                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Django Channels WebSocket Consumer               │  │
│  │  - Real-time bidirectional communication                 │  │
│  │  - Token-based WebSocket auth                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Celery Workers + Beat                        │  │
│  │  - Background task processing                             │  │
│  │  - Scheduled jobs (periodic tasks)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│  ┌────────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │   PostgreSQL       │  │     Redis      │  │    Azure     │  │
│  │   + PostGIS        │  │  (Cache +      │  │  Blob        │  │
│  │  (Primary DB)      │  │   Message      │  │  Storage     │  │
│  │                    │  │   Broker)      │  │  (Media)     │  │
│  └────────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  - Google Maps API (geocoding, maps)                            │
│  - OpenStreetMap (location data)                                │
│  - Email Service (notifications)                                │
│  - Payment Gateway (donations)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack Summary

| Layer | Technologies                                                     |
|-------|------------------------------------------------------------------|
| **Frontend** | Next.js 13, React 18, Material-UI v5, TypeScript, Emotion, Axios |
| **Backend** | Django 3.2, Django REST Framework, Django Channels, Python 3.x   |
| **Database** | PostgreSQL 13+, PostGIS extension                                |
| **Caching & Queue** | Redis                                                            |
| **Task Queue** | Celery + Celery Beat                                             |
| **Storage** | Azure Blob Storage                                               |
| **Web Server** | Uvicorn (ASGI), Gunicorn (WSGI)                                  |
| **Package Management** | PDM (backend), Yarn (frontend)                                   |

---

## Backend Architecture

### Django Project Structure

```
backend/
├── climateconnect_main/           # Core Django configuration
│   ├── settings.py                # Django settings
│   ├── urls.py                    # Root URL routing
│   ├── asgi.py                    # ASGI application (async)
│   ├── wsgi.py                    # WSGI application (sync)
│   ├── routing.py                 # WebSocket routing
│   └── celery.py                  # Celery configuration
│
├── climateconnect_api/            # Core user & system features
│   ├── models/                    # User, Skills, Badges, Donations, Notifications
│   ├── serializers/               # DRF serializers
│   ├── views/                     # API views
│   ├── permissions.py             # Custom permissions
│   ├── pagination.py              # Custom pagination
│   └── factories.py               # Test data factories
│
├── organization/                  # Projects & organizations
│   ├── models/                    # Project, Organization, Members, Posts, Comments
│   ├── serializers/               # DRF serializers
│   ├── views/                     # API views
│   └── permissions.py             # Access control
│
├── chat_messages/                 # Real-time messaging
│   ├── models/                    # MessageParticipants, Message, Participant
│   ├── consumer.py                # WebSocket consumer
│   ├── serializers/               # Message serializers
│   └── views/                     # REST endpoints
│
├── hubs/                          # Community hubs
│   ├── models/                    # Hub, HubTheme, Ambassadors, Supporters
│   ├── serializers/               # Hub serializers
│   └── views/                     # Hub API
│
├── location/                      # Geographic data
│   ├── models/                    # Location with PostGIS
│   └── views/                     # Location API
│
├── ideas/                         # Idea sharing system
│   ├── models/                    # Idea, IdeaComment, IdeaRating, IdeaSupporter
│   ├── serializers/               # Idea serializers
│   └── views/                     # Idea API
│
├── locale/                        # Backend translations
│   ├── en/                        # English
│   └── de/                        # German
│
└── manage.py                      # Django management CLI
```

### Django App Responsibilities

| App | Purpose | Key Models |
|-----|---------|-----------|
| **climateconnect_main** | Core configuration, routing, ASGI/WSGI setup | N/A (settings only) |
| **climateconnect_api** | User management, skills, badges, notifications, donations | UserProfile, Skill, Badge, Notification, Donation |
| **organization** | Projects, organizations, membership, collaboration | Organization, Project, ProjectMember, Post, Comment |
| **chat_messages** | Real-time messaging via WebSockets | MessageParticipants, Message, Participant |
| **hubs** | Geographic and sector-based communities | Hub, HubTheme, HubAmbassador |
| **location** | Geographic data with spatial queries | Location (PostGIS) |
| **ideas** | Idea proposals and collaboration | Idea, IdeaComment, IdeaSupporter |

### API Design Patterns

**RESTful Conventions**

- **Endpoints**: Prefixed with `/api/` (e.g., `/api/projects/`, `/api/organizations/`)
- **Methods**: Standard HTTP verbs (GET, POST, PUT, PATCH, DELETE)
- **Authentication**: Token-based via Django REST Knox
- **Serialization**: Django REST Framework serializers with nested relationships
- **Pagination**: Custom pagination classes for large datasets
- **Filtering**: Query parameters for filtering by hub, location, sector, tags
- **Permissions**: Custom permission classes per view/viewset

**URL Structure Examples**

```
/api/signup/                          # User registration
/api/login/                           # Token authentication
/api/logout/                          # Token invalidation

/api/profiles/{id}/                   # User profiles
/api/projects/                        # Project listing/creation
/api/projects/{id}/                   # Project detail
/api/organizations/{id}/              # Organization detail

/api/hubs/                            # Hub listing
/api/hubs/{url_slug}/                 # Hub detail by slug

/api/ideas/                           # Idea listing/creation
/api/chat/messages/                   # Message history
```

### Key Backend Components

#### 1. Authentication System

**Django REST Knox**
- Token-based authentication with automatic expiry
- Multiple tokens per user (device support)
- Secure token storage with hashing
- `/login/`, `/logout/` endpoints

**Token Flow**:
1. User POSTs credentials to `/api/login/`
2. Server validates and returns Knox token
3. Frontend stores token in universal-cookie
4. Token sent in `Authorization: Token <token>` header
5. WebSocket connections authenticate via token in connection params

#### 2. Permission System

**Role-Based Access Control (RBAC)**
- `Role` model defines permission levels: read-only, read-write, all (admin)
- Applied to `ProjectMember`, `OrganizationMember`, `Participant` (chat)
- Custom DRF permission classes enforce access rules
- Object-level permissions for editing/deleting content

**Permission Examples**:
- Only project members can post updates
- Only admins can add/remove members
- Organization owners can delete organization
- Comment authors can edit/delete their comments

#### 3. Notification System

**Event-Driven Architecture**
- 18 notification types for platform events
- `Notification` model linked to triggering entity
- `UserNotification` tracks per-user delivery and read status
- `EmailNotification` logs email sends
- Background tasks via Celery for email delivery

**Notification Flow**:
```
Event occurs (e.g., new comment)
    ↓
Signal/view creates Notification record
    ↓
UserNotification records created for recipients
    ↓
Celery task queued for email notifications
    ↓
User sees notification in UI + email
```

#### 4. Translation System

**Django Internationalization (i18n)**
- Separate translation models for content types
- Pattern: `{Model}Translation` with `(entity, language)` unique constraint
- `Language` model defines supported locales
- API serializers include translated content based on request language

---

## Frontend Architecture

### Next.js Project Structure

```
frontend/
├── pages/                         # Next.js Pages Router
│   ├── _app.js                    # App wrapper with providers
│   ├── _document.js               # Custom document (SSR)
│   ├── index.js                   # Homepage
│   ├── signin.js                  # Authentication pages
│   ├── browse.js                  # Browse projects/orgs
│   ├── projects/
│   ├── organizations/
│   ├── hubs/
│   ├── ideas/
│   └── ...
│
├── src/
│   ├── components/                # React components
│   │   ├── general/               # Shared components
│   │   ├── account/               # User account UI
│   │   ├── browse/                # Browse functionality
│   │   ├── organization/          # Organization pages
│   │   ├── project/               # Project pages
│   │   ├── hub/                   # Hub pages
│   │   ├── communication/         # Chat, notifications
│   │   ├── ideas/                 # Idea pages
│   │   └── indexPage/             # Homepage components
│   │
│   ├── context/                   # React Context providers
│   │   ├── UserContext.js         # Global user state
│   │   └── ...
│   │
│   ├── hooks/                     # Custom React hooks
│   ├── themes/                    # Material-UI themes
│   ├── utils/                     # Utility functions
│   │   ├── apiOperations.js       # API client
│   │   └── ...
│   │
│   └── types/                     # TypeScript type definitions
│
├── public/                        # Static assets
│   ├── images/
│   ├── fonts/
│   ├── data/                      # Static JSON data
│   └── icons/
│
├── devlink/                       # Webflow integration components
├── next.config.js                 # Next.js configuration
├── package.json                   # Dependencies
└── yarn.lock                      # Lock file
```

### Frontend Architecture Patterns

#### 1. Server-Side Rendering (SSR)

**Next.js Pages Router (not App Router)**
- `getInitialProps` for SSR data fetching (legacy)
- `getServerSideProps` for SSR data fetching (newer pages)
- `getStaticProps` for static generation
- Hybrid rendering: SSR for dynamic pages, static for marketing pages

**Benefits**:
- SEO optimization for public project/organization pages
- Faster initial page load
- Improved Web Vitals scores

#### 2. Component Organization

**Feature-Based Structure**
- Components grouped by domain (organization, project, hub, etc.)
- Shared components in `general/`
- Separation of concerns: presentation vs. container components

**Material-UI Integration**
- Emotion-based styling (CSS-in-JS)
- Custom theme in `src/themes/`
- Responsive design with breakpoints
- `sx` prop for component-level styling

#### 3. State Management

**Combination Approach**
- **React Context**: Global user state, authentication
- **Component State**: Local UI state
- **Server State**: Fetched from API, stored temporarily
- **Cookie Storage**: Auth token persistence (universal-cookie)

**UserContext Example**:
```javascript
// Provides user data globally
<UserContext.Provider value={{ user, setUser }}>
  <App />
</UserContext.Provider>
```

#### 4. API Communication

**Axios HTTP Client**
- Configured in `src/utils/apiOperations.js`
- Base URL from environment variables
- Token interceptor adds `Authorization` header
- Error handling and retry logic

**API Call Pattern**:
```javascript
import apiRequest from '../utils/apiOperations'

const response = await apiRequest({
  method: 'get',
  url: '/api/projects/',
  token: cookies.get('auth_token')
})
```

#### 5. Routing & Navigation

**File-Based Routing**
- Pages in `pages/` directory map to routes
- Dynamic routes: `[slug].js`, `[id].js`
- Custom 404 and error pages
- Client-side navigation via `next/link` and `next/router`

**Example Routes**:
```
/                              → pages/index.js
/browse                        → pages/browse.js
/projects/[slug]               → pages/projects/[slug].js
/organizations/[slug]          → pages/organizations/[slug].js
/hubs/[hubUrl]                 → pages/hubs/[hubUrl].js
```

#### 6. Internationalization

**Next.js i18n**
- Configured for English (en) and German (de)
- Locale detection from URL or browser
- Translation files (approach varies by implementation)
- Language switcher component

---

## Data Architecture

### Database: PostgreSQL + PostGIS

#### Schema Design

**Relational Database with Spatial Extension**

- **100+ tables** organized into Django apps
- **Foreign Key constraints** for referential integrity
- **Unique constraints** on junction tables to prevent duplicates
- **Indexes** on frequently queried fields (location, timestamps, foreign keys)
- **PostGIS spatial indexes** for geographic queries

#### Key Database Features

1. **PostGIS Spatial Data**
   - `Location` model uses `MultiPolygonField` and `PointField`
   - Spatial queries: distance, containment, intersection
   - Use cases: proximity search, geofencing, hub territories

2. **Soft Deletion**
   - Comments and Posts track `deleted_by` user
   - Preserves data for audit trails
   - Filtered in querysets to hide from users

3. **Hierarchical Data**
   - Self-referential ForeignKeys for trees
   - Examples: Organization parents, Hub hierarchies, Comment threading, Skill categories

4. **Many-to-Many Relationships**
   - Explicit through models (e.g., `ProjectMember`, `OrganizationTagging`)
   - Additional fields on relationships (role, availability, timestamps)

5. **Polymorphic Relationships**
   - `ContentType` framework for generic foreign keys
   - Used in: `AnswerMetaData` (matching), `Question.answer_type`

#### Database Optimization Strategies

- **Select Related / Prefetch Related**: Reduce N+1 queries in Django ORM
- **Database Indexes**: On foreign keys, frequently filtered fields
- **Pagination**: Limit result sets for large tables
- **Caching**: Redis for frequently accessed data (see below)

### Caching: Redis

**Use Cases**:
1. **Session Storage**: Django sessions (optional configuration)
2. **Celery Message Broker**: Task queue communication
3. **Celery Result Backend**: Store task results
4. **Application Cache**: Frequently accessed data (project rankings, hub stats)

**Cache Invalidation**:
- Time-based expiry for non-critical data
- Event-driven invalidation for critical data (e.g., user updates)

### Storage: Azure Blob Storage

**Media File Storage**
- User profile images
- Organization logos
- Project images
- Post attachments
- Idea images

**Django Storage Backend**:
- Custom storage class configured in settings
- Uploaded files automatically sent to Azure
- URLs generated for frontend access

---

## Infrastructure & DevOps

### Development Environment

**Local Setup**

```
┌─────────────────────────────────────────────┐
│  Developer Machine                          │
│                                             │
│  ┌────────────────┐   ┌─────────────────┐  │
│  │  Frontend      │   │  Backend        │  │
│  │  localhost:3000│   │  localhost:8000 │  │
│  └────────────────┘   └─────────────────┘  │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │  Docker Compose                        │ │
│  │  - PostgreSQL (5432)                   │ │
│  │  - Redis (6379)                        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Environment Configuration**:
- Backend: `.backend_env` file
- Frontend: `.env` file
- Docker services: `docker-compose.yml`

**Development Tools**:
- **Backend**: PDM (package manager), Black (formatter), Ruff (linter), pytest
- **Frontend**: Yarn, ESLint, Prettier, Jest, Storybook

### Docker Development (Optional)

**VS Code Dev Containers**
- `.devcontainer/` configuration
- Pre-configured PostgreSQL and Redis
- Consistent development environment across team

### Deployment Architecture

**Azure Cloud Platform**

```
┌─────────────────────────────────────────────────────────────┐
│                      Azure Cloud                            │
│                                                             │
│  ┌─────────────────┐              ┌────────────────────┐   │
│  │  Frontend       │              │  Backend           │   │
│  │  (App Service)  │◄────────────►│  (App Service)     │   │
│  │  - Next.js SSR  │  API Calls   │  - Django + DRF    │   │
│  │  - Port 3000    │              │  - Uvicorn/Gunicorn│   │
│  └─────────────────┘              └────────────────────┘   │
│                                             │               │
│                                             │               │
│  ┌──────────────────────────────────────────┼──────────┐   │
│  │                                          ▼          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │ PostgreSQL   │  │    Redis     │  │  Blob    │ │   │
│  │  │ Database     │  │   Cache      │  │ Storage  │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  │                Data Services                       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Celery Workers                                    │   │
│  │  - Background task processing                      │   │
│  │  - Celery Beat scheduler                           │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Deployment Scripts**:
- `start_backend.sh`: Backend startup script
- `start_frontend.sh`: Frontend startup script
- GitHub Actions workflows in `.github/workflows/`

**Environment Variables**:
- `ENVIRONMENT=production` triggers production settings
- Separate configs for staging and production

---

## Communication Patterns

### REST API

**Request/Response Pattern**

```
Frontend                          Backend
   │                                 │
   │  HTTP Request                   │
   │  GET /api/projects/             │
   ├────────────────────────────────►│
   │  Headers:                       │
   │    Authorization: Token xxx     │
   │                                 │
   │                          ┌──────┴──────┐
   │                          │  Query DB   │
   │                          │  Serialize  │
   │                          └──────┬──────┘
   │                                 │
   │  HTTP Response                  │
   │  200 OK                         │
   │◄────────────────────────────────┤
   │  Body: { results: [...] }       │
   │                                 │
```

**Characteristics**:
- Stateless (except auth token)
- JSON payloads
- HTTP status codes for outcomes
- CORS enabled for cross-origin requests

### WebSocket (Real-Time)

**Bidirectional Communication via Django Channels**

```
Frontend                          Backend
   │                                 │
   │  WebSocket Connect              │
   │  ws://localhost/ws/chat/        │
   ├────────────────────────────────►│
   │  Params: { token: xxx }         │
   │                                 │
   │  WebSocket Accepted             │
   │◄────────────────────────────────┤
   │                                 │
   │  Send Message                   │
   │  { type: 'message', ... }       │
   ├────────────────────────────────►│
   │                          ┌──────┴──────┐
   │                          │  Save to DB │
   │                          │  Broadcast  │
   │                          └──────┬──────┘
   │                                 │
   │  Receive Message                │
   │  { type: 'message', ... }       │
   │◄────────────────────────────────┤
   │                                 │
```

**Use Cases**:
- Real-time chat messaging
- Live notifications (optional implementation)
- Online presence indicators

**Implementation**:
- `chat_messages/consumer.py`: WebSocket consumer
- Token authentication on connection
- Group messaging via Channels layers
- Redis as channel layer backend

---

## Authentication & Security

### Authentication Flow

```
1. User Registration
   POST /api/signup/
   ├─► Create User + UserProfile
   └─► Return token

2. User Login
   POST /api/login/
   ├─► Validate credentials
   ├─► Generate Knox token
   └─► Return token + user data

3. Authenticated Request
   Any API endpoint
   ├─► Extract token from Authorization header
   ├─► Validate token (Knox)
   ├─► Attach user to request
   └─► Process request

4. WebSocket Authentication
   WS connection with token in params
   ├─► Extract token from query params
   ├─► Validate token (Knox)
   ├─► Accept connection
   └─► Link user to WebSocket
```

### Security Measures

1. **Token-Based Auth**
   - Knox tokens with automatic expiry
   - Secure token hashing in database
   - Multiple tokens per user (revokable)

2. **HTTPS/WSS in Production**
   - TLS encryption for all traffic
   - Secure WebSocket (WSS) connections

3. **CORS Configuration**
   - Whitelist allowed origins
   - Credentials included in requests

4. **Django Security Features**
   - CSRF protection for state-changing operations
   - SQL injection prevention (ORM)
   - XSS prevention (template escaping)
   - Clickjacking protection (X-Frame-Options)

5. **Permission Classes**
   - Object-level permissions
   - Role-based access control
   - Custom permission logic per view

6. **Input Validation**
   - DRF serializer validation
   - Form validation in frontend
   - File upload restrictions

7. **Rate Limiting** (recommended addition)
   - Throttle API requests per user/IP
   - Prevent abuse and DDoS

---

## Real-Time Features

### Django Channels Architecture

**ASGI (Asynchronous Server Gateway Interface)**

```
Client Request
    │
    ├──► HTTP Request
    │       └──► WSGI Handler (Gunicorn)
    │               └──► Django Views
    │
    └──► WebSocket Request
            └──► ASGI Handler (Uvicorn)
                    └──► Channels Routing
                            └──► Chat Consumer
```

**Key Components**:

1. **ASGI Application** (`climateconnect_main/asgi.py`)
   - Entry point for async requests
   - Routes HTTP and WebSocket separately

2. **Routing** (`climateconnect_main/routing.py`)
   - URL patterns for WebSocket connections
   - Similar to Django's URLconf

3. **Consumer** (`chat_messages/consumer.py`)
   - Handles WebSocket connections
   - Methods: `connect()`, `disconnect()`, `receive()`
   - Group messaging for multi-user chats

4. **Channel Layers**
   - Redis-backed message bus
   - Enables communication between consumer instances
   - Supports horizontal scaling

### Chat System Flow

```
1. User Opens Chat
   │
   ├─► Frontend establishes WebSocket connection
   │
2. Authentication
   │
   ├─► Consumer validates token
   ├─► Adds user to conversation group
   │
3. Send Message
   │
   ├─► User sends message via WebSocket
   ├─► Consumer saves to Message model
   ├─► Consumer broadcasts to group
   │
4. Receive Message
   │
   ├─► All participants receive via WebSocket
   ├─► Frontend updates chat UI in real-time
   │
5. Notification
   │
   ├─► Create MessageReceiver records
   ├─► Create Notification for offline users
   └─► Celery task sends email (if enabled)
```

---

## Background Processing

### Celery Task Queue

**Architecture**

```
Django App                Redis                Celery Workers
    │                       │                        │
    │  Queue Task           │                        │
    ├──────────────────────►│                        │
    │  task.delay(args)     │                        │
    │                       │  Fetch Task            │
    │                       │◄───────────────────────┤
    │                       │                        │
    │                       │  Execute Task          │
    │                       │                ┌───────┴────────┐
    │                       │                │  Process Task  │
    │                       │                │  - Send email  │
    │                       │                │  - Update DB   │
    │                       │                └───────┬────────┘
    │                       │                        │
    │                       │  Store Result          │
    │                       │◄───────────────────────┤
    │  Get Result           │                        │
    │◄──────────────────────┤                        │
```

**Configuration**:
- **Broker**: Redis (message queue)
- **Result Backend**: Redis (task results)
- **Config**: `climateconnect_main/celery.py`

**Queues**:

Most tasks use the default queue. One task is routed to a dedicated queue via
`CELERY_TASK_ROUTES` in `settings.py`:

| Queue | Task | Why |
|-------|------|-----|
| default | everything else | — |
| `lookup` | `location.tasks.fetch_autocomplete` | LocationIQ allows 2 req/s account-wide. The task carries `rate_limit=LOCATIONIQ_MAX_RATE`, and isolating it means a backlog of emails can't delay a user-facing autocomplete lookup (or vice versa). |

> ⚠️ **A worker must consume the `lookup` queue, or location autocomplete silently returns nothing.**
> `apply_async()` succeeding only means the broker accepted the message — not that anything will run
> it. With no consumer, every autocomplete request returns `202 pending` and the frontend gives up
> empty-handed. The backend recovers on its own after `LOCATION_PROXY_STALE_PENDING_S` by fetching
> inline (degraded but working), so watch for `"Reclaiming abandoned LocationIQ lookup"` warnings —
> a stream of those means the `lookup` worker isn't running.
>
> Locally, `docker-compose.yml` defines a `celery-lookup` service, and `make celery` starts a
> `lookup` worker next to the default one, so a developer running the standard commands gets a
> working platform. `make celery_lookup` starts only the `lookup` worker, for when you are working
> on autocomplete itself. On staging and production `start_backend.sh` starts the `lookup` worker as
> a second background process alongside gunicorn and the default worker in the same App Service
> container.
>
> **`fetch_autocomplete`'s rate limit is per worker process.** Two workers consuming `lookup` means
> 2×2 req/s to LocationIQ, so exactly one `lookup` worker per deployment. Do not scale that service
> (or the App Service instance count) without replacing `rate_limit` with a distributed limiter.

**Use Cases**:

1. **Email Notifications**
   - Send notification emails asynchronously
   - Avoid blocking HTTP requests
   - Retry on failure

2. **Data Processing**
   - Bulk imports/exports
   - Report generation
   - Image processing/compression

3. **Scheduled Tasks (Celery Beat)**
   - Periodic cleanup jobs
   - Daily digest emails
   - Ranking recalculation
   - Donation processing

**Task Example**:
```python
@shared_task
def send_notification_email(user_id, notification_id):
    # Fetch data
    # Compose email
    # Send via SMTP
    pass
```

---

## Internationalization

### Multi-Language Support

**Backend (Django i18n)**

1. **Translation Models**
   - Separate tables for translated content
   - Pattern: `{Model}Translation`
   - Foreign key to parent + language

2. **Translation Files**
   - `backend/locale/en/` and `backend/locale/de/`
   - `.po` files with message strings
   - Compiled to `.mo` files

3. **API Response**
   - Serializers include translated fields
   - Language detection from `Accept-Language` header or query param

**Frontend (Next.js i18n)**

1. **Configuration**
   - `next.config.js` defines locales (en, de)
   - Locale detection from URL path or browser

2. **Translation Approach**
   - Translation strings in JSON files or server-fetched
   - Components access translations via context/hook

3. **URL Structure**
   - `/en/projects` (English)
   - `/de/projects` (German)

**Supported Languages**:
- English (en) - Primary
- German (de) - Secondary
- Extensible for additional languages

---

## Development Environment

### Development Tools

**Backend**
- **Code Quality**: `make format` (Black), `make ruff` (linter)
- **Testing**: `make test` (pytest with --keepdb)
- **Migrations**: `make migrate`, `python manage.py makemigrations`

**Frontend**
- **Code Quality**: `yarn lint`, `yarn format`
- **Testing**: `yarn test` (Jest)
- **Storybook**: `yarn storybook` (component development)
- **Bundle Analysis**: `yarn analyze-bundle`

### VS Code Dev Containers (Optional)

**Configuration**: `.devcontainer/devcontainer.json`

**Benefits**:
- Consistent environment across developers
- Pre-configured services (PostgreSQL on 5499, Redis on 6379)
- Extensions auto-installed

**Usage**:
1. Install "Remote - Containers" extension
2. Open repo in VS Code
3. Click "Reopen in Container"

---

## Deployment Considerations

### Environment Variables

**Backend Critical Variables**:
- `SECRET_KEY`: Django secret (generate with openssl)
- `DEBUG`: Set to "false" in production
- `ALLOWED_HOSTS`: Comma-separated domain list
- `DATABASE_*`: Connection details
- `REDIS_HOST`, `REDIS_PORT`
- `AZURE_*`: Blob storage credentials
- `ENVIRONMENT`: "production" for prod settings

**Frontend Critical Variables**:
- `API_HOST`: Backend hostname
- `API_URL`: Full backend URL
- `SOCKET_URL`: WebSocket URL
- `ENVIRONMENT`: "production" for prod
- `BASE_URL_HOST`: Frontend hostname

### Database Migrations

**Strategy**:
- Run migrations before deploying new code
- Use `--no-input` flag for automated deployments
- Test migrations on staging environment first
- Backup database before major migrations

### Static Files & Media

**Backend**:
- Static files (CSS, JS, admin): Collected and served by web server or CDN
- Media files: Azure Blob Storage

**Frontend**:
- Built assets: Generated by `next build`
- Served by Next.js server or CDN

### Scaling Considerations

**Horizontal Scaling**:
- **Frontend**: Multiple Next.js instances behind load balancer
- **Backend**: Multiple Django instances (WSGI + ASGI) behind load balancer
- **Celery**: Multiple worker instances
- **Channel Layers**: Redis cluster or Redis Sentinel for HA

**Database Scaling**:
- Read replicas for read-heavy operations
- Connection pooling (PgBouncer)
- Query optimization and indexing

**Caching Strategy**:
- Redis for application cache
- CDN for static assets
- Browser caching headers

---

## Appendix: Key Integration Points

### Google Maps API
- **Purpose**: Geocoding, location autocomplete, map rendering
- **Usage**: Frontend components + backend geocoding

### OpenStreetMap
- **Purpose**: Alternative location data source
- **Usage**: Location enrichment, OSM IDs

### Location autocomplete (LocationIQ / Nominatim)
- **Purpose**: Type-ahead location search
- **Routing**: Gated by the `LOCATIONIQ_AUTOCOMPLETE` feature toggle. On, the frontend calls
  `/api/location_autocomplete/`, which serves from a Redis result cache or queues a rate-limited
  LocationIQ lookup on the `lookup` Celery queue (Nominatim fallback). Off, the browser calls
  Nominatim directly, as it did before the migration — that off-state keeps request volume
  distributed across user IPs rather than concentrated on one server address, which is what OSM's
  usage policy requires.
- **Caching**: 24h sliding TTL capped at 48h absolute, LRU-bounded to
  `LOCATION_PROXY_CACHE_MAX_ENTRIES` (default 1000). Polygon coordinates are stripped before caching —
  they are 85–99% of a payload and autocomplete only renders names; full geometry is re-fetched
  server-side when a `Location` is first saved.
- **Modules** (in `backend/location/`, one concern each):
  | Module | Owns |
  |--------|------|
  | `queue.py` | The Redis rendezvous key contract shared by the view, the Celery task and the cache — key names and `get_redis_conn()`, nothing else |
  | `providers.py` | Which upstream is called and how its response is read: `fetch_results()`, the LocationIQ/Nominatim calls, the toggle and daily-budget guards, `strip_geometry()` |
  | `cache.py` | Everything about a *stored* result: cache key, sliding TTL and age ceiling, LRU index, delivery marker, hit/miss counters |
  | `location_views.py` | HTTP contract: 200/202 polling, per-IP limits, backpressure, sentinel reclaim |
  | `tasks.py` | The rate-limited `fetch_autocomplete` job and the stats aggregation beat task |

  Dependencies run one way — `cache` → `providers` → `queue` — so there are no cycles and the view
  and the task can each import exactly what they use.
- **Usage tracking**: `AutocompleteRequestLog` (one row per real upstream call) is rolled up every
  10 minutes by `aggregate_autocomplete_stats` into `AutocompletePeriodStats`, one row per
  (period, provider); both are exposed at `GET /api/autocomplete_stats/`.
- **Specs**: `doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md` (queue),
  `doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md` (toggle + cache)

### Email Service
- **Purpose**: Transactional emails (notifications, password reset)
- **Implementation**: Django email backend (SMTP or service like SendGrid)

### Payment Gateway
- **Purpose**: Donation processing
- **Implementation**: Integration in `climateconnect_api/donations`

---

## Summary

Climate Connect employs a modern, scalable architecture with:

- **Decoupled frontend and backend** for independent scaling and development
- **Real-time capabilities** via WebSockets for instant communication
- **Comprehensive social features** enabling climate action collaboration
- **Intelligent matching** connecting users to relevant projects
- **Geographic awareness** using PostGIS for location-based discovery
- **Multilingual support** for global reach
- **Extensible design** with modular Django apps

This architecture supports the platform's mission to connect and empower climate activists worldwide while maintaining performance, security, and developer productivity.

## Version History

- **2025-11-27**: Initial documentation
