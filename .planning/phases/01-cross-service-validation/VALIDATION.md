# Cross-Service Validation Architecture

## Overview

Cross-service validation in the Shire platform uses HTTP-based validation checks between microservices over the Docker bridge network (`shire-network`). This ensures data integrity by preventing destructive operations that would create orphaned records.

## Validation Pattern

Validation functions are encapsulated in dedicated modules (e.g., `engagement-check.ts`, `client-check.ts`) that:

1. Perform synchronous HTTP calls to dependent services
2. Return boolean values indicating whether validation passed/failed
3. Never throw errors - always return boolean for graceful degradation
4. Log failures with structured JSON including request IDs for tracing

Route handlers call these validation functions and convert the boolean result to appropriate HTTP status codes.

## HTTP Status Codes

| Validation Result | HTTP Status | Error Code | Description |
|-------------------|-------------|------------|-------------|
| Active engagements found | 422 Unprocessable Entity | `ACTIVE_ENGAGEMENTS` | Cannot delete client with active engagements |
| Associated records found | 422 Unprocessable Entity | `HAS_ASSOCIATED_RECORDS` | Cannot delete engagement with reports or invoices |
| Client not found | 404 Not Found | `CLIENT_NOT_FOUND` | Referenced client does not exist |
| Missing credentials | 422 Unprocessable Entity | `MISSING_CREDENTIALS` | Client requires credentials for access type |

Note: HTTP 422 is used for validation failures (per RFC 4918), not HTTP 409 (Conflict). This aligns with REST best practices for validation errors.

## Fail-Open Strategy

Validation functions use a "fail-open" strategy to prevent cascading failures:

- **On error**: Log the error with context (client/engagement ID, error details, request ID) and return `false`
- **On timeout**: Log timeout error and return `false`
- **On 5xx errors**: Log service error and return `false`

This allows operations to proceed when dependent services are unavailable, prioritizing system availability over strict data integrity in degraded states. Failures are still logged for monitoring and alerting.

## Timeouts

All inter-service validation calls enforce a 5-second timeout using `AbortController`:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const res = await fetch(
  `${config.serviceUrl}/endpoint?id=${id}`,
  { signal: controller.signal }
);

clearTimeout(timeoutId);
```

This prevents route handlers from hanging indefinitely when dependent services are slow or unresponsive.

## Logging

Validation errors are logged with structured JSON to stdout:

```json
{
  "timestamp": "2026-03-10T11:46:09.699Z",
  "service": "client-service",
  "level": "error",
  "message": "Engagement service check failed",
  "clientId": "client-123",
  "error": "ECONNREFUSED"
}
```

When request IDs are available (from the BFF or API Gateway), they are included in log metadata for distributed tracing.

## Service URLs

Inter-service communication uses Docker Compose service names over the internal bridge network:

| Service | Internal URL | External Port |
|---------|--------------|---------------|
| Client Service | `http://client-service:3002` | 3002 (via API Gateway) |
| Engagement Service | `http://engagement-service:3003` | 3003 (via API Gateway) |
| Report Service | `http://report-service:3004` | 3004 (via API Gateway) |
| Billing Service | `http://billing-service:3005` | 3005 (via API Gateway) |

Only the API Gateway and Grafana expose ports directly to the host. Inter-service calls use the internal URLs for security and performance.

## Example: Client Deletion Validation

### Validation Function (`engagement-check.ts`)

```typescript
import { config } from './config.js';
import { createLogger } from '@shire/shared';

const { log } = createLogger(config.serviceName);

export async function checkActiveEngagements(
  clientId: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `${config.engagementServiceUrl}/engagements?clientId=${clientId}`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      log('error', 'Engagement service returned error', {
        clientId,
        status: res.status,
      });
      return false;
    }

    const body = (await res.json()) as { data?: unknown[] };
    return Array.isArray(body.data) && body.data.length > 0;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isAbort) {
      log('error', 'Engagement service check timed out', { clientId });
    } else {
      log('error', 'Engagement service check failed', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return false;
  }
}
```

### Route Handler (`routes/clients.ts`)

```typescript
clientsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const hasActive = await engagementCheck.checkActiveEngagements(id);

  if (hasActive) {
    res.status(422).json({
      error: {
        code: 'ACTIVE_ENGAGEMENTS',
        message: 'Cannot delete client with active engagements',
      },
    });
    return;
  }

  // Proceed with deletion...
});
```

## Parallel Validation

For operations requiring multiple independent validation checks (e.g., report-service and billing-service checks), use `Promise.allSettled` to parallelize requests:

```typescript
const [reportResult, billingResult] = await Promise.allSettled([
  checkHasReports(engagementId),
  checkHasInvoices(engagementId),
]);

const hasReports = reportResult.status === 'fulfilled' && reportResult.value;
const hasInvoices = billingResult.status === 'fulfilled' && billingResult.value;

if (hasReports || hasInvoices) {
  return res.status(422).json({
    error: {
      code: 'HAS_ASSOCIATED_RECORDS',
      message: 'Cannot delete engagement with associated reports or invoices',
    },
  });
}
```

This ensures that one slow or failed check doesn't block the entire validation process.

## Configuration

Service URLs are configured via environment variables with fallback defaults:

```typescript
export const config = {
  engagementServiceUrl:
    process.env.ENGAGEMENT_SERVICE_URL || 'http://engagement-service:3003',
  // ...
};
```

This allows flexibility for local development while providing sensible defaults for Docker Compose environments.

## Related Files

- `services/client-service/src/engagement-check.ts` - Client deletion validation
- `services/engagement-service/src/client-check.ts` - Engagement creation validation
- `services/engagement-service/src/report-invoice-check.ts` - Engagement deletion validation (report-service + billing-service)
- `services/report-service/src/engagement-check.ts` - Report creation validation
