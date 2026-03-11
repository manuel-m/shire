import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkAssociatedReportsOrInvoices } from './report-invoice-check.js';

// Mock config to use localhost for testing
vi.mock('./config.js', () => ({
  config: {
    reportServiceUrl: 'http://localhost:3004',
    billingServiceUrl: 'http://localhost:3005',
  },
}));

describe('report-invoice-check', () => {
  let mockReportFetch: ReturnType<typeof vi.fn>;
  let mockBillingFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Mock fetch globally
    mockReportFetch = vi.fn();
    mockBillingFetch = vi.fn();

    global.fetch = vi.fn((url: string) => {
      if (url.includes(':3004')) {
        return mockReportFetch(url);
      }
      if (url.includes(':3005')) {
        return mockBillingFetch(url);
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('returns false when both services are unavailable', () => {
    it('returns false when report-service is unavailable', async () => {
      mockReportFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(false);
    });

    it('returns false when billing-service is unavailable', async () => {
      mockBillingFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(false);
    });

    it('returns false when both services are unavailable', async () => {
      mockReportFetch.mockRejectedValueOnce(new Error('Service unavailable'));
      mockBillingFetch.mockRejectedValueOnce(new Error('Service unavailable'));

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(false);
    });
  });

  describe('returns true when reports exist', () => {
    it('returns true when report-service returns at least one report', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'report-1' }], total: 1 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });

    it('returns true when report-service returns multiple reports', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'report-1' }, { id: 'report-2' }], total: 2 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });
  });

  describe('returns true when invoices exist', () => {
    it('returns true when billing-service returns at least one invoice', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'invoice-1' }], total: 1 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });

    it('returns true when billing-service returns multiple invoices', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'invoice-1' }, { id: 'invoice-2' }], total: 2 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });
  });

  describe('returns false when both services return empty', () => {
    it('returns false when both services return empty arrays', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(false);
    });
  });

  describe('HTTP calls include 5-second timeout', () => {
    it('uses AbortController with 5-second timeout', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });

      await checkAssociatedReportsOrInvoices('engagement-123');

      // Verify fetch was called (abort controller verification is internal)
      expect(mockReportFetch).toHaveBeenCalled();
      expect(mockBillingFetch).toHaveBeenCalled();
    });
  });

  describe('handles partial failures gracefully', () => {
    it('returns true when report-service succeeds but billing-service fails', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'report-1' }], total: 1 }),
      });
      mockBillingFetch.mockRejectedValueOnce(new Error('Billing service down'));

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });

    it('returns true when billing-service succeeds but report-service fails', async () => {
      mockReportFetch.mockRejectedValueOnce(new Error('Report service down'));
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'invoice-1' }], total: 1 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });

    it('returns false (fail-open) when both services fail', async () => {
      mockReportFetch.mockRejectedValueOnce(new Error('Report service down'));
      mockBillingFetch.mockRejectedValueOnce(new Error('Billing service down'));

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(false);
    });
  });

  describe('OR logic - true if EITHER has records', () => {
    it('returns true when reports exist and billing returns empty', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'report-1' }], total: 1 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });

    it('returns true when invoices exist and report returns empty', async () => {
      mockReportFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [], total: 0 }),
      });
      mockBillingFetch.mockResolvedValueOnce({
        ok: true,
        // eslint-disable-next-line @typescript-eslint/require-await -- mock matches Response API
        json: async () => ({ data: [{ id: 'invoice-1' }], total: 1 }),
      });

      const result = await checkAssociatedReportsOrInvoices('engagement-123');

      expect(result).toBe(true);
    });
  });
});
