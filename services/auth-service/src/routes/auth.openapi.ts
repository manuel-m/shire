import { z } from 'zod';
import {
  CreateUserSchema,
  LoginSchema,
  RefreshRequestSchema,
  UpdateUserSchema,
  UserPublicSchema,
  AuthTokensSchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const security = [{ BearerAuth: [] }];

const AuthResponseSchema = z.object({
  user: UserPublicSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
}).openapi('AuthResponse');

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  summary: 'Register a new user',
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      description: 'User registered',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Email already registered',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Log in with email and password',
  request: {
    body: {
      content: { 'application/json': { schema: LoginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Invalid credentials',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  summary: 'Refresh access token',
  request: {
    body: {
      content: { 'application/json': { schema: RefreshRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Tokens refreshed',
      content: { 'application/json': { schema: AuthTokensSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Invalid or expired refresh token',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  summary: 'Log out (revoke refresh token)',
  security,
  request: {
    body: {
      content: { 'application/json': { schema: RefreshRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Logged out',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  summary: 'Get current user profile',
  security,
  responses: {
    200: {
      description: 'Current user',
      content: { 'application/json': { schema: UserPublicSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/auth/me',
  summary: 'Update current user profile',
  security,
  request: {
    body: {
      content: { 'application/json': { schema: UpdateUserSchema } },
    },
  },
  responses: {
    200: {
      description: 'User updated',
      content: { 'application/json': { schema: UserPublicSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Email already in use',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
