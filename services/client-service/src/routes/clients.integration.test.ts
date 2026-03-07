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
});

const testClient = {
  companyName: 'Acme Corp',
  industry: 'Technology',
  technicalStack: ['Node.js', 'MongoDB'],
  website: 'https://acme.com',
};

// ── Clients CRUD ──────────────────────────────────────────────────

describe('POST /clients', () => {
  it('should create a new client', async () => {
    const res = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    expect(res.status).toBe(201);
    expect(res.body.companyName).toBe(testClient.companyName);
    expect(res.body.industry).toBe(testClient.industry);
    expect(res.body._id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('should return 409 for duplicate company name', async () => {
    await request.post('/clients').set('Authorization', `Bearer ${token}`).send(testClient);
    const res = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_NAME');
  });

  it('should return 400 for invalid input', async () => {
    const res = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ website: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/clients').send(testClient);
    expect(res.status).toBe(401);
  });
});

describe('GET /clients', () => {
  beforeEach(async () => {
    await request.post('/clients').set('Authorization', `Bearer ${token}`).send(testClient);
    await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: 'Beta Inc', industry: 'Finance', technicalStack: ['Python'] });
    await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: 'Gamma Ltd', industry: 'Technology', technicalStack: ['Go'] });
  });

  it('should return paginated clients', async () => {
    const res = await request
      .get('/clients?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(2);
  });

  it('should filter by industry', async () => {
    const res = await request
      .get('/clients?industry=Technology')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((c: any) => c.industry === 'Technology')).toBe(true);
  });

  it('should filter by companyName', async () => {
    const res = await request
      .get('/clients?companyName=Beta')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].companyName).toBe('Beta Inc');
  });

  it('should not include codeCredentials in listing', async () => {
    const res = await request.get('/clients').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    for (const c of res.body.data) {
      expect(c.codeCredentials).toBeUndefined();
    }
  });
});

describe('GET /clients/:id', () => {
  it('should return a client by id', async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    const res = await request
      .get(`/clients/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.companyName).toBe(testClient.companyName);
    expect(res.body.codeCredentials).toBeUndefined();
  });

  it('should return 404 for non-existent client', async () => {
    const res = await request
      .get('/clients/non-existent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /clients/:id', () => {
  it('should update a client', async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    const res = await request
      .put(`/clients/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: 'Acme Corp Updated' });
    expect(res.status).toBe(200);
    expect(res.body.companyName).toBe('Acme Corp Updated');
  });

  it('should return 409 for duplicate company name on update', async () => {
    await request.post('/clients').set('Authorization', `Bearer ${token}`).send(testClient);
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: 'Other Corp', technicalStack: [] });
    const res = await request
      .put(`/clients/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: testClient.companyName });
    expect(res.status).toBe(409);
  });

  it('should return 404 for non-existent client', async () => {
    const res = await request
      .put('/clients/non-existent-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: 'New Name' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /clients/:id', () => {
  it('should delete a client and return 204', async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    const res = await request
      .delete(`/clients/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    // Verify deleted
    const getRes = await request
      .get(`/clients/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('should cascade delete contacts', async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    const clientId = createRes.body._id;

    // Create a contact
    await request
      .post(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'John Doe', email: 'john@acme.com' });

    // Delete client
    await request.delete(`/clients/${clientId}`).set('Authorization', `Bearer ${token}`);

    // Contacts should be gone (re-create client to check via DB)
    const db = getDb();
    const contacts = await db.collection('contacts').find({ clientId }).toArray();
    expect(contacts).toHaveLength(0);
  });

  it('should return 404 for non-existent client', async () => {
    const res = await request
      .delete('/clients/non-existent-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── Contacts CRUD ─────────────────────────────────────────────────

describe('Contacts CRUD', () => {
  let clientId: string;

  beforeEach(async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    clientId = createRes.body._id;
  });

  it('should create a contact', async () => {
    const res = await request
      .post(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe', email: 'jane@acme.com', role: 'CTO' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Jane Doe');
    expect(res.body.clientId).toBe(clientId);
  });

  it('should return 404 when creating contact for non-existent client', async () => {
    const res = await request
      .post('/clients/non-existent/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane', email: 'jane@test.com' });
    expect(res.status).toBe(404);
  });

  it('should list contacts for a client', async () => {
    await request
      .post(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Contact 1', email: 'c1@acme.com' });
    await request
      .post(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Contact 2', email: 'c2@acme.com' });

    const res = await request
      .get(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('should update a contact', async () => {
    const createRes = await request
      .post(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe', email: 'jane@acme.com' });

    const res = await request
      .put(`/clients/${clientId}/contacts/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Jane Updated');
  });

  it('should delete a contact', async () => {
    const createRes = await request
      .post(`/clients/${clientId}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Jane Doe', email: 'jane@acme.com' });

    const res = await request
      .delete(`/clients/${clientId}/contacts/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('should return 404 when updating non-existent contact', async () => {
    const res = await request
      .put(`/clients/${clientId}/contacts/non-existent`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('should return 404 when deleting non-existent contact', async () => {
    const res = await request
      .delete(`/clients/${clientId}/contacts/non-existent`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── Credentials ───────────────────────────────────────────────────

describe('Credentials', () => {
  let clientId: string;

  beforeEach(async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);
    clientId = createRes.body._id;
  });

  it('should store and retrieve credentials with encryption', async () => {
    const creds = {
      repoUrls: ['https://github.com/acme/repo'],
      sshKeys: ['ssh-rsa AAAAB3...'],
      tokens: ['ghp_abc123'],
    };

    const putRes = await request
      .put(`/clients/${clientId}/credentials`)
      .set('Authorization', `Bearer ${token}`)
      .send(creds);
    expect(putRes.status).toBe(200);

    const getRes = await request
      .get(`/clients/${clientId}/credentials`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.repoUrls).toEqual(creds.repoUrls);
    expect(getRes.body.sshKeys).toEqual(creds.sshKeys);
    expect(getRes.body.tokens).toEqual(creds.tokens);
  });

  it('should store credentials encrypted in the database', async () => {
    const creds = {
      sshKeys: ['my-secret-key'],
      tokens: ['my-secret-token'],
    };

    await request
      .put(`/clients/${clientId}/credentials`)
      .set('Authorization', `Bearer ${token}`)
      .send(creds);

    // Check raw DB values are NOT plaintext
    const db = getDb();
    const raw = await db.collection('clients').findOne({ _id: clientId } as any);
    expect(raw!.codeCredentials!.sshKeys![0]).not.toBe('my-secret-key');
    expect(raw!.codeCredentials!.tokens![0]).not.toBe('my-secret-token');
    // They should contain the iv:authTag:ciphertext format
    expect(raw!.codeCredentials!.sshKeys![0]).toContain(':');
  });

  it('should create audit log entries', async () => {
    const creds = { sshKeys: ['key1'] };

    await request
      .put(`/clients/${clientId}/credentials`)
      .set('Authorization', `Bearer ${token}`)
      .send(creds);
    await request
      .get(`/clients/${clientId}/credentials`)
      .set('Authorization', `Bearer ${token}`);

    const db = getDb();
    const logs = await db.collection('credential_access_logs').find({ clientId }).toArray();
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('write');
    expect(logs[1].action).toBe('read');
    expect(logs[0].userId).toBe('test-user-id');
  });

  it('should return 404 for non-existent client', async () => {
    const res = await request
      .get('/clients/non-existent/credentials')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── Active engagements check ──────────────────────────────────────

describe('Delete with active engagements', () => {
  it('should return 409 when client has active engagements', async () => {
    const createRes = await request
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(testClient);

    const engagementCheck = await import('../engagement-check.js');
    const spy = vi.spyOn(engagementCheck, 'checkActiveEngagements').mockResolvedValue(true);

    const res = await request
      .delete(`/clients/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_ENGAGEMENTS');

    spy.mockRestore();
  });
});

// ── Health ────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('client-service');
  });
});
