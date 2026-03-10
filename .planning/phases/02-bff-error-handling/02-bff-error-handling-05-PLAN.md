---
phase: 02-bff-error-handling
plan: 05
type: execute
wave: 2
depends_on: ['04a']
files_modified:
  - services/bff-service/src/routes/invoices.ts
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
    - 'Invoice detail endpoint returns HTTP 502 BAD_GATEWAY when billing service fails'
    - 'Invoice endpoint returns partial data (without clientName/engagementDescription) when enrichment services fail'
    - 'Failed enrichment attempts are logged as warnings with error details and request ID'
    - 'Request ID is propagated to billing, client, and engagement services'
    - 'Invoice detail route handler uses async function (not void async IIFE)'
  artifacts:
    - path: 'services/bff-service/src/routes/invoices.ts'
      provides: 'Refactored invoice detail route with proper error handling'
      exports: ['invoicesRouter']
      contains: 'async (req: Request, res: Response)'
  key_links:
    - from: 'services/bff-service/src/routes/invoices.ts'
      to: 'services/bff-service/src/lib/service-client.ts'
      via: 'fetchJson calls with requestId'
      pattern: 'fetchJson.*req.requestId'
    - from: 'services/bff-service/src/routes/invoices.ts'
      to: 'console output (logs)'
      via: "log('warn', ...) for enrichment failures"
      pattern: "log\\('warn'.*requestId"
---

<objective>
Refactor invoice detail route to replace void async IIFE with top-level async handler, convert Promise.all to Promise.allSettled for parallel enrichment, and add proper error logging.

Purpose: Invoice detail currently uses `void (async () => { ... })()` with `Promise.all` and empty catch block around enrichment. Parallel enrichment fails silently. This refactoring ensures enrichment failures are logged as warnings and partial data is returned.

Output: Invoice detail route with async handler, Promise.allSettled for parallel enrichment, warning logs for failures. Integration tests created in Wave 0 Plan 04a will verify behavior.

Note: Integration test file created in Plan 04a (Wave 0). This plan only modifies invoices.ts implementation.
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
@services/bff-service/src/routes/invoices.ts
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
  <name>Task 1: Refactor invoice detail route with Promise.allSettled</name>
  <files>services/bff-service/src/routes/invoices.ts</files>
  <action>
    Refactor invoices.ts GET /:id route handler:

    1. Replace `void (async () => { ... })()` with top-level async handler:
       ```typescript
       invoicesRouter.get('/:id', async (req: Request, res: Response) => {
         try {
           // ... fetch invoice first, then parallel enrichment
         } catch (err) {
           log('error', 'Invoice detail request failed', {
             error: err instanceof Error ? err.message : 'Unknown error',
             requestId: req.requestId,
           });
           res.status(502).json({
             error: { code: 'BAD_GATEWAY', message: 'Billing service unavailable' },
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
       const invoice = invoiceRes.data as Record<string, unknown>;

       const results = await Promise.allSettled([
         fetchJson<{ companyName?: string }>(
           config.clientServiceUrl,
           `/clients/${String(invoice.clientId)}`,
           auth,
           req.requestId,
         ),
         fetchJson<{ description?: string }>(
           config.engagementServiceUrl,
           `/engagements/${String(invoice.engagementId)}`,
           auth,
           req.requestId,
         ),
       ]);

       const clientResult = results[0];
       const engagementResult = results[1];

       if (clientResult.status === 'fulfilled' && clientResult.value.status === 200) {
         invoice.clientName = clientResult.value.data.companyName;
       } else if (clientResult.status === 'rejected') {
         log('warn', 'Client enrichment failed for invoice', {
           invoiceId: id,
           clientId: invoice.clientId,
           error: clientResult.reason instanceof Error
             ? clientResult.reason.message
             : 'Unknown error',
           requestId: req.requestId,
         });
       }

       if (engagementResult.status === 'fulfilled' && engagementResult.value.status === 200) {
         invoice.engagementDescription = engagementResult.value.data.description;
       } else if (engagementResult.status === 'rejected') {
         log('warn', 'Engagement enrichment failed for invoice', {
           invoiceId: id,
           engagementId: invoice.engagementId,
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
    <automated>grep -q "router.get.*async" services/bff-service/src/routes/invoices.ts && grep -q "Promise.allSettled" services/bff-service/src/routes/invoices.ts</automated>
  </verify>
  <done>Invoice detail route uses async handler, Promise.allSettled for parallel enrichment, enrichment failures logged as warnings with requestId</done>
</task>

</tasks>

<verification>
- Run integration tests (created in Plan 04a): `pnpm --filter @shire/bff-service test:integration`
- Verify no void async IIFE: `grep -r "void (async" services/bff-service/src/routes/invoices.ts` (should be empty)
- Verify Promise.allSettled: `grep -q "Promise.allSettled" services/bff-service/src/routes/invoices.ts`
- Verify async handler: `grep "router.get.*async.*=>" services/bff-service/src/routes/invoices.ts`
</verification>

<success_criteria>

1. Invoice detail route handler is declared as async function
2. Promise.allSettled used for parallel client and engagement enrichment
3. Billing service failure returns HTTP 502 with "Billing service unavailable" message
4. Client enrichment failure logs warning but doesn't prevent engagement enrichment
5. Engagement enrichment failure logs warning independently of client enrichment
6. Integration tests (created in Plan 04a) pass covering partial success scenarios
   </success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-05-SUMMARY.md`
</output>
