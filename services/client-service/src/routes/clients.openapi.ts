import { z } from 'zod';
import {
  ClientSchema,
  CreateClientSchema,
  UpdateClientSchema,
  ClientFilterQuerySchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const MIME_JSON = 'application/json';
const VALIDATION_ERROR_DESC = 'Validation error';
const CLIENT_NOT_FOUND_DESC = 'Client not found';
const CLIENT_BY_ID_PATH = '/clients/{id}';
const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/clients',
  summary: 'Create a new client',
  security,
  request: {
    body: {
      content: { [MIME_JSON]: { schema: CreateClientSchema } },
    },
  },
  responses: {
    201: {
      description: 'Client created',
      content: { [MIME_JSON]: { schema: ClientSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Duplicate company name',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
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
        [MIME_JSON]: {
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
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: CLIENT_BY_ID_PATH,
  summary: 'Get a client by ID',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Client found',
      content: { [MIME_JSON]: { schema: ClientSchema } },
    },
    404: {
      description: CLIENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: CLIENT_BY_ID_PATH,
  summary: 'Update a client',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { [MIME_JSON]: { schema: UpdateClientSchema } },
    },
  },
  responses: {
    200: {
      description: 'Client updated',
      content: { [MIME_JSON]: { schema: ClientSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: CLIENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Duplicate company name',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: CLIENT_BY_ID_PATH,
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
      description: CLIENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Client has active engagements',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});
