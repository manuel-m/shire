---
phase: 02-bff-error-handling
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - services/bff-service/src/routes/dashboard.integration.test.ts
  - services/bff-service/src/routes/dashboard.ts
autonomous: true
requirements:
  - ERR-01
  - ERR-02
  - ERR-03
  - ERR-04
  - ERR-05
  - ERR-06

must_haves:
  truths:
    - 'Dashboard endpoint returns HTTP 502 BAD_GATEWAY when downstream services fail'
    - 'Failed dashboard aggregation attempts are logged with error details and request ID'
    - 'Individual service failures in dashboard aggregation are handled without failing entire request'
    - 'Request ID is propagated to all downstream dashboard service calls'
    - 'Dashboard route handler uses async function (not void async IIFE)'
  artifacts:
    - path: 'services/bff-service/src/routes/dashboard.integration.test.ts'
      provides: 'Integration tests for dashboard error handling'
      min_lines: 50
    - path: 'services/bff-service/src/routes/dashboard.ts'
      provides: 'Refactored dashboard route with proper error handling'
      exports: ['dashboardRouter']
      contains: 'async (req: Request, res: Response)'
  key_links:
    - from: 'services/bff-service/src/routes/dashboard.ts'
      to: 'services/bff-service/src/lib/service-client.ts'
      via: 'fetchJson calls with requestId'
      pattern: 'fetchJson.*req.requestId'
    - from: 'services/bff-service/src/routes/dashboard.ts'
      to: 'console output (logs)'
      via: "log('warn', ...) for enrichment failures"
      pattern: "log\\('warn'.*requestId"
---

<objective>
Refactor dashboard route to replace void async IIFE pattern with top-level async handler, try-catch error handling, and Promise.allSettled for partial success handling.

Purpose: Dashboard currently uses `void (async () => { ... })()` which silently suppresses all errors, causing clients to hang when services fail. This refactoring ensures errors are caught, logged with request ID, and communicated via HTTP 502 BAD_GATEWAY responses.

Output: Dashboard route with proper async handler, try-catch blocks, warning logs for enrichment failures, and integration tests covering error scenarios.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-bff-error-handling/02-CONTEXT.md
@.planning/phases/02-bff-error-handling/02-RESEARCH.md
@services/bff-service/src/routes/dashboard.ts
@services/bff-service/src/lib/service-client.ts

<interfaces>
<!-- Key types and contracts from service-client.ts -->
From services/bff-service/src/lib/service-client.ts:
```typescript
export async function fetchJson<T = unknown>(
  serviceBaseUrl: string,
  path: string,
  authHeader?: string,
  requestId?: string,
): Promise<{ status: number; data: T }>;
```

From packages/shared/src/logger.ts:

```typescript
export function createLogger(serviceName: string): {
  log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void;
};
```

</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create dashboard integration tests</name>
  <files>services/bff-service/src/routes/dashboard.integration.test.ts</files>
  <behavior>
    - Test 1: GET /api/dashboard returns aggregated data when all services are healthy
    - Test 2: GET /api/dashboard returns partial data when some services fail (Promise.allSettled behavior)
    - Test 3: GET /api/dashboard logs warnings for failed enrichment (service degradation)
    - Test 4: GET /api/dashboard propagates X-Request-Id to downstream services
    - Test 5: GET /api/dashboard returns HTTP 502 with error response on complete failure
  </behavior>
  <action>
    Create integration test file using vitest and supertest. Use Express test utilities to mount dashboardRouter directly. Mock fetchJson to simulate service failures and verify logging behavior. Test scenarios:
    - Happy path: all services return 200
    - Partial failure: some services return 502 or timeout
    - Complete failure: all services fail
    - Request ID propagation: verify X-Request-Id header passed to fetchJson calls

    Import from services/bff-service/src/routes/dashboard.ts: dashboardRouter
    Import from services/bff-service/src/lib/service-client.ts: fetchJson (mock via vi.spyOn)
    Use vi.spyOn on console.log/console.error to verify log entries contain requestId

  </action>
  <verify>
    <automated>pnpm --filter @shire/bff-service test:integration</automated>
  </verify>
  <done>Integration test file created with 5+ test cases covering error scenarios, tests pass after Task 2 implementation</done>
</task>

<task type="auto">
  <name>Task 2: Refactor dashboard route with proper error handling</name>
  <files>services/bff-service/src/routes/dashboard.ts</files>
  <action>
    Refactor dashboard.ts GET route handler:

    1. Replace `void (async () => { ... })()` with top-level async handler:
       ```typescript
       dashboardRouter.get('/', async (req: Request, res: Response) => {
         try {
           // ... existing Promise.allSettled logic
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

    2. Keep existing Promise.allSettled pattern (already correct for partial success)

    3. Modify extract function to log warnings for failed services:
       ```typescript
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
       ```

    4. Update all 7 extract calls to include service name:
       - extract(results[0], 'Client service')
       - extract(results[1], 'Engagement service')
       - extract(results[2], 'Report service')
       - extract(results[3], 'Billing service')
       - extract(results[4], 'Engagement service')
       - extract(results[5], 'Billing service')
       - extract(results[6], 'Billing service')

    5. Ensure all fetchJson calls pass req.requestId (already present in existing code)

    6. DO NOT change the existing Promise.allSettled logic — it's already correct for partial success

    Per CONTEXT.md locked decision: Enrichment failures logged as warnings (service might be down temporarily), full handler failures logged as errors.

  </action>
  <verify>
    <automated>grep -q "router.get.*async" services/bff-service/src/routes/dashboard.ts && grep -q "try {" services/bff-service/src/routes/dashboard.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/dashboard.ts</automated>
  </verify>
  <done>Dashboard route uses async handler with try-catch, enrichment failures logged as warnings with requestId, all 7 service calls in Promise.allSettled</done>
</task>

</tasks>

<verification>
- Run integration tests: `pnpm --filter @shire/bff-service test:integration`
- Verify no void async IIFE pattern: `grep -r "void (async" services/bff-service/src/routes/dashboard.ts` (should be empty)
- Verify async handler declaration: `grep "router.get.*async.*=>" services/bff-service/src/routes/dashboard.ts`
- Verify try-catch block: `grep -A 50 "router.get.*async" services/bff-service/src/routes/dashboard.ts | grep -q "try {"`
- Verify Promise.allSettled present: `grep -q "Promise.allSettled" services/bff-service/src/routes/dashboard.ts`
</verification>

<success_criteria>

1. Dashboard route handler is declared as async function (not void async IIFE)
2. Top-level try-catch catches all errors and returns HTTP 502 BAD_GATEWAY
3. Individual service failures in Promise.allSettled are logged as warnings with requestId and service name
4. Partial success works: some services failing returns partial data (zeros for failed services)
5. All 7 fetchJson calls pass req.requestId (already present, verify unchanged)
6. Integration tests pass covering happy path, partial failure, and complete failure scenarios
   </success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-01-SUMMARY.md`
</output>
