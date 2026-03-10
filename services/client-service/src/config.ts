export const config = {
  port: parseInt(process.env.CLIENT_SERVICE_PORT || '3002', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shire-client',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  credentialsEncryptionKey:
    process.env.CREDENTIALS_ENCRYPTION_KEY || 'dev-encryption-key-change-me',
  engagementServiceUrl:
    process.env.ENGAGEMENT_SERVICE_URL || 'http://engagement-service:3003',
  serviceName: 'client-service',
} as const;
