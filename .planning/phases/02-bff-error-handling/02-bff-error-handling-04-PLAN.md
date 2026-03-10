---
phase: 02-bff-error-handling
plan: 04
type: execute
wave: 2
depends_on: []
files_modified:
  - services/bff-service/src/routes/reports.integration.test.ts
  - services/bff-service/src/routes/reports.ts
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
    - 'Report detail endpoint returns HTTP 502 BAD_GATEWAY when report service fails'
    - 'Report endpoint returns partial data (without clientName/engagementDescription) when enrichment services fail'
    - 'Failed enrichment attempts are logged as warnings with error details and request ID'
    - 'Request ID is propagated to report, client, and engagement services'
    - 'Report detail route handler uses async function (not void async IIFE)'
  artifacts:
    - path: 'services/bff-service/src/routes/reports.integration.test.ts'
      provides: 'Integration tests for report detail error handling'
      min_lines: 40
    - path: 'services/bff-service/src/routes/reports.ts'
      provides: 'Refactored report detail route with proper error handling'
      exports: ['reportsRouter']
      contains: 'async (req: Request, res: Response)'
  key_links:
    - from: 'services/bff-service/src/routes/reports.ts'
      to: 'services/bff-service/src/lib/service-client.ts'
      via: 'fetchJson calls with requestId'
      pattern: 'fetchJson.*req.requestId'
    - from: 'services/bff-service/src/routes/reports.ts'
      to: 'console output (logs)'
      via: "log('warn', ...) for enrichment failures"
      pattern: "log\\('warn'.*requestId"
---

<objective>
Refactor report detail route to replace void async IIFE with top-level async handler, convert Promise.all to Promise.allSettled for parallel enrichment, and add proper error logging.

Purpose: Report detail currently uses `void (async () => { ... })()` with `Promise.all` and empty catch block around enrichment. Parallel enrichment fails silently. This refactoring ensures enrichment failures are logged as warnings and partial data is returned.

Output: Report detail route with async handler, Promise.allSettled for parallel enrichment, warning logs for failures, and integration tests.
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
@services/bff-service/src/routes/reports.ts
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
  <name>Task 1: Create report detail integration tests</name>
  <files>services/bff-service/src/routes/reports.integration.test.ts</files>
  <behavior>
    - Test 1: GET /api/reports/:id returns report data with clientName and engagementDescription when all services are healthy
    - Test 2: GET /api/reports/:id returns report data with only clientName when engagement service fails
    - Test 3: GET /api/reports/:id returns report data without enrichment when both services fail
    - Test 4: GET /api/reports/:id returns HTTP 502 when report service fails
    - Test 5: GET /api/reports/:id logs warnings for failed enrichment
  </behavior>
  <action>
    Create integration test file using vitest and supertest. Mount reportsRouter directly. Mock fetchJson to simulate:
    - Report service returning 200 with report data (including clientId, engagementId)
    - Client service returning 200 with companyName
    - Engagement service returning 200 with description
    - Individual enrichment services failing (502, timeout)

    Verify warning logs contain requestId and error details.

    Import from services/bff-service/src/routes/reports.ts: reportsRouter
    Import from services/bff-service/src/lib/service-client.ts: fetchJson (mock via vi.spyOn)
    Use vi.spyOn on console.log to verify log entries

  </action>
  <verify>
    <automated>pnpm --filter @shire/bff-service test:integration</automated>
  </verify>
  <done>Integration test file created with 5+ test cases covering error scenarios, tests pass after Task 2 implementation</done>
</task>

<task type="auto">
  <name>Task 2: Refactor report detail route with Promise.allSettled</name>
  <files>services/bff-service/src/routes/reports.ts</files>
  <action>
    Refactor reports.ts GET /:id route handler:

    1. Replace `void (async () => { ... })()` with top-level async handler:
       ```typescript
       reportsRouter.get('/:id', async (req: Request, res: Response) => {
         try {
           // ... fetch report first, then parallel enrichment
         } catch (err) {
           log('error', 'Report detail request failed', {
             error: err instanceof Error ? err.message : 'Unknown error',
             requestId: req.requestId,
           });
           res.status(502).json({
             error: { code: 'BAD_GATEWAY', message: 'Report service unavailable' },
           });
         }
       });
       ```

    2. Add createLogger import at top:
       ```typescript
       const { log } = createLogger(config.serviceName);
       ```

    3. Replace Promise.all with Promise.allSettled in enrichment:
       ```typescript
       const report = reportRes.data as Record<string, unknown>;

       const results = await Promise.allSettled([
         fetchJson<{ companyName?: string }>(
           config.clientServiceUrl,
           `/clients/${String(report.clientId)}`,
           auth,
           req.requestId,
         ),
         fetchJson<{ description?: string }>(
           config.engagementServiceUrl,
           `/engagements/${String(report.engagementId)}`,
           auth,
           req.requestId,
         ),
       ]);

       const clientResult = results[0];
       const engagementResult = results[1];

       if (clientResult.status === 'fulfilled' && clientResult.value.status === 200) {
         report.clientName = clientResult.value.data.companyName;
       } else if (clientResult.status === 'rejected') {
         log('warn', 'Client enrichment failed for report', {
           reportId: id,
           clientId: report.clientId,
           error: clientResult.reason instanceof Error
             ? clientResult.reason.message
             : 'Unknown error',
           requestId: req.requestId,
         });
       }

       if (engagementResult.status === 'fulfilled' && engagementResult.value.status === 200) {
         report.engagementDescription = engagementResult.value.data.description;
       } else if (engagementResult.status === 'rejected') {
         log('warn', 'Engagement enrichment failed for report', {
           reportId: id,
           engagementId: report.engagementId,
           error: engagementResult.reason instanceof Error
             ? engagementResult.reason.message
             : 'Unknown error',
           requestId: req.requestId,
         });
       }
       ```

    Per CONTEXT.md locked decision: Promise.allSettled for parallel enrichment, per-service error handling, enrichment failures logged as warnings.

  </action>
  <verify>
    <automated>grep -q "router.get.*async" services/bff-service/src/routes/reports.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/reports.ts</automated>
  </verify>
  <done>Report detail route uses async handler, Promise.allSettled for parallel enrichment, enrichment failures logged as warnings with requestId</done>
</task>

</tasks>

<verification>
- Run integration tests: `pnpm --filter @shire/bff-service test:integration`
- Verify no void async IIFE: `grep -r "void (async" services/bff-service/src/routes/reports.ts` (should be empty)
- Verify Promise.allSettled: `grep -q "Promise.allSettled" services/bff-service/src/routes/reports.ts`
- Verify async handler: `grep "router.get.*async.*=>" services/bff-service/src/routes/reports.ts`
</verification>

<success_criteria>

1. Report detail route handler is declared as async function
2. Promise.allSettled used for parallel client and engagement enrichment
3. Report service failure returns HTTP 502 with "Report service unavailable" message
4. Client enrichment failure logs warning but doesn't prevent engagement enrichment
5. Engagement enrichment failure logs warning independently of client enrichment
6. Integration tests pass covering partial success scenarios
   </success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-04-SUMMARY.md`
</output>
