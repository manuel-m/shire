# Architecture Research: Cross-Service Validation and Error Handling in Microservices

**Project:** Shire Tech Debt Cleanup
**Researched:** 2026-03-10
**Confidence:** HIGH (based on existing working patterns in codebase)

## Executive Summary

The Shire platform has established patterns for cross-service validation and OpenAPI registration that work correctly in some services. The existing working examples (engagement-service/client-check.ts, report-service/engagement-check.ts, auth-service/*.openapi.ts) demonstrate the correct architecture for:
1. Synchronous HTTP-based cross-service validation
2. Error-aware enrichment in BFF layer
3. OpenAPI schema registration for API client generation

The tech debt stems from incomplete implementation (stubs) and anti-patterns (void async) that deviate from these working patterns. The fixes require no architectural changes — only implementing missing validation logic and refactoring BFF handlers to proper async patterns.

## Component Boundaries

### Validation Layer

**Responsibility:** Validate cross-service dependencies before state-changing operations

| Component | Location | Validates | Communicates With | Pattern |
|-----------|----------|-----------|-------------------|---------|
| `client-service/src/engagement-check.ts` | Domain service | Active engagements before client DELETE | engagement-service | HTTP fetch |
| `engagement-service/src/client-check.ts` | Domain service | Client exists before engagement CREATE/UPDATE | client-service | HTTP fetch |
| `engagement-service/src/report-invoice-check.ts` | Domain service | Associated reports/invoices before engagement DELETE | report-service, billing-service | HTTP fetch (stubbed) |
| `report-service/src/engagement-check.ts` | Domain service | Engagement exists before report CREATE/UPDATE | engagement-service | HTTP fetch |

**Where validation lives:** In the owning service's `*-check.ts` file, called by route handlers on DELETE operations.

**Error handling:** Validation failures return HTTP 409 (Conflict) with structured error response. Network failures fail safe (return false), but this should be logged.

### BFF Enrichment Layer

**Responsibility:** Aggregate data from multiple services, handle enrichment errors gracefully

| Component | Location | Enriches | Error Strategy |
|-----------|----------|----------|----------------|
| `bff-service/src/routes/clients.ts` | BFF | Clients with engagement count | Currently silent (void async) |
| `bff-service/src/routes/engagements.ts` | BFF | Engagements with client name | Best-effort try-catch |
| `bff-service/src/routes/reports.ts` | BFF | Reports with client/engagement names | Best-effort try-catch |
| `bff-service/src/routes/invoices.ts` | BFF | Invoices with client/engagement names | Best-effort try-catch |
| `bff-service/src/routes/dashboard.ts` | BFF | Aggregated metrics | Silent failure (Promise.allSettled) |

**Where enrichment happens:** In BFF route handlers after fetching primary data.

**Error handling:**
- Current anti-pattern: `void (async () => { ... })()` silences all errors
- Correct pattern: Use top-level async handler with try-catch, or catch specific enrichment failures

### OpenAPI Registration Layer

**Responsibility:** Define API contracts for client generation

| Component | Location | Registers | Status |
|-----------|----------|-----------|--------|
| `bff-service/src/routes/health.openapi.ts` | BFF | Health endpoint | Working |
| `auth-service/src/routes/auth.openapi.ts` | Auth service | All auth endpoints | Working |
| `client-service/src/routes/*.openapi.ts` | Client service | All client endpoints | Working |
| Other BFF routes | BFF | All other endpoints | Missing |

**Where OpenAPI lives:** Adjacent to route files as `*.openapi.ts` side-effect imports.

**Registration flow:**
1. Schema defined in `packages/shared-types/src/schemas/*.ts` with `.openapi()` decorator
2. Path registered in `services/*-service/src/routes/*.openapi.ts` via `registry.registerPath()`
3. OpenAPI file imported as side-effect in `services/*-service/src/app.ts`
4. Registry mounted to `/openapi.json` via `mountSwagger()`
5. Spec dumped to file for Orval (BFF only)

## Data Flow

### DELETE Validation Flow (Correct Pattern)

```
Client Request (DELETE /clients/:id)
    |
    v
Client Service Route Handler
    |
    +---> engagementCheck.checkActiveEngagements(clientId)
    |        |
    |        v
    |   HTTP GET engagement-service:3003/engagements?clientId={id}
    |        |
    |        +---> Engagement Service Query MongoDB
    |        |
    |        +---> Return { total, data, ... }
    |        |
    |        v
    |   if total > 0: return true
    |   else: return false
    |
    v
if hasActive === true
    |
    +---> Return HTTP 409: { error: { code: "ACTIVE_ENGAGEMENTS", ... } }
else
    |
    +---> Proceed with delete
    |
    v
Return HTTP 200/204
```

**Key characteristics:**
- Synchronous HTTP call from owning service to downstream service
- Returns boolean: `true` = has dependencies, `false` = safe to delete
- Response time adds to DELETE latency (acceptable for admin operations)
- Network failures fail safe (return false), but should be logged

### BFF Enrichment Flow (Correct Pattern - Not Currently Used)

```
Client Request (GET /api/clients/:id)
    |
    v
BFF Route Handler (async)
    |
    +---> fetchJson client-service/clients/:id
    |        |
    |        v
    |   Return { status, data }
    |
    +---> if status !== 200: return error
    |
    +---> try {
    |        fetchJson engagement-service/engagements?clientId={id}&limit=1
    |     } catch (error) {
    |        log('warning', 'Enrichment failed', { error, requestId });
    |        enrichment = { engagementCount: 0 };
    |     }
    |
    v
Return enriched response { ...data, engagementCount }
```

**Key characteristics:**
- Top-level async handler (not void IIFE)
- Errors caught and logged
- Enrichment failures don't fail the request
- Response includes partial data when enrichment fails

### Current Broken BFF Flow (Anti-Pattern)

```
Client Request (GET /api/dashboard)
    |
    v
BFF Route Handler
    |
    +---> void (async () => {
    |        // All fetches happen here
    |        // Errors are swallowed silently
    |        res.json(...);
    |     })();
    |
    v
Handler returns immediately (no await)
|
    v
Response may never be sent if error occurs
```

**Key problems:**
- `void` prefix means errors are unhandled rejections
- Handler returns immediately, not waiting for async work
- Connection close can happen before response sent
- No error logging or client notification

### OpenAPI Registration Flow (Correct Pattern)

```
Service Startup
    |
    v
app.ts imports
    |
    +---> './routes/health.openapi.js' (side effect)
    +---> './routes/clients.openapi.js' (side effect)
    +---> ...
    |
    v
Each *.openapi.ts file executes:
    |
    v
registry.registerPath({ method, path, request, responses })
    |
    v
Registry accumulates definitions
    |
    v
mountSwagger(app, registry, info)
    |
    v
/app/openapi.json endpoint mounted
```

**For BFF API client generation:**
```
Run: pnpm --filter bff-service dump-openapi
    |
    v
dump-openapi.ts script executes
    |
    v
Import all *.openapi.ts side effects
    |
    v
generateOpenAPIDocument(registry, info)
    |
    v
Write openapi.json to disk
    |
    v
Orval reads openapi.json
    |
    v
Generate TypeScript client in packages/api-client/src/generated/
```

## Patterns to Follow

### Pattern 1: Cross-Service Validation via HTTP

**What:** Synchronous HTTP call to downstream service for dependency check

**When:** Before DELETE operations that could orphan data

**Example (working - engagement-service/src/client-check.ts):**
```typescript
import { config } from './config.js';

export async function validateClient(
  clientId: string,
  authToken: string,
): Promise<{ exists: boolean }> {
  try {
    const res = await fetch(`${config.clientServiceUrl}/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return { exists: res.ok };
  } catch {
    return { exists: false };
  }
}
```

**Route handler usage:**
```typescript
// DELETE /engagements/:id
engagementsRouter.post('/:id', async (req, res) => {
  const validation = await clientCheck.validateClient(req.body.clientId, req.authToken);
  if (!validation.exists) {
    return res.status(400).json({
      error: { code: 'CLIENT_NOT_FOUND', message: 'Client does not exist' }
    });
  }
  // Proceed with creation
});
```

**Usage in DELETE (fix needed for client-service):**
```typescript
// DELETE /clients/:id
clientsRouter.delete('/:id', async (req, res) => {
  const hasActive = await engagementCheck.checkActiveEngagements(req.params.id);
  if (hasActive) {
    return res.status(409).json({
      error: { code: 'ACTIVE_ENGAGEMENTS', message: 'Cannot delete client with active engagements' }
    });
  }
  // Proceed with delete
});
```

**Key points:**
- Use service URLs from config (Docker network addresses)
- Forward auth token for downstream validation
- Try-catch handles network failures (fail safe)
- Return structured object, not bare boolean (extensible)

### Pattern 2: BFF Enrichment with Error Handling

**What:** Top-level async handler with explicit error handling

**When:** BFF routes that need to aggregate/enrich data

**Example (corrected pattern for clients.ts):**
```typescript
clientsRouter.get('/:id', async (req: Request, res: Response) => {
  const clientId = req.params.id as string;
  const auth = req.headers.authorization;
  const { log } = createLogger(config.serviceName);

  try {
    const [clientRes, engagementsRes] = await Promise.all([
      fetchJson(config.clientServiceUrl, `/clients/${clientId}`, auth, req.requestId),
      fetchJson(
        config.engagementServiceUrl,
        `/engagements?clientId=${clientId}&limit=1`,
        auth,
        req.requestId,
      ),
    ]);

    if (clientRes.status !== 200) {
      res.status(clientRes.status).json(clientRes.data);
      return;
    }

    const enriched = {
      ...(clientRes.data as object),
      engagementCount: engagementsRes.status === 200 ? (engagementsRes.data.total ?? 0) : 0,
    };

    if (engagementsRes.status !== 200) {
      log('warning', 'Engagement count enrichment failed', {
        clientId,
        status: engagementsRes.status,
        requestId: req.requestId,
      });
    }

    res.json(enriched);
  } catch (error) {
    log('error', 'Client enrichment failed', {
      error: String(error),
      clientId,
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Failed to enrich client data' },
    });
  }
});
```

**Alternative: Proxy for CRUD, enrichment only on detail:**
```typescript
// Proxy simple CRUD operations
clientsRouter.get('/', (req, res) => void proxyRequest(config.clientServiceUrl, '/clients', req, res));

// Enriched detail endpoint
clientsRouter.get('/:id', async (req, res) => { /* enrichment logic */ });
```

**Key points:**
- Handler is `async`, not void
- Try-catch wraps entire operation
- Enrichment failures logged but don't fail request
- Network errors return 502 BAD_GATEWAY
- Request ID propagated for tracing

### Pattern 3: OpenAPI Schema Registration

**What:** Register API paths using zod-to-openapi registry

**When:** For all BFF routes to enable API client generation

**Example (auth-service/src/routes/auth.openapi.ts):**
```typescript
import { z } from 'zod';
import {
  CreateUserSchema,
  LoginSchema,
  ErrorResponseSchema,
  UserPublicSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const AuthResponseSchema = z
  .object({
    user: UserPublicSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi('AuthResponse');

const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Log in with email and password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
```

**Example (enriched BFF endpoint - clients.openapi.ts):**
```typescript
import { z } from 'zod';
import {
  ClientSchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const EnrichedClientSchema = ClientSchema.extend({
  engagementCount: z.number(),
}).openapi('EnrichedClient');

const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'get',
  path: '/clients/{id}',
  summary: 'Get client by ID (enriched)',
  security,
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Client found',
      content: {
        'application/json': {
          schema: EnrichedClientSchema,
        },
      },
    },
    404: {
      description: 'Client not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
```

**Key points:**
- Import schemas from shared-types (single source of truth)
- Use `.openapi()` decorator for schema registration
- Register path with method, request schema, responses
- Include error response schemas
- Import as side effect in app.ts: `import './routes/clients.openapi.js'`

## Anti-Patterns to Avoid

### Anti-Pattern 1: Void Async IIFE in BFF

**What:** Using `void (async () => { ... })()` in route handlers

**Why bad:**
- Errors are unhandled rejections
- Handler returns immediately, not waiting for async work
- Response may never be sent if error occurs
- No error visibility or logging

**Instead:** Use top-level async handler with try-catch

```typescript
// BAD
clientsRouter.get('/:id', (req, res) => {
  void (async () => {
    const data = await fetchSomething();
    res.json(data);
  })();
});

// GOOD
clientsRouter.get('/:id', async (req, res) => {
  try {
    const data = await fetchSomething();
    res.json(data);
  } catch (error) {
    log('error', 'Failed', { error, requestId: req.requestId });
    res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Service unavailable' }});
  }
});
```

### Anti-Pattern 2: Silent Validation Failure

**What:** Validation functions catch all errors and return false without logging

**Why bad:**
- Network issues go undetected
- Data integrity risks (delete allowed when check fails)
- No observability into validation problems

**Instead:** Log failures before fail-safe return

```typescript
// BAD
export async function checkActiveEngagements(clientId: string): Promise<boolean> {
  try {
    const res = await fetch(`${config.engagementServiceUrl}/engagements?clientId=${clientId}`);
    return (await res.json()).total > 0;
  } catch {
    return false; // Silent failure
  }
}

// GOOD
export async function checkActiveEngagements(
  clientId: string,
  requestId?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${config.engagementServiceUrl}/engagements?clientId=${clientId}`);
    if (!res.ok) return false;
    const data = (await res.json()) as { total?: number };
    return (data.total ?? 0) > 0;
  } catch (error) {
    log('warning', 'Engagement check failed, allowing delete', {
      clientId,
      error: String(error),
      requestId,
    });
    return false; // Fail safe but logged
  }
}
```

### Anti-Pattern 3: Best-Effort Enrichment Without Feedback

**What:** Catching errors and returning partial data without logging

**Why bad:**
- Users see incomplete data but don't know why
- Debugging enrichment issues impossible
- Service failures hidden

**Instead:** Log enrichment failures, optionally include status flag

```typescript
// BAD
try {
  const clientRes = await fetchJson(...);
  engagement.clientName = clientRes.data.companyName;
} catch {
  // Silent
}

// GOOD - Option 1: Log but provide partial data
try {
  const clientRes = await fetchJson(...);
  if (clientRes.status === 200) {
    engagement.clientName = clientRes.data.companyName;
  } else {
    log('warning', 'Client enrichment failed', {
      engagementId: engagement._id,
      status: clientRes.status,
      requestId,
    });
  }
} catch (error) {
  log('error', 'Client enrichment failed', {
    engagementId: engagement._id,
    error: String(error),
    requestId,
  });
}

// GOOD - Option 2: Include enrichment status in response
res.json({
  ...engagement,
  enrichmentStatus: {
    client: clientRes.status === 200 ? 'enriched' : 'failed',
  },
});
```

### Anti-Pattern 4: Incomplete OpenAPI Registration

**What:** Some routes have .openapi.ts, others don't

**Why bad:**
- Generated API client is incomplete
- Frontend drifts from backend
- Manual API implementation needed for missing routes

**Instead:** Register all routes, run dump-openapi after changes

```typescript
// app.ts - import all registrations
import './routes/health.openapi.js';
import './routes/clients.openapi.js';
import './routes/engagements.openapi.js';
import './routes/reports.openapi.js';
import './routes/invoices.openapi.js';
import './routes/contacts.openapi.js';
import './routes/credentials.openapi.js';
import './routes/auth.openapi.js';
import './routes/dashboard.openapi.js';
```

## Scalability Considerations

| Concern | Current | Recommended for 100+ users | Recommended for 10K+ users |
|---------|---------|---------------------------|----------------------------|
| DELETE validation | Synchronous HTTP | Same (async acceptable) | Add circuit breaker, cache |
| BFF enrichment | Synchronous HTTP | Same | Consider message queue for heavy enrichment |
| Dashboard aggregation | 7 parallel calls | Same | Dedicated analytics service with caching |
| OpenAPI spec | Static JSON generation | Same | Automated regeneration on CI |

## Dependencies and Build Order

### Fix Implementation Order (Critical)

```
1. FIX VALIDATION STUBS (Foundation)
   |
   +---> 1a. Fix client-service/src/engagement-check.ts
   |        - Implement actual HTTP call to engagement-service
   |        - Add proper error handling and logging
   |
   +---> 1b. Fix engagement-service/src/report-invoice-check.ts
   |        - Implement HTTP calls to report-service and billing-service
   |        - Add proper error handling and logging
   |
   v
2. FIX BFF VOID ASYNC (Depends on #1)
   |
   +---> 2a. Fix clients.ts enrichment handler
   |        - Convert to async handler with try-catch
   |
   +---> 2b. Fix engagements.ts enrichment handler
   |
   +---> 2c. Fix reports.ts enrichment handler
   |
   +---> 2d. Fix invoices.ts enrichment handler
   |
   +---> 2e. Fix dashboard.ts handler (add error visibility)
   |
   v
3. COMPLETE OPENAPI REGISTRATION (Independent of #1, #2)
   |
   +---> 3a. Create clients.openapi.ts
   |
   +---> 3b. Create engagements.openapi.ts
   |
   +---> 3c. Create reports.openapi.ts
   |
   +---> 3d. Create invoices.openapi.ts
   |
   +---> 3e. Create contacts.openapi.ts
   |
   +---> 3f. Create credentials.openapi.ts
   |
   +---> 3g. Create auth.openapi.ts
   |
   +---> 3h. Create dashboard.openapi.ts
   |
   v
4. DUMP AND REGENERATE (Depends on #3)
   |
   +---> 4a. Run dump-openapi script
   |
   +---> 4b. Verify openapi.json is complete
   |
   +---> 4c. Run Orval generation
   |
   +---> 4d. Verify generated client
```

### Why This Order

1. **Validation first:** Critical data integrity fix. No dependencies on other work.
2. **BFF second:** Error handling improves reliability, doesn't change API contracts.
3. **OpenAPI third:** Independent work, enables client generation.
4. **Generation last:** Dependent on complete OpenAPI spec.

### Integration Tests Order

```
1. Test validation functions (mock downstream services)
2. Test BFF enrichment with service failures
3. Test OpenAPI spec completeness
4. Test generated client against actual API
```

## Error Response Format

Standardized across all services:

```typescript
interface ErrorResponse {
  error: {
    code: string;          // Machine-readable error code
    message: string;       // Human-readable message
  };
}
```

**Standard error codes:**
- `VALIDATION_ERROR` - Request validation failed (400)
- `UNAUTHORIZED` - Missing/invalid auth token (401)
- `FORBIDDEN` - Insufficient permissions (403)
- `NOT_FOUND` - Resource not found (404)
- `CONFLICT` - Resource state conflict (409)
- `ACTIVE_ENGAGEMENTS` - Cannot delete client with engagements (409)
- `HAS_ASSOCIATED_RECORDS` - Cannot delete with dependencies (409)
- `INVALID_STATUS_TRANSITION` - State machine violation (422)
- `BAD_GATEWAY` - Downstream service unavailable (502)

## Testing Strategy

### Validation Functions

```typescript
describe('engagement-check', () => {
  it('returns true when client has active engagements', async () => {
    mockFetch({ ok: true, json: () => ({ total: 5 }) });
    const result = await checkActiveEngagements('client-id', 'token');
    expect(result).toBe(true);
  });

  it('returns false when client has no engagements', async () => {
    mockFetch({ ok: true, json: () => ({ total: 0 }) });
    const result = await checkActiveEngagements('client-id', 'token');
    expect(result).toBe(false);
  });

  it('returns false and logs on service failure', async () => {
    mockFetch(() => { throw new Error('Network error'); });
    const result = await checkActiveEngagements('client-id', 'token');
    expect(result).toBe(false);
    expect(logWarning).toHaveBeenCalled();
  });
});
```

### BFF Enrichment

```typescript
describe('BFF clients', () => {
  it('returns enriched client when both services available', async () => {
    mockClientService({ _id: '1', companyName: 'Acme' });
    mockEngagementService({ total: 3 });
    const res = await request(app).get('/api/clients/1').set('Authorization', 'Bearer token');
    expect(res.body).toMatchObject({
      _id: '1',
      companyName: 'Acme',
      engagementCount: 3,
    });
  });

  it('returns partial data when enrichment fails', async () => {
    mockClientService({ _id: '1', companyName: 'Acme' });
    mockEngagementService(500); // Service error
    const res = await request(app).get('/api/clients/1').set('Authorization', 'Bearer token');
    expect(res.body).toMatchObject({
      _id: '1',
      companyName: 'Acme',
      engagementCount: 0,
    });
  });

  it('returns 502 when primary service fails', async () => {
    mockClientService(500);
    const res = await request(app).get('/api/clients/1').set('Authorization', 'Bearer token');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('BAD_GATEWAY');
  });
});
```

## OpenAPI Registry Patterns

### Enriched Response Schemas

For BFF endpoints that enrich data, define composite schemas:

```typescript
// shared-types/src/schemas/client.ts
export const EnrichedClientSchema = ClientSchema.extend({
  engagementCount: z.number().default(0),
}).openapi('EnrichedClient');

// shared-types/src/schemas/engagement.ts
export const EnrichedEngagementSchema = EngagementSchema.extend({
  clientName: z.string().optional(),
  hasCodeCredentials: z.boolean().optional(),
}).openapi('EnrichedEngagement');

// shared-types/src/schemas/report.ts
export const EnrichedReportSchema = ReportSchema.extend({
  clientName: z.string().optional(),
  engagementDescription: z.string().optional(),
}).openapi('EnrichedReport');

// shared-types/src/schemas/invoice.ts
export const EnrichedInvoiceSchema = InvoiceSchema.extend({
  clientName: z.string().optional(),
  engagementDescription: z.string().optional(),
}).openapi('EnrichedInvoice');
```

### Dashboard Schema

```typescript
// shared-types/src/schemas/dashboard.ts
export const DashboardSchema = z
  .object({
    totalClients: z.number(),
    totalEngagements: z.number(),
    totalReports: z.number(),
    totalInvoices: z.number(),
    activeEngagements: z.number(),
    draftInvoices: z.number(),
    overdueInvoices: z.number(),
  })
  .openapi('Dashboard');
```

## Sources

- Existing working patterns in codebase:
  - `services/engagement-service/src/client-check.ts` - Working validation pattern
  - `services/report-service/src/engagement-check.ts` - Working validation pattern
  - `services/auth-service/src/routes/auth.openapi.ts` - Working OpenAPI registration
  - `services/client-service/src/routes/*.openapi.ts` - Working OpenAPI registration
  - `packages/shared-types/src/openapi/helpers.ts` - Registry utilities
  - `services/bff-service/src/lib/service-client.ts` - Fetch utilities
- Platform architecture:
  - `.planning/codebase/ARCHITECTURE.md` - Service boundaries and communication patterns
  - `.planning/codebase/CONCERNS.md` - Tech debt inventory
  - `CLAUDE.md` - Project conventions
