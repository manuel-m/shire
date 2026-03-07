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

const MIME_JSON = 'application/json';
const VALIDATION_ERROR_DESC = 'Validation error';
const security = [{ BearerAuth: [] }];

const AuthResponseSchema = z
  .object({
    user: UserPublicSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi('AuthResponse');

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  summary: 'Register a new user',
  request: {
    body: {
      content: { [MIME_JSON]: { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      description: 'User registered',
      content: { [MIME_JSON]: { schema: AuthResponseSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Email already registered',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Log in with email and password',
  request: {
    body: {
      content: { [MIME_JSON]: { schema: LoginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: { [MIME_JSON]: { schema: AuthResponseSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Invalid credentials',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  summary: 'Refresh access token',
  request: {
    body: {
      content: { [MIME_JSON]: { schema: RefreshRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Tokens refreshed',
      content: { [MIME_JSON]: { schema: AuthTokensSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Invalid or expired refresh token',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
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
      content: { [MIME_JSON]: { schema: RefreshRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Logged out',
      content: {
        [MIME_JSON]: {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
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
      content: { [MIME_JSON]: { schema: UserPublicSchema } },
    },
    404: {
      description: 'User not found',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
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
      content: { [MIME_JSON]: { schema: UpdateUserSchema } },
    },
  },
  responses: {
    200: {
      description: 'User updated',
      content: { [MIME_JSON]: { schema: UserPublicSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'User not found',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Email already in use',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});
