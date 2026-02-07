# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

NagarSeva is a multilingual civic reporting application that enables citizens to report municipal issues (potholes, garbage, street lights, waterlogging) with photo evidence and GPS location. It features a citizen-facing app for report submission and a government dashboard for issue tracking and management.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **UI Framework**: shadcn/ui components + Radix UI primitives
- **Styling**: Tailwind CSS with custom civic theme
- **Routing**: React Router DOM v6
- **State Management**: React Query (TanStack Query) for async state
- **Maps**: Leaflet + React Leaflet for location services
- **Internationalization**: Custom i18n system supporting English, Hindi, and Gujarati
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for government dashboard analytics
- **Animations**: Framer Motion
- **Testing**: ESLint for code quality

## Development Commands

```powershell
# Install dependencies (uses legacy peer deps for React 19 compatibility)
npm install

# Start development server (runs on localhost:5173)
npm run dev

# Build for production
npm run build

# Build for development environment
npm run build:dev

# Run linting
npm run lint

# Preview production build
npm run preview

# Deploy to Netlify (production)
npm run deploy:netlify

# Deploy preview to Netlify
npm run deploy:preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Header.tsx      # Main navigation
│   ├── Hero.tsx        # Landing page hero
│   ├── Map.tsx         # Leaflet map component
│   ├── PhotoCapture.tsx # Camera/file upload
│   ├── ReportSubmission.tsx # Issue reporting form
│   └── ProtectedRoute.tsx # Auth wrapper
├── pages/              # Route components
│   ├── Landing.tsx     # Public landing page
│   ├── SignIn.tsx      # Authentication
│   ├── MainApp.tsx     # Authenticated citizen dashboard
│   ├── MyReports.tsx   # User's report history
│   ├── GovSignIn.tsx   # Government authentication
│   └── GovernmentDashboard.tsx # Admin analytics
├── lib/                # Utilities and services
│   ├── i18n.tsx        # Internationalization system
│   ├── reportStorage.ts # Mock report management
│   └── utils.ts        # Utility functions
├── hooks/              # Custom React hooks
└── App.tsx            # Root component with routing
```

## Key Architecture Patterns

### Authentication System
- Uses localStorage for demo authentication (`nagarSevaAuth`, `nagarSevaUser`)
- `ProtectedRoute` component wraps authenticated routes
- Separate auth flows for citizens and government users

### Internationalization (i18n)
- Custom context-based i18n system in `src/lib/i18n.tsx`
- Supports 3 locales: English (en), Hindi (hi), Gujarati (gu)
- Translation keys follow dot notation (e.g., `features.smart_photo`)
- Locale preference stored in localStorage (`nagarSevaLocale`)

### Report Management
- `reportStorage.ts` provides mock API interface for civic reports
- Reports include photo uploads, GPS coordinates, severity levels, and status tracking
- Government dashboard aggregates reports with analytics and mapping

### Routing Structure
```typescript
/                    → Landing page (public)
/signin             → Citizen authentication
/app                → Main citizen dashboard (protected)
/my-reports         → User's report history (protected)
/gov-signin         → Government authentication
/gov                → Government dashboard (public for demo)
```

### Component Architecture
- Uses shadcn/ui for consistent design system
- Custom civic theme with CSS variables in Tailwind config
- Motion components for animations
- Form components use React Hook Form + Zod validation

## Development Workflow

### Adding New Issue Types
1. Update subcategory mappings in `GovernmentDashboard.tsx` (`ISSUE_SUBCATEGORIES`)
2. Add translations to all locales in `i18n.tsx`
3. Update report storage interface in `reportStorage.ts`

### Adding New Languages
1. Add locale to `SupportedLocale` type in `i18n.tsx`
2. Add translation object to `translations` constant
3. Update `supportedLocales` array for UI dropdown

### Styling Guidelines
- Use Tailwind utility classes with semantic color tokens (`civic-blue`, `civic-green`, etc.)
- Custom animations defined in `tailwind.config.ts`
- Follow existing component patterns from shadcn/ui

## Environment Configuration

### Development
- Uses Vite dev server on port 5173
- Hot reload enabled
- Source maps generated

### Production (Netlify)
- Node.js 20 required
- Uses `--legacy-peer-deps` flag for React 19 compatibility
- SPA routing handled by `_redirects` file in public/
- CSS/JS minification and bundling enabled

### Build Outputs
- Production builds to `dist/` directory
- Source maps included
- Assets optimized for CDN delivery

## Windows-Specific Development

### PowerShell Scripts
- `deploy.ps1` - Automated Netlify deployment script
- `fix-deps.ps1` - Dependency conflict resolution

### File Paths
- Project uses Windows-style paths (`C:\Users\...`)
- Vite handles path resolution cross-platform
- Use forward slashes in import statements

## Testing & Quality

### ESLint Configuration
- TypeScript-specific rules enabled
- React hooks linting enforced
- Unused variables warnings disabled for development ease

### Browser Compatibility
- Modern browser features required (geolocation, camera access)
- Progressive enhancement for camera fallback to file upload
- Responsive design with mobile-first approach

## Common Tasks

### Adding New Components
```typescript
// Follow existing patterns from src/components/ui/
// Use shadcn/ui CLI for new primitives: npx shadcn@latest add [component]
```

### Modifying Map Behavior
- Leaflet configuration in `Map.tsx` and `GovernmentDashboard.tsx`
- Uses OpenStreetMap tiles by default
- Marker clustering and heat maps available

### Updating Government Dashboard
- Analytics data computed from report arrays
- Charts use Recharts library
- Real-time updates via polling pattern

This codebase emphasizes rapid civic engagement through an intuitive mobile-first interface while providing comprehensive administrative tools for government oversight.
