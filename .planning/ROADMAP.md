# Roadmap: Tech Debt Cleanup

**Project:** Shire Tech Debt Cleanup - Cross-Service Validation, BFF Error Handling, API Client Generation
**Granularity:** Coarse (3-5 phases)
**Last Updated:** 2026-03-10

## Phases

- [x] **Phase 1: Cross-Service Validation** - Fix stubbed validation to prevent data integrity violations
- [ ] **Phase 2: BFF Error Handling** - Replace void async pattern with proper error handling
- [ ] **Phase 3: OpenAPI Registration** - Complete API documentation for all BFF routes
- [ ] **Phase 4: API Client Generation & Frontend Migration** - Generate type-safe client and migrate frontend

## Phase Details

### Phase 1: Cross-Service Validation

**Goal:** Client and engagement deletions validate against dependent data before allowing destructive operations, preventing orphaned records.

**Depends on:** Nothing (first phase)

**Requirements:** VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, VAL-06, VAL-07

**Success Criteria** (what must be TRUE):
1. User cannot delete a client that has active engagements (receives 422 error with clear message)
2. User cannot delete an engagement that has reports or invoices (receives 422 error with clear message)
3. Validation failures are logged with request ID for distributed tracing
4. Downstream service unavailability is handled gracefully (fails open, logs error)
5. Validation requests timeout after 5 seconds to prevent hanging

**Plans:** 2 plans

- [x] 01-cross-service-validation-01-PLAN.md — Implement client deletion validation (engagement-check.ts)
- [x] 01-cross-service-validation-02-PLAN.md — Implement engagement deletion validation (report-invoice-check.ts)

---

### Phase 2: BFF Error Handling

**Goal:** BFF enrichment endpoints properly surface errors instead of silently failing, improving observability and reliability.

**Depends on:** Phase 1

**Requirements:** ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06

**Success Criteria** (what must be TRUE):
1. BFF enrichment endpoints return HTTP 502 BAD_GATEWAY when downstream services fail
2. All enrichment failures are logged with error details and request ID
3. Individual service failures in parallel enrichment are handled without failing entire request
4. Request ID is propagated to all downstream service calls
5. No void async IIFE patterns exist in BFF route handlers

**Plans:** TBD

---

### Phase 3: OpenAPI Registration

**Goal:** All BFF routes have complete OpenAPI schemas registered, enabling automated API client generation.

**Depends on:** Nothing (can be parallelized with Phases 1 and 2)

**Requirements:** API-01, API-02, API-03, API-04, API-05, API-06, API-07

**Success Criteria** (what must be TRUE):
1. Every BFF route has a corresponding `.openapi.ts` registration file
2. BFF `/openapi.json` endpoint returns a complete specification
3. All request and response schemas are documented including error responses
4. Authenticated routes include BearerAuth security scheme
5. Enriched response schemas are defined in shared-types

**Plans:** TBD

---

### Phase 4: API Client Generation & Frontend Migration

**Goal:** Frontend uses a generated type-safe API client for all API calls, eliminating manual implementation drift.

**Depends on:** Phase 3

**Requirements:** GEN-01, GEN-02, GEN-03, GEN-04, FE-01, FE-02, FE-03, FE-04, FE-05, FE-06

**Success Criteria** (what must be TRUE):
1. Orval generates a complete TypeScript API client from BFF OpenAPI spec
2. Generated client compiles without TypeScript errors
3. Frontend imports and uses generated query and mutation hooks for all API calls
4. Manual API files in `apps/web-app/src/features/*/api/*.ts` are removed
5. Frontend builds and type-checks successfully
6. Error handling in components works correctly with generated client errors

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cross-Service Validation | 2/2 | Complete | 2026-03-10 |
| 2. BFF Error Handling | 0/0 | Not started | - |
| 3. OpenAPI Registration | 0/0 | Not started | - |
| 4. API Client Generation & Frontend Migration | 0/0 | Not started | - |

---

## Dependencies

```
Phase 3 (OpenAPI Registration)
    |
    v
Phase 4 (Client Generation + Frontend Migration)
    ^
    |
Phase 2 (BFF Error Handling) -- can run parallel to Phase 3
    ^
    |
Phase 1 (Cross-Service Validation) -- can run parallel to Phase 3
```

**Parallelization:** Phase 1 and Phase 2 can be worked in parallel with Phase 3 since they have no dependencies. Phase 4 must wait for Phase 3.

---

*Roadmap created: 2026-03-10*
*Phase 1 planned: 2026-03-10*
*Phase 1 executed: 2026-03-10*
