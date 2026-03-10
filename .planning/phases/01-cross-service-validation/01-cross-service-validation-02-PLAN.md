---
phase: 01-cross-service-validation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - services/engagement-service/src/report-invoice-check.ts
  - services/engagement-service/src/config.ts
autonomous: true
requirements: [VAL-02, VAL-03, VAL-04, VAL-05, VAL-06, VAL-07]

must_haves:
  truths:
    - "User cannot delete an engagement that has reports or invoices"
    - "Validation failures return HTTP 409 with HAS_ASSOCIATED_RECORDS error code"
    - "Validation failures are logged with request ID tracing"
    - "HTTP validation calls include 5-second timeout"
    - "Validation handles downstream service unavailability gracefully (fails open)"
  artifacts:
    - path: "services/engagement-service/src/report-invoice-check.ts"
      provides: "Report and invoice validation function"
      min_lines: 50
    - path: "services/engagement-service/src/config.ts"
      provides: "reportServiceUrl and billingServiceUrl configuration"
      exports: ["reportServiceUrl", "billingServiceUrl"]
  key_links:
    - from: "services/engagement-service/src/routes/engagements.ts"
      to: "services/engagement-service/src/report-invoice-check.ts"
      via: "import * as reportInvoiceCheck"
      pattern: "checkAssociatedReportsOrInvoices"
    - from: "services/engagement-service/src/report-invoice-check.ts"
      to: "http://report-service:3004, http://billing-service:3005"
      via: "fetch with AbortController timeout"
      pattern: "AbortController.*5000"
---

<objective>
Implement engagement deletion validation to prevent deleting engagements with associated reports or invoices.

Purpose: Data integrity - stop orphaned report and invoice records when engagements are deleted. Currently stubbed to always return false, allowing destructive operations.
Output: Working HTTP-based validation function with timeout, logging, and fail-open behavior for both report-service and billing-service.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@services/engagement-service/src/client-check.ts
@.planning/research/SUMMARY.md
</context>

<interfaces>
<!-- Working pattern from engagement-service/src/client-check.ts - follow this structure -->
From services/engagement-service/src/client-check.ts:
```typescript
import { config } from './config.js';

export async function validateClient(
  clientId: string,
  authToken: string,
): Promise<{ exists: boolean; hasCodeCredentials: boolean }> {
  try {
    const res = await fetch(`${config.clientServiceUrl}/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status === 404) {
      return { exists: false, hasCodeCredentials: false };
    }
    if (!res.ok) {
      return { exists: false, hasCodeCredentials: false };
    }
    // Additional credential checks...
    return { exists: true, hasCodeCredentials };
  } catch {
    return { exists: false, hasCodeCredentials: false }; // Fail safe
  }
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add reportServiceUrl and billingServiceUrl to engagement-service config</name>
  <files>services/engagement-service/src/config.ts</files>
  <behavior>
    - Test 1: reportServiceUrl config value is defined
    - Test 2: reportServiceUrl points to report-service:3004
    - Test 3: billingServiceUrl config value is defined
    - Test 4: billingServiceUrl points to billing-service:3005
  </behavior>
  <action>Add reportServiceUrl and billingServiceUrl to config.ts following the same pattern as clientServiceUrl. Use Docker Compose service names: http://report-service:3004 and http://billing-service:3005. This allows report-invoice-check.ts to make HTTP calls to both services.</action>
  <verify>pnpm --filter @shire/engagement-service type-check passes without errors</verify>
  <done>reportServiceUrl and billingServiceUrl exported from config.ts with correct URLs</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement checkAssociatedReportsOrInvoices with parallel HTTP calls</name>
  <files>services/engagement-service/src/report-invoice-check.ts</files>
  <behavior>
    - Test 1: Returns false when both report-service and billing-service are unavailable
    - Test 2: Returns true when report-service returns at least one report
    - Test 3: Returns true when billing-service returns at least one invoice
    - Test 4: Returns false when both services return empty arrays
    - Test 5: HTTP calls include 5-second timeout via AbortController
    - Test 6: Logs errors when fetch fails (includes request ID)
    - Test 7: Uses Promise.allSettled to handle partial failures
  </behavior>
  <action>Replace stubbed checkAssociatedReportsOrInvoices function with real implementation:
1. Import config for both service URLs and createLogger
2. Create logger with 'engagement-service' serviceName
3. Implement two parallel checks using Promise.allSettled:
   - Call GET /reports?engagementId={id} to check for reports
   - Call GET /invoices?engagementId={id} to check for invoices
4. Each fetch uses AbortController with 5-second timeout
5. Return true if EITHER reports > 0 OR invoices > 0 (OR logic)
6. On any error (timeout, 5xx, network): log error with request ID but continue checking other service
7. If both calls fail: return false (fail-open - allow deletion if we can't verify)
8. DO NOT throw errors - always return boolean for graceful degradation

Note: The current route uses HTTP 409 for HAS_ASSOCIATED_RECORDS. The validation function returns boolean; the route handler converts to HTTP response.</action>
  <verify>pnpm --filter @shire/engagement-service type-check passes; grep -q "AbortController" services/engagement-service/src/report-invoice-check.ts; grep -q "Promise.allSettled" services/engagement-service/src/report-invoice-check.ts</verify>
  <done>checkAssociatedReportsOrInvoices makes parallel HTTP calls with timeout and fail-open handling</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete engagement deletion validation implementation (config + report-invoice-check.ts)</what-built>
  <how-to-verify>
1. Start services: docker-compose up engagement-service report-service billing-service
2. Create a test engagement via POST /engagements (with valid clientId)
3. Create a report for that engagement via POST /reports
4. Attempt to delete the engagement via DELETE /engagements/{id}
5. Expected: 409 Conflict with error code HAS_ASSOCIATED_RECORDS
6. Delete the report first, then delete engagement
7. Expected: 204 No Content (delete succeeds)
8. Verify billing-service validation works similarly
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
Integration tests already exist in services/engagement-service/src/routes/engagements.integration.test.ts (lines 423-438). These tests mock checkAssociatedReportsOrInvoices. After implementation, verify:
1. Existing tests still pass (they use mocks)
2. Manual verification shows HTTP calls work (as described in checkpoint)
</verification>

<success_criteria>
1. Deleting an engagement with reports returns 409 with HAS_ASSOCIATED_RECORDS error code
2. Deleting an engagement with invoices returns 409 with HAS_ASSOCIATED_RECORDS error code
3. Deleting an engagement without reports or invoices succeeds (204)
4. HTTP calls timeout after 5 seconds
5. Downstream service unavailability logs error and allows deletion (fail-open)
6. All type checks pass
</success_criteria>

<output>
After completion, create `.planning/phases/01-cross-service-validation/01-cross-service-validation-02-SUMMARY.md`
</output>
