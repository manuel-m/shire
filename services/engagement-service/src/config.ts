export const config = {
  port: parseInt(process.env.ENGAGEMENT_SERVICE_PORT || '3003', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shire-engagement',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  clientServiceUrl: process.env.CLIENT_SERVICE_URL || 'http://client-service:3002',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  reportServiceUrl: process.env.REPORT_SERVICE_URL || 'http://report-service:3004',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  billingServiceUrl: process.env.BILLING_SERVICE_URL || 'http://billing-service:3005',
  serviceName: 'engagement-service',
} as const;
