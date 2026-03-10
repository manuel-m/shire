# State: Tech Debt Cleanup

**Project:** Shire Tech Debt Cleanup - Cross-Service Validation, BFF Error Handling, API Client Generation
**Created:** 2026-03-10

## Project Reference

**Core Value:** Data integrity and maintainability — critical operations must validate correctly, errors must be surfaced, and API contracts must be generated from source.

**Current Focus:** Initializing roadmap for v1 tech debt cleanup milestone.

## Current Position

**Phase:** Not started (roadmap created)
**Plan:** TBD
**Status:** Planning
**Progress:** 0/4 phases complete

```
Phase: [----] 0%
Phase 1: [----] 0% - Cross-Service Validation
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

### Key Constraints

- **Tech Stack:** Node.js, TypeScript, Express, MongoDB, React, Zod
- **Pattern Consistency:** Follow existing cross-service HTTP validation patterns
- **Breaking Changes:** Avoid breaking existing frontend API usage until generated client is integrated
- **Test Coverage:** Add integration tests for fixed validation functions
- **Commit Granularity:** Atomic commits for each fix

### Known Blockers

None currently.

### Active Todos

1. Plan Phase 1: Cross-Service Validation
2. Plan Phase 2: BFF Error Handling
3. Plan Phase 3: OpenAPI Registration
4. Plan Phase 4: API Client Generation & Frontend Migration

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

### Next Steps

- Run `/gsd:plan-phase 1` to begin planning Cross-Service Validation
- Phases 1, 2, and 3 can be planned and executed in parallel

---

*State initialized: 2026-03-10*
