# GitHub Copilot Instructions for Climate Connect

> **Mission**: Climate Connect helps people solve the climate crisis by connecting activists, organizations, and projects for effective climate action.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Patterns](#architecture-patterns)
4. [Code Style & Best Practices](#code-style--best-practices)
5. [Development Workflow](#development-workflow)
6. [Important Considerations](#important-considerations)
7. [File Naming Conventions](#file-naming-conventions)
8. [Common Code Patterns](#common-code-patterns)
9. [Environment Variables](#environment-variables)
10. [Copilot-Specific Tips](#copilot-specific-tips)
11. [Quick Reference](#quick-reference-for-common-tasks)

---

## Project Overview

Climate Connect (climateconnect.earth) is a full-stack climate action platform connecting activists, organizations, and projects to facilitate collaboration on climate solutions. The platform enables users to discover projects, join organizations, share ideas, communicate in real-time, and participate in geography/sector-based communities.

**Repository**: Monorepo with `/backend` (Django) and `/frontend` (Next.js) directories.

## Tech Stack

### Backend
- **Framework**: Django 3.2 + Django REST Framework
- **Language**: Python 3.11
- **Database**: PostgreSQL with PostGIS extension (geospatial data)
- **Caching/Message Broker**: Redis
- **Real-time**: Django Channels (WebSocket support via ASGI)
- **Background Tasks**: Celery + Celery Beat (scheduled tasks)
- **Authentication**: Django REST Knox (token-based)
- **Package Manager**: PDM (pyproject.toml)
- **Storage**: Azure Blob Storage (media files)
- **Testing**: Django test framework + Factory Boy + Faker

### Frontend
- **Framework**: Next.js 12 (React 17)
- **Language**: JavaScript (partial TypeScript migration in progress)
- **UI Library**: Material-UI v5 (@mui/material)
- **Styling**: Emotion (@emotion/react, @emotion/styled)
- **State**: React hooks (no Redux/global state library)
- **HTTP Client**: Axios
- **Maps**: @react-google-maps/api + Google Maps API
- **Date Handling**: date-fns, dayjs
- **Package Manager**: Yarn (also supports Bun - bun.lock present)
- **Testing**: Jest
- **Rendering**: SSR (Server-Side Rendering)

### Infrastructure
- **Containers**: Docker (docker-compose for dev/prod)
- **Dev Environment**: VS Code Dev Containers supported
- **Deployment**: Azure App Service
- **Monitoring**: Sentry (error tracking)

## Architecture Patterns

### Backend Structure
- **Modular Django Apps**: Each domain has its own app (climateconnect_api, organization, chat_messages, hubs, ideas, location, translations)
- **App Structure Pattern**:
  ```
  app_name/
    ├── models/          # Database models (can be split into multiple files)
    ├── serializers/     # DRF serializers for API responses
    ├── views/           # API views/viewsets
    ├── permissions.py   # Custom DRF permissions
    ├── urls.py          # URL routing
    ├── admin.py         # Django admin customization
    ├── utility/         # Helper functions
    ├── migrations/      # Database migrations
    ├── locale/          # Translation files (i18n)
    └── tests/           # Test files
  ```
- **RESTful API**: Standard REST endpoints with DRF ViewSets and APIViews
- **WebSocket**: Real-time chat via Django Channels consumers
- **Background Processing**: Celery tasks for async operations (email, notifications, etc.)

### Frontend Structure
- **Pages**: `/frontend/pages/` - Next.js pages (file-based routing)
- **Components**: `/frontend/src/components/` - Reusable React components
- **Utils**: `/frontend/src/utils/` - Helper functions and utilities
- **Themes**: `/frontend/src/themes/` - MUI theme configuration
- **SSR Pattern**: Pages use `getServerSideProps` or `getInitialProps` for data fetching

### Key Domain Entities
- **UserProfile**: Extended user profiles with skills, availability, location
- **Organization**: Climate organizations with membership management
- **Project**: Climate action projects with status tracking, members, skills. . A project can also be an event or an idea. 
- **Hub**: Geographic/sector-based communities with custom branding
- **Chat**: Real-time messaging (user-to-user and group)
- **Notification**: Multi-channel notification system (in-app + email)
- **Badge**: Gamification system for achievements
- **Donation**: Fundraising campaigns and contribution tracking

### Architecture documentation
- [Architecture overview](../doc/mosy/architecture_overview.md)

## Code Style & Best Practices

### Backend (Python/Django)
- **Formatting**: Use `black` for code formatting (configured in pyproject.toml)
- **Linting**: Follow PEP 8
- **Commands**: 
  - Run `make format` before committing
  - Use `make start` to start the development server
  - Use `python manage.py <command>` for Django management commands
- **Models**: 
  - Use explicit `related_name` for relationships
  - Add helpful `__str__` methods
  - Use `choices` for enum-like fields
  - Include docstrings for complex models
- **Serializers**: 
  - Keep serializers focused and single-purpose
  - Use nested serializers for related data
  - Implement `create()` and `update()` for complex operations
- **Views/ViewSets**:
  - Use ViewSets for standard CRUD operations
  - Use APIView for custom endpoints
  - Apply appropriate permission classes
  - Return proper HTTP status codes
- **Permissions**: Create custom permission classes in `permissions.py`
- **Async Support**: Use async views/consumers for real-time features (Django Channels)

### Frontend (JavaScript/React/Next.js)
- **Formatting**: Use `yarn format` (Prettier)
- **Linting**: Use `yarn lint` (ESLint) - must pass before commit
- **Component Pattern**:
  - Functional components with hooks (no class components)
  - PropTypes for type validation (TypeScript migration in progress)
  - Extract reusable logic into custom hooks
- **Material-UI v5**:
  - Use `@mui/material` imports
  - Use `styled()` from `@mui/styles` or `@emotion/styled` for styling
  - Use theme breakpoints for responsive design
  - Access theme with `useTheme()` hook
- **Data Fetching**:
  - Use `getServerSideProps` for SSR
  - Use Axios for API calls
  - Handle loading and error states
  - Use universal cookies for auth token management
- **State Management**: 
  - Use React hooks (useState, useEffect, useContext, etc.)
  - Pass props for component communication
  - Use Context API for deeply nested state (sparingly)
- **Routing**: Use Next.js file-based routing in `/pages/`

### General Guidelines
- **Branch Strategy**: Create feature branches from `master` (single branching model)
- **Commits**: Write clear, concise commit messages
- **PRs**: 
  - Add meaningful title and description
  - Include detailed testing steps
  - Squash merge when approved
  - Ensure linting passes before PR
- **Testing**: 
  - Write tests for new features
  - Backend: Use Django test framework + Factory Boy
  - Frontend: Use Jest
- **Translations**: 
  - Support English and German
  - Use Django i18n for backend (`gettext`)
  - Add translation keys for user-facing strings

## Development Workflow

### Local Setup
1. **Recommended**: Use VS Code Dev Containers for one-click setup
2. **Manual**: Follow README for PostgreSQL, Redis, Python venv, and Node.js setup
3. Start services:
   - Backend: `cd backend && make start` (port 8000)
   - Frontend: `cd frontend && yarn dev` (port 3000)
   - Redis: Available in dev container or local install
   - PostgreSQL: Available in dev container or local install

### Common Commands
**Backend**:
- `make start` - Start Django development server
- `make format` - Format code with black
- `python manage.py makemigrations` - Create migrations
- `python manage.py migrate` - Apply migrations
- `python manage.py createsuperuser` - Create admin user
- `python manage.py test` - Run tests
- `celery -A climateconnect_main worker -l info` - Start Celery worker
- `celery -A climateconnect_main beat -l info` - Start Celery beat (scheduler)

**Frontend**:
- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn lint` - Run ESLint
- `yarn format` - Run Prettier
- `yarn test` - Run Jest tests

### Database Access
- **PostgreSQL REPL**: `psql` (in dev container or `psql -h localhost -U <user> <db>`)
- **Redis REPL**: `redis-cli -h redis` (in dev container) or `redis-cli`

## Important Considerations

### When Writing Backend Code
- Always consider database performance (use `select_related`/`prefetch_related` for relations)
- Implement proper pagination for list endpoints
- Add appropriate indexes in models for frequently queried fields
- Use transactions for multi-model operations
- Cache expensive queries with Redis
- Handle timezone-aware datetimes (use Django's timezone utils)
- Validate input data with serializers
- Use proper HTTP status codes (200, 201, 400, 404, etc.)
- Log errors appropriately

### When Writing Frontend Code
- Optimize for SEO (Next.js SSR)
- Handle loading states and errors gracefully
- Make components accessible (a11y)
- Optimize images (use Next.js Image component when possible)
- Keep bundle size in mind (use dynamic imports for large components)
- Test responsive design (mobile, tablet, desktop)
- Use semantic HTML
- Handle authentication state (check for token)
- Display user-friendly error messages

### When Working with Real-time Features
- WebSocket connections use token authentication
- Messages are sent/received through Django Channels
- Redis is the channel layer backend
- Handle connection drops and reconnection logic
- Test with multiple concurrent users

### When Working with Location Data
- Use PostGIS for geospatial queries
- Location model includes city, country, coordinates
- OpenStreetMap and Nominatim API for geocoding and map display
- Consider privacy when handling user locations

### Security Considerations
- Never commit secrets (use .env files)
- Validate all user input
- Use Django's built-in CSRF protection
- Implement proper authentication checks
- Follow least privilege for permissions
- Sanitize user-generated content (XSS prevention)
- Use HTTPS in production

## File Naming Conventions
- **Backend**: `snake_case.py`
- **Frontend**: 
  - Components: `PascalCase.js` or `PascalCase.tsx`
  - Utils: `camelCase.js`
  - Pages: Next.js convention (lowercase with hyphens or dynamic `[param].js`)

## Testing Requirements
- Write tests for new features
- Maintain existing test coverage
- Run linting before committing
- Test in dev environment before PR
- Include manual testing steps in PR description

## Resources
- **Main Site**: https://climateconnect.earth
- **Repo**: https://github.com/climateconnect/climateconnect
- **Issue Tracker**: Use GitHub Issues

## Key Dependencies to Remember
- **Backend**: Django 3.2, DRF, Channels, Celery, Knox, PostGIS, Redis, Azure Storage
- **Frontend**: Next.js 12, React 17, MUI v5, Axios, Emotion, date-fns
- **Dev Tools**: Docker, VS Code Dev Containers, PDM, Yarn

---

## Quick Reference for Common Tasks

### Adding a New Model
1. Create model in `app/models/`
2. Add to `app/models/__init__.py`
3. Create serializer in `app/serializers/`
4. Run `python manage.py makemigrations`
5. Run `python manage.py migrate`
6. Register in `app/admin.py` (optional)
7. Add tests in `app/tests/`

### Adding a New API Endpoint
1. Create view in `app/views/`
2. Add URL pattern in `app/urls.py`
3. Implement permissions in view or `app/permissions.py`
4. Create/update serializer
5. Test endpoint
6. Document in code comments

### Adding a New Frontend Page
1. Create file in `/frontend/pages/`
2. Implement component with proper SSR (getServerSideProps if needed)
3. Add API calls with error handling
4. Style with MUI components
5. Test responsive design
6. Check authentication requirements

### Adding a Background Task
1. Create task in `app/tasks.py` with `@app.task` decorator (using Celery app)
2. Import and call with `.apply_async()` or `.delay()`
3. Ensure Celery worker is running
4. Test task execution
5. Add periodic task in Celery Beat configuration if scheduled

---

## Common Code Patterns

### Backend Patterns

#### Model Example
```python
from django.db import models

class Example(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(User, related_name="examples", on_delete=models.CASCADE)
    
    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["name", "created_at"])]
    
    def __str__(self):
        return self.name
```

#### Serializer Example
```python
from rest_framework import serializers

class ExampleSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)
    
    class Meta:
        model = Example
        fields = ["id", "name", "created_at", "user", "user_name"]
        read_only_fields = ["id", "created_at"]
```

#### ViewSet Example
```python
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

class ExampleViewSet(viewsets.ModelViewSet):
    serializer_class = ExampleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Example.objects.select_related("user").filter(user=self.request.user)
```

#### Celery Task Example
```python
from climateconnect_main.celery import app

@app.task
def send_notification_email(user_id, message):
    # Task implementation
    pass
```

### Frontend Patterns

#### Page with SSR Example
```javascript
import { useEffect, useState } from 'react';
import { Container, Typography } from '@mui/material';
import axios from 'axios';

export default function ExamplePage({ initialData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  
  return (
    <Container>
      <Typography variant="h4">Example Page</Typography>
      {/* Content */}
    </Container>
  );
}

export async function getServerSideProps(context) {
  try {
    const response = await axios.get(`${process.env.API_URL}/api/example/`);
    return { props: { initialData: response.data } };
  } catch (error) {
    return { props: { initialData: null } };
  }
}
```

#### MUI Styled Component Example
```javascript
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

const StyledContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2),
  },
}));
```

---

## Environment Variables

### Backend (.backend_env)
- `SECRET_KEY` - Django secret key
- `DEBUG` - Set to "true" for development
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts
- `AZURE_STORAGE_ACCOUNT_NAME` - Azure blob storage account
- `AZURE_STORAGE_ACCOUNT_KEY` - Azure blob storage key
- `SENTRY_DSN` - Sentry error tracking DSN

### Frontend (.env / .env.local)
- `API_URL` - Backend API URL (http://localhost:8000 for dev)
- `NEXT_PUBLIC_API_URL` - Public API URL for client-side
- `GOOGLE_MAPS_API_KEY` - Google Maps JavaScript API key
- `FRONTEND_SENTRY_DSN` - Sentry error tracking DSN

---

## Copilot-Specific Tips

### When Generating Backend Code
- Always include proper error handling with try/except blocks
- Add type hints for function parameters and return values when possible
- Include docstrings for complex functions
- Use Django's timezone utilities: `from django.utils import timezone`
- Prefer `select_related()` for ForeignKey and `prefetch_related()` for ManyToMany
- Use `@transaction.atomic` for operations that modify multiple models
- Remember to add migrations after model changes

### When Generating Frontend Code
- Always handle loading and error states in API calls
- Use proper TypeScript types for components being migrated
- Include responsive design using MUI breakpoints
- Add proper accessibility attributes (aria-labels, alt text, etc.)
- Use meaningful component and variable names
- Extract repeated JSX into separate components
- Handle authentication checks with token validation

### When Writing Tests
- **Backend**: Use Factory Boy for test data creation
- **Backend**: Use `self.client` for API endpoint testing
- **Backend**: Clean up test data with `setUp()` and `tearDown()`
- **Frontend**: Mock API calls with Jest
- **Frontend**: Test component rendering and user interactions
- Always test error cases and edge conditions

### API Development Guidelines
- Return proper status codes: 200 (OK), 201 (Created), 204 (No Content), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found)
- Use pagination for list endpoints (DRF's `PageNumberPagination`)
- Include filtering options using `django-filter`
- Implement proper permission checks before data access
- Return consistent error response format
- Add OpenAPI/Swagger documentation comments

### Performance Optimization
- **Backend**: Use `only()` and `defer()` to limit fetched fields
- **Backend**: Implement Redis caching for expensive queries
- **Backend**: Use database indexes on frequently queried fields
- **Backend**: Profile slow endpoints with Django Debug Toolbar
- **Frontend**: Use dynamic imports for large components: `const Component = dynamic(() => import('./Component'))`
- **Frontend**: Optimize images with proper sizing and lazy loading
- **Frontend**: Minimize API calls by combining related data in endpoints

---

**Remember**: This is a climate action platform serving real users working on climate solutions. Write clean, maintainable code that helps the mission of connecting people to solve the climate crisis.

