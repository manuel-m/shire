# Requirements: Shire Tech Debt Cleanup

**Defined:** 2026-03-10
**Core Value:** Data integrity and maintainability — critical operations must validate correctly, errors must be surfaced, and API contracts must be generated from source.

## v1 Requirements

Requirements for this tech debt cleanup milestone. Each maps to roadmap phases.

### Cross-Service Validation

- [x] **VAL-01**: Client deletion validates no active engagements exist before allowing delete
- [x] **VAL-02**: Engagement deletion validates no reports or invoices exist before allowing delete
- [x] **VAL-03**: Validation uses synchronous HTTP calls to downstream services
- [x] **VAL-04**: Validation failures return HTTP 422 with clear error codes
- [x] **VAL-05**: Validation failures are logged with request ID tracing
- [x] **VAL-06**: HTTP validation calls include timeout (5 seconds)
- [x] **VAL-07**: Validation handles downstream service unavailability gracefully (fail-open)

### BFF Error Handling

- [x] **ERR-01**: All BFF enrichment endpoints use top-level async handlers (no void async IIFE)
- [x] **ERR-02**: All BFF handlers have try-catch error handling
- [x] **ERR-03**: Failed enrichment attempts are logged with error details
- [x] **ERR-04**: Service failures return HTTP 502 BAD_GATEWAY with error response
- [x] **ERR-05**: Individual service failures are handled gracefully (either via `Promise.allSettled` for parallel enrichment, or per-service try-catch blocks for sequential enrichment)
- [x] **ERR-06**: Request ID propagated to all downstream service calls

### OpenAPI Registration

- [ ] **API-01**: All BFF route files have corresponding `.openapi.ts` registration
- [ ] **API-02**: All OpenAPI schemas include request/response definitions
- [ ] **API-03**: All OpenAPI registrations include error response schemas
- [ ] **API-04**: Authenticated routes include BearerAuth security scheme
- [ ] **API-05**: Enriched response schemas are defined in shared-types
- [ ] **API-06**: All `.openapi.ts` files are imported as side effects in app.ts
- [ ] **API-07**: BFF `/openapi.json` endpoint exports complete spec

### API Client Generation

- [ ] **GEN-01**: OpenAPI spec dump contains all BFF routes
- [ ] **GEN-02**: Orval generates complete TypeScript API client
- [ ] **GEN-03**: Generated client exports all endpoints and schemas
- [ ] **GEN-04**: Generated client compiles without TypeScript errors

### Frontend Migration

- [ ] **FE-01**: Frontend imports generated API client
- [ ] **FE-02**: Manual API files in `apps/web-app/src/features/*/api/*.ts` are replaced
- [ ] **FE-03**: Frontend components use generated query and mutation hooks
- [ ] **FE-04**: Error handling in components works with generated client
- [ ] **FE-05**: Frontend builds and type-checks successfully
- [ ] **FE-06**: Pagination properties match generated client interface

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Reliability Enhancements

- **REL-01**: Circuit breaker pattern for cross-service validation calls
- **REL-02**: Retry logic for transient validation failures
- **REL-03**: Soft delete pattern for entities (isDeleted flag)

### Observability

- **OBS-01**: Distributed tracing across all services
- **OBS-02**: Metrics for validation success/failure rates
- **OBS-03**: Dashboard shows service health status

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                      | Reason                                                   |
| -------------------------------------------- | -------------------------------------------------------- |
| Missing Services (Analytics, API Gateway)    | These are architectural additions, not tech debt cleanup |
| Report PDF generation pipeline               | Marked separately as incomplete feature, not debt        |
| Database indexes                             | Performance optimization, not critical debt              |
| Rate limiting and WAF                        | Security hardening, not critical debt                    |
| Response compression                         | Performance optimization, not critical debt              |
| Soft delete for reports/invoices             | Feature addition, not debt cleanup                       |
| Event-sourcing for cross-service consistency | Alternative architecture, out of scope                   |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| VAL-01      | Phase 1 | Complete |
| VAL-02      | Phase 1 | Complete |
| VAL-03      | Phase 1 | Complete |
| VAL-04      | Phase 1 | Complete |
| VAL-05      | Phase 1 | Complete |
| VAL-06      | Phase 1 | Complete |
| VAL-07      | Phase 1 | Complete |
| ERR-01      | Phase 2 | Complete |
| ERR-02      | Phase 2 | Complete |
| ERR-03      | Phase 2 | Complete |
| ERR-04      | Phase 2 | Complete |
| ERR-05      | Phase 2 | Complete |
| ERR-06      | Phase 2 | Complete |
| API-01      | Phase 3 | Pending  |
| API-02      | Phase 3 | Pending  |
| API-03      | Phase 3 | Pending  |
| API-04      | Phase 3 | Pending  |
| API-05      | Phase 3 | Pending  |
| API-06      | Phase 3 | Pending  |
| API-07      | Phase 3 | Pending  |
| GEN-01      | Phase 4 | Pending  |
| GEN-02      | Phase 4 | Pending  |
| GEN-03      | Phase 4 | Pending  |
| GEN-04      | Phase 4 | Pending  |
| FE-01       | Phase 4 | Pending  |
| FE-02       | Phase 4 | Pending  |
| FE-03       | Phase 4 | Pending  |
| FE-04       | Phase 4 | Pending  |
| FE-05       | Phase 4 | Pending  |
| FE-06       | Phase 4 | Pending  |

**Coverage:**

- v1 requirements: 28 total
- Mapped to phases: 28/28
- Unmapped: 0

---

_Requirements defined: 2026-03-10_
_Last updated: 2026-03-10 after roadmap creation_
