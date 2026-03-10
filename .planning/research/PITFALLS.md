# Domain Pitfalls

**Domain:** Node.js/Express Microservices with BFF Pattern
**Researched:** 2026-03-10
**Focus:** Cross-service validation, async error handling, API client generation

## Critical Pitfalls

### Pitfall 1: Void Async IIFE in Express Handlers

**What goes wrong:**
Using `void (async () => { ... })()` in Express route handlers silently suppresses all errors. When the async function throws, Express never sees the error, and the client receives no response or a partial response.

**Why it happens:**
Developers use this pattern to avoid declaring the route handler as `async`, but `void` explicitly discards the promise rejection. Express's error-handling middleware only catches errors thrown synchronously or from properly awaited async handlers.

**Consequences:**
- Unhandled promise rejections that may crash Node.js in older versions
- Clients hang indefinitely waiting for response
- Silent failures in BFF enrichment endpoints (dashboard returning 0 counts when services are down)
- No logging of errors, making debugging impossible
- Service failures appear as successful requests with incomplete data

**Detection:**
- ESLint rules detecting `void (async` patterns
- Monitoring for unhandled promise rejections in production
- Integration tests that verify error responses are returned (not empty responses)
- Dashboard returning 0s for metrics without corresponding error logs

**Prevention:**
- Declare route handlers as `async` functions: `router.get('/', async (req, res) => { ... })`
- Use try/catch blocks around all async operations
- Ensure errors are passed to `next()` or returned via `res.status(code).json(error)`
- Configure ESLint rule: `@typescript-eslint/no-floating-promises`
- Use Express async error handling middleware wrapper

**Phase:** ERR-01 (Async Error Handling) - This milestone

---

### Pitfall 2: Stubbed Cross-Service Validation Functions

**What goes wrong:**
Validation functions that always return `false` (no dependencies found) allow destructive operations like DELETE to proceed even when dependent data exists, creating orphaned records and violating data integrity.

**Why it happens:**
Developers stub validation during initial development with plans to implement "later," but the TODOs are never addressed. The functions compile and pass basic tests (they return a boolean), so they appear to work.

**Consequences:**
- DELETE `/clients/:id` succeeds even with active engagements
- DELETE `/engagements/:id` succeeds even with associated reports/invoices
- Orphaned data in database breaking referential integrity
- Broken business logic downstream (reports referencing deleted engagements)
- Production data corruption that is difficult to recover

**Detection:**
- Search for TODO comments in `*-check.ts` files
- Review integration tests to ensure they test rejection (not just stubbed `false` return)
- Query database for orphaned records (engagements with missing clientId, etc.)
- Manual testing attempting to delete entities with dependencies

**Prevention:**
- Never stub validation functions that affect data integrity
- Implement actual HTTP calls to validate dependencies following the pattern in `services/engagement-service/src/client-check.ts`
- Use contract tests to verify downstream services respond correctly
- Add integration tests that create dependent records and verify DELETE is rejected
- Consider soft delete pattern (isDeleted flag) as alternative to hard delete with validation

**Phase:** VAL-01, VAL-02 (Cross-Service Validation) - This milestone

---

### Pitfall 3: Incomplete OpenAPI Registration Leading to Stale API Client

**What goes wrong:**
When BFF routes lack OpenAPI schema registration files, Orval generates an incomplete API client. The frontend then manually implements API calls, creating drift between frontend and backend contracts.

**Why it happens:**
OpenAPI registration is side-effect based (files imported in `app.ts` but not directly used). New routes are added without corresponding `.openapi.ts` files because the code still compiles and works. The pattern (importing `*.openapi.ts` as side effect) is non-obvious.

**Consequences:**
- Generated client only contains health endpoint (or outdated subset)
- Frontend manual API implementations diverge from backend behavior
- Breaking changes in backend silently break frontend
- TypeScript errors in generated code if mismatch occurs
- Regeneration overwrites manual frontend implementations, causing merge conflicts

**Detection:**
- Compare BFF routes (`services/bff-service/src/routes/*.ts`) with OpenAPI imports (`services/bff-service/src/app.ts`)
- Check if generated client (`packages/api-client/src/generated/`) matches BFF routes
- Review Orval output for missing route warnings
- Audit frontend API files (`apps/web-app/src/features/*/api/*.ts`) vs generated client

**Prevention:**
- Create `.openapi.ts` file for every BFF route immediately
- Add pre-commit hook to verify all routes have corresponding OpenAPI registration
- Run Orval generation in CI pipeline and fail if spec changes unexpectedly
- Store OpenAPI spec as artifact and compare between builds
- Use schema-first approach: define OpenAPI first, generate server stubs

**Phase:** API-01, API-02, API-03, API-04 (API Client Generation) - This milestone

## Moderate Pitfalls

### Pitfall 4: Race Conditions in Cross-Service Validation

**What goes wrong:**
When checking for dependencies before DELETE, a race condition can occur if dependent records are created between the check and the actual deletion.

**Why it happens:**
CHECK operation (HTTP GET) and DELETE operation are separate round trips without atomicity. In high-concurrency environments, another request can insert dependent data between these operations.

**Consequences:**
- Orphaned records despite validation check passing
- Data integrity violations that only occur under load
- Difficult to reproduce race conditions in testing

**Detection:**
- Load testing with concurrent create/delete operations
- Database queries for orphaned records after heavy load
- Integration tests with explicit timing delays between check and delete

**Prevention:**
- Use database-level foreign key constraints when possible (MongoDB doesn't support FK constraints like SQL)
- Implement retry logic: check again before delete, fail if state changed
- Consider event-sourcing pattern with append-only event log
- Use distributed locks around check-and-delete operations
- Document race condition acceptance criteria for non-critical data

**Phase:** VAL-01, VAL-02 - Add retry logic to validation functions

---

### Pitfall 5: Best-Effort Enrichment Masking Service Failures

**What goes wrong:**
Using `catch {}` blocks in BFF enrichment endpoints (like `clients.ts` line 27-48) silently ignores failures from downstream services, returning incomplete data to the client without any indication of failure.

**Why it happens:**
Developers add `catch {}` thinking "enrichment is optional" or "don't fail the whole request if enrichment fails." But this masks legitimate service failures and degrades user experience without signaling anything is wrong.

**Consequences:**
- Dashboard shows 0s for metrics when services are down (appears correct but is wrong)
- Client/engagement detail pages missing enrichment fields
- No way for frontend to distinguish "no data" from "service failure"
- Silent failures make debugging production issues difficult

**Detection:**
- Check for empty `catch {}` or `catch { /* ignore */ }` blocks
- Monitor for service health vs returned enrichment completeness
- Review logs for failed enrichment attempts
- Integration tests that verify partial failures are communicated

**Prevention:**
- Always log caught exceptions with full context
- Consider returning enriched fields as nullable with source status
- Use Promise.allSettled and report fulfillment status to client
- Implement circuit breakers to skip failing enrichment temporarily
- Add health indicators to response indicating which services are unavailable

**Phase:** ERR-01 - Replace silent catches with logging and proper error propagation

---

### Pitfall 6: Missing Request ID Propagation in Async Operations

**What goes wrong:**
When `void (async () => { ... })()` is used for enrichment, the request ID may not be properly propagated to downstream service calls, breaking distributed tracing.

**Why it happens:**
The async IIFE is detached from the Express request context, and developers may forget to pass `req.requestId` to all downstream calls.

**Consequences:**
- Impossible to trace requests across services
- Correlation lost between frontend request and backend logs
- Debugging cross-service issues becomes guesswork
- Logs cannot be aggregated by request ID for analysis

**Detection:**
- Review async operations for consistent request ID forwarding
- Add integration test that verifies request ID appears in all downstream logs
- Use distributed tracing tools (Jaeger, Zipkin) to visualize request flow

**Prevention:**
- Ensure all `fetchJson` and service calls include `req.requestId` parameter
- Add TypeScript type enforcement for request ID propagation
- Use middleware that attaches request ID to async context storage (AsyncLocalStorage)
- Write linting rule to verify request ID is passed in service calls

**Phase:** ERR-01 - Audit and fix request ID propagation in all BFF handlers

---

## Minor Pitfalls

### Pitfall 7: HTTP Timeout Not Configured for Cross-Service Calls

**What goes wrong:**
Native `fetch` calls in cross-service validation have no timeout, causing handlers to hang indefinitely when downstream services are unresponsive.

**Why it happens:**
JavaScript's `fetch` has no default timeout, and developers forget to add `AbortController` for timeout handling.

**Consequences:**
- Request handlers hang indefinitely
- Slow services cascade to timeouts across system
- No circuit breaking when services are degraded
- Resource exhaustion from accumulated hanging requests

**Detection:**
- Review all `fetch` calls for timeout configuration
- Load testing with simulated service delays
- Monitor for requests exceeding expected duration

**Prevention:**
- Wrap all fetch calls with timeout using AbortController
- Use axios or got libraries with built-in timeout support
- Configure sensible timeouts (e.g., 5s for service calls, 30s for user-facing requests)
- Add circuit breaker pattern to stop calling failing services

**Phase:** VAL-01, VAL-02 - Add timeout configuration to all cross-service HTTP calls

---

### Pitfall 8: Orval Generated Client Uses Non-Awaited Mutations

**What goes wrong:**
When using Orval with React Query, generated mutations may be called without proper error handling, causing unhandled promise rejections in React components.

**Why it happens:**
Orval generates hooks that accept options, but developers may not properly handle error states in components.

**Consequences:**
- Unhandled promise rejections in browser console
- Silent failures for user actions
- Poor UX with no loading or error feedback
- State inconsistencies when mutations fail silently

**Detection:**
- ESLint rules for unhandled promise rejections
- React DevTools showing error states not being read
- Integration tests for mutation error paths

**Prevention:**
- Always destructure `{ error, isLoading }` from Orval-generated hooks
- Add error boundaries to catch and display mutation errors
- Use TypeScript to enforce all mutation returns are handled
- Document proper mutation usage pattern in codebase

**Phase:** API-04 (Frontend Migration) - Ensure proper error handling in all React components using generated client

---

### Pitfall 9: Pagination Response Mismatch Between Generated Client and Backend

**What goes wrong:**
Orval generates client based on OpenAPI schema, but if schema doesn't match actual backend response format (e.g., different property names for `total`, `page`, `limit`), frontend pagination breaks.

**Why it happens:**
OpenAPI schema may be defined once but not updated when backend response format changes, or Zod schema doesn't match OpenAPI registration.

**Consequences:**
- Frontend pagination controls malfunction
- Infinite scroll or load more buttons broken
- Data display issues (showing wrong subset or missing items)
- TypeScript compilation errors if types don't match

**Detection:**
- Contract tests comparing generated client types to actual backend responses
- Integration tests for pagination endpoints
- Compare Zod schemas with OpenAPI registration files

**Prevention:**
- Ensure Zod schemas and OpenAPI registration are always in sync
- Add CI step that validates OpenAPI spec matches schema files
- Use automated schema generation from Zod as single source of truth
- Document pagination response format explicitly

**Phase:** API-02, API-03 - Verify OpenAPI spec accurately reflects backend response formats

---

## Phase-Specific Warnings

### Phase: VAL-01 (Client Validation)
| Topic | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Implementing `checkActiveEngagements` | Race condition if engagements created between check and delete | Add retry: check again immediately before delete, fail if state changed |
| HTTP call to engagement-service | No timeout configured | Use AbortController with 5s timeout |
| Error handling | Catching all errors and returning false | Log errors, differentiate between "not found" and "service unavailable" |

### Phase: VAL-02 (Engagement Validation)
| Topic | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Implementing `checkAssociatedReportsOrInvoices` | Making two separate HTTP calls increases failure surface | Use Promise.all with proper error handling, fail fast if either fails |
| Checking reports and invoices | Different response formats for counts | Standardize on `?limit=1` pattern for count extraction |

### Phase: ERR-01 (BFF Error Handling)
| Topic | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Converting void async to async handlers | Forgetting to handle errors in try/catch | Add error handling middleware that logs all errors |
| Dashboard aggregation | Promise.allSettled hiding failures | Log rejected promises, consider partial failure response |
| Request ID propagation | Losing request ID in async context | Ensure all fetchJson calls include requestId parameter |

### Phase: API-01/02 (OpenAPI Registration)
| Topic | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Creating `.openapi.ts` files | Forgetting to import in `app.ts` as side effect | Use automated script to verify all routes have registrations |
| Schema consistency | Zod schema and OpenAPI registration diverge | Generate OpenAPI from Zod programmatically, not manually |
| Security schemes | Missing BearerAuth registration | Add security to all authenticated routes consistently |

### Phase: API-03 (Client Generation)
| Topic | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Running Orval generation | Overwriting manual work in generated directory | Ensure generated directory contains only auto-generated files |
| TypeScript errors after generation | Generated types conflict with existing frontend types | Resolve conflicts by using generated types as source of truth |

### Phase: API-04 (Frontend Migration)
| Topic | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Replacing manual fetch with generated client | Breaking existing UI logic | Migrate incrementally, test each endpoint thoroughly |
| React Query integration | Not properly handling error states | Add error boundaries, ensure error and isLoading are destructured |
| Pagination handling | Different property names in generated client | Update UI to use generated client's property names |

## Sources

### Codebase Analysis
- `.planning/codebase/CONCERNS.md` - Current issues with stubbed validation and void async pattern (HIGH confidence)
- `.planning/codebase/ARCHITECTURE.md` - Architecture patterns for cross-service communication (HIGH confidence)
- `services/bff-service/src/routes/*.ts` - Analysis of void async pattern across 5 route files (HIGH confidence)
- `services/client-service/src/engagement-check.ts` - Stub implementation example (HIGH confidence)
- `services/engagement-service/src/client-check.ts` - Working HTTP-based validation pattern (HIGH confidence)
- `packages/api-client/orval.config.ts` - Orval configuration referencing incomplete OpenAPI spec (HIGH confidence)
- `services/bff-service/openapi.json` - Contains only health endpoint (HIGH confidence)

### External Sources
- Note: Web search tools were unavailable (rate limit reached) during this research. Findings are based on codebase analysis and well-known Node.js/Express microservices patterns. Confidence levels reflect this constraint.

### Training Data Knowledge
- Express async handler patterns (MEDIUM confidence - standard practice, should verify with Express 5 docs)
- Microservices cross-service validation patterns (MEDIUM confidence - widely used but verify with specific stack docs)
- Orval/OpenAPI generation workflows (LOW confidence - library-specific, verify with official docs)

---

*Pitfalls analysis: 2026-03-10*
