---
phase: 02-bff-error-handling
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - services/bff-service/src/routes/dashboard.integration.test.ts
autonomous: true
requirements:
  - ERR-03
  - ERR-04
  - ERR-06

must_haves:
  truths:
    - 'Integration test file exists for dashboard error handling'
    - 'Tests cover service failures, partial success, and request ID propagation'
    - 'Test file follows vitest + supertest conventions used in project'
  artifacts:
    - path: 'services/bff-service/src/routes/dashboard.integration.test.ts'
      provides: 'Test scaffold for dashboard error handling'
      min_lines: 40
  key_links: []
---

<objective>
Create integration test scaffold for dashboard route error handling. This is a Wave 0 task that provides the test infrastructure before implementation begins.

Purpose: Tests must exist before implementation to enable TDD. This plan creates the test file with mocked service calls to verify error handling behavior.

Output: Integration test file with 5+ test cases covering happy path, partial failures, complete failure, and request ID propagation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-bff-error-handling/02-CONTEXT.md
@.planning/phases/02-bff-error-handling/02-RESEARCH.md
@services/bff-service/src/routes/dashboard.ts
@services/bff-service/src/lib/service-client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create dashboard integration test scaffold</name>
  <files>services/bff-service/src/routes/dashboard.integration.test.ts</files>
  <action>
    Create integration test file using vitest and supertest. Mount dashboardRouter directly (import from services/bff-service/src/routes/dashboard.ts).

    Write test cases that will verify the following behaviors once implementation is complete:
    1. Happy path: GET /api/dashboard returns aggregated data when all services are healthy
    2. Partial success: GET /api/dashboard returns partial data when some services fail
    3. Complete failure: GET /api/dashboard returns HTTP 502 when all services fail
    4. Request ID propagation: X-Request-Id header is passed to downstream services
    5. Warning logging: Failed service aggregations are logged with requestId

    Use vi.spyOn to mock fetchJson from services/bff-service/src/lib/service-client.ts to simulate service responses and failures.

    Note: Tests will initially fail (RED state) because implementation is not yet refactored. This is expected TDD behavior.

  </action>
  <verify>
    <automated>test -f services/bff-service/src/routes/dashboard.integration.test.ts</automated>
  </verify>
  <done>Integration test file created with 5+ test cases, imports dashboardRouter, mocks fetchJson via vi.spyOn</done>
</task>

</tasks>

<verification>
- File exists: `test -f services/bff-service/src/routes/dashboard.integration.test.ts`
- File has test cases: `grep -c "describe\|it" services/bff-service/src/routes/dashboard.integration.test.ts`
</verification>

<success_criteria>
Integration test scaffold created and ready for TDD implementation in Plan 01.
</success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-00-SUMMARY.md`
</output>
