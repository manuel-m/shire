import { z } from 'zod';
import {
  CodeCredentialsInputSchema,
  CodeCredentialsOutputSchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const security = [{ BearerAuth: [] }];
const clientIdParam = z.object({ id: z.string().openapi({ description: 'Client ID' }) });

registry.registerPath({
  method: 'put',
  path: '/clients/{id}/credentials',
  summary: 'Update code credentials for a client',
  security,
  request: {
    params: clientIdParam,
    body: {
      content: { 'application/json': { schema: CodeCredentialsInputSchema } },
    },
  },
  responses: {
    200: {
      description: 'Credentials updated',
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
    404: {
      description: 'Client not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/clients/{id}/credentials',
  summary: 'Get code credentials for a client',
  security,
  request: {
    params: clientIdParam,
  },
  responses: {
    200: {
      description: 'Decrypted credentials',
      content: { 'application/json': { schema: CodeCredentialsOutputSchema } },
    },
    404: {
      description: 'Client not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
