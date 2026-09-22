# Architecture Overview (Mosy Framework)

## Introduction
This document outlines the architecture of Climate Connect using the Mosy Framework principles. It aligns business objectives with technical implementation.

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

## Core Components

### 1. Actors
- **Guest**: Unauthenticated visitor.
- **Member**: Verified registered user.
- **Organization**: Organization represented by a user.
- **Admin**: Platform administrator.
- **Networker**: Platform administrator of a specific climate hub.

### 2. Technical Stack
- **Frontend**: Next.js (React), TypeScript, Tailwind CSS.
- **Backend**: Python (Django), Django Rest Framework.
- **Database**: PostgreSQL (PostGIS).
- **Async/Queue**: Redis, Celery.
- **Storage**: Azure Blob Storage (Production).
- **External Services**:
  - Mailjet (Email).
  - OpenStreetMap/Nominatim (Geocoding).
  - Sentry (Monitoring).

### 3. Documentation Map
- **[System Entities](./entities/system-entities.md)**: Data models and domain objects.
- **[Functional Flows](./flows/core-flows.md)**: User journeys and system processes.
- **[Objectives & Metrics](./metrics/objectives.md)**: Success criteria.
