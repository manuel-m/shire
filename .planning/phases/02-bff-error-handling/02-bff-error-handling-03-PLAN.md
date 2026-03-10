---
phase: 02-bff-error-handling
plan: 03
type: execute
wave: 2
depends_on: ['02a']
files_modified:
  - services/bff-service/src/routes/engagements.ts
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
    - 'Engagement detail endpoint returns HTTP 502 BAD_GATEWAY when engagement service fails'
    - 'Engagement endpoint returns engagement data without clientName when client service fails'
    - 'Failed client enrichment is logged as warning with error details and request ID'
    - 'Request ID is propagated to both engagement-service and client-service calls'
    - 'Engagement detail route handler uses async function (not void async IIFE)'
  artifacts:
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

Output: Engagement detail route with async handler, try-catch with warning logs for enrichment failures. Integration tests created in Wave 0 Plan 02a will verify behavior.

Note: Sequential enrichment pattern (fetch engagement first, then enrich client) is intentional and per CONTEXT.md locked decision. Do not parallelize. ERR-05 satisfied via per-service try-catch (sequential pattern is equivalent error handling).

Note: Integration test file created in Plan 02a (Wave 0). This plan only modifies engagements.ts implementation.
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

<task type="auto">
  <name>Task 1: Refactor engagement detail route with logging</name>
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

       // Enrich with client name - best-effort but logged (satisfies ERR-05)
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

    Per CONTEXT.md locked decision: Sequential enrichment pattern is correct (client depends on engagement), enrichment failures logged as warnings, per-service try-catch blocks. ERR-05 satisfied via individual service try-catch handling (sequential pattern equivalent to Promise.allSettled for error handling).

  </action>
  <verify>
    <automated>grep -q "router.get.*async" services/bff-service/src/routes/engagements.ts && grep -q "try {" services/bff-service/src/routes/engagements.ts</automated>
  </verify>
  <done>Engagement detail route uses async handler with top-level try-catch, client enrichment failures logged as warnings with requestId, sequential pattern preserved, ERR-05 satisfied via per-service error handling</done>
</task>

</tasks>

<verification>
- Run integration tests (created in Plan 02a): `pnpm --filter @shire/bff-service test:integration`
- Verify no void async IIFE: `grep -r "void (async" services/bff-service/src/routes/engagements.ts` (should be empty)
- Verify async handler: `grep "router.get.*async.*=>" services/bff-service/src/routes/engagements.ts`
- Verify warning log in enrichment catch block: `grep -A 10 "catch" services/bff-service/src/routes/engagements.ts | grep -q "log('warn'"`
</verification>

<success_criteria>

1. Engagement detail route handler is declared as async function
2. Top-level try-catch catches all errors and returns HTTP 502 with "Engagement service unavailable" message
3. Client enrichment failures are caught and logged as warnings with requestId and engagementId (satisfies ERR-05 via per-service try-catch)
4. Sequential pattern preserved (engagement fetched before client enrichment)
5. Engagement data is returned even when client enrichment fails (best-effort pattern)
6. Integration tests (created in Plan 02a) pass covering partial success and complete failure scenarios
   </success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-03-SUMMARY.md`
</output>
