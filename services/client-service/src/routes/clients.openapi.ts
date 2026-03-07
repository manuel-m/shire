import { z } from 'zod';
import {
  ClientSchema,
  CreateClientSchema,
  UpdateClientSchema,
  ClientFilterQuerySchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/clients',
  summary: 'Create a new client',
  security,
  request: {
    body: {
      content: { 'application/json': { schema: CreateClientSchema } },
    },
  },
  responses: {
    201: {
      description: 'Client created',
      content: { 'application/json': { schema: ClientSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Duplicate company name',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/clients',
  summary: 'List clients with filtering and pagination',
  security,
  request: {
    query: ClientFilterQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of clients',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(ClientSchema),
            total: z.number(),
            page: z.number(),
            limit: z.number(),
          }),
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
  path: '/clients/{id}',
  summary: 'Get a client by ID',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Client found',
      content: { 'application/json': { schema: ClientSchema } },
    },
    404: {
      description: 'Client not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/clients/{id}',
  summary: 'Update a client',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { 'application/json': { schema: UpdateClientSchema } },
    },
  },
  responses: {
    200: {
      description: 'Client updated',
      content: { 'application/json': { schema: ClientSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Client not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Duplicate company name',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/clients/{id}',
  summary: 'Delete a client',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: {
      description: 'Client deleted',
    },
    404: {
      description: 'Client not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Client has active engagements',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
