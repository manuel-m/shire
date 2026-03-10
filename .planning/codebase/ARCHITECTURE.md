# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Monorepo Microservices with Backend-for-Frontend (BFF)

**Key Characteristics:**
- Monorepo managed by pnpm workspaces
- Six domain services behind a BFF, communicating via synchronous REST over Docker network
- Single shared-types package defining Zod schemas as the source of truth for types
- Each service owns its MongoDB collections with independent database instances
- Express.js HTTP servers with OpenAPI/Swagger documentation for each service
- JWT-based authentication validated at BFF layer with bearer token forwarding
- Prometheus metrics endpoint on every service via prom-client
- Structured JSON logging with request ID tracing across services

## Layers

**Backend Services Layer:**
- Purpose: Domain-specific business logic and data persistence
- Location: `services/`
- Contains: Express apps, MongoDB collections, route handlers, OpenAPI registration
- Depends on: `@shire/shared` (middleware, logging, metrics), `@shire/shared-types` (schemas)
- Used by: BFF Service (via HTTP), Web App (via BFF proxy)

**BFF Layer (Backend-for-Frontend):**
- Purpose: Single entry point for the web application, request routing, enrichment/aggregation
- Location: `services/bff-service/src/`
- Contains: Route handlers that proxy to backend services, dashboard aggregation
- Depends on: `@shire/shared`, all backend services via HTTP
- Used by: Web App (primary API consumer)

**Shared Types Layer:**
- Purpose: Single source of truth for all data schemas and TypeScript types
- Location: `packages/shared-types/src/`
- Contains: Zod schemas, inferred TypeScript types, OpenAPI registry helpers
- Depends on: Zod, @asteasolutions/zod-to-openapi
- Used by: All services, BFF, Web App

**Shared Utilities Layer:**
- Purpose: Common backend infrastructure code
- Location: `packages/shared/src/`
- Contains: Express middleware (request ID, auth), logging, metrics, health routes, Swagger mounting
- Depends on: `@shire/shared-types`, express, jsonwebtoken, prom-client, swagger-ui-express
- Used by: All backend services and BFF

**API Client Package:**
- Purpose: Type-safe HTTP client with auth token management
- Location: `packages/api-client/src/`
- Contains: Fetcher with automatic token access, generated API client stubs
- Depends on: `@shire/shared-types`
- Used by: Web App

**Web Application Layer:**
- Purpose: React SPA user interface
- Location: `apps/web-app/src/`
- Contains: React components, TanStack Query setup, React Router, MUI UI library
- Depends on: `@shire/shared-types`, `@shire/api-client`, React ecosystem, MUI
- Used by: End users (consultants)

## Data Flow

**Authentication Flow:**

1. User submits credentials to `/api/auth/login` via BFF proxy
2. BFF proxies to Auth Service (`http://auth-service:3001/auth/login`)
3. Auth Service validates credentials, issues JWT (15 min expiry) and refresh token (7 day expiry)
4. Access token stored in memory by Web App, refresh token in localStorage
5. All subsequent requests include `Authorization: Bearer <token>` header
6. BFF validates JWT using same secret, attaches user payload to `req.user`
7. On token expiry, Web App calls `/api/auth/refresh` to get new access token

**API Request Flow (General CRUD):**

1. Web App makes request to BFF (e.g., `/api/clients`)
2. BFF validates JWT, extracts user context
3. BFF proxies to appropriate backend service with forwarded headers (Authorization, X-Request-Id)
4. Backend service validates request against Zod schema, queries MongoDB, returns response
5. Response flows back through BFF to Web App

**Aggregation Flow (Dashboard):**

1. Web App requests `/api/dashboard`
2. BFF validates auth, then makes parallel `Promise.allSettled` calls to all backend services
3. Each service returns count totals
4. BFF aggregates and returns unified dashboard object

**Client Detail Enrichment Flow:**

1. Web App requests `/api/clients/:id`
2. BFF proxies to Client Service for client data
3. BFF makes additional request to Engagement Service for engagement count
4. BFF merges `engagementCount` into client response

**Report Generation Flow:**

1. Report is created with structured sections (problems, recommendations, action plan)
2. GET `/reports/:id/generate/markdown` calls Handlebars template rendering
3. Markdown can be converted to HTML then PDF (Puppeteer - not yet implemented)

**State Management:**
- Server-side: MongoDB per service (each service has its own database)
- Client-side: TanStack Query v5 configured but not yet used; currently `useState` + `useEffect` with direct `fetch()`

## Key Abstractions

**Zod Schema as Type Source:**
- Purpose: Define data contracts once, derive types everywhere
- Examples: `packages/shared-types/src/schemas/*.ts`
- Pattern: Zod schema with `.openapi()` decorator → `z.infer<>` for TypeScript type

**Service Router Pattern:**
- Purpose: Express Router with per-route authentication and validation
- Examples: `services/*/src/routes/*.ts`
- Pattern:
  ```typescript
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req, res) => {
    const parsed = Schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: ... });
    // Business logic
    res.json({ data, total, page, limit });
  });
  ```

**OpenAPI Registry Pattern:**
- Purpose: Auto-generate OpenAPI spec from Zod schemas
- Examples: `packages/shared-types/src/openapi/registry.ts`
- Pattern: Each route file imports `*.openapi.ts` as side effect to register paths

**BFF Proxy Pattern:**
- Purpose: Forward requests to backend services with auth forwarding
- Examples: `services/bff-service/src/lib/service-client.ts`
- Pattern: `proxyRequest(serviceBaseUrl, path, req, res)` forwards all method, body, headers

**Pagination Pattern:**
- Purpose: Consistent API pagination across all list endpoints
- Examples: `packages/shared-types/src/schemas/common.ts` (PaginationQuerySchema)
- Pattern: Query params `?page=1&limit=20`, response `{ data, total, page, limit }`

**Status Transition Validation:**
- Purpose: Enforce valid state machine transitions
- Examples: `services/engagement-service/src/routes/engagements.ts` (VALID_STATUS_TRANSITIONS)
- Pattern: Record mapping current status to allowed next statuses

## Entry Points

**Backend Service Entry Points:**
- Location: `services/*/src/index.ts`
- Triggers: `pnpm dev` (tsx watch) or `node dist/index.js` (production)
- Responsibilities:
  - Connect to MongoDB via `connectDb()`
  - Create Express app via `createApp()`
  - Listen on configured port
  - Exit on error with logging

**Service App Factories:**
- Location: `services/*/src/app.ts`
- Triggers: Called by `index.ts` on startup
- Responsibilities:
  - Create Express app instance
  - Set up middleware (JSON parser, request ID, metrics)
  - Mount routers (health, metrics, domain routes)
  - Mount Swagger UI at `/swagger` and OpenAPI spec at `/openapi.json`

**BFF Service Entry Point:**
- Location: `services/bff-service/src/index.ts`
- Triggers: `pnpm dev` or production startup
- Responsibilities: Create app, listen on port 3007 (no DB connection)

**Web App Entry Point:**
- Location: `apps/web-app/src/main.tsx`
- Triggers: Vite dev server or production build load
- Responsibilities: Render App component (with providers) into DOM

**Web App Component Entry:**
- Location: `apps/web-app/src/App.tsx`
- Triggers: Main render
- Responsibilities: Wrap AppRouter in AppProviders (BrowserRouter, ThemeProvider, QueryClientProvider, AuthProvider)

**Web App Router:**
- Location: `apps/web-app/src/app/router.tsx`
- Triggers: Navigation via React Router
- Responsibilities: Define route structure, wrap protected routes with AppLayout

## Error Handling

**Strategy:** Standardized error response format with error codes

**Patterns:**
- Validation errors: `{ error: { code: "VALIDATION_ERROR", message: "..." } }` (HTTP 400)
- Unauthorized: `{ error: { code: "UNAUTHORIZED", message: "..." } }` (HTTP 401)
- Not found: `{ error: { code: "NOT_FOUND", message: "..." } }` (HTTP 404)
- Conflict: `{ error: { code: "DUPLICATE_NAME", message: "..." } }` (HTTP 409)
- Status transition error: `{ error: { code: "INVALID_STATUS_TRANSITION", message: "..." } }` (HTTP 422)
- Backend unavailable: `{ error: { code: "BAD_GATEWAY", message: "Backend service unavailable" } }` (HTTP 502)

## Cross-Cutting Concerns

**Logging:**
- Structured JSON to stdout: `{ timestamp, service, level, message, requestId, ...metadata }`
- Via `createLogger()` from `@shire/shared`
- Request ID attached via middleware and logged on all operations

**Validation:**
- Zod schemas from `@shire/shared-types` are the single source of truth
- `safeParse()` pattern with early return on validation failure
- Same schemas used for request body, query params, and TypeScript types

**Authentication:**
- JWT bearer tokens with 15-minute access token expiry
- Refresh token rotation on refresh
- Auth middleware at service level validates JWT and attaches `req.user`
- BFF shares JWT secret with Auth Service for validation

**Metrics:**
- Prometheus format via prom-client
- Every service exposes `/metrics` endpoint
- Histogram for request duration, counter for request totals
- Default Node.js metrics collected automatically

**Observability:**
- Request ID tracing via `X-Request-Id` header (or generated if absent)
- All services forward request ID to downstream calls
- Logs include request ID for correlation

---

*Architecture analysis: 2026-03-10*
