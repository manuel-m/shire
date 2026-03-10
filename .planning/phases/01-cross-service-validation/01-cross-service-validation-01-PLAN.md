---
phase: 01-cross-service-validation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - services/client-service/src/engagement-check.ts
  - services/client-service/src/config.ts
autonomous: true
requirements: [VAL-01, VAL-03, VAL-04, VAL-05, VAL-06, VAL-07]

must_haves:
  truths:
    - "User cannot delete a client that has active engagements"
    - "Validation failures return HTTP 422 with ACTIVE_ENGAGEMENTS error code"
    - "Validation failures are logged with request ID tracing"
    - "HTTP validation calls include 5-second timeout"
    - "Validation handles engagement-service unavailability gracefully (fails open)"
  artifacts:
    - path: "services/client-service/src/engagement-check.ts"
      provides: "Active engagement validation function"
      min_lines: 30
    - path: "services/client-service/src/config.ts"
      provides: "engagementServiceUrl configuration"
      exports: ["engagementServiceUrl"]
  key_links:
    - from: "services/client-service/src/routes/clients.ts"
      to: "services/client-service/src/engagement-check.ts"
      via: "import * as engagementCheck"
      pattern: "checkActiveEngagements"
    - from: "services/client-service/src/engagement-check.ts"
      to: "http://engagement-service:3003"
      via: "fetch with AbortController timeout"
      pattern: "AbortController.*5000"
---

<objective>
Implement client deletion validation to prevent deleting clients with active engagements.

Purpose: Data integrity - stop orphaned engagement records when clients are deleted. Currently stubbed to always return false, allowing destructive operations.
Output: Working HTTP-based validation function with timeout, logging, and fail-open behavior.
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
  <name>Task 1: Add engagementServiceUrl to client-service config</name>
  <files>services/client-service/src/config.ts</files>
  <behavior>
    - Test 1: engagementServiceUrl config value is defined
    - Test 2: engagementServiceUrl points to engagement-service:3003
  </behavior>
  <action>Add engagementServiceUrl to config.ts following the same pattern as jwtSecret and serviceName. Use Docker Compose service name: http://engagement-service:3003. This allows engagement-check.ts to make HTTP calls to engagement-service.</action>
  <verify>pnpm --filter @shire/client-service type-check passes without errors</verify>
  <done>engagementServiceUrl exported from config.ts with correct URL</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement checkActiveEngagements with HTTP call to engagement-service</name>
  <files>services/client-service/src/engagement-check.ts</files>
  <behavior>
    - Test 1: Returns false when engagement-service is unavailable (catch block)
    - Test 2: Returns false when HTTP response is not ok (5xx, network error)
    - Test 3: Returns true when engagement-service returns at least one engagement for clientId
    - Test 4: Returns false when engagement-service returns empty array
    - Test 5: HTTP call includes 5-second timeout via AbortController
    - Test 6: Logs error when fetch fails (includes request ID)
  </behavior>
  <action>Replace stubbed checkActiveEngagements function with real implementation:
1. Import config for engagementServiceUrl and createLogger
2. Create logger with 'client-service' serviceName
3. Implement with AbortController for 5-second timeout
4. Call GET /engagements?clientId={id} to check for active engagements
5. Return true if data.length > 0, false otherwise
6. On any error (timeout, 5xx, network): log error with request ID and return false (fail-open)
7. DO NOT throw errors - always return boolean for graceful degradation

Follow the exact pattern from engagement-service/src/client-check.ts but for the use case of checking active engagements (count > 0).</action>
  <verify>pnpm --filter @shire/client-service type-check passes; grep -q "AbortController" services/client-service/src/engagement-check.ts</verify>
  <done>checkActiveEngagements makes real HTTP call with timeout and fail-open handling</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete client deletion validation implementation (config + engagement-check.ts)</what-built>
  <how-to-verify>
1. Start services: docker-compose up client-service engagement-service
2. Create a test client via POST /clients
3. Create an engagement for that client via POST /engagements
4. Attempt to delete the client via DELETE /clients/{id}
5. Expected: 409 Conflict with error code ACTIVE_ENGAGEMENTS
6. Delete the engagement first, then delete client
7. Expected: 204 No Content (delete succeeds)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
Integration tests already exist in services/client-service/src/routes/clients.integration.test.ts (lines 418-436). These tests mock checkActiveEngagements. After implementation, verify:
1. Existing tests still pass (they use mocks)
2. Manual verification shows HTTP calls work (as described in checkpoint)
</verification>

<success_criteria>
1. Deleting a client with engagements returns 422 with ACTIVE_ENGAGEMENTS error code
2. Deleting a client without engagements succeeds (204)
3. HTTP calls timeout after 5 seconds
4. Engagement-service unavailability logs error and allows deletion (fail-open)
5. All type checks pass
</success_criteria>

<output>
After completion, create `.planning/phases/01-cross-service-validation/01-cross-service-validation-01-SUMMARY.md`
</output>
