import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { createApp } from '../app.js';
import { connectDb, disconnectDb, getDb } from '../db.js';

let mongod: MongoMemoryServer;
let request: supertest.SuperTest<supertest.Test>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  const app = createApp();
  request = supertest(app) as any;
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

const testUser = { email: 'test@example.com', password: 'password123', name: 'Test User' };

describe('POST /auth/register', () => {
  it('should register a new user and return tokens', async () => {
    const res = await request.post('/auth/register').send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.name).toBe(testUser.name);
    expect(res.body.user.role).toBe('consultant');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should return 409 for duplicate email', async () => {
    await request.post('/auth/register').send(testUser);
    const res = await request.post('/auth/register').send(testUser);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('should return 400 for invalid input', async () => {
    const res = await request.post('/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request.post('/auth/register').send(testUser);
  });

  it('should login with valid credentials', async () => {
    const res = await request.post('/auth/login').send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should return 401 for wrong password', async () => {
    const res = await request.post('/auth/login').send({ email: testUser.email, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await request.post('/auth/login').send({ email: 'no@example.com', password: 'test' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('should refresh tokens with a valid refresh token', async () => {
    const registerRes = await request.post('/auth/register').send(testUser);
    const { refreshToken } = registerRes.body;

    const res = await request.post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Old token should be rotated (no longer valid)
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('should return 401 for invalid refresh token', async () => {
    const res = await request.post('/auth/refresh').send({ refreshToken: 'invalid' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('should invalidate refresh token', async () => {
    const registerRes = await request.post('/auth/register').send(testUser);
    const { accessToken, refreshToken } = registerRes.body;

    const logoutRes = await request
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    // Refresh should now fail
    const refreshRes = await request.post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('should return 401 without auth header', async () => {
    const res = await request.post('/auth/logout').send({ refreshToken: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('should return current user profile', async () => {
    const registerRes = await request.post('/auth/register').send(testUser);
    const { accessToken } = registerRes.body;

    const res = await request.get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testUser.email);
    expect(res.body.name).toBe(testUser.name);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('should return 401 without token', async () => {
    const res = await request.get('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /auth/me', () => {
  it('should update user profile', async () => {
    const registerRes = await request.post('/auth/register').send(testUser);
    const { accessToken } = registerRes.body;

    const res = await request
      .put('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.email).toBe(testUser.email);
  });

  it('should return 409 when updating to an existing email', async () => {
    await request.post('/auth/register').send(testUser);
    const otherUser = { email: 'other@example.com', password: 'password123', name: 'Other' };
    const otherRes = await request.post('/auth/register').send(otherUser);
    const { accessToken } = otherRes.body;

    const res = await request
      .put('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: testUser.email });
    expect(res.status).toBe(409);
  });
});

describe('GET /health', () => {
  it('should return ok', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Refresh token limit', () => {
  it('should keep at most 5 refresh tokens per user', async () => {
    const registerRes = await request.post('/auth/register').send(testUser);
    const { refreshToken: firstToken } = registerRes.body;

    // Generate 5 more login sessions (total 6 refresh tokens issued)
    for (let i = 0; i < 5; i++) {
      await request.post('/auth/login').send({ email: testUser.email, password: testUser.password });
    }

    // The first token should have been evicted
    const refreshRes = await request.post('/auth/refresh').send({ refreshToken: firstToken });
    expect(refreshRes.status).toBe(401);
  });
});
