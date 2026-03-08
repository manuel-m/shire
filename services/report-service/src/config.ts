export const config = {
  port: parseInt(process.env.REPORT_SERVICE_PORT || '3004', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shire-report',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  engagementServiceUrl: process.env.ENGAGEMENT_SERVICE_URL || 'http://engagement-service:3003',
  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- internal Docker network
  clientServiceUrl: process.env.CLIENT_SERVICE_URL || 'http://client-service:3002',
  serviceName: 'report-service',
} as const;
