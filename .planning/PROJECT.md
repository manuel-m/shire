# Shire Tech Debt Cleanup

## What This Is

A focused cleanup of critical technical debt in the Shire AI Consulting Back-Office Platform. This work addresses data integrity risks (stubbed validation), silent error handling (void async pattern), and outdated API client generation. The platform is a microservices architecture with 6 domain services behind a BFF, using Node.js/TypeScript, MongoDB, and React.

## Core Value

Data integrity and maintainability — critical operations must validate correctly, errors must be surfaced, and API contracts must be generated from source.

## Requirements

### Validated

- ✓ Client CRUD — existing
- ✓ Contact CRUD — existing
- ✓ Engagement lifecycle management — existing
- ✓ Report CRUD with versioning and markdown — existing
- ✓ Invoice creation and status management — existing
- ✓ JWT authentication and refresh tokens — existing
- ✓ BFF proxy and dashboard aggregation — existing
- ✓ MongoDB per-service databases — existing
- ✓ Prometheus metrics on all services — existing
- ✓ Structured JSON logging with request ID tracing — existing
- ✓ Zod schemas as source of truth for types — existing

### Active

- [ ] **VAL-01**: Client deletion validates active engagements before allowing delete
- [ ] **VAL-02**: Engagement deletion validates associated reports/invoices before allowing delete
- [ ] **ERR-01**: BFF enrichment endpoints properly handle and return errors (no silent failures)
- [ ] **API-01**: All BFF routes register OpenAPI schemas
- [ ] **API-02**: Full OpenAPI spec is available and exported
- [ ] **API-03**: API client is regenerated from complete OpenAPI spec
- [ ] **API-04**: Frontend uses generated API client for all API calls

### Out of Scope

- Missing Services (Analytics Service, API Gateway) — these are architectural additions, not tech debt cleanup
- Report PDF generation pipeline — marked separately in CONCERNS.md as incomplete but not critical debt
- Database indexes — performance optimization, not critical debt
- Rate limiting and WAF — security hardening, not critical debt
- Response compression — performance optimization, not critical debt
- Soft delete for reports/invoices — feature addition, not debt cleanup

## Context

Shire is a microservices platform with 6 backend services (Auth, Client, Engagement, Report, Billing, BFF) and a React web app. The platform is functional but has three critical tech debt issues:

1. **Stubbed cross-service validation**: DELETE operations for clients and engagements call validation functions that always return `false`, allowing deletions even when dependent data exists. This violates data integrity and creates orphaned records.

2. **BFF void async pattern**: Multiple BFF route handlers use `void (async () => { ... })()` which silently suppresses errors. When enrichment or service calls fail, clients receive empty responses without error indication.

3. **Outdated API client generation**: The Orval config only references the health endpoint's OpenAPI spec. Most BFF routes lack `.openapi.ts` registration files, so the generated API client is incomplete. The frontend manually implements API calls instead of using the generated client, creating drift between backend and frontend.

The codebase was recently mapped (`.planning/codebase/`), providing detailed architecture, structure, stack, and concerns documentation to guide this cleanup.

## Constraints

- **Tech Stack**: Must use existing stack (Node.js, TypeScript, Express, MongoDB, React, Zod)
- **Pattern Consistency**: Follow existing patterns for cross-service checks (see `services/engagement-service/src/client-check.ts` and `services/report-service/src/engagement-check.ts` for working examples)
- **Breaking Changes**: Avoid breaking existing frontend API usage until generated client is integrated
- **Test Coverage**: Add integration tests for fixed validation functions
- **Commit Granularity**: Atomic commits for each fix to enable rollback if needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix validation stubs with actual HTTP calls | Existing patterns use HTTP for cross-service checks | — Pending |
| Replace void async with proper error handling | Current pattern silently swallows errors | — Pending |
| Complete OpenAPI before regenerating client | Need complete spec before generation | — Pending |
| Frontend migration to generated client post-generation | Avoid breaking changes during API client fix | — Pending |

---
*Last updated: 2026-03-10 after initialization*
