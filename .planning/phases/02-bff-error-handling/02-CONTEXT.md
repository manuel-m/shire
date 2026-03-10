# Phase 2: BFF Error Handling - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace void async IIFE pattern in BFF enrichment routes with proper error handling. Currently 5 routes (`dashboard.ts`, `clients.ts`, `engagements.ts`, `reports.ts`, `invoices.ts`) use `void (async () => { ... })()` which silently suppresses errors. Enrichment failures result in incomplete responses without clear error indication to clients.
</domain>

<decisions>
## Implementation Decisions

### Try-catch structure

- Use per-service try-catch blocks around each individual service call
- Individual services can fail without affecting other parallel calls
- Top-level async handler replaces void async IIFE pattern

### Logging strategy

- Enrichment failures logged as warnings (service might be down temporarily)
- Full handler failures logged as errors (request cannot complete)
- Include requestId and error details in all error logs

### Error response format

- Keep existing error format: `{ error: { code: 'BAD_GATEWAY', message: '...' } }`
- Message includes service name: "Client service unavailable" or "Engagement service unavailable"
- Consistent with existing `proxyRequest` error handling in `service-client.ts`

### Claude's Discretion

- Timeout duration for enrichment calls (5-second pattern from Phase 1 suggested)
- Promise.all vs Promise.allSettled choice for parallel enrichment
- Specific handling of sequential enrichment patterns (engagements.ts line 46)
- Whether to add tests for error scenarios

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `service-client.ts` provides `proxyRequest()` with proper error handling (502 BAD_GATEWAY)
- `service-client.ts` provides `fetchJson<T>()` returning `{ status, data }`
- `proxyRequest()` already handles Authorization and X-Request-Id header forwarding
- `proxyRequest()` already logs errors with requestId

### Established Patterns

- `proxyRequest()` uses try-catch with 502 response: already correct error handling model
- `fetchJson()` does not throw, returns status/data tuple
- X-Request-Id header already propagated via `req.requestId` and `proxyRequest`/`fetchJson`
- Logger from `@shire/shared` used across all services: `log('error', message, metadata)`

### Integration Points

- Enrichment routes: `/api/clients/:id`, `/api/engagements/:id`, `/api/reports/:id`, `/api/invoices/:id`
- Dashboard route: `/api/dashboard` (aggregates 7 service calls)
- Simple proxy routes: All other CRUD endpoints use `void proxyRequest(...)` (already ok)
- Config URLs: `clientServiceUrl`, `engagementServiceUrl`, `reportServiceUrl`, `billingServiceUrl`

### Current Void Async Pattern Locations

| Route File       | Line(s) | Pattern                        | Parallel Calls                                    |
| ---------------- | ------- | ------------------------------ | ------------------------------------------------- |
| `dashboard.ts`   | 14      | `void (async () => { ... })()` | 7 calls with `Promise.allSettled`                 |
| `clients.ts`     | 23      | `void (async () => { ... })()` | 2 calls with `Promise.all`                        |
| `engagements.ts` | 29      | `void (async () => { ... })()` | Sequential fetch + enrichment try-catch           |
| `reports.ts`     | 23      | `void (async () => { ... })()` | 3 calls with `Promise.all` + enrichment try-catch |
| `invoices.ts`    | 35      | `void (async () => { ... })()` | 3 calls with `Promise.all` + enrichment try-catch |

### Key Technical Constraints

- Express 5.x route handlers must not return promises directly (void pattern was workaround)
- `fetchJson` uses native `fetch` which already supports AbortController for timeouts
- Enrichment is "best-effort" in some routes (try-catch only around enrichment, not main fetch)
- `Promise.allSettled` already used in dashboard, returns `PromiseSettledResult<T>[]`

</code_context>

<specifics>
## Specific Ideas

"User wants service names in error messages so they know which service failed"
"Enrichment failures should be warnings, not errors — services may be temporarily down"
"Per-service catches allow partial success — if client-service is down but engagement-service works, still return partial data"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 02-bff-error-handling_
_Context gathered: 2026-03-10_
