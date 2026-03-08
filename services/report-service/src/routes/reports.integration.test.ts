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

const testReport = {
  engagementId: 'test-engagement-id',
  clientId: 'test-client-id',
  title: 'Security Audit Report',
  sections: {
    executiveSummary: 'This is the executive summary.',
    problems: [
      {
        title: 'SQL Injection',
        severity: 'critical' as const,
        description: 'Found SQL injection in login form',
        impact: 'Full database compromise',
      },
    ],
    recommendations: [
      {
        title: 'Use parameterized queries',
        priority: 'high' as const,
        description: 'Replace string concatenation with parameterized queries',
      },
    ],
    actionPlan: [
      {
        step: 1,
        title: 'Fix login form',
        description: 'Parameterize the login query',
        responsible: 'Dev Team',
      },
    ],
  },
};

function mockChecksPass() {
  return import('../engagement-check.js').then((mod) => {
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue({ exists: true });
    vi.spyOn(mod, 'validateClient').mockResolvedValue({ exists: true });
  });
}

function mockEngagementNotFound() {
  return import('../engagement-check.js').then((mod) => {
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue({ exists: false });
    vi.spyOn(mod, 'validateClient').mockResolvedValue({ exists: true });
  });
}

function mockClientNotFound() {
  return import('../engagement-check.js').then((mod) => {
    vi.spyOn(mod, 'validateEngagement').mockResolvedValue({ exists: true });
    vi.spyOn(mod, 'validateClient').mockResolvedValue({ exists: false });
  });
}

async function createReport(data = testReport) {
  await mockChecksPass();
  return request.post('/reports').set('Authorization', `Bearer ${token}`).send(data);
}

// ── POST /reports ─────────────────────────────────────────────────

describe('POST /reports', () => {
  it('should create a new report', async () => {
    const res = await createReport();
    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.version).toBe(1);
    expect(res.body.status).toBe('draft');
    expect(res.body.title).toBe(testReport.title);
    expect(res.body.engagementId).toBe(testReport.engagementId);
    expect(res.body.clientId).toBe(testReport.clientId);
    expect(res.body.createdAt).toBeDefined();
  });

  it('should return 400 for invalid input', async () => {
    await mockChecksPass();
    const res = await request
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Missing required fields' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 for non-existent engagement', async () => {
    await mockEngagementNotFound();
    const res = await request
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(testReport);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ENGAGEMENT_NOT_FOUND');
  });

  it('should return 404 for non-existent client', async () => {
    await mockClientNotFound();
    const res = await request
      .post('/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(testReport);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/reports').send(testReport);
    expect(res.status).toBe(401);
  });
});

// ── GET /reports ──────────────────────────────────────────────────

describe('GET /reports', () => {
  beforeEach(async () => {
    await createReport();
    await createReport({ ...testReport, title: 'Second Report' });
  });

  it('should return paginated reports', async () => {
    const res = await request
      .get('/reports?page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
  });

  it('should filter by engagementId', async () => {
    const res = await request
      .get(`/reports?engagementId=${testReport.engagementId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should filter by status', async () => {
    const res = await request.get('/reports?status=draft').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((r: any) => r.status === 'draft')).toBe(true);
  });
});

// ── GET /reports/:id ──────────────────────────────────────────────

describe('GET /reports/:id', () => {
  it('should return a report by id', async () => {
    const createRes = await createReport();
    const res = await request
      .get(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(testReport.title);
  });

  it('should return 404 for non-existent report', async () => {
    const res = await request
      .get('/reports/non-existent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── PUT /reports/:id ──────────────────────────────────────────────

describe('PUT /reports/:id', () => {
  it('should update a draft report and increment version', async () => {
    const createRes = await createReport();
    const res = await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
    expect(res.body.version).toBe(2);
  });

  it('should store previous version on update', async () => {
    const createRes = await createReport();
    await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Title' });

    const versionsRes = await request
      .get(`/reports/${createRes.body._id}/versions`)
      .set('Authorization', `Bearer ${token}`);
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body).toHaveLength(2);
    expect(versionsRes.body[0].version).toBe(1);
    expect(versionsRes.body[1].version).toBe(2);
  });

  it('should return 422 for non-draft report', async () => {
    const createRes = await createReport();
    // Set status to review directly
    await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'review' });

    const res = await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should not work' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IMMUTABLE_STATUS');
  });

  it('should return 404 for non-existent report', async () => {
    const res = await request
      .put('/reports/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('should merge sections on partial update', async () => {
    const createRes = await createReport();
    const res = await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sections: {
          executiveSummary: 'Updated summary',
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.sections.executiveSummary).toBe('Updated summary');
    // Original problems should still be there
    expect(res.body.sections.problems).toHaveLength(1);
  });
});

// ── GET /reports/:id/versions ─────────────────────────────────────

describe('GET /reports/:id/versions', () => {
  it('should return all versions', async () => {
    const createRes = await createReport();
    await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'V2' });
    await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'V3' });

    const res = await request
      .get(`/reports/${createRes.body._id}/versions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].version).toBe(1);
    expect(res.body[1].version).toBe(2);
    expect(res.body[2].version).toBe(3);
  });

  it('should return 404 for non-existent report', async () => {
    const res = await request
      .get('/reports/non-existent-id/versions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /reports/:id/versions/:version ────────────────────────────

describe('GET /reports/:id/versions/:version', () => {
  it('should return a specific version', async () => {
    const createRes = await createReport();
    await request
      .put(`/reports/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'V2' });

    const res = await request
      .get(`/reports/${createRes.body._id}/versions/1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.title).toBe(testReport.title);
  });

  it('should return current version', async () => {
    const createRes = await createReport();
    const res = await request
      .get(`/reports/${createRes.body._id}/versions/1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
  });

  it('should return 404 for non-existent version', async () => {
    const createRes = await createReport();
    const res = await request
      .get(`/reports/${createRes.body._id}/versions/99`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VERSION_NOT_FOUND');
  });
});

// ── POST /reports/:id/generate/markdown ───────────────────────────

describe('POST /reports/:id/generate/markdown', () => {
  it('should generate markdown from report', async () => {
    const createRes = await createReport();
    const res = await request
      .post(`/reports/${createRes.body._id}/generate/markdown`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.markdown).toContain('# Security Audit Report');
    expect(res.body.markdown).toContain('## Executive Summary');
    expect(res.body.markdown).toContain('SQL Injection');
    expect(res.body.markdown).toContain('## Recommendations');
    expect(res.body.markdown).toContain('## Action Plan');
  });

  it('should return 404 for non-existent report', async () => {
    const res = await request
      .post('/reports/non-existent-id/generate/markdown')
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
    expect(res.body.service).toBe('report-service');
  });
});
