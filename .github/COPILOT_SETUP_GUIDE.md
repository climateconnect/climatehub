# GitHub Copilot Configuration Guide for Climate Connect

This guide provides suggestions for optimizing GitHub Copilot for the Climate Connect project.

## Current Setup ✅

The `.github/copilot-instructions.md` file has been created with comprehensive project-specific context including:
- Tech stack and dependencies
- Architecture patterns
- Code style guidelines
- Common patterns and examples
- Development workflow
- Security considerations

## Additional Optimization Recommendations

### 1. **Create a `.github/copilot-config.yml` (If Supported)**

GitHub Copilot may support additional configuration files in future versions. Monitor for:
```yaml
# Future potential configuration
context:
  - patterns: ["backend/**/*.py"]
    rules:
       - "Always use Django 5.2 patterns"
      - "Include proper error handling"
  - patterns: ["frontend/**/*.js", "frontend/**/*.tsx"]
    rules:
      - "Use React 18 functional components"
      - "Always implement loading states"
```

### 2. **Enhance Code Comments for Better Context**

Add structured comments in key files to help Copilot understand patterns:

**Backend Example** (`backend/climateconnect_api/models/__init__.py`):
```python
"""
Core models for Climate Connect user profiles and authentication.

Common patterns:
- All models use explicit related_name
- Timestamps use auto_now_add/auto_now
- Use db_index=True for frequently queried fields
- Include helpful __str__ methods
"""
```

**Frontend Example** (`frontend/src/components/README.md`):
```markdown
# Components Architecture

## Patterns
- All components are functional with hooks
- Use MUI v5 components (@mui/material)
- Styled components use @emotion/styled
- Props validated with PropTypes (TypeScript migration in progress)

## File Structure
- Layout components in `/layout`
- Reusable UI elements in `/general`
- Feature-specific components in feature folders
```

### 3. **Add JSDoc/Docstring Templates**

Create template files that Copilot can reference:

**Backend** (`backend/TEMPLATES.md`):
```markdown
# Python Code Templates

## ViewSet Template
```python
class ExampleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Example resources.
    
    Permissions: IsAuthenticated
    Filtering: name, created_at
    """
    serializer_class = ExampleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['name', 'created_at']
    
    def get_queryset(self):
        return Example.objects.select_related('user')
```
```

**Frontend** (`frontend/TEMPLATES.md`):
```markdown
# React Component Templates

## Page Component Template
```javascript
export default function ExamplePage({ initialData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Component logic
  
  return (
    <Container>
      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {/* Content */}
    </Container>
  );
}

export async function getServerSideProps(context) {
  // Server-side data fetching
}
```
```

### 4. **IDE-Specific Configuration**

#### VS Code Settings (`.vscode/settings.json`)
```json
{
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "plaintext": false,
    "markdown": true
  },
  "github.copilot.editor.enableAutoCompletions": true,
  "github.copilot.advanced": {
    "length": 500,
    "temperature": 0.2,
    "top_p": 0.95
  },
  "editor.inlineSuggest.enabled": true,
  "editor.quickSuggestions": {
    "other": true,
    "comments": true,
    "strings": true
  }
}
```

#### PyCharm/JetBrains Settings
- Enable Copilot in all Python and JavaScript files
- Set context window to maximum
- Enable suggestions in comments for documentation

### 5. **Create Context-Rich README Files in Key Directories**

Add README files in important directories:

**Backend Apps** (`backend/climateconnect_api/README.md`):
```markdown
# climateconnect_api

Core user management, authentication, and system-wide features.

## Key Models
- UserProfile: Extended user data with skills and location
- Skill: Hierarchical skill taxonomy
- Badge/UserBadge: Gamification system
- Notification: Multi-channel notification system

## API Endpoints
- `/api/profiles/` - User profile management
- `/api/skills/` - Skill listings
- `/api/notifications/` - User notifications

## Common Tasks
- User registration: Uses Knox token auth
- Profile updates: Include location and skills
- Notifications: Support 18+ notification types
```

**Frontend Components** (`frontend/src/components/README.md`):
```markdown
# Components Directory

## Structure
- `/general` - Reusable UI components
- `/layout` - Page layouts and navigation
- `/project` - Project-specific components
- `/organization` - Organization-specific components
- `/hub` - Hub/community components

## Patterns
- All components use MUI v5
- Styling with @emotion/styled or sx prop
- Responsive design with theme.breakpoints
- Loading states for async operations
```

### 6. **Leverage .editorconfig for Consistency**

Create `.editorconfig` at root:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.py]
indent_style = space
indent_size = 4
max_line_length = 88

[*.{js,jsx,ts,tsx,json}]
indent_style = space
indent_size = 2
max_line_length = 100

[*.md]
trim_trailing_whitespace = false
```

### 7. **Add Type Hints and PropTypes**

Improve type information for better Copilot suggestions:

**Backend - Use Python Type Hints**:
```python
from typing import List, Optional, Dict, Any
from django.contrib.auth.models import User

def get_user_projects(user: User, active_only: bool = True) -> List[Dict[str, Any]]:
    """
    Get all projects for a user.
    
    Args:
        user: The user to get projects for
        active_only: Whether to filter for active projects only
    
    Returns:
        List of project dictionaries with basic info
    """
    # Implementation
```

**Frontend - Enhance PropTypes/TypeScript**:
```javascript
import PropTypes from 'prop-types';

ExampleComponent.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
  }).isRequired,
  projects: PropTypes.arrayOf(PropTypes.object),
  onUpdate: PropTypes.func,
};
```

### 8. **Create a Glossary for Domain Terms**

Add `GLOSSARY.md` at root:
```markdown
# Climate Connect Glossary

## Domain Terms
- **Hub**: Geographic or sector-based community with custom branding
- **Project**: Climate action initiative with members, skills, and status tracking
- **Organization**: Registered climate organization with membership management
- **Idea**: Early-stage climate action proposal before becoming a project
- **Badge**: Achievement recognition in gamification system
- **Availability**: Time commitment level for user participation

## Technical Terms
- **Knox**: Token-based authentication library for DRF
- **Celery**: Background task processing system
- **PostGIS**: PostgreSQL extension for geospatial data
- **SSR**: Server-Side Rendering in Next.js
- **MUI**: Material-UI v5 component library
```

### 9. **Maintain Updated Dependencies Documentation**

Create `DEPENDENCIES.md`:
```markdown
# Key Dependencies Reference

## Backend Critical Dependencies
- Django 3.2.x - Web framework
- djangorestframework - API framework
- django-rest-knox - Token authentication
- channels - WebSocket support
- celery - Background tasks
- psycopg2 - PostgreSQL driver
- django-storages - Azure Blob Storage integration

## Frontend Critical Dependencies
- next@14.x - React framework
- react@18.x - UI library
- @mui/material@5.x - Component library
- axios - HTTP client
- @react-google-maps/api - Maps integration

## Update Frequency
- Security patches: Apply immediately
- Minor versions: Review monthly
- Major versions: Plan carefully (breaking changes)
```

### 10. **Use Conventional Commits**

Add `.github/COMMIT_CONVENTION.md`:
```markdown
# Commit Message Convention

Use conventional commits to help Copilot understand change patterns:

## Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

## Examples
```
feat(api): add endpoint for project search

Implement full-text search across projects with filters for
location, skills, and status.

Closes #123
```

```
fix(frontend): resolve mobile navigation overflow

Update responsive breakpoints for hub navigation menu to prevent
horizontal scroll on mobile devices.
```
```

### 11. **Enable Copilot Labs Features**

If using VS Code:
1. Install "GitHub Copilot Labs" extension
2. Use "Explain Code" for understanding complex sections
3. Use "Language Translation" for code style conversions
4. Use "Test Generation" for automated test creation

### 12. **Create Snippet Libraries**

Add VS Code snippets (`.vscode/snippets.json`):
```json
{
  "Django ViewSet": {
    "prefix": "ccviewset",
    "body": [
      "class ${1:Name}ViewSet(viewsets.ModelViewSet):",
      "    \"\"\"",
      "    ${2:Description}",
      "    \"\"\"",
      "    serializer_class = ${1}Serializer",
      "    permission_classes = [IsAuthenticated]",
      "    ",
      "    def get_queryset(self):",
      "        return ${1}.objects.select_related('${3:relation}')"
    ]
  },
  "Next.js Page": {
    "prefix": "ccpage",
    "body": [
      "import { Container } from '@mui/material';",
      "",
      "export default function ${1:Name}Page({ ${2:props} }) {",
      "  return (",
      "    <Container>",
      "      ${3:/* Content */}",
      "    </Container>",
      "  );",
      "}",
      "",
      "export async function getServerSideProps(context) {",
      "  return { props: {} };",
      "}"
    ]
  }
}
```

### 13. **Regular Maintenance Tasks**

- **Weekly**: Review Copilot suggestions accuracy and add clarifications to instructions
- **Monthly**: Update code patterns based on new features
- **Quarterly**: Review and update tech stack versions in instructions
- **When onboarding**: Walk new developers through Copilot setup

### 14. **Team Collaboration on Copilot Usage**

Create `COPILOT_TIPS.md` for the team:
```markdown
# Team Tips for Using Copilot Effectively

## Writing Better Prompts
1. Be specific in comments: "Create a DRF viewset for Project with pagination"
2. Include context: "// This component displays hub members with filtering"
3. Reference existing patterns: "// Similar to UserProfileSerializer"

## Code Review with Copilot
- Review all Copilot suggestions for security issues
- Verify database query efficiency
- Check for proper error handling
- Ensure accessibility in frontend components

## When to Trust Copilot
✅ Boilerplate code (models, serializers)
✅ Common patterns (API endpoints, React components)
✅ Test scaffolding
✅ Documentation

## When to Be Cautious
⚠️ Security-sensitive code (auth, permissions)
⚠️ Complex business logic
⚠️ Database migrations
⚠️ Performance-critical sections
```

### 15. **Metrics and Feedback Loop**

Track Copilot effectiveness:
```markdown
# Copilot Effectiveness Tracking

## Monthly Review Questions
1. What percentage of suggestions are accepted?
2. Which file types get the best suggestions?
3. Are there common mistakes in suggestions?
4. What context is Copilot missing?

## Improvement Actions
- Update copilot-instructions.md based on common errors
- Add more examples for problematic areas
- Create templates for frequently generated code
- Document edge cases and special considerations
```

---

## Quick Start Checklist

- [x] Create `.github/copilot-instructions.md` ✅ (Done)
- [ ] Add README files in key directories
- [ ] Create GLOSSARY.md for domain terms
- [ ] Add code templates in TEMPLATES.md files
- [ ] Configure IDE-specific settings
- [ ] Add .editorconfig for consistency
- [ ] Create DEPENDENCIES.md reference
- [ ] Set up commit conventions
- [ ] Add code snippets for common patterns
- [ ] Train team on effective Copilot usage
- [ ] Set up regular review process

---

## Additional Resources

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Copilot Best Practices](https://github.blog/2023-06-20-how-to-write-better-prompts-for-github-copilot/)
- [Django Best Practices](https://docs.djangoproject.com/en/5.2/misc/design-philosophies/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Best Practices](https://react.dev/learn)

---

**Remember**: Copilot is a tool to enhance productivity, not replace thoughtful software engineering. Always review, test, and validate generated code.

