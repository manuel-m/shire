import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
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

const testEngagement = {
  clientId: 'test-client-id',
  type: 'diagnostic',
  accessType: 'black-box',
  description: 'Security audit for Acme Corp',
  priority: 'high',
};

// Mock client-check to allow creation by default
function mockClientExists(hasCredentials = false) {
  const clientCheckModule = import('../client-check.js');
  return clientCheckModule.then((mod) =>
    vi.spyOn(mod, 'validateClient').mockResolvedValue({
      exists: true,
      hasCodeCredentials: hasCredentials,
    }),
  );
}

function mockClientNotFound() {
  return import('../client-check.js').then((mod) =>
    vi.spyOn(mod, 'validateClient').mockResolvedValue({
      exists: false,
      hasCodeCredentials: false,
    }),
  );
}

async function createEngagement(data = testEngagement) {
  await mockClientExists();
  const res = await request.post('/engagements').set('Authorization', `Bearer ${token}`).send(data);
  return res;
}

// ── POST /engagements ────────────────────────────────────────────

describe('POST /engagements', () => {
  it('should create a new engagement', async () => {
    const res = await createEngagement();
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(testEngagement.clientId);
    expect(res.body.type).toBe(testEngagement.type);
    expect(res.body.accessType).toBe(testEngagement.accessType);
    expect(res.body.status).toBe('requested');
    expect(res.body._id).toBeDefined();
    expect(res.body.creationDate).toBeDefined();
  });

  it('should return 400 for invalid input', async () => {
    await mockClientExists();
    const res = await request
      .post('/engagements')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'missing required fields' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent client', async () => {
    await mockClientNotFound();
    const res = await request
      .post('/engagements')
      .set('Authorization', `Bearer ${token}`)
      .send(testEngagement);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('should return 422 for code-credentials without client credentials', async () => {
    await mockClientExists(false);
    const res = await request
      .post('/engagements')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...testEngagement, accessType: 'code-credentials' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MISSING_CREDENTIALS');
  });

  it('should allow code-credentials when client has credentials', async () => {
    await mockClientExists(true);
    const res = await request
      .post('/engagements')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...testEngagement, accessType: 'code-credentials' });
    expect(res.status).toBe(201);
    expect(res.body.accessType).toBe('code-credentials');
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/engagements').send(testEngagement);
    expect(res.status).toBe(401);
  });
});

// ── GET /engagements ─────────────────────────────────────────────

describe('GET /engagements', () => {
  beforeEach(async () => {
    await createEngagement();
    await createEngagement({
      ...testEngagement,
      type: 'support',
      priority: 'low',
      description: 'Support engagement',
    });
    await createEngagement({
      ...testEngagement,
      type: 'resolution',
      priority: 'critical',
      description: 'Resolution engagement',
    });
  });

  it('should return paginated engagements', async () => {
    const res = await request
      .get('/engagements?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it('should filter by status', async () => {
    const res = await request
      .get('/engagements?status=requested')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.every((e: any) => e.status === 'requested')).toBe(true);
  });

  it('should filter by type', async () => {
    const res = await request
      .get('/engagements?type=support')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('support');
  });

  it('should filter by priority', async () => {
    const res = await request
      .get('/engagements?priority=critical')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].priority).toBe('critical');
  });

  it('should filter by clientId', async () => {
    const res = await request
      .get(`/engagements?clientId=${testEngagement.clientId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });
});

// ── GET /engagements/:id ─────────────────────────────────────────

describe('GET /engagements/:id', () => {
  it('should return an engagement by id', async () => {
    const createRes = await createEngagement();
    const res = await request
      .get(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe(testEngagement.description);
  });

  it('should return 404 for non-existent engagement', async () => {
    const res = await request
      .get('/engagements/non-existent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /engagements/client/:clientId ────────────────────────────

describe('GET /engagements/client/:clientId', () => {
  it('should return engagements for a client', async () => {
    await createEngagement();
    await createEngagement({
      ...testEngagement,
      description: 'Second engagement',
    });

    const res = await request
      .get(`/engagements/client/${testEngagement.clientId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('should return empty array for unknown client', async () => {
    const res = await request
      .get('/engagements/client/unknown-client')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ── PUT /engagements/:id ─────────────────────────────────────────

describe('PUT /engagements/:id', () => {
  it('should update an engagement', async () => {
    const createRes = await createEngagement();
    const res = await request
      .put(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated description', priority: 'critical' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated description');
    expect(res.body.priority).toBe('critical');
  });

  it('should not allow changing type via update', async () => {
    const createRes = await createEngagement();
    const res = await request
      .put(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'support' });
    expect(res.status).toBe(200);
    // type should not change since UpdateEngagementSchema doesn't include it
    expect(res.body.type).toBe('diagnostic');
  });

  it('should preserve creationDate on update', async () => {
    const createRes = await createEngagement();
    const res = await request
      .put(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'New desc' });
    expect(res.status).toBe(200);
    expect(res.body.creationDate).toBe(createRes.body.creationDate);
  });

  it('should return 404 for non-existent engagement', async () => {
    const res = await request
      .put('/engagements/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Nope' });
    expect(res.status).toBe(404);
  });
});

// ── PATCH /engagements/:id/status ────────────────────────────────

describe('PATCH /engagements/:id/status', () => {
  it('should transition from requested to diagnosis', async () => {
    const createRes = await createEngagement();
    const res = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'diagnosis' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('diagnosis');
  });

  it('should transition from diagnosis to in-progress', async () => {
    const createRes = await createEngagement();
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'diagnosis' });
    const res = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in-progress');
  });

  it('should transition between in-progress and waiting-for-client', async () => {
    const createRes = await createEngagement();
    // requested → diagnosis → in-progress → waiting-for-client → in-progress
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'diagnosis' });
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });
    const waitRes = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'waiting-for-client' });
    expect(waitRes.status).toBe(200);
    expect(waitRes.body.status).toBe('waiting-for-client');

    const backRes = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });
    expect(backRes.status).toBe(200);
    expect(backRes.body.status).toBe('in-progress');
  });

  it('should auto-set timeline.endDate when completing', async () => {
    const createRes = await createEngagement();
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'diagnosis' });
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });
    const res = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.timeline.endDate).toBeDefined();
  });

  it('should return 422 for invalid status transition', async () => {
    const createRes = await createEngagement();
    const res = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should return 422 for transition from completed', async () => {
    const createRes = await createEngagement();
    // Go to completed
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'diagnosis' });
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });
    await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });

    const res = await request
      .patch(`/engagements/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in-progress' });
    expect(res.status).toBe(422);
  });

  it('should return 404 for non-existent engagement', async () => {
    const res = await request
      .patch('/engagements/non-existent-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'diagnosis' });
    expect(res.status).toBe(404);
  });
});

// ── DELETE /engagements/:id ──────────────────────────────────────

describe('DELETE /engagements/:id', () => {
  it('should delete an engagement and return 204', async () => {
    const createRes = await createEngagement();
    const res = await request
      .delete(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const getRes = await request
      .get(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('should return 409 when engagement has associated reports/invoices', async () => {
    const createRes = await createEngagement();

    const reportInvoiceCheck = await import('../report-invoice-check.js');
    const spy = vi
      .spyOn(reportInvoiceCheck, 'checkAssociatedReportsOrInvoices')
      .mockResolvedValue(true);

    const res = await request
      .delete(`/engagements/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_RECORDS');

    spy.mockRestore();
  });

  it('should return 404 for non-existent engagement', async () => {
    const res = await request
      .delete('/engagements/non-existent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── Health ────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('engagement-service');
  });
});
