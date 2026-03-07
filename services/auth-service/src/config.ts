import type { StringValue } from 'ms';

export const config = {
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shire-auth',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN || '15m') as StringValue,
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '7', 10),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  maxRefreshTokensPerUser: 5,
  serviceName: 'auth-service',
} as const;
