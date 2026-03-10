# Features: Tech Debt Cleanup

**Analysis Date:** 2026-03-10

## Overview

This milestone focuses on three categories of technical debt:

1. **Cross-Service Validation** — Stub implementations that allow data integrity violations
2. **Async Error Handling** — Void async pattern that silently suppresses errors
3. **API Client Generation** — Incomplete OpenAPI registration causing manual API implementation

Each category contains table stakes (essential for functionality) and anti-features (patterns to avoid).

---

## Cross-Service Validation

### Table Stakes (Must Have)

| Feature | Description | Complexity |
|----------|-------------|-------------|
| Client deletion check | Validate no active engagements exist before allowing client deletion | Low |
| Engagement deletion check | Validate no reports or invoices exist before allowing engagement deletion | Low |
| HTTP-based validation calls | Use synchronous HTTP calls to downstream services for validation | Medium |
| Proper error responses | Return 422 Unprocessable Entity with clear error codes | Low |
| Request ID propagation | Include X-Request-Id in validation calls for tracing | Low |

### Implementation Notes

- **Validation belongs in owning service**: Client Service checks Engagement Service; Engagement Service checks Report/Billing Services
- **Fail-open strategy**: If downstream service is unavailable, log error but return `true` (has dependencies) to prevent accidental deletion
- **Return value semantics**: `true` = has dependencies (block deletion), `false` = safe to delete

### Anti-Features (Avoid)

| Anti-Feature | Why Avoid | Alternative |
|--------------|------------|--------------|
| Validation in BFF | Business rules belong in domain services | Move to owning service |
| Async validation without wait | Race condition allows deletion before check completes | Use synchronous HTTP call |
| Always return `false` | Stub implementation bypasses validation | Implement actual HTTP check |
| Hard-coded responses | Cannot adapt to real data | Query downstream service |

---

## Async Error Handling in BFF

### Table Stakes (Must Have)

| Feature | Description | Complexity |
|----------|-------------|-------------|
| Top-level async handlers | Remove void async IIFE pattern | Low |
| Try-catch error logging | Catch and log all errors | Low |
| Proper HTTP status codes | Return 500/502 for failures | Low |
| Promise.allSettled usage | Handle individual service failures gracefully | Medium |
| Partial enrichment on failure | Return available data with null for failed enrichments | Medium |

### Implementation Notes

- **Remove void async pattern**: The pattern `void (async () => { ... })()` silently suppresses unhandled promise rejections
- **Top-level async**: Make route handler itself async with try-catch block
- **Log failures**: Every failed enrichment should be logged with error details
- **Don't mask**: Return null for failed enrichments but surface that a failure occurred

### Anti-Features (Avoid)

| Anti-Feature | Why Avoid | Alternative |
|--------------|------------|--------------|
| Void async IIFE | Silently suppresses errors, potential connection close | Top-level async with try-catch |
| Silent failures | Client receives empty response with no error indication | Log and return error status |
| Sequential enrichment | Slower response time | Use Promise.all or Promise.allSettled |
| No error codes | Client can't distinguish failure types | Return specific error codes |

---

## API Client Generation

### Table Stakes (Must Have)

| Feature | Description | Complexity |
|----------|-------------|-------------|
| OpenAPI schema registration | Register all route schemas with `.openapi()` decorator | Low |
| Path registration | Create `.openapi.ts` files for all BFF routes | Low |
| Spec export endpoint | `/openapi.json` returns complete spec | Low |
| Full OpenAPI coverage | All endpoints documented in spec | Medium |
| Orval regeneration | Generate API client from complete spec | Low |
| Type-safe client | Frontend uses generated types and methods | Medium |

### Implementation Notes

- **Side-effect imports**: Import `.openapi.ts` files in `app.ts` as side effects to register paths
- **Schema decoration**: Use `.openapi()` method on Zod schemas to register OpenAPI metadata
- **Registry pattern**: Use shared `registry` from `@shire/shared-types/openapi/registry`
- **Complete coverage**: Every endpoint in BFF must have OpenAPI registration

### Anti-Features (Avoid)

| Anti-Feature | Why Avoid | Alternative |
|--------------|------------|--------------|
| Manual API calls in frontend | Drift from backend contracts, duplicate work | Use generated client |
| Partial OpenAPI registration | Generated client incomplete | Register all endpoints |
| Regenerating without testing | May break frontend if contracts change | Test generated client before merge |
| Direct fetch without types | No compile-time checking | Use Orval-generated methods |

---

## Complexity Assessment

| Category | Complexity | Rationale |
|-----------|-------------|------------|
| Cross-service validation | Low | HTTP calls, existing patterns to follow |
| BFF async error handling | Low | Refactor handlers, straightforward |
| API client generation | Medium | Multiple files, frontend integration required |

## Dependencies Between Features

```
[VAL-01/VAL-02] ← Independent → [ERR-01]
                              ↓
[API-01/API-02] ← Independent ↘ [API-03]
                                       ↓
                                   [API-04]
```

- **Validation (VAL)**: Independent of error handling and API work
- **Error handling (ERR)**: Independent, but best after validation to surface validation failures
- **OpenAPI registration (API-01/02)**: Independent of validation and error handling
- **Client generation (API-03)**: Depends on complete OpenAPI spec
- **Frontend migration (API-04)**: Depends on generated client

---

*Features analysis: 2026-03-10*
