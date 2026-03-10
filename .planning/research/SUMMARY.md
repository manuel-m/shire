# Project Research Summary

**Project:** Tech Debt Cleanup - Cross-Service Validation, BFF Error Handling, API Client Generation
**Domain:** Node.js/Express Microservices with BFF Pattern
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

This is a tech debt cleanup milestone for an existing microservices platform with established patterns. The platform uses Node.js/Express services with a BFF layer, MongoDB for persistence, and Zod for validation. Three categories of tech debt require remediation: stubbed cross-service validation functions that allow data integrity violations, void async patterns in BFF handlers that silently suppress errors, and incomplete OpenAPI registration that forces manual frontend API implementation.

The recommended approach is to follow existing working patterns rather than introducing new architecture. The codebase contains correct implementations of cross-service HTTP validation (engagement-service/src/client-check.ts, report-service/src/engagement-check.ts) and OpenAPI registration (auth-service/src/routes/auth.openapi.ts, client-service/src/routes/*.openapi.ts). The fixes require implementing missing validation logic following the established HTTP-based pattern, refactoring BFF handlers from void async IIFE to proper async/await with try-catch, and completing OpenAPI registration for all BFF routes to enable automated API client generation.

Key risks include race conditions in validation (check-delete timing), circuit breaker absence causing cascading timeouts, and potential breaking changes when migrating frontend to generated client. Mitigation involves adding retry logic for validation, configuring HTTP timeouts, and migrating frontend incrementally with thorough testing.

## Key Findings

### Recommended Stack

The existing stack is appropriate for this work. No new technologies are required.

**Core technologies:**
- **Node.js/Express:** Runtime and web framework — established patterns exist for async handlers and HTTP inter-service communication
- **Zod + zod-to-openapi:** Schema validation and OpenAPI generation — existing working examples in auth-service and client-service demonstrate correct usage
- **node-fetch / undici:** HTTP client for cross-service validation — fetch-based pattern already works in engagement-service
- **Orval:** API client generator from OpenAPI spec — already configured, just needs complete spec as input

**Optional but recommended:**
- **AbortController:** Request timeout handling — native Node.js feature, should be added to all cross-service calls
- **Circuit breaker pattern:** Production reliability — consider post-cleanup for 10K+ user scale

### Expected Features

This milestone focuses on tech debt remediation, not new features. The work enables correct behavior for existing functionality.

**Must have (table stakes):**
- Client deletion validation — prevent deleting clients with active engagements (data integrity)
- Engagement deletion validation — prevent deleting engagements with reports or invoices (data integrity)
- BFF async error handling — surface errors instead of silently failing (observability)
- Complete OpenAPI registration — all BFF routes documented (API contract)
- Generated API client — frontend uses type-safe client instead of manual fetch

**Should have (competitive):**
- Request timeout configuration — prevent hanging requests (reliability)
- Request ID propagation — enable distributed tracing (debuggability)
- Retry logic for validation — mitigate race conditions (data integrity)
- Circuit breaker pattern — prevent cascading failures (resilience)

**Defer (v2+):**
- Soft delete pattern — alternative to hard delete with validation
- Event-sourcing for cross-service consistency — alternative to synchronous validation
- Dedicated analytics service — offload heavy dashboard aggregation

### Architecture Approach

The platform already has correct architecture patterns; the tech debt stems from incomplete implementation and anti-patterns.

**Major components:**
1. **Validation Layer** — Domain services (*-check.ts files) validate cross-service dependencies before destructive operations using synchronous HTTP calls. Working examples exist; stub implementations need completion.
2. **BFF Enrichment Layer** — BFF route handlers aggregate data from multiple services. Currently uses void async anti-pattern; needs refactoring to async handlers with try-catch.
3. **OpenAPI Registration Layer** — Route-adjacent *.openapi.ts files register API paths via zod-to-openapi registry. Auth and client services have complete registration; other BFF routes are missing.
4. **API Client Generation** — Orval generates TypeScript client from OpenAPI spec. Currently incomplete due to missing OpenAPI registrations.

**Data flow:** DELETE requests flow through validation check before deletion. Enrichment requests fetch primary data then parallel enrich downstream. OpenAPI registration happens at service startup via side-effect imports.

### Critical Pitfalls

1. **Void Async IIFE in Express Handlers** — Silently suppresses all errors, causing clients to hang and unhandled promise rejections. Fix by making route handlers async with try-catch blocks.
2. **Stubbed Cross-Service Validation** — Functions always return false (no dependencies), allowing destructive operations that orphan data. Fix by implementing actual HTTP calls following engagement-service/src/client-check.ts pattern.
3. **Incomplete OpenAPI Registration** — Missing .openapi.ts files cause incomplete generated client, forcing manual frontend API implementation that drifts from backend. Fix by registering all routes and running dump-openapi.
4. **Best-Effort Enrichment Masking Failures** — Empty catch blocks in BFF hide service failures. Fix by logging errors and optionally including enrichment status in response.
5. **Missing HTTP Timeouts** — Native fetch has no timeout, causing handlers to hang when services are unresponsive. Fix by wrapping all fetch calls with AbortController.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Cross-Service Validation (VAL-01, VAL-02)

**Rationale:** Data integrity is highest priority. Validation fixes have no dependencies on other work and protect against orphaned records. Working examples exist in codebase to follow.

**Delivers:**
- Implemented client-service/src/engagement-check.ts with HTTP call to engagement-service
- Implemented engagement-service/src/report-invoice-check.ts with HTTP calls to report-service and billing-service
- Integration tests for validation functions

**Addresses:** Cross-Service Validation (FEATURES.md - Table Stakes)
**Avoids:** Stubbed validation functions, race conditions

**Implementation notes:**
- Follow engagement-service/src/client-check.ts pattern exactly
- Add logging for network failures (fail safe but observable)
- Return HTTP 409 Conflict with error code when validation fails
- Add AbortController with 5s timeout to fetch calls

### Phase 2: BFF Async Error Handling (ERR-01)

**Rationale:** Improves observability and reliability. Depends on validation being fixed to surface validation failures properly. No API contract changes.

**Delivers:**
- Refactored clients.ts route handler (async with try-catch)
- Refactored engagements.ts route handler
- Refactored reports.ts route handler
- Refactored invoices.ts route handler
- Refactored dashboard.ts with error visibility
- Request ID propagation verified

**Addresses:** Async Error Handling in BFF (FEATURES.md - Table Stakes)
**Avoids:** Void async IIFE, silent failures, missing request IDs

**Implementation notes:**
- Use top-level async: `router.get('/:id', async (req, res) => { ... })`
- Try-catch entire handler, log errors, return 502 BAD_GATEWAY
- Use Promise.allSettled for enrichment, log rejections
- Ensure req.requestId passed to all fetchJson calls

### Phase 3: OpenAPI Registration (API-01, API-02)

**Rationale:** Independent of validation and error handling work. Enables client generation. Well-documented patterns exist.

**Delivers:**
- clients.openapi.ts for all client routes
- engagements.openapi.ts for all engagement routes
- reports.openapi.ts for all report routes
- invoices.openapi.ts for all invoice routes
- contacts.openapi.ts for contact routes
- credentials.openapi.ts for credential routes
- auth.openapi.ts for auth routes
- dashboard.openapi.ts for dashboard routes
- All imported as side effects in app.ts

**Addresses:** OpenAPI schema registration, spec export endpoint (FEATURES.md - Table Stakes)
**Avoids:** Partial registration, missing security schemes

**Implementation notes:**
- Follow auth-service/src/routes/auth.openapi.ts pattern
- Define enriched schemas in shared-types (EnrichedClient, EnrichedEngagement, etc.)
- Use registry.registerPath with method, path, request, responses
- Include all error response schemas
- Add security = [{ BearerAuth: [] }] to authenticated routes

### Phase 4: API Client Generation (API-03)

**Rationale:** Depends on complete OpenAPI spec from Phase 3. Generates type-safe client.

**Delivers:**
- Complete openapi.json dump from BFF
- Orval-generated TypeScript client in packages/api-client/src/generated/
- Verified generated client coverage

**Addresses:** Full OpenAPI coverage, Orval regeneration, Type-safe client (FEATURES.md - Table Stakes)
**Avoids:** Incomplete client, TypeScript conflicts

**Implementation notes:**
- Run `pnpm --filter bff-service dump-openapi`
- Verify openapi.json contains all routes
- Run `pnpm --filter api-client generate` (orval)
- Check generated/ directory for complete coverage

### Phase 5: Frontend Migration (API-04)

**Rationale:** Depends on generated client from Phase 4. Migrate frontend incrementally to use generated client.

**Delivers:**
- Frontend imports generated client methods
- Manual API files replaced with generated calls
- React Query integration verified
- Error handling in components validated

**Addresses:** Manual API calls replaced, frontend type safety (FEATURES.md - Table Stakes)
**Avoids:** Breaking UI logic, unhandled mutations, pagination mismatches

**Implementation notes:**
- Migrate one route/file at a time
- Always destructure `{ error, isLoading }` from Orval hooks
- Add error boundaries to catch mutation errors
- Update pagination properties to match generated client
- Test thoroughly before proceeding to next route

### Phase Ordering Rationale

1. **Validation first** — Protects data integrity immediately. No dependencies on other work. Highest risk if left unaddressed.
2. **BFF error handling second** — Improves observability. No API contract changes. Best done after validation so validation errors are properly surfaced.
3. **OpenAPI registration third** — Independent work, enables client generation. Parallelizable with validation and error handling.
4. **Client generation fourth** — Strict dependency on complete OpenAPI spec.
5. **Frontend migration last** — Strict dependency on generated client. Highest risk of breaking changes.

**Parallelization opportunity:** Phase 1 (Validation), Phase 2 (BFF Error), and Phase 3 (OpenAPI) can be worked in parallel by different team members. Phase 4 and 5 must follow Phase 3 and 4 respectively.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 5 (Frontend Migration):** Frontend codebase not fully analyzed. Need to audit `apps/web-app/src/features/*/api/*.ts` files to understand manual API patterns and migration complexity.
- **Phase 1 (Cross-Service Validation):** Need to verify exact response formats from engagement-service, report-service, and billing-service for count queries (pagination format vs simple count).

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (BFF Error Handling):** Well-documented async handler patterns in Express. Codebase has working examples.
- **Phase 3 (OpenAPI Registration):** Working examples in auth-service and client-service. Pattern is established.
- **Phase 4 (Client Generation):** Orval configuration exists. Standard workflow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing working patterns in codebase provide proven examples |
| Features | HIGH | Tech debt remediation scope is well-defined in CONCERNS.md |
| Architecture | HIGH | Correct architecture already exists; deviations are documented anti-patterns |
| Pitfalls | HIGH | Based on direct codebase analysis, anti-patterns are clearly identified |

**Overall confidence:** HIGH

### Gaps to Address

- **Frontend API audit:** Manual API implementations in frontend not fully mapped. Need to inventory `apps/web-app/src/features/*/api/*.ts` files during Phase 5 planning.
- **Service response formats:** Exact pagination response format for count queries needs verification (whether `?limit=1` returns `{ total, data }` or just count).
- **Orval React Query integration:** Frontend's exact React Query setup needs verification to ensure generated hooks work correctly.

**How to handle during planning/execution:**
- Conduct frontend API audit as pre-work for Phase 5
- Verify response formats by inspecting existing service handlers before implementing validation
- Test generated Orval hooks with a simple endpoint before full frontend migration

## Sources

### Primary (HIGH confidence)
- Existing working patterns in codebase:
  - `services/engagement-service/src/client-check.ts` — Working HTTP-based validation pattern
  - `services/report-service/src/engagement-check.ts` — Working HTTP-based validation pattern
  - `services/auth-service/src/routes/auth.openapi.ts` — Working OpenAPI registration
  - `services/client-service/src/routes/*.openapi.ts` — Working OpenAPI registration
  - `packages/shared-types/src/openapi/helpers.ts` — Registry utilities
- Codebase analysis:
  - `.planning/codebase/CONCERNS.md` — Tech debt inventory (HIGH)
  - `.planning/codebase/ARCHITECTURE.md` — Service boundaries (HIGH)
  - `services/bff-service/src/routes/*.ts` — Void async anti-pattern analysis (5 files, HIGH)
  - `packages/api-client/orval.config.ts` — Orval configuration (HIGH)

### Secondary (MEDIUM confidence)
- Standard Node.js/Express patterns for async handlers
- Cross-service HTTP validation best practices
- OpenAPI/zod-to-openapi integration patterns

### Tertiary (LOW confidence)
- Orval React Query integration specifics — verify with Orval docs during Phase 4
- Circuit breaker implementation — optional for this milestone, defer to future work

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
