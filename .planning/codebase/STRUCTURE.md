# Codebase Structure

**Analysis Date:** 2026-03-10

## Directory Layout

```
shire/
├── packages/
│   ├── shared/               # @shire/shared — shared backend utilities
│   ├── shared-types/         # @shire/shared-types — Zod schemas + TS types
│   └── api-client/           # @shire/api-client — generated API client
├── services/
│   ├── auth-service/         # JWT auth, user management (port 3001)
│   ├── client-service/       # Clients, contacts, credentials (port 3002)
│   ├── engagement-service/   # Consulting engagements (port 3003)
│   ├── report-service/       # Report CRUD, versioning (port 3004)
│   ├── billing-service/      # Invoices, payments (port 3005)
│   └── bff-service/          # BFF for web app (port 3007)
├── apps/
│   └── web-app/             # React 19 SPA (Vite dev server port 5173)
├── infrastructure/          # Docker Compose, observability configs
├── doc/                     # PRD, architecture, feature specs
├── scripts/                 # Verify, admin, utility scripts
└── backups/                 # Database backups
```

## Directory Purposes

**`packages/shared/`:**
- Purpose: Shared backend infrastructure code used by all services
- Contains: Express middleware (request ID, auth), logging, metrics, health routes, Swagger mounting
- Key files: `src/index.ts`, `src/middleware/auth.ts`, `src/logger.ts`, `src/metrics.ts`

**`packages/shared-types/`:**
- Purpose: Single source of truth for all data schemas and TypeScript types
- Contains: Zod schemas for all domain entities, OpenAPI registry helpers, validation utilities
- Key files: `src/index.ts`, `src/schemas/*.ts` (client, engagement, report, billing, user, contact), `src/openapi/registry.ts`

**`packages/api-client/`:**
- Purpose: Type-safe HTTP client with automatic auth token management
- Contains: Fetcher with token accessors, generated API client stubs
- Key files: `src/index.ts`, `src/fetcher.ts`

**`services/auth-service/`:**
- Purpose: User authentication and management via JWT tokens
- Contains: Express app, MongoDB collections (users, refresh_tokens), auth routes
- Key files: `src/index.ts`, `src/app.ts`, `src/routes/auth.ts`, `src/db.ts`

**`services/client-service/`:**
- Purpose: Client, contact, and encrypted code credential management
- Contains: Express app, MongoDB collections (clients, contacts, credential_access_logs), client routes
- Key files: `src/index.ts`, `src/app.ts`, `src/routes/clients.ts`, `src/routes/contacts.ts`, `src/routes/credentials.ts`, `src/crypto.ts`

**`services/engagement-service/`:**
- Purpose: Consulting engagement lifecycle management
- Contains: Express app, MongoDB collections (engagements), engagement routes
- Key files: `src/index.ts`, `src/app.ts`, `src/routes/engagements.ts`, `src/client-check.ts`, `src/report-invoice-check.ts`

**`services/report-service/`:**
- Purpose: Report CRUD, versioning, and markdown generation
- Contains: Express app, MongoDB collections (reports, report_versions), report routes, Handlebars template
- Key files: `src/index.ts`, `src/app.ts`, `src/routes/reports.ts`, `src/markdown.ts`, `src/engagement-check.ts`

**`services/billing-service/`:**
- Purpose: Invoice creation, status management, payment tracking
- Contains: Express app, MongoDB collections (invoices), invoice routes, invoice number generation
- Key files: `src/index.ts`, `src/app.ts`, `src/routes/invoices.ts`, `src/invoice-number.ts`, `src/entity-check.ts`

**`services/bff-service/`:**
- Purpose: Single entry point for web application, request proxying, aggregation
- Contains: Express app (no DB), routes that proxy to backend services, dashboard aggregation
- Key files: `src/index.ts`, `src/app.ts`, `src/routes/*.ts`, `src/lib/service-client.ts`, `src/config.ts`

**`apps/web-app/`:**
- Purpose: React 19 SPA for consultants to manage clients, engagements, reports, billing
- Contains: React components, TanStack Query setup, React Router v7, MUI v6
- Key files: `src/main.tsx`, `src/App.tsx`, `src/app/router.tsx`, `src/providers/AppProviders.tsx`

**`infrastructure/`:**
- Purpose: Docker Compose configuration and observability stack
- Contains: Docker Compose files, Prometheus configs, Grafana dashboards, Loki configs, Alloy collector
- Key files: `docker-compose.yml`, `docker-compose.dev.yml`, `prometheus/prometheus.yml`, `grafana/dashboards/`

**`doc/`:**
- Purpose: Product requirements, architecture docs, feature specifications
- Contains: PRD, architecture diagrams, feature specifications
- Key files: Various markdown documentation files

**`scripts/`:**
- Purpose: Utility and verification scripts
- Contains: Admin scripts, verification scripts, dependency checking, security scanning
- Key files: `scripts/admin/*`, `scripts/verify/*`, `scripts/depcheck.sh`, `scripts/semgrep.sh`

## Key File Locations

**Entry Points:**
- `packages/shared-types/src/index.ts`: Exports all Zod schemas and inferred types
- `packages/shared/src/index.ts`: Exports shared backend utilities
- `packages/api-client/src/index.ts`: Exports fetcher and generated client
- `services/*/src/index.ts`: Service startup and server listen
- `services/*/src/app.ts`: Express app factory and route mounting
- `apps/web-app/src/main.tsx`: React app mount point

**Configuration:**
- `services/*/src/config.ts`: Service-specific config (ports, URLs, secrets)
- `services/*/package.json`: Service dependencies and build scripts
- `packages/*/package.json`: Package exports and dependencies
- `apps/web-app/vite.config.ts`: Vite configuration (proxy /api → localhost:3007)
- `infrastructure/docker-compose.yml`: Service orchestration

**Core Logic:**
- `services/*/src/routes/*.ts`: Route handlers and business logic
- `services/*/src/db.ts`: MongoDB connection and collection accessors
- `packages/shared-types/src/schemas/*.ts`: Domain entity schemas
- `apps/web-app/src/features/*/`: Feature modules (pages, components, API hooks)

**Testing:**
- `services/*/src/routes/*.integration.test.ts`: Supertest integration tests with MongoDB Memory Server
- `services/*/package.json`: `test:unit` and `test:integration` scripts

## Naming Conventions

**Files:**
- `.ts` for TypeScript source files (all backend code)
- `.tsx` for React components (web app)
- `routes/*.ts` for Express route handlers
- `.integration.test.ts` for integration tests
- `.openapi.ts` for OpenAPI registration (side-effect imports)

**Directories:**
- `src/` for source code
- `dist/` for compiled output (TypeScript)
- `features/<domain>/` for web app feature modules
- `components/` for shared React components
- `middleware/` for Express middleware
- `routes/` for API routes

**MongoDB Collections:**
- Plural snake_case: `users`, `refresh_tokens`, `clients`, `contacts`, `credential_access_logs`, `engagements`, `reports`, `report_versions`, `invoices`

**Services:**
- Lowercase kebab-case: `auth-service`, `client-service`, `engagement-service`, `report-service`, `billing-service`, `bff-service`

**Packages:**
- Scoped with `@shire/`: `@shire/shared`, `@shire/shared-types`, `@shire/api-client`

## Where to Add New Code

**New Feature (Backend):**
- Primary code: `services/<service>/src/routes/<resource>.ts` (new route handler)
- OpenAPI registration: `services/<service>/src/routes/<resource>.openapi.ts` (new file)
- Schemas: `packages/shared-types/src/schemas/<domain>.ts` (new Zod schemas)
- Tests: `services/<service>/src/routes/<resource>.integration.test.ts`

**New Feature (Frontend):**
- Implementation: `apps/web-app/src/features/<domain>/` (new feature module)
- Pages: `apps/web-app/src/features/<domain>/pages/*.tsx`
- Components: `apps/web-app/src/features/<domain>/components/*.tsx`
- API hooks: `apps/web-app/src/features/<domain>/api/<resource>Queries.ts` or `<resource>Mutations.ts`
- Route: Add to `apps/web-app/src/app/router.tsx`

**New Component/Module:**
- Implementation: Add to existing feature's `components/` directory
- Shared components: `apps/web-app/src/components/` (if truly shared)

**Utilities:**
- Shared helpers: `packages/shared/src/<module>.ts`
- Frontend hooks: `apps/web-app/src/hooks/*.ts`
- Frontend helpers: `apps/web-app/src/lib/*.ts`

**New Service:**
- Directory: `services/<new-service>/`
- Required files: `src/index.ts`, `src/app.ts`, `src/db.ts`, `src/config.ts`, `src/routes/*.ts`, `package.json`
- Add to BFF config: `services/bff-service/src/config.ts` (add URL)
- Add BFF routes: `services/bff-service/src/routes/<resource>.ts`

**New Schemas:**
- Domain schemas: `packages/shared-types/src/schemas/<domain>.ts`
- Export from index: Add to `packages/shared-types/src/index.ts`

## Special Directories

**`node_modules/`:**
- Purpose: pnpm workspace symlinked dependencies
- Generated: Yes
- Committed: No

**`dist/`:**
- Purpose: TypeScript compiled output
- Generated: Yes
- Committed: No

**`.git/`:**
- Purpose: Git repository
- Generated: No
- Committed: N/A (git metadata)

**`infrastructure/backup/`:**
- Purpose: Database backups
- Generated: Yes (via backup scripts)
- Committed: Yes (for version control of backups)

**`infrastructure/seed/`:**
- Purpose: Database seed data
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents and codebase analysis
- Generated: No (manual)
- Committed: Yes

**`scripts/verify/`:**
- Purpose: Verification scripts for data integrity
- Generated: No
- Committed: Yes

**`scripts/admin/`:**
- Purpose: Administrative utility scripts
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-10*
