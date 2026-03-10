---
phase: 02-bff-error-handling
plan: 01a
type: execute
wave: 0
depends_on: []
files_modified:
  - services/bff-service/src/routes/clients.integration.test.ts
autonomous: true
requirements:
  - ERR-03
  - ERR-04
  - ERR-05
  - ERR-06

must_haves:
  truths:
    - 'Integration test file exists for client detail error handling'
    - 'Tests cover service failures, partial success, Promise.allSettled behavior, and request ID propagation'
    - 'Test file follows vitest + supertest conventions used in project'
  artifacts:
    - path: 'services/bff-service/src/routes/clients.integration.test.ts'
      provides: 'Test scaffold for client detail error handling'
      min_lines: 40
  key_links: []
---

<objective>
Create integration test scaffold for client detail route error handling. This is a Wave 0 task that provides the test infrastructure before implementation begins.

Purpose: Tests must exist before implementation to enable TDD. This plan creates the test file with mocked service calls to verify Promise.allSettled partial success behavior.

Output: Integration test file with 5+ test cases covering happy path, service failures, partial data return, and request ID propagation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-bff-error-handling/02-CONTEXT.md
@.planning/phases/02-bff-error-handling/02-RESEARCH.md
@services/bff-service/src/routes/clients.ts
@services/bff-service/src/lib/service-client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create client detail integration test scaffold</name>
  <files>services/bff-service/src/routes/clients.integration.test.ts</files>
  <action>
    Create integration test file using vitest and supertest. Mount clientsRouter directly (import from services/bff-service/src/routes/clients.ts).

    Write test cases that will verify the following behaviors once implementation is complete:
    1. Happy path: GET /api/clients/:id returns client data with engagementCount when both services are healthy
    2. Partial success: GET /api/clients/:id returns client data with engagementCount: 0 when engagement service fails
    3. Complete failure: GET /api/clients/:id returns HTTP 502 when client service fails
    4. Request ID propagation: X-Request-Id header is passed to downstream services
    5. Warning logging: Failed engagement enrichment is logged with requestId

    Use vi.spyOn to mock fetchJson from services/bff-service/src/lib/service-client.ts to simulate:
    - Client service returning 200 with client data
    - Engagement service returning 200 with total count
    - Engagement service failing (502, timeout, network error)

    Use vi.spyOn on console.log to verify log entries contain requestId for enrichment failures.

    Note: Tests will initially fail (RED state) because implementation is not yet refactored. This is expected TDD behavior.

  </action>
  <verify>
    <automated>test -f services/bff-service/src/routes/clients.integration.test.ts</automated>
  </verify>
  <done>Integration test file created with 5+ test cases, imports clientsRouter, mocks fetchJson via vi.spyOn</done>
</task>

</tasks>

<verification>
- File exists: `test -f services/bff-service/src/routes/clients.integration.test.ts`
- File has test cases: `grep -c "describe\|it" services/bff-service/src/routes/clients.integration.test.ts`
</verification>

<success_criteria>
Integration test scaffold created and ready for TDD implementation in Plan 02.
</success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-01a-SUMMARY.md`
</output>
