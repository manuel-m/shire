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

const testLineItems = [
  { description: 'Security audit', quantity: 10, unitPrice: 150, total: 1500 },
  { description: 'Report writing', quantity: 5, unitPrice: 100, total: 500 },
];

const testInvoice = {
  clientId: 'test-client-id',
  engagementId: 'test-engagement-id',
  currency: 'EUR',
  lineItems: testLineItems,
  issueDate: '2026-03-01',
  dueDate: '2026-04-01',
};

function mockEntitiesExist() {
  const entityCheckModule = import('../entity-check.js');
  return entityCheckModule.then((mod) => {
    vi.spyOn(mod, 'validateClient').mockResolvedValue(true);
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue(true);
  });
}

function mockClientNotFound() {
  return import('../entity-check.js').then((mod) => {
    vi.spyOn(mod, 'validateClient').mockResolvedValue(false);
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue(true);
  });
}

function mockEngagementNotFound() {
  return import('../entity-check.js').then((mod) => {
    vi.spyOn(mod, 'validateClient').mockResolvedValue(true);
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue(false);
  });
}

async function createInvoice(data = testInvoice) {
  await mockEntitiesExist();
  const res = await request.post('/invoices').set('Authorization', `Bearer ${token}`).send(data);
  return res;
}

async function transitionToStatus(invoiceId: string, targetStatus: string) {
  const transitions: Record<string, string[]> = {
    issued: ['issued'],
    'pending-payment': ['issued', 'pending-payment'],
    paid: ['issued', 'pending-payment', 'paid'],
    overdue: ['issued', 'pending-payment', 'overdue'],
  };

  const steps = transitions[targetStatus] || [];
  for (const status of steps) {
    await request
      .patch(`/invoices/${invoiceId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });
  }
}

// ── POST /invoices ────────────────────────────────────────────

describe('POST /invoices', () => {
  it('should create a new invoice', async () => {
    const res = await createInvoice();
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(testInvoice.clientId);
    expect(res.body.engagementId).toBe(testInvoice.engagementId);
    expect(res.body.status).toBe('draft');
    expect(res.body._id).toBeDefined();
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}-\d{3}$/);
    expect(res.body.amount).toBe(2000);
    expect(res.body.createdAt).toBeDefined();
  });

  it('should auto-generate sequential invoice numbers', async () => {
    const res1 = await createInvoice();
    const res2 = await createInvoice();
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    // Second invoice should have next sequence number
    const seq1 = parseInt(res1.body.invoiceNumber.split('-')[2], 10);
    const seq2 = parseInt(res2.body.invoiceNumber.split('-')[2], 10);
    expect(seq2).toBe(seq1 + 1);
  });

  it('should compute amount from line items', async () => {
    const res = await createInvoice({
      ...testInvoice,
      lineItems: [
        { description: 'Item 1', quantity: 2, unitPrice: 100, total: 200 },
        { description: 'Item 2', quantity: 3, unitPrice: 50, total: 150 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(350);
  });

  it('should return 400 for invalid input', async () => {
    await mockEntitiesExist();
    const res = await request
      .post('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent client', async () => {
    await mockClientNotFound();
    const res = await request
      .post('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(testInvoice);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('should return 404 for non-existent engagement', async () => {
    await mockEngagementNotFound();
    const res = await request
      .post('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(testInvoice);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ENGAGEMENT_NOT_FOUND');
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/invoices').send(testInvoice);
    expect(res.status).toBe(401);
  });
});

// ── GET /invoices ─────────────────────────────────────────────

describe('GET /invoices', () => {
  beforeEach(async () => {
    await createInvoice();
    await createInvoice({ ...testInvoice, clientId: 'other-client' });
    await createInvoice({ ...testInvoice, engagementId: 'other-engagement' });
  });

  it('should return paginated invoices', async () => {
    const res = await request
      .get('/invoices?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it('should filter by status', async () => {
    const res = await request.get('/invoices?status=draft').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.every((i: any) => i.status === 'draft')).toBe(true);
  });

  it('should filter by clientId', async () => {
    const res = await request
      .get('/invoices?clientId=other-client')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].clientId).toBe('other-client');
  });

  it('should filter by engagementId', async () => {
    const res = await request
      .get('/invoices?engagementId=other-engagement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].engagementId).toBe('other-engagement');
  });
});

// ── GET /invoices/:id ─────────────────────────────────────────

describe('GET /invoices/:id', () => {
  it('should return an invoice by id', async () => {
    const createRes = await createInvoice();
    const res = await request
      .get(`/invoices/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.clientId).toBe(testInvoice.clientId);
  });

  it('should return 404 for non-existent invoice', async () => {
    const res = await request
      .get('/invoices/non-existent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /invoices/client/:clientId ────────────────────────────

describe('GET /invoices/client/:clientId', () => {
  it('should return invoices for a client', async () => {
    await createInvoice();
    await createInvoice();

    const res = await request
      .get(`/invoices/client/${testInvoice.clientId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('should return empty array for unknown client', async () => {
    const res = await request
      .get('/invoices/client/unknown-client')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ── GET /invoices/engagement/:engagementId ────────────────────

describe('GET /invoices/engagement/:engagementId', () => {
  it('should return invoices for an engagement', async () => {
    await createInvoice();
    await createInvoice();

    const res = await request
      .get(`/invoices/engagement/${testInvoice.engagementId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('should return empty array for unknown engagement', async () => {
    const res = await request
      .get('/invoices/engagement/unknown-engagement')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ── PUT /invoices/:id ─────────────────────────────────────────

describe('PUT /invoices/:id', () => {
  it('should update a draft invoice', async () => {
    const createRes = await createInvoice();
    const newItems = [{ description: 'Updated item', quantity: 1, unitPrice: 999, total: 999 }];
    const res = await request
      .put(`/invoices/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lineItems: newItems, currency: 'USD' });
    expect(res.status).toBe(200);
    expect(res.body.lineItems).toHaveLength(1);
    expect(res.body.amount).toBe(999);
    expect(res.body.currency).toBe('USD');
  });

  it('should reject update of non-draft invoice', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'issued');

    const res = await request
      .put(`/invoices/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'GBP' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_EDITABLE');
  });

  it('should return 404 for non-existent invoice', async () => {
    const res = await request
      .put('/invoices/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'GBP' });
    expect(res.status).toBe(404);
  });
});

// ── PATCH /invoices/:id/status ────────────────────────────────

describe('PATCH /invoices/:id/status', () => {
  it('should transition from draft to issued', async () => {
    const createRes = await createInvoice();
    const res = await request
      .patch(`/invoices/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'issued' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('issued');
  });

  it('should transition through full lifecycle to paid', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'paid');

    const res = await request
      .get(`/invoices/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.paidDate).toBeDefined();
  });

  it('should auto-set paidDate when marking as paid', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'pending-payment');

    const res = await request
      .patch(`/invoices/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.paidDate).toBeDefined();
  });

  it('should allow paid from overdue', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'overdue');

    const res = await request
      .patch(`/invoices/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  it('should return 422 for invalid status transition', async () => {
    const createRes = await createInvoice();
    const res = await request
      .patch(`/invoices/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('should return 422 for transition from paid', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'paid');

    const res = await request
      .patch(`/invoices/${createRes.body._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'issued' });
    expect(res.status).toBe(422);
  });

  it('should return 404 for non-existent invoice', async () => {
    const res = await request
      .patch('/invoices/non-existent-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'issued' });
    expect(res.status).toBe(404);
  });
});

// ── POST /invoices/:id/send ───────────────────────────────────

describe('POST /invoices/:id/send', () => {
  it('should send an issued invoice and transition to pending-payment', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'issued');

    const res = await request
      .post(`/invoices/${createRes.body._id}/send`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending-payment');
  });

  it('should return 422 for non-issued invoice', async () => {
    const createRes = await createInvoice();
    const res = await request
      .post(`/invoices/${createRes.body._id}/send`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_OPERATION');
  });

  it('should return 404 for non-existent invoice', async () => {
    const res = await request
      .post('/invoices/non-existent-id/send')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── POST /invoices/:id/remind ─────────────────────────────────

describe('POST /invoices/:id/remind', () => {
  it('should send reminder for pending-payment invoice', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'pending-payment');

    const res = await request
      .post(`/invoices/${createRes.body._id}/remind`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payment reminder sent');
  });

  it('should send reminder for overdue invoice', async () => {
    const createRes = await createInvoice();
    await transitionToStatus(createRes.body._id, 'overdue');

    const res = await request
      .post(`/invoices/${createRes.body._id}/remind`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Payment reminder sent');
  });

  it('should return 422 for draft invoice', async () => {
    const createRes = await createInvoice();
    const res = await request
      .post(`/invoices/${createRes.body._id}/remind`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_OPERATION');
  });

  it('should return 404 for non-existent invoice', async () => {
    const res = await request
      .post('/invoices/non-existent-id/remind')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── Health ────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('billing-service');
  });
});
