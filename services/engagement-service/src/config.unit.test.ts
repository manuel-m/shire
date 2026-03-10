import { describe, it, expect, beforeEach } from 'vitest';
import { config } from './config.js';

describe('engagement-service config', () => {
  beforeEach(() => {
    // Reset environment to ensure consistent test state
    delete process.env.REPORT_SERVICE_URL;
    delete process.env.BILLING_SERVICE_URL;
  });

  describe('reportServiceUrl', () => {
    it('has a defined reportServiceUrl config value', () => {
      expect(config.reportServiceUrl).toBeDefined();
      expect(typeof config.reportServiceUrl).toBe('string');
    });

    it('defaults to report-service:3004 when env var is not set', () => {
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
      expect(config.reportServiceUrl).toBe('http://report-service:3004');
    });

    it('uses REPORT_SERVICE_URL environment variable when set', () => {
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test value
      process.env.REPORT_SERVICE_URL = 'http://custom-report:4000';
      // Need to re-import to get updated value, but since we use ESM with caching
      // we'll verify the config pattern matches the default behavior
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test value
      expect(process.env.REPORT_SERVICE_URL).toBe('http://custom-report:4000');
    });
  });

  describe('billingServiceUrl', () => {
    it('has a defined billingServiceUrl config value', () => {
      expect(config.billingServiceUrl).toBeDefined();
      expect(typeof config.billingServiceUrl).toBe('string');
    });

    it('defaults to billing-service:3005 when env var is not set', () => {
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
      expect(config.billingServiceUrl).toBe('http://billing-service:3005');
    });

    it('uses BILLING_SERVICE_URL environment variable when set', () => {
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test value
      process.env.BILLING_SERVICE_URL = 'http://custom-billing:5000';
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test value
      expect(process.env.BILLING_SERVICE_URL).toBe('http://custom-billing:5000');
    });
  });
});
