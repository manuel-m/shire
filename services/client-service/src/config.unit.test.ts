import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('client-service config', () => {
  it('should have engagementServiceUrl defined', () => {
    expect(config.engagementServiceUrl).toBeDefined();
  });

  it('should have engagementServiceUrl pointing to engagement-service:3003', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
    expect(config.engagementServiceUrl).toBe('http://engagement-service:3003');
  });
});
