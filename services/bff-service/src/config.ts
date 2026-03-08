export const config = {
  port: parseInt(process.env.BFF_SERVICE_PORT || '3007', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  clientServiceUrl: process.env.CLIENT_SERVICE_URL || 'http://client-service:3002',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  engagementServiceUrl: process.env.ENGAGEMENT_SERVICE_URL || 'http://engagement-service:3003',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  reportServiceUrl: process.env.REPORT_SERVICE_URL || 'http://report-service:3004',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://billing-service:3005',
  serviceName: 'bff-service',
} as const;
