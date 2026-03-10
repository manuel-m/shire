# Technology Stack

**Analysis Date:** 2026-03-10

## Cross-Service Validation Patterns

### HTTP-based Validation (Recommended)

**Pattern:**
```typescript
// In the service that owns the entity being deleted
import fetch from 'node-fetch';

async function checkDownstreamDependency(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${downstreamServiceUrl}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: id })
    });
    return response.ok;
  } catch (error) {
    // Log error, but return true (fail open) to prevent blocking on service unavailability
    logger.error({ error }, 'Downstream check failed');
    return true; // Has dependencies - block deletion
  }
}

// In the DELETE route
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const hasDependencies = await checkDownstreamDependency(id);
  if (hasDependencies) {
    return res.status(422).json({
      error: { code: 'HAS_DEPENDENCIES', message: 'Cannot delete entity with dependencies' }
    });
  }

  // Proceed with deletion
});
```

**Why this pattern:**
- Validation lives in the owning service (single responsibility)
- Synchronous HTTP call ensures data consistency at deletion time
- Fail-open behavior prevents cascading failures when downstream services are unavailable
- Clear error response to client (422 Unprocessable Entity)

**DO NOT:**
- Implement validation in BFF (business rules belong in domain services)
- Use async validation without waiting for result (data integrity risk)
- Allow deletion if downstream service is unreachable without logging

### Async Error Handling in BFF

**Correct Pattern:**
```typescript
router.get('/:id', async (req, res) => {
  try {
    const client = await proxyRequest('client-service', `/clients/${req.params.id}`, req);
    if (!client) {
      return res.status(404).json({ error: { code: 'NOT_FOUND' }});
    }

    // Enrichment - parallel with error handling
    const [engagementResult, invoiceResult] = await Promise.allSettled([
      proxyRequest('engagement-service', `/engagements/by-client/${req.params.id}`, req),
      proxyRequest('billing-service', `/invoices/by-client/${req.params.id}`, req),
    ]);

    // Handle each result
    if (engagementResult.status === 'fulfilled') {
      client.engagementCount = engagementResult.value?.total || 0;
    } else {
      client.engagementCount = null;
      logger.error({ error: engagementResult.reason }, 'Enrichment failed for engagements');
    }

    if (invoiceResult.status === 'fulfilled') {
      client.invoiceCount = invoiceResult.value?.total || 0;
    } else {
      client.invoiceCount = null;
      logger.error({ error: invoiceResult.reason }, 'Enrichment failed for invoices');
    }

    res.json(client);
  } catch (error) {
    logger.error({ error }, 'Client detail request failed');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR' }});
  }
});
```

**DO NOT:**
```typescript
// ANTI-PATTERN - void async IIFE silently swallows errors
router.get('/:id', (req, res) => {
  const client = await proxyRequest('client-service', `/clients/${req.params.id}`, req);
  res.json(client);

  // Error here is never caught or logged
  void (async () => {
    const engagements = await proxyRequest('engagement-service', ...);
    client.engagementCount = engagements?.total;
  })();
});
```

### OpenAPI Registration

**Pattern for Route-Level Registration:**
```typescript
// services/bff-service/src/routes/clients.openapi.ts
import { registry } from '@shire/shared-types/openapi/registry';
import { ClientSchema, ClientParamsSchema } from '@shire/shared-types';

registry.registerPath({
  method: 'get',
  path: '/api/clients',
  tags: ['Clients'],
  summary: 'List clients',
  request: { params: ClientParamsSchema },
  responses: {
    200: {
      description: 'List of clients',
      content: { 'application/json': { schema: registry.ref('PaginatedClients') }}
    }
  }
});
```

**Pattern for App-Level Registration:**
```typescript
// services/bff-service/src/app.ts
import './routes/health.openapi';      // Side-effect: registers paths
import './routes/auth.openapi';        // Side-effect: registers paths
import './routes/clients.openapi';     // Side-effect: registers paths
// ... all other .openapi.ts files

// Register endpoint to dump spec
app.get('/openapi.json', (req, res) => {
  res.json(registry.getSpec());
});
```

**Orval Configuration:**
```typescript
// packages/api-client/orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
  openApiSpecUrl: 'http://localhost:3007/openapi.json',
  output: {
    mode: 'split',
    target: 'src/generated/api-client.ts',
    schemas: 'src/generated/schemas',
    client: 'fetch',
    httpMethods: true,
  },
});
```

## Dependencies

### Required for This Work
- `node-fetch` or `undici` (for HTTP requests between services)
- Existing patterns in codebase provide working examples

### Optional but Recommended
- `abort-controller` (for request timeout handling)
- Circuit breaker pattern (for production reliability)

## Confidence Levels

| Area | Confidence | Reason |
|-------|------------|---------|
| Cross-service validation HTTP pattern | HIGH | Working examples exist in codebase |
| BFF async error handling | HIGH | Anti-pattern clearly identified; correct pattern documented |
| OpenAPI registration | HIGH | Working examples in auth-service; pattern verified |
| Circuit breakers | MEDIUM | Well-known pattern but not in current codebase |

---

*Stack analysis: 2026-03-10*
