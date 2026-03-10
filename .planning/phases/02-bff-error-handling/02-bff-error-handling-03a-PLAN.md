---
phase: 02-bff-error-handling
plan: 03a
type: execute
wave: 0
depends_on: []
files_modified:
  - services/bff-service/src/routes/reports.integration.test.ts
autonomous: true
requirements:
  - ERR-03
  - ERR-04
  - ERR-05
  - ERR-06

must_haves:
  truths:
    - 'Integration test file exists for report detail error handling'
    - 'Tests cover service failures, partial success, Promise.allSettled behavior, and request ID propagation'
    - 'Test file follows vitest + supertest conventions used in project'
  artifacts:
    - path: 'services/bff-service/src/routes/reports.integration.test.ts'
      provides: 'Test scaffold for report detail error handling'
      min_lines: 40
  key_links: []
---

<objective>
Create integration test scaffold for report detail route error handling. This is a Wave 0 task that provides the test infrastructure before implementation begins.

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
@services/bff-service/src/routes/reports.ts
@services/bff-service/src/lib/service-client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create report detail integration test scaffold</name>
  <files>services/bff-service/src/routes/reports.integration.test.ts</files>
  <action>
    Create integration test file using vitest and supertest. Mount reportsRouter directly (import from services/bff-service/src/routes/reports.ts).

    Write test cases that will verify the following behaviors once implementation is complete:
    1. Happy path: GET /api/reports/:id returns report data with clientName and engagementDescription when all services are healthy
    2. Partial success (client only): GET /api/reports/:id returns report data with only clientName when engagement service fails
    3. Partial success (neither): GET /api/reports/:id returns report data without enrichment when both services fail
    4. Complete failure: GET /api/reports/:id returns HTTP 502 when report service fails
    5. Request ID propagation: X-Request-Id header is passed to downstream services
    6. Warning logging: Failed enrichment attempts are logged with requestId

    Use vi.spyOn to mock fetchJson from services/bff-service/src/lib/service-client.ts to simulate:
    - Report service returning 200 with report data (including clientId, engagementId)
    - Client service returning 200 with companyName
    - Engagement service returning 200 with description
    - Individual enrichment services failing (502, timeout)

    Use vi.spyOn on console.log to verify log entries contain requestId for enrichment failures.

    Note: Tests will initially fail (RED state) because implementation is not yet refactored. This is expected TDD behavior.

  </action>
  <verify>
    <automated>test -f services/bff-service/src/routes/reports.integration.test.ts</automated>
  </verify>
  <done>Integration test file created with 6+ test cases, imports reportsRouter, mocks fetchJson via vi.spyOn</done>
</task>

</tasks>

<verification>
- File exists: `test -f services/bff-service/src/routes/reports.integration.test.ts`
- File has test cases: `grep -c "describe\|it" services/bff-service/src/routes/reports.integration.test.ts`
</verification>

<success_criteria>
Integration test scaffold created and ready for TDD implementation in Plan 04.
</success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-03a-SUMMARY.md`
</output>
