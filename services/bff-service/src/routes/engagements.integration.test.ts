import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { engagementsRouter } from './engagements.js';
import { fetchJson } from '../lib/service-client.js';

// Use vi.hoisted to create variables that can be referenced in mock factories
const { mockLog } = vi.hoisted(() => {
  return {
    mockLog: vi.fn(),
  };
});

// Mock logger to avoid actual logging in tests
vi.mock('../config.js', () => ({
  config: {
    serviceName: 'bff-service',
    jwtSecret: 'test-secret',
    clientServiceUrl: 'http://client-service:3002',
    engagementServiceUrl: 'http://engagement-service:3003',
    reportServiceUrl: 'http://report-service:3004',
    billingServiceUrl: 'http://billing-service:3005',
  },
}));

// Mock createLogger from @shire/shared
vi.mock('@shire/shared', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      log: mockLog,
    })),
    createAuthMiddleware: vi.fn(() => ({
      requireAuth: vi.fn((req, res, next) => {
        // Skip auth for tests
        next();
      }),
    })),
  };
});

// Mock fetchJson to control service responses
vi.mock('../lib/service-client.js', () => ({
  fetchJson: vi.fn(),
}));

const mockedFetchJson = fetchJson as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/engagements', engagementsRouter);
  return app;
}

describe('GET /api/engagements/:id', () => {
  const authHeader = 'Bearer test-token';
  const requestId = 'test-request-id-123';
  const engagementId = 'eng-123';

  it('should return engagement data with clientName when both services are healthy (happy path)', async () => {
    let callCount = 0;
    mockedFetchJson.mockImplementation((_url, _path, _auth, _reqId) => {
      callCount++;
      if (callCount === 1) {
        // First call: fetch engagement
        return Promise.resolve({
          status: 200,
          data: { id: engagementId, clientId: 'client-456', title: 'Test Engagement' },
        });
      } else {
        // Second call: enrich with client name
        return Promise.resolve({
          status: 200,
          data: { companyName: 'Test Client Corp' },
        });
      }
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get(`/api/engagements/${engagementId}`)
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: engagementId,
      clientId: 'client-456',
      title: 'Test Engagement',
      clientName: 'Test Client Corp',
    });

    // Verify fetchJson was called twice (engagement + client enrichment)
    expect(mockedFetchJson).toHaveBeenCalledTimes(2);

    // Verify request ID was propagated to both service calls
    expect(mockedFetchJson.mock.calls[0][3]).toBe(requestId);
    expect(mockedFetchJson.mock.calls[1][3]).toBe(requestId);
  });

  it('should return engagement data without clientName when client service fails (partial success)', async () => {
    let callCount = 0;
    mockedFetchJson.mockImplementation((_url, _path, _auth, _reqId) => {
      callCount++;
      if (callCount === 1) {
        // First call: fetch engagement successfully
        return Promise.resolve({
          status: 200,
          data: { id: engagementId, clientId: 'client-456', title: 'Test Engagement' },
        });
      } else {
        // Second call: client enrichment fails
        return Promise.reject(new Error('Client service unavailable'));
      }
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get(`/api/engagements/${engagementId}`)
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: engagementId,
      clientId: 'client-456',
      title: 'Test Engagement',
    });

    // Verify fetchJson was called twice (engagement + attempted client enrichment)
    expect(mockedFetchJson).toHaveBeenCalledTimes(2);

    // Verify warning was logged for failed enrichment
    const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');
    expect(warnLogCalls.length).toBeGreaterThan(0);

    // Verify requestId is included in warning logs
    const warnCallWithRequestId = warnLogCalls.some((call) => call[2]?.requestId === requestId);
    expect(warnCallWithRequestId).toBe(true);
  });

  it('should return HTTP 502 when engagement service fails (complete failure)', async () => {
    // Mock engagement service to fail
    mockedFetchJson.mockRejectedValue(new Error('Engagement service unavailable'));

    const app = createTestApp();
    const response = await supertest(app)
      .get(`/api/engagements/${engagementId}`)
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });

    // Verify error was logged with requestId
    const errorLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'error');
    expect(errorLogCalls.length).toBeGreaterThan(0);
    expect(errorLogCalls[0][2]).toMatchObject({ requestId });
  });

  it('should propagate X-Request-Id header to downstream services', async () => {
    const testRequestId = 'trace-456-xyz';
    const capturedRequestIds: string[] = [];

    mockedFetchJson.mockImplementation((_url, path, _auth, requestId) => {
      capturedRequestIds.push(requestId);
      if (path.includes('/engagements/')) {
        return Promise.resolve({
          status: 200,
          data: { id: engagementId, clientId: 'client-456', title: 'Test Engagement' },
        });
      } else {
        return Promise.resolve({
          status: 200,
          data: { companyName: 'Test Client Corp' },
        });
      }
    });

    const app = createTestApp();
    await supertest(app)
      .get(`/api/engagements/${engagementId}`)
      .set('Authorization', authHeader)
      .set('X-Request-Id', testRequestId);

    // Both service calls should have received request ID
    expect(capturedRequestIds).toHaveLength(2);
    expect(capturedRequestIds.every((id) => id === testRequestId)).toBe(true);
  });

  it('should log warning for failed client enrichment with requestId', async () => {
    let callCount = 0;
    mockedFetchJson.mockImplementation((_url, _path, _auth, _reqId) => {
      callCount++;
      if (callCount === 1) {
        // Engagement fetch succeeds
        return Promise.resolve({
          status: 200,
          data: { id: engagementId, clientId: 'client-456', title: 'Test Engagement' },
        });
      } else {
        // Client enrichment fails with specific error
        return Promise.reject(new Error('ECONNREFUSED: Connection refused'));
      }
    });

    const app = createTestApp();
    await supertest(app)
      .get(`/api/engagements/${engagementId}`)
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    // Count warning log calls
    const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');
    expect(warnLogCalls.length).toBeGreaterThan(0);

    // Verify warning contains requestId
    const warnCall = warnLogCalls[0];
    expect(warnCall[2]).toHaveProperty('requestId', requestId);

    // Verify warning contains engagementId and clientId for debugging
    expect(warnCall[2]).toHaveProperty('engagementId', engagementId);
    expect(warnCall[2]).toHaveProperty('clientId', 'client-456');
  });
});
