---
phase: 02-bff-error-handling
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - services/bff-service/src/routes/clients.integration.test.ts
  - services/bff-service/src/routes/clients.ts
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
    - 'Client detail endpoint returns HTTP 502 BAD_GATEWAY when client service fails'
    - 'Client endpoint returns partial data (with engagementCount: 0) when engagement service fails'
    - 'Failed engagement enrichment is logged as warning with error details and request ID'
    - 'Request ID is propagated to both client-service and engagement-service calls'
    - 'Client detail route handler uses async function (not void async IIFE)'
  artifacts:
    - path: 'services/bff-service/src/routes/clients.integration.test.ts'
      provides: 'Integration tests for client detail error handling'
      min_lines: 40
    - path: 'services/bff-service/src/routes/clients.ts'
      provides: 'Refactored client detail route with proper error handling'
      exports: ['clientsRouter']
      contains: 'async (req: Request, res: Response)'
  key_links:
    - from: 'services/bff-service/src/routes/clients.ts'
      to: 'services/bff-service/src/lib/service-client.ts'
      via: 'fetchJson calls with requestId'
      pattern: 'fetchJson.*req.requestId'
    - from: 'services/bff-service/src/routes/clients.ts'
      to: 'console output (logs)'
      via: "log('warn', ...) for enrichment failures"
      pattern: "log\\('warn'.*requestId"
---

<objective>
Refactor client detail route to replace void async IIFE with top-level async handler, convert Promise.all to Promise.allSettled for partial success, and add proper error logging.

Purpose: Client detail currently uses `void (async () => { ... })()` with `Promise.all` which fails entire request when engagement enrichment fails. This refactoring ensures engagement service failures are logged as warnings and don't prevent returning client data.

Output: Client detail route with async handler, Promise.allSettled for partial success, warning logs for enrichment failures, and integration tests.
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
@services/bff-service/src/routes/clients.ts
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
  <name>Task 1: Create client detail integration tests</name>
  <files>services/bff-service/src/routes/clients.integration.test.ts</files>
  <behavior>
    - Test 1: GET /api/clients/:id returns client data with engagementCount when both services are healthy
    - Test 2: GET /api/clients/:id returns client data with engagementCount: 0 when engagement service fails
    - Test 3: GET /api/clients/:id returns HTTP 502 when client service fails
    - Test 4: GET /api/clients/:id logs warning for failed engagement enrichment
    - Test 5: GET /api/clients/:id propagates X-Request-Id to both services
  </behavior>
  <action>
    Create integration test file using vitest and supertest. Mount clientsRouter directly. Mock fetchJson to simulate:
    - Client service returning 200 with client data
    - Engagement service returning 200 with total count
    - Engagement service failing (502, timeout, network error)

    Verify warning log contains requestId and error details for enrichment failures.

    Import from services/bff-service/src/routes/clients.ts: clientsRouter
    Import from services/bff-service/src/lib/service-client.ts: fetchJson (mock via vi.spyOn)
    Use vi.spyOn on console.log to verify log entries

  </action>
  <verify>
    <automated>pnpm --filter @shire/bff-service test:integration</automated>
  </verify>
  <done>Integration test file created with 5+ test cases covering error scenarios, tests pass after Task 2 implementation</done>
</task>

<task type="auto">
  <name>Task 2: Refactor client detail route with Promise.allSettled</name>
  <files>services/bff-service/src/routes/clients.ts</files>
  <action>
    Refactor clients.ts GET /:id route handler:

    1. Replace `void (async () => { ... })()` with top-level async handler:
       ```typescript
       clientsRouter.get('/:id', async (req: Request, res: Response) => {
         try {
           // ... fetchJson logic with Promise.allSettled
         } catch (err) {
           log('error', 'Client detail request failed', {
             error: err instanceof Error ? err.message : 'Unknown error',
             requestId: req.requestId,
           });
           res.status(502).json({
             error: { code: 'BAD_GATEWAY', message: 'Client service unavailable' },
           });
         }
       });
       ```

    2. Replace Promise.all with Promise.allSettled:
       ```typescript
       const results = await Promise.allSettled([
         fetchJson(config.clientServiceUrl, `/clients/${clientId}`, auth, req.requestId),
         fetchJson<{ total?: number }>(
           config.engagementServiceUrl,
           `/engagements?clientId=${clientId}&limit=1`,
           auth,
           req.requestId,
         ),
       ]);
       ```

    3. Handle client fetch failure (critical path):
       ```typescript
       const clientResult = results[0];
       const engagementsResult = results[1];

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
       ```

    4. Handle engagement enrichment failure (best-effort):
       ```typescript
       const enriched = {
         ...(clientRes.data as object),
         engagementCount:
           engagementsResult.status === 'fulfilled' && engagementsResult.value.status === 200
             ? (engagementsResult.value.data.total ?? 0)
             : (() => {
                 if (engagementsResult.status === 'rejected') {
                   log('warn', 'Engagement enrichment failed', {
                     clientId,
                     error: engagementsResult.reason instanceof Error
                       ? engagementsResult.reason.message
                       : 'Unknown error',
                     requestId: req.requestId,
                   });
                 }
                 return 0;
               })(),
       };
       ```

    5. Import createLogger at top (add to existing import from '@shire/shared'):
       ```typescript
       const { log } = createLogger(config.serviceName);
       ```

    Per CONTEXT.md locked decision: Per-service try-catch blocks around each individual service call, individual services can fail without affecting other parallel calls, enrichment failures logged as warnings.

  </action>
  <verify>
    <automated>grep -q "router.get.*async" services/bff-service/src/routes/clients.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/clients.ts</automated>
  </verify>
  <done>Client detail route uses async handler, Promise.allSettled for parallel calls, engagement enrichment failures logged as warnings with requestId</done>
</task>

</tasks>

<verification>
- Run integration tests: `pnpm --filter @shire/bff-service test:integration`
- Verify no void async IIFE: `grep -r "void (async" services/bff-service/src/routes/clients.ts` (should be empty)
- Verify Promise.allSettled: `grep -q "Promise.allSettled" services/bff-service/src/routes/clients.ts`
- Verify async handler: `grep "router.get.*async.*=>" services/bff-service/src/routes/clients.ts`
</verification>

<success_criteria>

1. Client detail route handler is declared as async function
2. Promise.allSettled used for parallel client and engagement fetches
3. Client service failure returns HTTP 502 with "Client service unavailable" message
4. Engagement service failure logs warning but returns client data with engagementCount: 0
5. All error logs include requestId
6. Integration tests pass covering partial success and complete failure scenarios
   </success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-02-SUMMARY.md`
</output>
