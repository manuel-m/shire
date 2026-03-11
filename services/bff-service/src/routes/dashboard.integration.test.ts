import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { dashboardRouter } from './dashboard.js';
import { fetchJson } from '../lib/service-client.js';

// Use vi.hoisted to create variables that can be referenced in mock factories
const { mockLog } = vi.hoisted(() => {
  return {
    mockLog: vi.fn(),
  };
});

// Mock the logger to avoid actual logging in tests
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

// Mock the createLogger from @shire/shared
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
  app.use('/api/dashboard', dashboardRouter);
  return app;
}

describe('GET /api/dashboard', () => {
  const authHeader = 'Bearer test-token';
  const requestId = 'test-request-id-123';

  it('should return aggregated data when all services are healthy (happy path)', async () => {
    // Mock all services to return successful responses
    mockedFetchJson.mockResolvedValue({
      status: 200,
      data: { total: 5 },
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get('/api/dashboard')
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totalClients: 5,
      totalEngagements: 5,
      totalReports: 5,
      totalInvoices: 5,
      activeEngagements: 5,
      draftInvoices: 5,
      overdueInvoices: 5,
    });

    // Verify fetchJson was called 7 times with correct parameters
    expect(mockedFetchJson).toHaveBeenCalledTimes(7);

    // Verify request ID was propagated to all service calls
    for (const call of mockedFetchJson.mock.calls) {
      expect(call[3]).toBe(requestId);
    }
  });

  it('should return partial data when some services fail', async () => {
    // Mock services: first 3 succeed, last 4 fail
    const callCount = { value: 0 };
    mockedFetchJson.mockImplementation(() => {
      callCount.value++;
      if (callCount.value <= 3) {
        return Promise.resolve({ status: 200, data: { total: 3 } });
      }
      return Promise.reject(new Error('Service unavailable'));
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get('/api/dashboard')
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(200);
    // First 3 services should have data, rest should be 0
    expect(response.body.totalClients).toBe(3);
    expect(response.body.totalEngagements).toBe(3);
    expect(response.body.totalReports).toBe(3);
    expect(response.body.totalInvoices).toBe(0);
    expect(response.body.activeEngagements).toBe(0);
    expect(response.body.draftInvoices).toBe(0);
    expect(response.body.overdueInvoices).toBe(0);

    // Verify warnings were logged for failed aggregations
    expect(mockLog).toHaveBeenCalled();
  });

  it('should return HTTP 502 when all services fail', async () => {
    // Mock all services to reject
    mockedFetchJson.mockRejectedValue(new Error('All services down'));

    const app = createTestApp();
    const response = await supertest(app)
      .get('/api/dashboard')
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
    const testRequestId = 'trace-123-abc';
    const capturedRequestIds: string[] = [];

    mockedFetchJson.mockImplementation((url, path, auth, requestId) => {
      capturedRequestIds.push(requestId);
      return Promise.resolve({ status: 200, data: { total: 1 } });
    });

    const app = createTestApp();
    await supertest(app)
      .get('/api/dashboard')
      .set('Authorization', authHeader)
      .set('X-Request-Id', testRequestId);

    // All service calls should have received the request ID
    expect(capturedRequestIds).toHaveLength(7);
    expect(capturedRequestIds.every((id) => id === testRequestId)).toBe(true);
  });

  it('should handle services returning non-200 status codes gracefully', async () => {
    // Mock some services to return non-200 status
    const callCount = { value: 0 };
    mockedFetchJson.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 2) {
        return Promise.resolve({ status: 500, data: { error: 'Internal error' } });
      }
      if (callCount.value === 4) {
        return Promise.resolve({ status: 404, data: { error: 'Not found' } });
      }
      return Promise.resolve({ status: 200, data: { total: 2 } });
    });

    const app = createTestApp();
    const response = await supertest(app)
      .get('/api/dashboard')
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(200);
    // Non-200 responses should be treated as failure and return 0
    expect(response.body.totalEngagements).toBe(0); // 500 response
    expect(response.body.totalInvoices).toBe(0); // 404 response
    expect(response.body.totalClients).toBe(2); // 200 response
    expect(response.body.totalReports).toBe(2); // 200 response
  });

  it('should log warning for each failed service aggregation', async () => {
    // Mock specific services to fail
    const callCount = { value: 0 };
    mockedFetchJson.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return Promise.reject(new Error('Client service timeout'));
      }
      if (callCount.value === 3) {
        return Promise.reject(new Error('Report service connection refused'));
      }
      return Promise.resolve({ status: 200, data: { total: 1 } });
    });

    const app = createTestApp();
    await supertest(app)
      .get('/api/dashboard')
      .set('Authorization', authHeader)
      .set('X-Request-Id', requestId);

    // Count warning log calls
    const warnLogCalls = mockLog.mock.calls.filter((call) => call[0] === 'warn');
    expect(warnLogCalls.length).toBeGreaterThan(0);

    // Verify requestId is included in warning logs
    const warnCallWithRequestId = warnLogCalls.some((call) => call[2]?.requestId === requestId);
    expect(warnCallWithRequestId).toBe(true);
  });
});
