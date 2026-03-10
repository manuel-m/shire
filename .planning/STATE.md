# State: Tech Debt Cleanup

**Project:** Shire Tech Debt Cleanup - Cross-Service Validation, BFF Error Handling, API Client Generation
**Created:** 2026-03-10

## Project Reference

**Core Value:** Data integrity and maintainability — critical operations must validate correctly, errors must be surfaced, and API contracts must be generated from source.

**Current Focus:** Initializing roadmap for v1 tech debt cleanup milestone.

## Current Position

**Phase:** 01 (Cross-Service Validation) — Wave 1 complete
**Plan:** 01-01 and 01-02 complete
**Status:** Awaiting verification
**Progress:** 0/4 phases complete (2/2 plans complete in Phase 1)

```
Phase: [----] 0%
Phase 1: [███░] 75% - Cross-Service Validation (plans complete, pending verification)
Phase 2: [----] 0% - BFF Error Handling
Phase 3: [----] 0% - OpenAPI Registration
Phase 4: [----] 0% - API Client Generation & Frontend Migration
```

## Performance Metrics

No metrics yet. Milestone not started.

## Accumulated Context

### Decisions Made

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-10 | Create 4-phase roadmap | Coarse granularity (3-5) required, combined GEN+FE into single phase due to tight coupling |
| 2026-03-10 | Use HTTP 422 for validation failures | Follows RFC 4918 best practices for validation errors (per VAL-04 feedback) |
| 2026-03-10 | Fail-open strategy for validation | Allows operations to proceed when dependent services unavailable, preventing cascading failures |
| 2026-03-10 | 5-second AbortController timeout | Prevents route handlers from hanging indefinitely on slow services |

### Key Constraints

- **Tech Stack:** Node.js, TypeScript, Express, MongoDB, React, Zod
- **Pattern Consistency:** Follow existing cross-service HTTP validation patterns
- **Breaking Changes:** Avoid breaking existing frontend API usage until generated client is integrated
- **Test Coverage:** Add integration tests for fixed validation functions
- **Commit Granularity:** Atomic commits for each fix

### Known Blockers

None currently.

### Active Todos

1. ~~Plan Phase 1: Cross-Service Validation~~ — COMPLETE (2 plans executed)
2. Verify Phase 1: Cross-Service Validation — PENDING (checkpoint verification)
3. Plan Phase 2: BFF Error Handling
4. Plan Phase 3: OpenAPI Registration
5. Plan Phase 4: API Client Generation & Frontend Migration

### Research Notes

From research/SUMMARY.md:

**High Confidence Areas:**
- Existing working patterns for cross-service validation (engagement-service/src/client-check.ts, report-service/src/engagement-check.ts)
- Working OpenAPI registration examples (auth-service/src/routes/auth.openapi.ts, client-service/src/routes/*.openapi.ts)

**Gaps to Address:**
- Frontend API audit needed: Manual API implementations in `apps/web-app/src/features/*/api/*.ts` not fully mapped
- Service response formats: Exact pagination format for count queries needs verification

## Session Continuity

### Last Session

- Created roadmap with 4 phases
- All 28 v1 requirements mapped to phases
- Granularity set to "coarse" (3-5 phases)
- Dependencies established: Phase 4 depends on Phase 3; Phase 3 is independent
- **Phase 1 execution complete:**
  - 01-01: Client deletion validation with engagement-service HTTP check
  - 01-02: Engagement deletion validation with parallel report/billing service checks
  - Both plans use 5-second AbortController timeout and fail-open strategy

### Next Steps

- Verify Phase 1 with `/gsd:verify-work 1` (checkpoint tasks pending)
- After verification: run `/gsd:plan-phase 2` for BFF Error Handling
- Phases 2 and 3 can be planned and executed in parallel

---

*State initialized: 2026-03-10*
