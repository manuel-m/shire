# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Runner:**
- Vitest 3.x (node environment)
- Config: `vitest.config.ts` in each service

**Config template (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
  },
});
```

**Assertion Library:**
- Built-in Vitest `expect`

**Run Commands:**
```bash
pnpm test                    # Run all tests across monorepo
pnpm test:unit              # Unit tests (if present)
pnpm test:integration       # Integration tests only
pnpm --filter <service> test # Run tests for specific service
```

**Service-specific scripts:**
```bash
cd services/auth-service
pnpm test                   # Run integration tests
pnpm test:integration        # Explicit integration tests
```

## Test File Organization

**Location:**
- Co-located with source code: `src/routes/[entity].integration.test.ts`
- One integration test file per route module

**Naming:**
- `[entity].integration.test.ts` for API route tests
- No unit test files currently present in services
- Web app has no test files configured

**Structure:**
```
services/[service-name]/
  src/
    routes/
      auth.integration.test.ts      # Auth route tests
      clients.integration.test.ts   # Client route tests
    vitest.config.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { connectDb, disconnectDb, getDb } from '../db.js';
import { config } from '../config.js';

let mongod: MongoMemoryServer;
let request: supertest.SuperTest<supertest.Test>;

function makeToken(overrides?: Partial<{ userId: string; email: string; role: string }>): string {
  return jwt.sign(
    { userId: 'test-user-id', email: 'test@example.com', role: 'consultant', ...overrides },
    config.jwtSecret,
  );
}

let token: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  const app = createApp();
  request = supertest(app) as any;
  token = makeToken();
});

afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});

beforeEach(async () => {
  const db = getDb();
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).deleteMany({});
  }
  vi.restoreAllMocks();
});

describe('POST /endpoint', () => {
  it('should return success', async () => {
    const res = await request.post('/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send(data);
    expect(res.status).toBe(200);
    expect(res.body.field).toBe(expected);
  });

  it('should return 400 for invalid input', async () => {
    const res = await request.post('/endpoint').send(invalidData);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

**Patterns:**
- `beforeAll`: Start MongoDB Memory Server, connect DB, init `supertest`, create token
- `afterAll`: Disconnect DB, stop MongoDB Memory Server
- `beforeEach`: Clear all collections, restore all mocks
- `describe`: Group tests by endpoint or feature
- `it`: Test specific behavior with descriptive name

## Mocking

**Framework:** Vitest native mocking (`vi`)

**Patterns:**
```typescript
// Mock external service checks
function mockChecksPass() {
  return import('../engagement-check.js').then((mod) => {
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue({ exists: true });
    vi.spyOn(mod, 'validateClient').mockResolvedValue({ exists: true });
  });
}

// Spy and mock in test
it('should return 409 when check returns true', async () => {
  const engagementCheck = await import('../engagement-check.js');
  const spy = vi.spyOn(engagementCheck, 'checkActiveEngagements').mockResolvedValue(true);

  const res = await request.delete(`/clients/${id}`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(409);
  expect(res.body.error.code).toBe('ACTIVE_ENGAGEMENTS');

  spy.mockRestore();
});
```

**What to Mock:**
- Inter-service HTTP calls (e.g., `engagement-check.ts`, `client-check.ts`)
- External dependencies that aren't under test
- Service-to-service validation checks

**What NOT to Mock:**
- Database operations (use MongoDB Memory Server instead)
- Express route handlers
- Middleware being tested

## Fixtures and Factories

**Test Data:**
```typescript
const testClient = {
  companyName: 'Acme Corp',
  industry: 'Technology',
  technicalStack: ['Node.js', 'MongoDB'],
  website: 'https://acme.com',
};

const testUser = { email: 'test@example.com', password: 'password123', name: 'Test User' };
```

**Helper Functions:**
```typescript
// Token factory
function makeToken(overrides?: Partial<{ userId: string; email: string; role: string }>): string {
  return jwt.sign(
    { userId: 'test-user-id', email: 'test@example.com', role: 'consultant', ...overrides },
    config.jwtSecret,
  );
}

// Entity creation helpers
async function createReport(data = testReport) {
  await mockChecksPass();
  return request.post('/reports')
    .set('Authorization', `Bearer ${token}`)
    .send(data);
}
```

**Location:**
- Defined at top of test files
- No shared fixtures directory currently

## Coverage

**Requirements:** 80% on service logic, 100% on API endpoints and Zod schemas

**View Coverage:**
```bash
# Add coverage to vitest config
# Currently no explicit coverage command documented
```

## Test Types

**Unit Tests:**
- Not currently implemented in services
- When added, test pure functions in isolation (e.g., `crypto.ts` utilities)

**Integration Tests:**
- Primary test type for all services
- Test full HTTP request/response cycle
- Use `supertest` for HTTP assertions
- MongoDB Memory Server for database

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  const res = await request.post('/endpoint').send(data);
  expect(res.status).toBe(200);
});
```

**Error Testing:**
```typescript
it('should return 401 without auth', async () => {
  const res = await request.post('/endpoint').send(data);
  expect(res.status).toBe(401);
});

it('should return 409 for duplicate', async () => {
  await createEntity();
  const res = await createEntity(); // Same data
  expect(res.status).toBe(409);
  expect(res.body.error.code).toBe('DUPLICATE_NAME');
});

it('should return 404 for non-existent', async () => {
  const res = await request.get('/endpoint/non-existent');
  expect(res.status).toBe(404);
});
```

**Pagination Testing:**
```typescript
it('should return paginated results', async () => {
  const res = await request.get('/clients?page=1&limit=2')
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
  expect(res.body.total).toBeGreaterThan(2);
  expect(res.body.page).toBe(1);
  expect(res.body.limit).toBe(2);
});
```

**Filter Testing:**
```typescript
it('should filter by field', async () => {
  const res = await request.get('/clients?industry=Technology')
    .set('Authorization', `Bearer ${token}`);
  expect(res.body.data.every((c: any) => c.industry === 'Technology')).toBe(true);
});
```

**Cascade Delete Testing:**
```typescript
it('should cascade delete related records', async () => {
  const createRes = await createClient();
  const clientId = createRes.body._id;

  // Create related record
  await request.post(`/clients/${clientId}/contacts`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'John Doe', email: 'john@example.com' });

  // Delete client
  await request.delete(`/clients/${clientId}`)
    .set('Authorization', `Bearer ${token}`);

  // Verify cascade
  const db = getDb();
  const contacts = await db.collection('contacts').find({ clientId }).toArray();
  expect(contacts).toHaveLength(0);
});
```

**Encrypted Data Testing:**
```typescript
it('should store encrypted data', async () => {
  const secretData = { sshKeys: ['my-secret-key'] };
  await request.put(`/clients/${id}/credentials`)
    .set('Authorization', `Bearer ${token}`)
    .send(secretData);

  const db = getDb();
  const raw = await db.collection('clients').findOne({ _id: id });
  // Verify raw DB value is NOT plaintext
  expect(raw!.codeCredentials!.sshKeys![0]).not.toBe('my-secret-key');
  // Verify encryption format: iv:authTag:ciphertext
  expect(raw!.codeCredentials!.sshKeys![0]).toContain(':');
});
```

**Version Testing (Reports):**
```typescript
it('should increment version on update', async () => {
  const createRes = await createReport();
  const res = await request.put(`/reports/${createRes.body._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Updated' });
  expect(res.body.version).toBe(2);
});
```

## Health Endpoint Testing

Every service includes health endpoint test:

```typescript
describe('GET /health', () => {
  it('should return ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('service-name');
  });
});
```

## Mock Restoration

Always restore mocks in `beforeEach`:

```typescript
beforeEach(async () => {
  // Clear collections...
  vi.restoreAllMocks();
});
```

Or manually restore after spy usage:

```typescript
const spy = vi.spyOn(module, 'function').mockResolvedValue(value);
// ... test code ...
spy.mockRestore();
```

## Test Organization Comments

Tests often use section comment separators for readability:

```typescript
// ── POST /clients ──────────────────────────────────────────────────
describe('POST /clients', () => { /* ... */ });

// ── GET /clients ────────────────────────────────────────────────────
describe('GET /clients', () => { /* ... */ });

// ── Health ───────────────────────────────────────────────────────────
describe('GET /health', () => { /* ... */ });
```

---

*Testing analysis: 2026-03-10*
