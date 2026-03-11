import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express, Request, Response } from 'express';
import supertest from 'supertest';

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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const actual = (await importOriginal()) as Record<string, unknown>;
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

// Import invoicesRouter, requestId middleware, and mocked functions after mocking module
import { invoicesRouter } from './invoices.js';
import { fetchJson, proxyRequest } from '../lib/service-client.js';
import { requestId } from '@shire/shared';

const mockedFetchJson = fetchJson as ReturnType<typeof vi.fn>;
const mockedProxyRequest = proxyRequest as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use('/api/invoices', invoicesRouter);
  return app;
}

describe('GET /api/invoices/:id - Enriched Invoice Detail', () => {
  const authHeader = 'Bearer test-token';
  const requestId = 'test-request-id-123';

  describe('Happy path - All services healthy', () => {
    it('should return invoice data with clientName and engagementDescription when all services respond successfully', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service call
          return Promise.resolve({
            status: 200,
            data: {
              id: 'invoice-123',
              clientId: 'client-456',
              engagementId: 'engagement-789',
              amount: 5000,
              status: 'paid',
            },
          });
        }
        if (callCount === 2) {
          // Client service call
          return Promise.resolve({
            status: 200,
            data: {
              companyName: 'Acme Corp',
            },
          });
        }
        // Engagement service call
        return Promise.resolve({
          status: 200,
          data: {
            description: 'Q1 2026 Consulting Services',
          },
        });
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'invoice-123',
        clientId: 'client-456',
        engagementId: 'engagement-789',
        amount: 5000,
        status: 'paid',
        clientName: 'Acme Corp',
        engagementDescription: 'Q1 2026 Consulting Services',
      });

      // Verify all three services were called with correct arguments
      expect(mockedFetchJson).toHaveBeenCalledTimes(3);
      expect(mockedFetchJson).toHaveBeenNthCalledWith(
        1,
        'http://billing-service:3005',
        '/invoices/invoice-123',
        'Bearer test-token',
        requestId,
      );
      expect(mockedFetchJson).toHaveBeenNthCalledWith(
        2,
        'http://client-service:3002',
        '/clients/client-456',
        'Bearer test-token',
        requestId,
      );
      expect(mockedFetchJson).toHaveBeenNthCalledWith(
        3,
        'http://engagement-service:3003',
        '/engagements/engagement-789',
        'Bearer test-token',
        requestId,
      );
    });
  });

  describe('Partial success - Client service only', () => {
    it('should return invoice data with only clientName when engagement service fails', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service call
          return Promise.resolve({
            status: 200,
            data: {
              id: 'invoice-123',
              clientId: 'client-456',
              engagementId: 'engagement-789',
              amount: 5000,
            },
          });
        }
        if (callCount === 2) {
          // Client service response (success)
          return Promise.resolve({
            status: 200,
            data: {
              companyName: 'Acme Corp',
            },
          });
        }
        // Engagement service response (failure)
        return Promise.reject(new Error('Engagement service unavailable'));
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'invoice-123',
        clientId: 'client-456',
        engagementId: 'engagement-789',
        amount: 5000,
        clientName: 'Acme Corp',
      });

      // engagementDescription should not be present
      expect(response.body.engagementDescription).toBeUndefined();
    });
  });

  describe('Partial success - Neither enrichment service', () => {
    it('should return invoice data without enrichment when both client and engagement services fail', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service call
          return Promise.resolve({
            status: 200,
            data: {
              id: 'invoice-123',
              clientId: 'client-456',
              engagementId: 'engagement-789',
              amount: 5000,
            },
          });
        }
        // Both enrichment services fail
        return Promise.reject(new Error('Service unavailable'));
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'invoice-123',
        clientId: 'client-456',
        engagementId: 'engagement-789',
        amount: 5000,
      });

      // Neither enrichment field should be present
      expect(response.body.clientName).toBeUndefined();
      expect(response.body.engagementDescription).toBeUndefined();
    });
  });

  describe('Complete failure - Billing service unavailable', () => {
    it('should return HTTP 502 when billing service fails', async () => {
      mockedFetchJson.mockRejectedValue(new Error('Billing service unavailable'));

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(502);
      expect(response.body).toEqual({
        error: { code: 'BAD_GATEWAY', message: 'Billing service unavailable' },
      });

      // Only billing service should have been called
      expect(mockedFetchJson).toHaveBeenCalledTimes(1);
    });

    it('should return HTTP 404 when billing service returns 404', async () => {
      mockedFetchJson.mockResolvedValue({
        status: 404,
        data: { error: { code: 'NOT_FOUND', message: 'Invoice not found' } },
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });

      // Only billing service should have been called
      expect(mockedFetchJson).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request ID propagation', () => {
    it('should pass X-Request-Id header to all downstream service calls', async () => {
      const testRequestId = 'test-request-id-abc';

      mockedFetchJson.mockImplementation(() => {
        return Promise.resolve({ status: 200, data: {} });
      });

      const app = createTestApp();
      await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', testRequestId);

      // Verify X-Request-Id was passed to all calls
      expect(mockedFetchJson).toHaveBeenCalledTimes(3);
      mockedFetchJson.mock.calls.forEach((call) => {
        expect(call[3]).toBe(testRequestId);
      });
    });

    it('should include different request IDs when they vary', async () => {
      const testRequestId = 'custom-request-id-abc123';

      // Create app with custom middleware that sets different request IDs
      const customApp = express();
      customApp.use(express.json());
      customApp.use((req: Request, _res: Response, next) => {
        req.requestId = testRequestId;
        next();
      });
      customApp.use('/api/invoices', invoicesRouter);

      mockedFetchJson.mockImplementation(() => {
        return Promise.resolve({ status: 200, data: {} });
      });

      await supertest(customApp).get('/api/invoices/invoice-123').set('Authorization', authHeader);

      // Verify custom request ID was passed
      expect(mockedFetchJson).toHaveBeenCalledTimes(3);
      mockedFetchJson.mock.calls.forEach((call) => {
        expect(call[3]).toBe(testRequestId);
      });
    });
  });

  describe('Warning logging - Failed enrichment attempts', () => {
    it('should log warnings when client enrichment fails', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service response
          return Promise.resolve({
            status: 200,
            data: { id: 'invoice-123', clientId: 'client-456', engagementId: 'engagement-789' },
          });
        }
        if (callCount === 2) {
          // Client service response (failure)
          return Promise.reject(new Error('Client service unavailable'));
        }
        // Engagement service response (success)
        return Promise.resolve({ status: 200, data: { description: 'Q1 Services' } });
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);

      // Verify warning was logged for failed client enrichment
      const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');
      const clientWarn = warnLogCalls.find((call) => call[1]?.includes('Client enrichment failed'));
      expect(clientWarn).toBeDefined();
      expect(clientWarn?.[2]).toHaveProperty('requestId', requestId);
    });

    it('should log warnings when engagement enrichment fails', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service response
          return Promise.resolve({
            status: 200,
            data: { id: 'invoice-123', clientId: 'client-456', engagementId: 'engagement-789' },
          });
        }
        if (callCount === 2) {
          // Client service response (success)
          return Promise.resolve({ status: 200, data: { companyName: 'Acme Corp' } });
        }
        // Engagement service response (failure)
        return Promise.reject(new Error('Engagement service unavailable'));
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);

      // Verify warning was logged for failed engagement enrichment
      const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');
      const engagementWarn = warnLogCalls.find((call) =>
        call[1]?.includes('Engagement enrichment failed'),
      );
      expect(engagementWarn).toBeDefined();
      expect(engagementWarn?.[2]).toHaveProperty('requestId', requestId);
    });

    it('should include requestId in enrichment failure logs', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service response
          return Promise.resolve({
            status: 200,
            data: { id: 'invoice-123', clientId: 'client-456', engagementId: 'engagement-789' },
          });
        }
        // Both enrichment services to fail
        return Promise.reject(new Error('Service unavailable'));
      });

      const app = createTestApp();
      const response = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(response.status).toBe(200);

      // Verify requestId is included in warning logs
      const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');
      expect(warnLogCalls.length).toBeGreaterThan(0);
      warnLogCalls.forEach((call) => {
        expect(call[2]).toHaveProperty('requestId', requestId);
      });
    });
  });

  describe('Promise.allSettled behavior - Parallel enrichment', () => {
    it('should make parallel calls to client and engagement services (Promise.allSettled pattern)', async () => {
      let clientCallTime: number | null = null;
      let engagementCallTime: number | null = null;
      let billingCallTime: number | null = null;

      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service
          billingCallTime = Date.now();
          return {
            status: 200,
            data: { id: 'invoice-123', clientId: 'client-456', engagementId: 'engagement-789' },
          };
        }
        if (callCount === 2) {
          // Client service with slight delay
          clientCallTime = Date.now();
          return new Promise((resolve) =>
            setTimeout(() => resolve({ status: 200, data: { companyName: 'Acme Corp' } }), 10),
          );
        }
        // Engagement service
        engagementCallTime = Date.now();
        return { status: 200, data: { description: 'Q1 Services' } };
      });

      const app = createTestApp();
      await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      // Verify timing indicates parallel calls (within same time window)
      expect(billingCallTime).toBeDefined();
      expect(clientCallTime).toBeDefined();
      expect(engagementCallTime).toBeDefined();

      // After implementation with Promise.allSettled, client and engagement should be called
      // in parallel (time difference < 5ms)
      const timeDiff = Math.abs((clientCallTime || 0) - (engagementCallTime || 0));
      expect(timeDiff).toBeLessThan(5);
    });

    it('should continue enrichment even if one service times out or errors', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service
          return Promise.resolve({
            status: 200,
            data: { id: 'invoice-123', clientId: 'client-456', engagementId: 'engagement-789' },
          });
        }
        if (callCount === 2) {
          // Client service to throw (network error)
          return Promise.reject(new Error('Network timeout'));
        }
        // Engagement service (success)
        return Promise.resolve({
          status: 200,
          data: { description: 'Q1 Services' },
        });
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      // After implementation with Promise.allSettled, request should succeed
      // with partial data (engagement description but no client name)
      expect(res.status).toBe(200);
      expect(res.body.engagementDescription).toBe('Q1 Services');
      // clientName should be undefined when Promise.allSettled is used
      expect(res.body.clientName).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing clientId and engagementId in invoice data', async () => {
      mockedFetchJson.mockImplementation(() => {
        return Promise.resolve({
          status: 200,
          data: {
            id: 'invoice-123',
            amount: 5000,
            // No clientId or engagementId
          },
        });
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'invoice-123',
        amount: 5000,
      });

      // Enrichment services should be called (even though IDs are undefined)
      expect(mockedFetchJson).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed enrichment service responses', async () => {
      let callCount = 0;
      mockedFetchJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Billing service
          return Promise.resolve({
            status: 200,
            data: { id: 'invoice-123', clientId: 'client-456', engagementId: 'engagement-789' },
          });
        }
        if (callCount === 2) {
          // Client service with missing companyName field
          return Promise.resolve({ status: 200, data: { id: 'client-456' } }); // No companyName
        }
        // Engagement service success
        return Promise.resolve({
          status: 200,
          data: { description: 'Q1 Services' },
        });
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/invoices/invoice-123')
        .set('Authorization', authHeader)
        .set('X-Request-Id', requestId);

      expect(res.status).toBe(200);
      expect(res.body.engagementDescription).toBe('Q1 Services');
      // clientName should be undefined (graceful degradation)
      expect(res.body.clientName).toBeUndefined();
    });
  });
});

describe('GET /api/invoices - simple proxy', () => {
  it('should proxy requests to billing service', async () => {
    mockedProxyRequest.mockImplementation((_baseUrl, _path, _req, res) => {
      res.status(200).json([{ _id: 'invoice-1', amount: 1000 }]);
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get('/api/invoices')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ _id: 'invoice-1', amount: 1000 }]);
  });
});

describe('POST /api/invoices', () => {
  it('should proxy requests to billing service', async () => {
    mockedProxyRequest.mockImplementation((_baseUrl, _path, _req, res) => {
      res.status(201).json({ _id: 'new-invoice', amount: 2000 });
    });

    const app = createTestApp();
    const response = await supertest(app)
      .post('/api/invoices')
      .set('Authorization', 'Bearer test-token')
      .send({ amount: 2000 });

    expect(response.status).toBe(201);
  });
});
