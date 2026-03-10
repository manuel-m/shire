---
phase: 02-bff-error-handling
plan: 02a
type: execute
wave: 0
depends_on: []
files_modified:
  - services/bff-service/src/routes/engagements.integration.test.ts
autonomous: true
requirements:
  - ERR-03
  - ERR-06

must_haves:
  truths:
    - 'Integration test file exists for engagement detail error handling'
    - 'Tests cover service failures, partial success (sequential pattern), and request ID propagation'
    - 'Test file follows vitest + supertest conventions used in project'
  artifacts:
    - path: 'services/bff-service/src/routes/engagements.integration.test.ts'
      provides: 'Test scaffold for engagement detail error handling'
      min_lines: 40
  key_links: []
---

<objective>
Create integration test scaffold for engagement detail route error handling. This is a Wave 0 task that provides the test infrastructure before implementation begins.

Purpose: Tests must exist before implementation to enable TDD. This plan creates the test file with mocked service calls to verify sequential enrichment error handling (per-service try-catch satisfies ERR-05).

Output: Integration test file with 5+ test cases covering happy path, service failures, partial data return, and request ID propagation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-bff-error-handling/02-CONTEXT.md
@.planning/phases/02-bff-error-handling/02-RESEARCH.md
@services/bff-service/src/routes/engagements.ts
@services/bff-service/src/lib/service-client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create engagement detail integration test scaffold</name>
  <files>services/bff-service/src/routes/engagements.integration.test.ts</files>
  <action>
    Create integration test file using vitest and supertest. Mount engagementsRouter directly (import from services/bff-service/src/routes/engagements.ts).

    Write test cases that will verify the following behaviors once implementation is complete:
    1. Happy path: GET /api/engagements/:id returns engagement data with clientName when both services are healthy
    2. Partial success: GET /api/engagements/:id returns engagement data without clientName when client service fails
    3. Complete failure: GET /api/engagements/:id returns HTTP 502 when engagement service fails
    4. Request ID propagation: X-Request-Id header is passed to downstream services
    5. Warning logging: Failed client enrichment is logged with requestId

    Use vi.spyOn to mock fetchJson from services/bff-service/src/lib/service-client.ts to simulate:
    - Engagement service returning 200 with engagement data (including clientId)
    - Client service returning 200 with companyName
    - Client service failing (502, timeout, network error)

    Use vi.spyOn on console.log to verify log entries contain requestId for enrichment failures.

    Note: Tests will initially fail (RED state) because implementation is not yet refactored. This is expected TDD behavior.

  </action>
  <verify>
    <automated>test -f services/bff-service/src/routes/engagements.integration.test.ts</automated>
  </verify>
  <done>Integration test file created with 5+ test cases, imports engagementsRouter, mocks fetchJson via vi.spyOn</done>
</task>

</tasks>

<verification>
- File exists: `test -f services/bff-service/src/routes/engagements.integration.test.ts`
- File has test cases: `grep -c "describe\|it" services/bff-service/src/routes/engagements.integration.test.ts`
</verification>

<success_criteria>
Integration test scaffold created and ready for TDD implementation in Plan 03.
</success_criteria>

<output>
After completion, create `.planning/phases/02-bff-error-handling/02-bff-error-handling-02a-SUMMARY.md`
</output>
