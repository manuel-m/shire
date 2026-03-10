# Phase 2: BFF Error Handling - Research

**Researched:** 2026-03-10
**Domain:** Express 5.x async route handlers, BFF error handling patterns
**Confidence:** HIGH

## Summary

This phase addresses the void async IIFE anti-pattern in BFF enrichment routes. The current implementation uses `void (async () => { ... })()` which silently suppresses all errors, causing clients to hang and making debugging impossible. Five route files (`dashboard.ts`, `clients.ts`, `engagements.ts`, `reports.ts`, `invoices.ts`) need refactoring to use proper async route handlers with try-catch blocks.

The fix is straightforward: declare route handlers as `async` functions, wrap async operations in try-catch blocks, and use `Promise.allSettled` for parallel enrichment with individual error logging. The existing `proxyRequest` and `fetchJson` utilities already handle Authorization and X-Request-Id header forwarding, so request ID propagation is already in place. The key change is ensuring errors are caught, logged, and communicated to clients via HTTP 502 BAD_GATEWAY responses.

**Primary recommendation:** Replace all void async IIFE patterns with top-level async handlers using try-catch blocks and `Promise.allSettled` for parallel enrichment.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Use per-service try-catch blocks around each individual service call
- Individual services can fail without affecting other parallel calls
- Top-level async handler replaces void async IIFE pattern
- Enrichment failures logged as warnings (service might be down temporarily)
- Full handler failures logged as errors (request cannot complete)
- Include requestId and error details in all error logs
- Keep existing error format: `{ error: { code: 'BAD_GATEWAY', message: '...' } }`
- Message includes service name: "Client service unavailable" or "Engagement service unavailable"
- Consistent with existing `proxyRequest` error handling in `service-client.ts`

### Claude's Discretion

- Timeout duration for enrichment calls (5-second pattern from Phase 1 suggested)
- Promise.all vs Promise.allSettled choice for parallel enrichment
- Specific handling of sequential enrichment patterns (engagements.ts line 46)
- Whether to add tests for error scenarios

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                    | Research Support                                                                                                   |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| ERR-01 | All BFF enrichment endpoints use top-level async handlers (no void async IIFE) | Express 5.x supports async handlers natively; existing void pattern suppresses errors (PITFALLS.md lines 9-37)     |
| ERR-02 | All BFF handlers have try-catch error handling                                 | Standard pattern for async error handling; existing `proxyRequest` provides correct error response model           |
| ERR-03 | Failed enrichment attempts are logged with error details                       | `createLogger` from `@shire/shared` provides structured logging; `proxyRequest` already logs errors with requestId |
| ERR-04 | Service failures return HTTP 502 BAD_GATEWAY with error response               | `proxyRequest` already implements this pattern; matches existing error format in `service-client.ts`               |
| ERR-05 | Promise.allSettled handles individual service failures                         | Native Promise.allSettled allows partial success; already used in dashboard.ts with correct extraction pattern     |
| ERR-06 | Request ID propagated to all downstream service calls                          | `req.requestId` middleware already installed; `proxyRequest` and `fetchJson` already forward X-Request-Id header   |

</phase_requirements>

## Standard Stack

### Core

| Library    | Version | Purpose       | Why Standard                                                     |
| ---------- | ------- | ------------- | ---------------------------------------------------------------- |
| Node.js    | 18+     | Runtime       | Project constraint from CLAUDE.md                                |
| TypeScript | 5.7.0   | Type system   | Project constraint from CLAUDE.md                                |
| Express    | ^5.1.0  | Web framework | Current version in bff-service; supports async handlers natively |

### Supporting

| Library        | Version      | Purpose          | When to Use                                        |
| -------------- | ------------ | ---------------- | -------------------------------------------------- |
| native `fetch` | Built-in     | HTTP client      | Already used in `fetchJson` and `proxyRequest`     |
| @shire/shared  | workspace:\* | Shared utilities | Provides `createLogger` and `createAuthMiddleware` |
| vitest         | ^3.1.0       | Test framework   | Project testing standard from CLAUDE.md            |
| supertest      | ^7.1.0       | HTTP testing     | For integration tests of error scenarios           |

### Alternatives Considered

| Instead of          | Could Use            | Tradeoff                                                                                                             |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| native fetch        | axios / got          | Existing code uses fetch; axios has built-in timeout but adds dependency                                             |
| top-level try-catch | asyncHandler wrapper | Wrapper pattern is more DRY but top-level try-catch is clearer for BFF enrichment logic                              |
| Promise.allSettled  | Promise.all          | Promise.all fails fast on first rejection; Promise.allSettled allows partial success which is desired for enrichment |

**Installation:**
No new packages required. Existing stack supports all needed functionality.

## Architecture Patterns

### Recommended Project Structure

BFF service structure is already correct:

```
services/bff-service/src/
├── lib/
│   └── service-client.ts     # proxyRequest and fetchJson utilities (already correct)
├── routes/
│   ├── dashboard.ts           # 7 parallel enrichment calls (needs refactoring)
│   ├── clients.ts             # GET /:id with engagement count (needs refactoring)
│   ├── engagements.ts         # GET /:id with client name (needs refactoring)
│   ├── reports.ts            # GET /:id with client+engagement names (needs refactoring)
│   └── invoices.ts           # GET /:id with client+engagement names (needs refactoring)
└── app.ts                     # Router mounting
```

### Pattern 1: Async Route Handler with Try-Catch

**What:** Declare route handler as async function with try-catch block for error handling
**When to use:** All enrichment routes that make async calls to downstream services

**Example:**

```typescript
// Source: services/bff-service/src/routes/clients.ts (after refactoring)
import { Router, Request, Response } from 'express';
import { createLogger } from '@shire/shared';
import { fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { log } = createLogger(config.serviceName);

clientsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const clientId = req.params.id as string;
    const auth = req.headers.authorization;

    const results = await Promise.allSettled([
      fetchJson(config.clientServiceUrl, `/clients/${clientId}`, auth, req.requestId),
      fetchJson<{ total?: number }>(
        config.engagementServiceUrl,
        `/engagements?clientId=${clientId}&limit=1`,
        auth,
        req.requestId,
      ),
    ]);

    const clientResult = results[0];
    const engagementsResult = results[1];

    // Handle client fetch failure
    if (clientResult.status === 'rejected') {
      log('error', 'Client service unavailable', {
        clientId,
        error: clientResult.reason instanceof Error ? clientResult.reason.message : 'Unknown error',
        requestId: req.requestId,
      });
      res.status(502).json({
        error: { code: 'BAD_GATEWAY', message: 'Client service unavailable' },
      });
      return;
    }

    const clientRes = clientResult.value;
    if (clientRes.status !== 200) {
      res.status(clientRes.status).json(clientRes.data);
      return;
    }

    const enriched = {
      ...(clientRes.data as object),
      engagementCount:
        engagementsResult.status === 'fulfilled' && engagementsResult.value.status === 200
          ? (engagementsResult.value.data.total ?? 0)
          : (() => {
              if (engagementsResult.status === 'rejected') {
                log('warn', 'Engagement enrichment failed', {
                  clientId,
                  error:
                    engagementsResult.reason instanceof Error
                      ? engagementsResult.reason.message
                      : 'Unknown error',
                  requestId: req.requestId,
                });
              }
              return 0;
            })(),
    };

    res.json(enriched);
  } catch (err) {
    log('error', 'Client detail request failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });
  }
});
```

### Pattern 2: Parallel Enrichment with Promise.allSettled

**What:** Use Promise.allSettled for parallel service calls, handle each result individually
**When to use:** Dashboard aggregation and detail endpoints that enrich from multiple services

**Example:**

```typescript
// Source: services/bff-service/src/routes/dashboard.ts (after refactoring)
dashboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;

    const results = await Promise.allSettled([
      fetchJson<{ total?: number }>(
        config.clientServiceUrl,
        '/clients?limit=1',
        auth,
        req.requestId,
      ),
      fetchJson<{ total?: number }>(
        config.engagementServiceUrl,
        '/engagements?limit=1',
        auth,
        req.requestId,
      ),
      // ... 5 more service calls
    ]);

    // Extract results, logging failures but not failing entire request
    const extract = (
      r: PromiseSettledResult<{ status: number; data: { total?: number } }>,
      serviceName: string,
    ) => {
      if (r.status === 'fulfilled' && r.value.status === 200) {
        return r.value.data.total ?? 0;
      }
      if (r.status === 'rejected') {
        log('warn', `${serviceName} aggregation failed`, {
          error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
          requestId: req.requestId,
        });
      }
      return 0;
    };

    const dashboard = {
      totalClients: extract(results[0], 'Client service'),
      totalEngagements: extract(results[1], 'Engagement service'),
      // ... other fields
    };

    log('info', 'Dashboard aggregated', { requestId: req.requestId });
    res.json(dashboard);
  } catch (err) {
    log('error', 'Dashboard request failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });
  }
});
```

### Pattern 3: Sequential Enrichment with Per-Service Try-Catch

**What:** Fetch primary data first, then enrich with try-catch around enrichment calls
**When to use:** When primary fetch is required for enrichment (e.g., need clientId to fetch related data)

**Example:**

```typescript
// Source: services/bff-service/src/routes/engagements.ts (after refactoring)
engagementsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const auth = req.headers.authorization;

    const engRes = await fetchJson<{ clientId?: string }>(
      config.engagementServiceUrl,
      `/engagements/${id}`,
      auth,
      req.requestId,
    );

    if (engRes.status !== 200) {
      res.status(engRes.status).json(engRes.data);
      return;
    }

    const engagement = engRes.data as Record<string, unknown>;

    // Enrich with client name - best-effort but logged
    try {
      const clientRes = await fetchJson<{ companyName?: string }>(
        config.clientServiceUrl,
        `/clients/${String(engagement.clientId)}`,
        auth,
        req.requestId,
      );
      if (clientRes.status === 200) {
        engagement.clientName = clientRes.data.companyName;
      }
    } catch (err) {
      log('warn', 'Client enrichment failed for engagement', {
        engagementId: id,
        clientId: engagement.clientId,
        error: err instanceof Error ? err.message : 'Unknown error',
        requestId: req.requestId,
      });
    }

    res.json(engagement);
  } catch (err) {
    log('error', 'Engagement detail request failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });
  }
});
```

### Anti-Patterns to Avoid

- **Void Async IIFE:** `void (async () => { ... })()` silently suppresses all errors. Use top-level async handler instead.
- **Empty catch blocks:** `catch {}` masks failures. Always log errors with context.
- **Returning promises without await:** `router.get('/', handler())` discards promise. Always declare handler as async or await the promise.
- **Not propagating request IDs:** Failing to pass `req.requestId` breaks distributed tracing.
- **Throwing in enrichment:** Enrichment failures should be caught and logged, not thrown (best-effort pattern).

## Don't Hand-Roll

| Problem               | Don't Build          | Use Instead                             | Why                                            |
| --------------------- | -------------------- | --------------------------------------- | ---------------------------------------------- |
| HTTP client wrapper   | Custom fetch wrapper | Native `fetch` with `AbortController`   | Already implemented in `service-client.ts`     |
| Request ID generation | UUID generation      | `req.requestId` from middleware         | Already implemented via `requestId` middleware |
| Error logging utility | Custom logger        | `createLogger` from `@shire/shared`     | Already provides structured JSON logging       |
| Proxy request handler | Custom proxy logic   | `proxyRequest` from `service-client.ts` | Already handles auth, headers, error responses |

**Key insight:** The `service-client.ts` module already provides correct patterns for inter-service communication. The phase work is about refactoring route handlers to use these utilities properly, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Void Async IIFE Silently Suppresses Errors

**What goes wrong:** Using `void (async () => { ... })()` in Express route handlers discards all promise rejections. Express never sees errors, clients hang, and no logging occurs.

**Why it happens:** The `void` operator explicitly ignores the returned promise, and the async function detaches from Express's error handling middleware.

**How to avoid:** Declare route handlers as `async` functions: `router.get('/', async (req, res) => { ... })` and use try-catch blocks.

**Warning signs:**

- Dashboard returning 0s for metrics when services are down (no error logs)
- Clients hanging indefinitely on detail endpoints
- Unhandled promise rejections in Node.js logs

### Pitfall 2: Missing Request ID Propagation

**What goes wrong:** Forgetting to pass `req.requestId` to downstream calls breaks distributed tracing.

**Why it happens:** When refactoring void async IIFE, developers may copy code without including the requestId parameter.

**How to avoid:** Ensure all `fetchJson` and `proxyRequest` calls include `req.requestId` parameter.

**Warning signs:** Logs from downstream services missing X-Request-Id correlation.

### Pitfall 3: Throwing Errors in Best-Effort Enrichment

**What goes wrong:** Throwing errors from enrichment calls causes the entire request to fail when enrichment should be optional.

**Why it happens:** Developers apply the same error handling pattern to both critical data fetches and optional enrichment.

**How to avoid:** Use try-catch around enrichment, log warnings, and continue with partial data. Only throw/catch-respond at top level for critical failures.

**Warning signs:** Dashboard failing completely when one service is down.

### Pitfall 4: Not Using Promise.allSettled for Parallel Calls

**What goes wrong:** Using `Promise.all` fails the entire request when any single parallel call fails, preventing partial success.

**Why it happens:** `Promise.all` is more common; developers may not know about `Promise.allSettled`.

**How to avoid:** Use `Promise.allSettled` for parallel enrichment calls where partial success is acceptable.

**Warning signs:** All dashboard metrics returning 0 when any single service is down.

### Pitfall 5: Generic Error Messages Without Service Name

**What goes wrong:** Error responses like "Backend service unavailable" don't indicate which specific service failed.

**Why it happens:** Reusing the same error message for all service failures.

**How to avoid:** Include service name in error messages: "Client service unavailable" or "Engagement service unavailable".

**Warning signs:** Debugging production issues requires checking multiple service logs.

## Code Examples

Verified patterns from existing codebase:

### Reusable Utilities (Already Correct)

```typescript
// Source: services/bff-service/src/lib/service-client.ts
export async function proxyRequest(
  serviceBaseUrl: string,
  path: string,
  req: Request,
  res: Response,
  options?: ProxyOptions,
): Promise<void> {
  // ... forwards Authorization and X-Request-Id headers
  // ... catches errors and returns 502 BAD_GATEWAY
  // ... logs errors with requestId
}

export async function fetchJson<T = unknown>(
  serviceBaseUrl: string,
  path: string,
  authHeader?: string,
  requestId?: string,
): Promise<{ status: number; data: T }> {
  // ... returns status/data tuple
  // ... does NOT throw
}
```

### Logger Usage (Already Correct)

```typescript
// Source: packages/shared/src/logger.ts
export function createLogger(serviceName: string) {
  function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      level,
      message,
      ...metadata,
    };
    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }
  return { log };
}
```

### Timeout Pattern (From Phase 1, Optional for This Phase)

```typescript
// Source: services/engagement-service/src/report-invoice-check.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch(url, { signal: controller.signal, headers });
  // ... handle response
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') {
    log('error', 'Service call timed out', { requestId, timeout: 5000 });
  }
} finally {
  clearTimeout(timeoutId);
}
```

## State of the Art

| Old Approach                   | Current Approach                       | When Changed | Impact                                    |
| ------------------------------ | -------------------------------------- | ------------ | ----------------------------------------- |
| void (async () => {})          | Top-level async handler with try-catch | Express 5.x  | Proper error handling, no silent failures |
| Promise.all                    | Promise.allSettled for enrichment      | ES2020       | Partial success for parallel enrichment   |
| Unhandled enrichment errors    | Logged warnings with requestId         | This phase   | Observability of service degradation      |
| Generic "unavailable" messages | Service-specific error messages        | This phase   | Faster debugging in production            |

**Deprecated/outdated:**

- Express 4.x async handler patterns (require wrappers) - Express 5.x supports async natively
- Callback-based error handling - replaced by async/await

## Open Questions

1. **Timeout duration for enrichment calls**
   - What we know: Phase 1 used 5-second AbortController timeout for validation calls
   - What's unclear: Whether enrichment calls should also timeout or wait indefinitely
   - Recommendation: Add 5-second timeout following Phase 1 pattern for consistency

2. **Sequential vs parallel enrichment in engagements.ts**
   - What we know: Current implementation fetches engagement first, then enriches client name sequentially
   - What's unclear: Whether this should remain sequential or be parallelized with a single Promise.allSettled
   - Recommendation: Keep sequential as-is - client enrichment is genuinely dependent on having the engagement record

3. **Test coverage for error scenarios**
   - What we know: Existing integration tests cover happy paths; error scenarios not tested
   - What's unclear: Level of testing required for this refactoring
   - Recommendation: Add basic error handling tests verifying 502 responses and log entries

## Validation Architecture

### Test Framework

| Property           | Value                                      |
| ------------------ | ------------------------------------------ |
| Framework          | Vitest 3.1.0                               |
| Config file        | services/\*/vitest.config.ts (per-service) |
| Quick run command  | `pnpm --filter @shire/bff-service test`    |
| Full suite command | `pnpm -r test`                             |

### Phase Requirements → Test Map

| Req ID | Behavior                                       | Test Type   | Automated Command                                                   | File Exists? |
| ------ | ---------------------------------------------- | ----------- | ------------------------------------------------------------------- | ------------ |
| ERR-01 | Route handlers use async (not void IIFE)       | unit        | `grep -q "router.get.*async" services/bff-service/src/routes/*.ts`  | Wave 0       |
| ERR-02 | Handlers have try-catch error handling         | unit        | `grep -q "try {" services/bff-service/src/routes/*.ts`              | Wave 0       |
| ERR-03 | Failed enrichment logged with error details    | integration | `pnpm --filter @shire/bff-service test:integration`                 | Wave 0       |
| ERR-04 | Service failures return 502 BAD_GATEWAY        | integration | `pnpm --filter @shire/bff-service test:integration`                 | Wave 0       |
| ERR-05 | Promise.allSettled handles individual failures | unit        | `grep -q "Promise.allSettled" services/bff-service/src/routes/*.ts` | Wave 0       |
| ERR-06 | Request ID propagated to downstream calls      | integration | `pnpm --filter @shire/bff-service test:integration`                 | Wave 0       |

### Sampling Rate

- **Per task commit:** `pnpm --filter @shire/bff-service test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/bff-service/src/routes/*.integration.test.ts` — covers ERR-03, ERR-04, ERR-06
- [ ] `services/bff-service/src/routes/dashboard.integration.test.ts` — tests dashboard aggregation error handling
- [ ] `services/bff-service/src/routes/clients.integration.test.ts` — tests client detail enrichment error handling
- [ ] Framework install: None - vitest already in package.json

## Sources

### Primary (HIGH confidence)

- Existing working patterns in codebase:
  - `services/bff-service/src/lib/service-client.ts` - Correct error handling model in proxyRequest
  - `services/bff-service/src/routes/dashboard.ts` - Current void async pattern (needs refactoring)
  - `services/bff-service/src/routes/clients.ts` - Current void async pattern (needs refactoring)
  - `services/bff-service/src/routes/engagements.ts` - Current void async pattern (needs refactoring)
  - `services/bff-service/src/routes/reports.ts` - Current void async pattern (needs refactoring)
  - `services/bff-service/src/routes/invoices.ts` - Current void async pattern (needs refactoring)
  - `packages/shared/src/logger.ts` - Structured logging utility
  - `packages/shared/src/middleware/request-id.ts` - Request ID propagation middleware
- Project documentation:
  - `.planning/phases/02-bff-error-handling/02-CONTEXT.md` - User decisions (HIGH)
  - `.planning/research/PITFALLS.md` - Void async IIFE pitfall analysis (HIGH)
  - `.planning/research/STACK.md` - BFF error handling patterns (HIGH)
  - `CLAUDE.md` - Project conventions (HIGH)

### Secondary (MEDIUM confidence)

- Express 5.x async handler patterns (standard Node.js/Express practice)
- Promise.allSettled vs Promise.all tradeoffs (ES2020 specification)
- Vitest testing patterns for Express routes

### Tertiary (LOW confidence)

- None - all findings verified against codebase or standard language specifications

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All dependencies verified in package.json and CLAUDE.md
- Architecture: HIGH - Working examples exist in codebase; patterns verified
- Pitfalls: HIGH - Direct codebase analysis; anti-patterns clearly identified

**Research date:** 2026-03-10
**Valid until:** 2026-04-09 (30 days - stable domain)
