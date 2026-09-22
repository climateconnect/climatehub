# Climate Connect Glossary

> Domain-specific terminology for Climate Connect platform

## Core Concepts

### **Hub**
Geographic or sector-based community with custom branding, featured content, and moderation capabilities. Examples: "Berlin Hub", "Renewable Energy Hub"
- **Related Models**: `Hub`, `HubStat`, `HubTranslation`
- **Key Features**: Custom themes, featured projects, location filtering

### **Project**
Climate action initiative with members, status tracking, and collaboration features.
- **States**: Draft, In Progress, Completed, On Hold
- **Related Models**: `Project`, `ProjectMember`, `ProjectFollower`, `ProjectComment`
- **Key Features**: Member management, status updates, timeline

### **Organization**
Registered climate organization with membership management, verification status, and project portfolio.
- **Types**: Non-profit, Company, Other
- **Related Models**: `Organization`, `OrganizationMember`, `ProjectParents` (org-project link)
- **Key Features**: Member roles, verification badges, project creation

### **UserProfile**
Extended user profile with climate-relevant information beyond basic authentication.
- **Related Models**: `UserProfile`, `UserProfileTranslation`, `Availability`, `Skill`
- **Key Features**: Skills, availability, location, bio, background image

### **Idea**
Early-stage climate action proposal before becoming a full project.
- **Related Models**: `Idea`, `IdeaSupporter`, `IdeaComment`
- **Lifecycle**: Idea → Project (promotion path)

## Features

### **Chat/Messaging**
Real-time communication system using WebSocket (Django Channels).
- **Related Models**: `MessageParticipants`, `Message`
- **Types**: User-to-user, group chats
- **Tech**: Django Channels with Redis channel layer

### **Notification**
Multi-channel system supporting in-app and email notifications.
- **Related Models**: `Notification`, `UserNotification`, `EmailNotification`
- **Types**: 18+ notification types including messages, comments, follows, likes, membership requests
- **Delivery**: In-app (immediate), Email (with user preferences and digest options)

### **Badge**
Gamification system for recognizing user contributions and achievements.
- **Related Models**: `Badge`, `UserBadge`, `DonorBadge`
- **Examples**: "Early Adopter", "Project Creator", "Active Contributor"

### **Donation**
Fundraising system with campaigns and contribution tracking.
- **Related Models**: `Donation`, `DonationGoal`
- **Features**: One-time and recurring donations, campaign goals, donor badges

## User Roles & Permissions

### **Organization Member Roles**
- **Admin**: Full control, can manage members and settings
- **Member**: Can create projects under organization
- **Creator**: Original founder of the organization

### **Project Member Roles**
- **Admin**: Full project control
- **Member**: Can edit project and participate
- **Creator**: Original project initiator

### **Hub Roles**
- **Hub Ambassador**: Community moderator with feature/pin capabilities

## Technical Terms

### **Knox**
Django REST Knox - Token-based authentication library providing secure token management with automatic expiry and per-device tokens.

### **Celery**
Distributed task queue for background job processing (emails, notifications, scheduled tasks).
- **Celery Worker**: Processes async tasks
- **Celery Beat**: Scheduler for periodic tasks

### **PostGIS**
PostgreSQL extension for geospatial data storage and querying.
- **Use Cases**: Location search, distance calculations, map boundaries
- **Models**: `Location` (city, country, lat/long)

### **SSR (Server-Side Rendering)**
Next.js feature for rendering pages on the server before sending to client.
- **Benefits**: SEO optimization, faster initial page load
- **Implementation**: `getServerSideProps`, `getInitialProps`

### **MUI (Material-UI)**
React component library (v5) following Material Design principles.
- **Styling**: Emotion-based (@emotion/react, @emotion/styled)
- **Theming**: Custom Climate Connect theme in `/frontend/src/themes/`

### **Channels**
Django Channels - Extension that adds WebSocket support to Django via ASGI.
- **Consumers**: WebSocket handlers (similar to views)
- **Channel Layer**: Redis-backed message passing for real-time features

### **DRF (Django REST Framework)**
Powerful toolkit for building Web APIs in Django.
- **Serializers**: Data validation and transformation
- **ViewSets**: CRUD operations with routing
- **Permissions**: Fine-grained access control

## Data Concepts

### **Translation Models**
Suffix pattern: `*Translation` (e.g., `ProjectTranslation`, `UserProfileTranslation`)
- **Languages**: English (default), German
- **Framework**: Django i18n with custom translation models

### **Availability**
User time commitment level for climate action participation.
- **Examples**: "Full-time", "Part-time", "Volunteer on weekends"
- **Related to**: Job opportunities, project expectations

### **Skill**
Hierarchical taxonomy of abilities relevant to climate action.
- **Structure**: Parent-child relationships (e.g., "Programming" → "Python")
- **Usage**: User profiles, project requirements, matching

### **Location**
Geographic information with PostGIS support.
- **Fields**: City, country, lat/long, multi-location support
- **Sources**: OpenStreetMap, Nominatim API
- **Privacy**: Users can choose location visibility

## Status & State Values

### Notification Types (Examples)
- `PRIVATE_MESSAGE` - Direct message received
- `PROJECT_COMMENT` - Comment on project
- `PROJECT_FOLLOWER` - New project follower
- `PROJECT_LIKE` - Project was liked
- `MEMBERSHIP_REQUEST` - Join request received
- `IDEA_COMMENT` - Comment on idea
- (Total: 18+ types)

## Common Abbreviations

- **CC**: Climate Connect
- **API**: Application Programming Interface
- **CRUD**: Create, Read, Update, Delete
- **SSR**: Server-Side Rendering
- **CSR**: Client-Side Rendering
- **WS**: WebSocket
- **OSM**: OpenStreetMap
- **GCP**: Google Cloud Platform
- **PDM**: Python Development Master (package manager)

## External Services

### **Azure Blob Storage**
Cloud storage service for media files (profile images, project images, organization logos).

### **Google Maps API**
Service for geocoding, map display, and location autocomplete.

### **Nominatim API**
OpenStreetMap geocoding service for location search and reverse geocoding.

### **Sentry**
Error tracking and monitoring service for both backend and frontend.

---

## Relationships Overview

```
User (Django Auth)
  ↓ 1:1
UserProfile ←→ Skills (M2M)
  ↓         ↘ Location (FK)
  ↓          ↘ Availability (FK)
  ↓
  ├─→ ProjectMember → Project
  ├─→ OrganizationMember → Organization → Project (via ProjectParents)
  ├─→ HubMember → Hub
  ├─→ Idea
  ├─→ Message
  └─→ Notification (via UserNotification)
```

---

**Note**: This glossary is maintained to help developers, Copilot, and new contributors quickly understand Climate Connect's domain language.

