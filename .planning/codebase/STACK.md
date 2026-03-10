# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- TypeScript 5.7.0 - All backend services, shared packages, and frontend application

**Secondary:**
- JavaScript (ES2022) - Runtime target for compiled TypeScript, Docker scripts, configuration

## Runtime

**Environment:**
- Node.js >= 20 (required per `package.json` engines)
- Node.js 22 Alpine (Docker base image)

**Package Manager:**
- pnpm (workspace-based monorepo)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Express 5.1.0 - HTTP server framework for all microservices
- React 19.0.0 - Frontend SPA (`apps/web-app/`)
- React Router 7.1.0 - Client-side routing

**Testing:**
- Vitest 3.1.0 - Test runner for all services
- MongoDB Memory Server 10.4.0 - In-memory MongoDB for integration tests
- Supertest 7.1.0 - HTTP endpoint testing

**Build/Dev:**
- TypeScript 5.7.0 - Type checking and compilation
- Vite 6.0.0 - Frontend bundler and dev server
- tsx 4.19.0 - TypeScript execution for development hot-reload
- esbuild (via Vite) - Fast bundling

## Key Dependencies

**Critical:**
- Zod 3.24.0 - Schema validation and runtime type checking (single source of truth for types)
- @asteasolutions/zod-to-openapi 7.3.4 - OpenAPI specification generation from Zod schemas
- prom-client 15.1.0 - Prometheus metrics collection
- jsonwebtoken 9.0.0 - JWT token generation and validation
- bcrypt 6.0.0 - Password hashing (auth service)

**Infrastructure:**
- mongodb 6.12.0 - MongoDB driver (per-service databases)
- docker-compose - Multi-service orchestration
- nginx:alpine - Frontend static asset serving

**Frontend:**
- @mui/material 6.4.0 - Material-UI component library
- @mui/x-data-grid 7.25.0 - Data table component
- @emotion/react 11.14.0 - CSS-in-JS styling
- @emotion/styled 11.14.0 - Styled components
- @tanstack/react-query 5.62.0 - Data fetching (configured but not actively used yet)
- react-hook-form 7.54.0 - Form handling
- @hookform/resolvers 3.9.0 - Zod integration for forms
- Handlebars 4.7.8 - Report template rendering

**API Generation:**
- orval 7.3.0 - OpenAPI-to-TS client generator
- openapi3-ts 4.5.0 - OpenAPI type definitions

**Code Quality:**
- eslint 10.0.3 - Linting
- typescript-eslint 8.56.1 - TypeScript-specific ESLint rules
- eslint-plugin-sonarjs 4.0.1 - Code quality rules
- eslint-config-prettier 10.1.8 - Prettier/ESLint integration
- prettier 3.8.1 - Code formatting
- jscpd 4.0.8 - Code duplication detection
- depcheck 1.4.7 - Dependency checker
- husky 9.1.7 - Git hooks

## Configuration

**Environment:**
- Environment variables via `.env.example` template
- Per-service config modules (`services/*/src/config.ts`)
- Key configs required: `MONGODB_URI`, `JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`

**Build:**
- `tsconfig.base.json` - Shared TypeScript configuration
- `eslint.config.mjs` - ESLint flat config with SonarJS rules
- `.prettierrc` - Prettier formatting rules
- `.jscpd.json` - Duplication detection thresholds
- `.lintstagedrc.json` - Pre-commit lint rules

**Workspace:**
- `pnpm-workspace.yaml` - Monorepo workspace definition
- `services/*`, `packages/*`, `apps/*` workspace packages

## Platform Requirements

**Development:**
- Node.js >= 20
- pnpm (enabled via `corepack`)
- Docker and Docker Compose

**Production:**
- Docker Compose or container orchestration
- MongoDB 7 (shared per service databases on one instance)
- Prometheus-compatible metrics scraper
- Grafana-compatible dashboard viewer
- Loki-compatible log aggregator

---

*Stack analysis: 2026-03-10*
