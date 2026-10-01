# Frontend AI Agent Instructions for Climate Connect

> **Mission**: Build beautiful, responsive React components that enable climate activists to collaborate effectively.

## Frontend Tech Stack
- **Framework**: Next.js 14 (React 18)
- **Language**: JavaScript (partial TypeScript migration in progress)
- **UI Library**: Material-UI v5 (@mui/material)
- **Styling**: Emotion (@emotion/react, @emotion/styled)
- **State**: React hooks (no Redux/global state library)
- **HTTP Client**: Axios
- **Date Handling**: date-fns, dayjs
- **Package Manager**: Yarn 4 (also supports Bun - bun.lock present)
- **Testing**: Jest
- **Rendering**: SSR (Server-Side Rendering)

## Architecture Patterns

### Frontend Structure
- **Pages**: `/frontend/pages/` - Next.js pages (file-based routing)
- **Components**: `/frontend/src/components/` - Reusable React components
- **Utils**: `/frontend/src/utils/` - Helper functions and utilities
- **Themes**: `/frontend/src/themes/` - MUI theme configuration
- **SSR Pattern**: Pages use `getServerSideProps` or `getInitialProps` for data fetching

### Component Architecture
- **Functional Components**: Use functional components with hooks (no class components)
- **Type Validation**: PropTypes for type validation (TypeScript migration in progress)
- **Custom Hooks**: Extract reusable logic into custom hooks
- **State Management**: Use React hooks (useState, useEffect, useContext, etc.)

## Code Style & Best Practices

### Formatting & Linting
- **Formatting**: Use `yarn format` (Prettier)
- **Linting**: Use `yarn lint` (ESLint) - must pass before commit

### Component Pattern
- Functional components with hooks (no class components)
- PropTypes for type validation (TypeScript migration in progress)
- Extract reusable logic into custom hooks

### Material-UI v5
- Use `@mui/material` imports
- Style with `styled()` from `@mui/material/styles` or the `sx` prop. Do not use `makeStyles`/`withStyles` from `@mui/styles` (deprecated, being removed — see `doc/spec/MIGRATION_MUI_STYLE_PLAN.md`)
- Use theme breakpoints for responsive design
- Access theme with `useTheme()` hook

### Data Fetching
- Use `getServerSideProps` for SSR
- Use Axios for API calls
- Handle loading and error states
- Use universal cookies for auth token management

### State Management
- Use React hooks (useState, useEffect, useContext, etc.)
- Pass props for component communication
- Use Context API for deeply nested state (sparingly)

### Routing
- Use Next.js file-based routing in `/pages/`

## Common Commands

### Development
- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn lint` - Run ESLint
- `yarn format` - Run Prettier
- `yarn test` - Run Jest tests

## Important Considerations

### Performance & SEO
- Optimize for SEO (Next.js SSR)
- Handle loading states and errors gracefully
- Optimize images (use Next.js Image component when possible)
- Keep bundle size in mind (use dynamic imports for large components)
- Test responsive design (mobile, tablet, desktop)

### Accessibility
- Make components accessible (a11y)
- Use semantic HTML
- Add proper accessibility attributes (aria-labels, alt text, etc.)

### Authentication
- Handle authentication state (check for token)
- Display user-friendly error messages
- Use universal cookies for token management

### Testing
- Write tests for new features using Jest
- Mock API calls with Jest
- Test component rendering and user interactions
- Always test error cases and edge conditions

### Documentation Maintenance
- Update `doc/mosy/flows/` when implementing new user flows or modifying existing ones
- Update `doc/api-documentation.md` when consuming new endpoints or changing API integration
- Add frontend implementation notes to relevant `doc/spec/` files (optional)
- Update `doc/architecture.md` for significant frontend architecture changes
- Update `doc/environment-variables.md` when adding new frontend environment variables
- Review and update this frontend agent.md file as the frontend tech stack evolves
- **Note**: `/doc/spec/` contains optional specifications for reference - use as helpful context but not required. **Workflow**: GitHub Issues lead the work, specs provide fine-grained details when available.

## Common Code Patterns

### Page with SSR Example
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

### MUI Styled Component Example
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

### Component with API Call Example
```javascript
import { useState, useEffect } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';

const DataComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/data/');
        setData(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      {/* Render data */}
    </Box>
  );
};
```

## Quick Reference for Common Tasks

### Adding a New Frontend Page
1. Create file in `/frontend/pages/`
2. Implement component with proper SSR (getServerSideProps if needed)
3. Add API calls with error handling
4. Style with MUI components
5. Test responsive design
6. Check authentication requirements

### Creating a Reusable Component
1. Create component in `/frontend/src/components/`
2. Use functional component pattern with hooks
3. Add PropTypes for type validation
4. Style with MUI components and Emotion
5. Make responsive with theme breakpoints
6. Add accessibility attributes
7. Write tests for the component

### Adding API Integration
1. Use Axios for HTTP requests
2. Handle loading and error states
3. Use try/catch blocks for error handling
4. Display user-friendly error messages
5. Handle authentication tokens properly

## File Naming Conventions
- **Components**: `PascalCase.js` or `PascalCase.tsx`
- **Utils**: `camelCase.js`
- **Pages**: Next.js convention (lowercase with hyphens or dynamic `[param].js`)

## Environment Variables (.env / .env.local)
- `API_URL` - Backend API URL (http://localhost:8000 for dev)
- `NEXT_PUBLIC_API_URL` - Public API URL for client-side
- `SENTRY_DSN` - Sentry error tracking DSN

## Key Dependencies to Remember
- Next.js 14, React 18, MUI v5, Axios, Emotion, date-fns

## Performance Optimization Tips
- Use dynamic imports for large components: `const Component = dynamic(() => import('./Component'))`
- Optimize images with proper sizing and lazy loading
- Minimize API calls by combining related data in endpoints
- Use React.memo for expensive components
- Implement proper caching strategies

## Resources
- **Main Site**: https://climateconnect.earth
- **Repo**: https://github.com/climateconnect/climateconnect
- **Issue Tracker**: Use GitHub Issues
- **Detailed Documentation**: See `/doc/` folder for comprehensive architecture, user flows, and API documentation
  - `doc/architecture.md` - Complete system and frontend architecture
  - `doc/mosy/flows/` - User flow documentation for frontend features
  - `doc/api-documentation.md` - API reference for frontend integration
  - `doc/spec/` - Feature specifications that inform frontend implementation
  - `doc/environment-variables.md` - Complete environment variable reference

**Remember**: This frontend serves climate activists working on real climate solutions. Build intuitive, accessible, and performant user interfaces that help people connect and collaborate effectively on climate action.
