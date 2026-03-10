# Codebase Concerns

**Analysis Date:** 2026-03-10

## Tech Debt

**Stub Implementation - Cross-Service Validation:**
- Issue: Critical inter-service validation functions are stubbed, always returning `false` or placeholder values
- Files:
  - `services/client-service/src/engagement-check.ts`
  - `services/engagement-service/src/report-invoice-check.ts`
- Impact: DELETE operations cannot properly validate dependencies. Client deletion claims to check for active engagements but always returns `false`, allowing deletion even with engagements. Engagement deletion claims to check for associated reports/invoices but always returns `false`, allowing orphaned data.
- Fix approach: Replace stub implementations with actual HTTP calls to downstream services using the same pattern as `services/engagement-service/src/client-check.ts` and `services/report-service/src/engagement-check.ts`

**Missing Services Per Architecture:**
- Issue: Architecture documents reference services that do not exist in codebase
- Files: `doc/ARCHITECTURE.md`, `CLAUDE.md`
- Impact: Analytics Service (dashboard metrics) and API Gateway (rate limiting, JWT validation) are documented but not implemented. BFF-service currently handles all routing without proper gateway protections.
- Fix approach: Implement missing services or update architecture docs to reflect current reality (BFF as entry point, no dedicated gateway)

**API Client Generation Outdated:**
- Issue: Orval config references `openapi.json` that only contains health endpoint, not full API
- Files: `packages/api-client/orval.config.ts`, `services/bff-service/openapi.json`
- Impact: Web app API client only has health endpoint generated. Missing `.openapi.ts` files in `services/bff-service/src/routes/` for auth, clients, engagements, reports, invoices, contacts, credentials, dashboard endpoints. Frontend manually implements API calls in `apps/web-app/src/features/*/api/*.ts` instead of using generated client.
- Fix approach: Add OpenAPI schema registration to all BFF routes (like `health.openapi.ts`), run `dump-openapi`, then regenerate API client

**Report Generation Pipeline Incomplete:**
- Issue: Markdown endpoint exists but HTML/PDF generation pipeline (Handlebars + Puppeteer) is not implemented
- Files: `services/report-service/src/routes/reports.ts`, `services/report-service/src/markdown.ts`, `doc/ARCHITECTURE.md`
- Impact: Reports can be stored as structured data and markdown, but cannot be exported as PDF documents for clients.
- Fix approach: Add Handlebars template compilation, HTML rendering with CSS, and Puppeteer PDF generation to report service

**BFF Service Void Async Pattern:**
- Issue: Multiple handlers use `void (async () => { ... })()` pattern which silences errors
- Files:
  - `services/bff-service/src/routes/clients.ts`
  - `services/bff-service/src/routes/engagements.ts`
  - `services/bff-service/src/routes/reports.ts`
  - `services/bff-service/src/routes/invoices.ts`
  - `services/bff-service/src/routes/dashboard.ts`
- Impact: Unhandled promise rejections in async IIFE. If enrichment or service calls fail silently, client receives empty responses without error indication.
- Fix approach: Use top-level async handlers or properly catch and return errors

## Known Bugs

**Client Deletion Bypasses Engagement Check:**
- Symptoms: Can delete client even with active engagements
- Files: `services/client-service/src/routes/clients.ts` (line 150), `services/client-service/src/engagement-check.ts`
- Trigger: DELETE `/clients/:id` calls `checkActiveEngagements()` which always returns `false`
- Workaround: None. Data integrity compromised.

**Engagement Deletion Allows Orphaned Reports/Invoices:**
- Symptoms: Can delete engagement with associated reports or invoices
- Files: `services/engagement-service/src/routes/engagements.ts` (line 221), `services/engagement-service/src/report-invoice-check.ts`
- Trigger: DELETE `/engagements/:id` calls `checkAssociatedReportsOrInvoices()` which always returns `false`
- Workaround: None. Data integrity compromised.

**Dashboard Ignores Service Failures:**
- Symptoms: Dashboard always returns data even when backend services are down
- Files: `services/bff-service/src/routes/dashboard.ts` (line 65-66)
- Trigger: Any service down results in `0` count for that metric
- Workaround: Not currently an issue but hides failures

## Security Considerations

**Default Secrets in Config:**
- Risk: Production deployments may use default secrets if environment variables not set
- Files:
  - `services/auth-service/src/config.ts`
  - `services/client-service/src/config.ts`
  - `services/engagement-service/src/config.ts`
  - `services/report-service/src/config.ts`
  - `services/billing-service/src/config.ts`
  - `services/bff-service/src/config.ts`
- Current mitigation: All configs have `|| 'dev-secret-change-me'` fallback. `services/client-service/src/config.ts` has `|| 'dev-encryption-key-change-me'` for credentials encryption.
- Recommendations: Remove default fallbacks for production. Fail fast if required secrets missing. Use secret management (Vault, AWS Secrets Manager, Kubernetes secrets). Add config validation on startup.

**No Rate Limiting:**
- Risk: No protection against API abuse, DoS attacks
- Files: No rate limiting implementation found
- Current mitigation: None. Architecture documents mention rate limiting as API Gateway responsibility, but API Gateway does not exist.
- Recommendations: Implement rate limiting in BFF service (express-rate-limit, @casl/ability for per-user limits). Add IP-based throttling for auth endpoints.

**No Input Sanitization:**
- Risk: MongoDB injection via regex queries
- Files: `services/client-service/src/routes/clients.ts` (lines 72-77)
- Current mitigation: Using `$regex` with user input. Though Zod validates type, malicious regex patterns could cause ReDoS.
- Recommendations: Use MongoDB text indexes with `$search` instead of `$regex`. Implement input sanitization for search queries.

**Code Credentials Exposure Risk:**
- Risk: Encrypted credentials in database but access logging may not be complete
- Files: `services/client-service/src/routes/credentials.ts`
- Current mitigation: Schema defined but implementation review needed.
- Recommendations: Ensure all credential access is logged. Implement key rotation. Consider hardware security module (HSM) or KMS for encryption keys.

**Missing API Gateway:**
- Risk: All services behind BFF without proper gateway protections
- Files: Architecture docs reference `api-gateway` service, only `bff-service` exists
- Current mitigation: BFF service performs auth via `createAuthMiddleware` but no centralized rate limiting or request validation.
- Recommendations: Implement API Gateway or enhance BFF with gateway features. Add WAF rules. Implement request size limits.

## Performance Bottlenecks

**BFF Enrichment Sequential Fetches:**
- Problem: Enrichment endpoints make multiple sequential HTTP calls to downstream services
- Files: `services/bff-service/src/routes/clients.ts`, `services/bff-service/src/routes/engagements.ts`, `services/bff-service/src/routes/reports.ts`, `services/bff-service/src/routes/invoices.ts`
- Cause: Each endpoint fetches from 2-3 services sequentially (client, engagement, etc.)
- Improvement path: Use `Promise.all` for parallel enrichment (already done in `services/bff-service/src/routes/clients.ts` line 27 but others are sequential). Consider caching enrichment data. Consider adding client/engagement names directly to reports/invoices (denormalization).

**Dashboard Aggregation:**
- Problem: Dashboard makes 7 parallel HTTP calls every request
- Files: `services/bff-service/src/routes/dashboard.ts`
- Cause: Calls each service with `?limit=1` to get `total` count
- Improvement path: Add metrics endpoint to each service that returns counts only. Implement caching (Redis). Push aggregation to a dedicated Analytics Service.

**No Database Indexes:**
- Problem: No index definitions found in codebase
- Files: No `index.ts` or migration files for indexes in any service
- Cause: MongoDB indexes not defined in code. Collections may lack optimal indexes for common queries.
- Improvement path: Add index definitions for `clientId`, `engagementId`, `status`, `companyName`, timestamps. Create migration system for index management.

**No Response Compression:**
- Problem: Large JSON responses not compressed
- Files: `services/*/src/app.ts`
- Cause: No compression middleware in Express apps
- Improvement path: Add `express-compression` middleware to all services

## Fragile Areas

**Inter-Service Validation via HTTP:**
- Files:
  - `services/engagement-service/src/client-check.ts`
  - `services/report-service/src/engagement-check.ts`
  - `services/billing-service/src/entity-check.ts`
- Why fragile: Network failures cause validation to fail gracefully (return false). Service unavailability breaks business logic (can't create/update if dependencies can't be validated).
- Safe modification: Add circuit breakers for service calls. Implement fallback caching. Consider event-based eventual consistency.
- Test coverage: No unit tests for check functions. Integration tests mock but don't validate failure scenarios.

**Void Async Handlers in BFF:**
- Files: All routes in `services/bff-service/src/routes/`
- Why fragile: Errors are swallowed silently. Service failures result in incomplete responses.
- Safe modification: Convert to proper async handlers. Add error handling and logging.
- Test coverage: No integration tests for BFF service (`vitest run --passWithNoTests`).

**Entity Deletion Without Proper Validation:**
- Files:
  - `services/client-service/src/routes/clients.ts` (DELETE)
  - `services/engagement-service/src/routes/engagements.ts` (DELETE)
- Why fragile: Cascade deletes (contacts when client deleted) but no equivalent for reports/invoices when engagement deleted. No soft delete option.
- Safe modification: Implement proper cascade validation first. Consider soft delete (isDeleted flag) instead of hard delete.
- Test coverage: Integration tests exist but test stub behavior (always returns false).

**Orval/API Client Generation:**
- Files: `packages/api-client/`
- Why fragile: Manual frontend API implementation diverges from backend schemas. Regeneration would overwrite manual work.
- Safe modification: Complete OpenAPI registration, regenerate fully, verify frontend uses generated client.
- Test coverage: None for generated client matching backend behavior.

## Scaling Limits

**Dashboard Concurrent Requests:**
- Current capacity: Each dashboard request spawns 7 concurrent HTTP calls
- Limit: With 100 concurrent users = 700 HTTP calls to services
- Scaling path: Implement caching. Add dedicated analytics service. Consider read replicas for queries.

**No Connection Pooling:**
- Current capacity: Default MongoDB connection pool
- Limit: Not specified, potential bottleneck under load
- Scaling path: Configure connection pool sizes per service. Monitor connection counts.

**No Horizontal Scaling:**
- Current capacity: Single instance per service in Docker Compose
- Limit: Cannot scale horizontally without load balancer
- Scaling path: Deploy with orchestration (Kubernetes). Add service discovery. Implement session affinity for stateful operations.

## Dependencies at Risk

**Express 5.1.0 (Release Candidate):**
- Risk: Express 5.x was in RC status for years, may have breaking changes
- Impact: Middleware ecosystem compatibility, potential security issues
- Migration plan: Monitor for stable release. Pin to 4.18.x if stability concerns arise.

**Orval 7.3.0:**
- Risk: API client generation breaking on minor version updates
- Impact: Frontend builds fail on regeneration
- Migration plan: Pin major version. Add tests for generated client. Consider alternatives (openapi-typescript-codegen).

**MongoDB 7:**
- Risk: Using latest major version, potential compatibility issues
- Impact: Driver compatibility, index changes, performance characteristics
- Migration plan: Test migrations on staging. Document backup/restore procedures (exists in `infrastructure/backup/`).

## Missing Critical Features

**Invoice/Report Soft Delete:**
- Problem: No delete endpoints for invoices or reports. Hard deletes may break audit trail
- Files: `services/billing-service/src/routes/invoices.ts`, `services/report-service/src/routes/reports.ts`
- Blocks: Audit compliance, historical reporting
- Status: Not a bug by design, but incomplete for production use

**Email Notifications:**
- Problem: Invoice send and remind endpoints exist but don't actually send emails
- Files: `services/billing-service/src/routes/invoices.ts` (lines 250-305)
- Blocks: Actual invoicing workflow
- Status: Log messages only, no email provider integration

**Background Jobs:**
- Problem: No job queue for async operations (PDF generation, email sending)
- Files: No job scheduler (Bull, Agenda) found
- Blocks: Long-running operations without blocking requests
- Status: Not implemented

**File Storage for PDFs:**
- Problem: No file storage configured for generated PDF reports
- Files: Not implemented
- Blocks: Report delivery
- Status: Not implemented

## Test Coverage Gaps

**BFF Service:**
- What's not tested: All routing logic, enrichment, proxying behavior
- Files: `services/bff-service/src/routes/*.ts`
- Risk: Silent failures, incorrect enrichment, proxy bugs
- Priority: High

**Check Functions:**
- What's not tested: Inter-service validation functions (client-check, engagement-check, entity-check)
- Files: `services/*/src/*-check.ts`, `services/billing-service/src/entity-check.ts`
- Risk: Business logic failures, data integrity issues
- Priority: High

**Error Handling:**
- What's not tested: Failure modes, service unavailability, network timeouts
- Files: All services
- Risk: Undefined behavior under load or failure
- Priority: Medium

**Concurrency:**
- What's not tested: Race conditions, concurrent updates, duplicate prevention
- Files: `services/client-service/src/routes/clients.ts` (duplicate check), others
- Risk: Data corruption under concurrent access
- Priority: Medium

**Integration:**
- What's not tested: End-to-end flows (create client -> engagement -> report -> invoice)
- Files: Across multiple services
- Risk: Cross-service failures not caught
- Priority: Medium

---

*Concerns audit: 2026-03-10*
