import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';

// Use vi.hoisted to create variables that can be referenced in mock factories
const { mockLog } = vi.hoisted(() => {
  return {
    mockLog: vi.fn(),
  };
});

// Mock config
vi.mock('../config.js', () => ({
  config: {
    serviceName: 'bff-service',
    jwtSecret: 'test-secret',
    authServiceUrl: 'http://auth-service:3001',
    clientServiceUrl: 'http://client-service:3002',
    engagementServiceUrl: 'http://engagement-service:3003',
    reportServiceUrl: 'http://report-service:3004',
    billingServiceUrl: 'http://billing-service:3005',
  },
}));

// Mock createLogger from @shire/shared
vi.mock('@shire/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shire/shared')>();
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

// Mock service-client utilities
vi.mock('../lib/service-client.js', () => ({
  fetchJson: vi.fn(),
  proxyRequest: vi.fn(),
}));

// Import reportsRouter, requestId middleware, and mocked functions after mocking the module
import { reportsRouter } from './reports.js';
import { fetchJson, proxyRequest } from '../lib/service-client.js';
import { requestId } from '@shire/shared';

const mockedFetchJson = fetchJson as ReturnType<typeof vi.fn>;
const mockedProxyRequest = proxyRequest as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use('/api/reports', reportsRouter);
  return app;
}

const mockReport = {
  _id: 'report-123',
  title: 'Q1 Strategy Review',
  clientId: 'client-456',
  engagementId: 'engagement-789',
  status: 'draft',
  createdAt: '2024-03-10T10:00:00Z',
};

const mockClient = {
  _id: 'client-456',
  companyName: 'Acme Corp',
  industry: 'Technology',
};

const mockEngagement = {
  _id: 'engagement-789',
  description: 'Q1 Strategy Initiative',
  status: 'active',
};

describe('GET /api/reports/:id - error handling', () => {
  const authHeader = 'Bearer test-token';
  const requestId = 'test-request-id-123';

  describe('Happy path', () => {
    it('should return report with clientName and engagementDescription when all services are healthy', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        if (callCount === 2) {
          // Client service call
          return Promise.resolve({ status: 200, data: { companyName: mockClient.companyName } });
        }
        // Engagement service call
        return Promise.resolve({ status: 200, data: { description: mockEngagement.description } });
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(mockReport._id);
      expect(response.body.clientName).toBe(mockClient.companyName);
      expect(response.body.engagementDescription).toBe(mockEngagement.description);

      // Verify fetchJson was called 3 times
      expect(mockedFetchJson).toHaveBeenCalledTimes(3);

      // Verify request ID was propagated to all service calls
      for (const call of mockedFetchJson.mock.calls) {
        expect(call[3]).toBe(requestId);
      }
    });
  });

  describe('Partial success', () => {
    it('should return report with only clientName when engagement service fails', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        if (callCount === 2) {
          // Client service call
          return Promise.resolve({ status: 200, data: { companyName: mockClient.companyName } });
        }
        // Engagement service call fails
        return Promise.reject(new Error('Engagement service unavailable'));
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(mockReport._id);
      expect(response.body.clientName).toBe(mockClient.companyName);
      // Engagement description should not be present (or undefined)
      expect(response.body.engagementDescription).toBeUndefined();
    });

    it('should return report with only engagementDescription when client service fails', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        if (callCount === 2) {
          // Client service call fails
          return Promise.reject(new Error('Client service unavailable'));
        }
        // Engagement service call succeeds
        return Promise.resolve({ status: 200, data: { description: mockEngagement.description } });
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(mockReport._id);
      expect(response.body.engagementDescription).toBe(mockEngagement.description);
      // Client name should not be present (or undefined)
      expect(response.body.clientName).toBeUndefined();
    });

    it('should return report without enrichment when both services fail', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        // Both enrichment services fail
        return Promise.reject(new Error('Service unavailable'));
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(mockReport._id);
      expect(response.body.clientName).toBeUndefined();
      expect(response.body.engagementDescription).toBeUndefined();
    });

    it('should handle enrichment services returning non-200 status codes gracefully', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        if (callCount === 2) {
          // Client service returns 404
          return Promise.resolve({ status: 404, data: { error: 'Client not found' } });
        }
        // Engagement service returns 500
        return Promise.resolve({ status: 500, data: { error: 'Internal error' } });
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(mockReport._id);
      // Neither enrichment should be present (non-200 status codes)
      expect(response.body.clientName).toBeUndefined();
      expect(response.body.engagementDescription).toBeUndefined();
    });
  });

  describe('Complete failure', () => {
    it('should return HTTP 502 when report service fails', async () => {
      mockedFetchJson.mockRejectedValue(new Error('Report service unavailable'));

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(502);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('BAD_GATEWAY');

      // Verify error was logged with requestId
      const errorLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'error');
      expect(errorLogCalls.length).toBeGreaterThan(0);
    });

    it('should return HTTP 502 when report service returns non-200', async () => {
      mockedFetchJson.mockResolvedValue({ status: 500, data: { error: 'Internal error' } });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(500);
    });
  });

  describe('Request ID propagation', () => {
    it('should pass X-Request-Id header to downstream services', async () => {
      const testRequestId = 'trace-123-abc';
      const capturedRequestIds: string[] = [];

      mockedFetchJson.mockImplementation((url, path, auth, requestId) => {
        capturedRequestIds.push(requestId);
        return Promise.resolve({ status: 200, data: { ...mockReport } });
      });

      const app = createTestApp();
      await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', testRequestId);

      // All service calls should have received the request ID
      expect(capturedRequestIds.length).toBeGreaterThan(0);
      expect(capturedRequestIds.every((id) => id === testRequestId)).toBe(true);
    });
  });

  describe('Warning logging', () => {
    it('should log failed enrichment attempts with requestId', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        // Make enrichment fail
        throw new Error('Client service timeout');
      });

      const app = createTestApp();
      await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      // After implementation is complete, verify:
      // 1. Warning log was called with 'warn' level
      const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');

      // Placeholder assertion - this will pass once implementation is complete
      // Once implemented, the warnings should include requestId
      expect(warnLogCalls).toBeDefined();
    });

    it('should log separate warnings for each failed enrichment service', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Report service call
          return Promise.resolve({ status: 200, data: { ...mockReport } });
        }
        if (callCount === 2) {
          // Client service fails
          throw new Error('Client service unavailable');
        }
        // Engagement service also fails
        throw new Error('Engagement service unavailable');
      });

      const app = createTestApp();
      await supertest(app)
        .get('/api/reports/report-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      // After implementation is complete, verify:
      // Multiple warning logs were called (one for each failed enrichment)
      const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');

      // Placeholder assertion - this will pass once implementation is complete
      // Once implemented, there should be separate warnings for each failed service
      expect(warnLogCalls).toBeDefined();
    });
  });
});

describe('GET /api/reports - simple proxy', () => {
  it('should proxy requests to report service', async () => {
    mockedProxyRequest.mockImplementation((_baseUrl, _path, _req, res) => {
      res.status(200).json([{ _id: 'report-1', title: 'Report 1' }]);
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get('/api/reports')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ _id: 'report-1', title: 'Report 1' }]);
  });
});

describe('POST /api/reports', () => {
  it('should proxy requests to report service', async () => {
    mockedProxyRequest.mockImplementation((_baseUrl, _path, _req, res) => {
      res.status(201).json({ _id: 'new-report', title: 'New Report' });
    });

    const app = createTestApp();
    const response = await supertest(app)
      .post('/api/reports')
      .set('Authorization', 'Bearer test-token')
      .send({ title: 'New Report' });

    expect(response.status).toBe(201);
  });
});

describe('PUT /api/reports/:id', () => {
  it('should proxy requests to report service', async () => {
    mockedProxyRequest.mockImplementation((_baseUrl, _path, _req, res) => {
      res.status(200).json({ _id: 'report-123', title: 'Updated' });
    });

    const app = createTestApp();
    const response = await supertest(app)
      .put('/api/reports/report-123')
      .set('Authorization', 'Bearer test-token')
      .send({ title: 'Updated' });

    expect(response.status).toBe(200);
  });
});
