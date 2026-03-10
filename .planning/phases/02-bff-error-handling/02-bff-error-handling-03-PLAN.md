---
phase: 02-bff-error-handling
plan: 03
type: execute
wave: 2
depends_on: []
files_modified:
  - services/bff-service/src/routes/engagements.integration.test.ts
  - services/bff-service/src/routes/engagements.ts
autonomous: true
requirements:
  - ERR-01
  - ERR-02
  - ERR-03
  - ERR-04
  - ERR-06

must_haves:
  truths:
    - 'Engagement detail endpoint returns HTTP 502 BAD_GATEWAY when engagement service fails'
    - 'Engagement endpoint returns engagement data without clientName when client service fails'
    - 'Failed client enrichment is logged as warning with error details and request ID'
    - 'Request ID is propagated to both engagement-service and client-service calls'
    - 'Engagement detail route handler uses async function (not void async IIFE)'
  artifacts:
    - path: 'services/bff-service/src/routes/engagements.integration.test.ts'
      provides: 'Integration tests for engagement detail error handling'
      min_lines: 40
    - path: 'services/bff-service/src/routes/engagements.ts'
      provides: 'Refactored engagement detail route with proper error handling'
      exports: ['engagementsRouter']
      contains: 'async (req: Request, res: Response)'
  key_links:
    - from: 'services/bff-service/src/routes/engagements.ts'
      to: 'services/bff-service/src/lib/service-client.ts'
      via: 'fetchJson calls with requestId'
      pattern: 'fetchJson.*req.requestId'
    - from: 'services/bff-service/src/routes/engagements.ts'
      to: 'console output (logs)'
      via: "log('warn', ...) for enrichment failures"
      pattern: "log\\('warn'.*requestId"
---

<objective>
Refactor engagement detail route to replace void async IIFE with top-level async handler and add proper error logging for client enrichment.

Purpose: Engagement detail currently uses `void (async () => { ... })()` with an empty catch block around client enrichment. Errors are silently suppressed. This refactoring ensures client enrichment failures are logged as warnings with request ID.

Output: Engagement detail route with async handler, try-catch with warning logs for enrichment failures, and integration tests.

Note: Sequential enrichment pattern (fetch engagement first, then enrich client) is intentional and per CONTEXT.md locked decision. Do not parallelize.
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
@services/bff-service/src/routes/engagements.ts
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
  <name>Task 1: Create engagement detail integration tests</name>
  <files>services/bff-service/src/routes/engagements.integration.test.ts</files>
  <behavior>
    - Test 1: GET /api/engagements/:id returns engagement data with clientName when both services are healthy
    - Test 2: GET /api/engagements/:id returns engagement data without clientName when client service fails
    - Test 3: GET /api/engagements/:id returns HTTP 502 when engagement service fails
    - Test 4: GET /api/engagements/:id logs warning for failed client enrichment
    - Test 5: GET /api/engagements/:id propagates X-Request-Id to both services
  </behavior>
  <action>
    Create integration test file using vitest and supertest. Mount engagementsRouter directly. Mock fetchJson to simulate:
    - Engagement service returning 200 with engagement data (including clientId)
    - Client service returning 200 with companyName
    - Client service failing (502, timeout, network error)

    Verify warning log contains requestId and error details for enrichment failures.

    Import from services/bff-service/src/routes/engagements.ts: engagementsRouter
    Import from services/bff-service/src/lib/service-client.ts: fetchJson (mock via vi.spyOn)
    Use vi.spyOn on console.log to verify log entries

  </action>
  <verify>
    <automated>pnpm --filter @shire/bff-service test:integration</automated>
  </verify>
  <done>Integration test file created with 5+ test cases covering error scenarios, tests pass after Task 2 implementation</done>
</task>

<task type="auto">
  <name>Task 2: Refactor engagement detail route with logging</name>
  <files>services/bff-service/src/routes/engagements.ts</files>
  <action>
    Refactor engagements.ts GET /:id route handler:

    1. Replace `void (async () => { ... })()` with top-level async handler:
       ```typescript
       engagementsRouter.get('/:id', async (req: Request, res: Response) => {
         try {
           // ... fetch engagement first, then enrich
         } catch (err) {
           log('error', 'Engagement detail request failed', {
             error: err instanceof Error ? err.message : 'Unknown error',
             requestId: req.requestId,
           });
           res.status(502).json({
             error: { code: 'BAD_GATEWAY', message: 'Engagement service unavailable' },
           });
         }
       });
       ```

    2. Keep sequential pattern (fetch engagement first, then enrich client) - this is intentional per CONTEXT.md

    3. Add createLogger import at top:
       ```typescript
       const { log } = createLogger(config.serviceName);
       ```

    4. Replace empty catch block with logging:
       ```typescript
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
       ```

    Per CONTEXT.md locked decision: Sequential enrichment pattern is correct (client depends on engagement), enrichment failures logged as warnings, per-service try-catch blocks.

  </action>
  <verify>
    <automated>grep -q "router.get.*async" services/bff-service/src/routes/engagements.ts && grep -q "try {" services/bff-service/src/routes/engagements.ts</automated>
  </verify>
  <done>Engagement detail route uses async handler with top-level try-catch, client enrichment failures logged as warnings with requestId, sequential pattern preserved</done>
</task>

</tasks>

<verification>
- Run integration tests: `pnpm --filter @shire/bff-service test:integration`
- Verify no void async IIFE: `grep -r "void (async" services/bff-service/src/routes/engagements.ts` (should be empty)
- Verify async handler: `grep "router.get.*async.*=>" services/bff-service/src/routes/engagements.ts`
- Verify warning log in enrichment catch block: `grep -A 10 "catch" services/bff-service/src/routes/engagements.ts | grep -q "log('warn'"`
</verification>

<success_criteria>

1. Engagement detail route handler is declared as async function
2. Top-level try-catch catches all errors and returns HTTP 502 with "Engagement service unavailable" message
3. Client enrichment failures are caught and logged as warnings with requestId and engagementId
4. Sequential pattern preserved (engagement fetched before client enrichment)
5. Engagement data is returned even when client enrichment fails (best-effort pattern)
6. Integration tests pass covering partial success and complete failure scenarios
   </success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-03-SUMMARY.md`
</output>
