import { z } from 'zod';
import {
  EngagementSchema,
  CreateEngagementSchema,
  UpdateEngagementSchema,
  UpdateEngagementStatusSchema,
  EngagementFilterQuerySchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const MIME_JSON = 'application/json';
const VALIDATION_ERROR_DESC = 'Validation error';
const ENGAGEMENT_NOT_FOUND_DESC = 'Engagement not found';
const ENGAGEMENT_BY_ID_PATH = '/engagements/{id}';
const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/engagements',
  summary: 'Create a new engagement',
  security,
  request: {
    body: {
      content: { [MIME_JSON]: { schema: CreateEngagementSchema } },
    },
  },
  responses: {
    201: {
      description: 'Engagement created',
      content: { [MIME_JSON]: { schema: EngagementSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Client not found',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Client missing required credentials',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/engagements',
  summary: 'List engagements with filtering and pagination',
  security,
  request: {
    query: EngagementFilterQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of engagements',
      content: {
        [MIME_JSON]: {
          schema: z.object({
            data: z.array(EngagementSchema),
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
  path: ENGAGEMENT_BY_ID_PATH,
  summary: 'Get an engagement by ID',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Engagement found',
      content: { [MIME_JSON]: { schema: EngagementSchema } },
    },
    404: {
      description: ENGAGEMENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: ENGAGEMENT_BY_ID_PATH,
  summary: 'Update an engagement',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { [MIME_JSON]: { schema: UpdateEngagementSchema } },
    },
  },
  responses: {
    200: {
      description: 'Engagement updated',
      content: { [MIME_JSON]: { schema: EngagementSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: ENGAGEMENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/engagements/{id}/status',
  summary: 'Update engagement status',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { [MIME_JSON]: { schema: UpdateEngagementStatusSchema } },
    },
  },
  responses: {
    200: {
      description: 'Engagement status updated',
      content: { [MIME_JSON]: { schema: EngagementSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: ENGAGEMENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Invalid status transition',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: ENGAGEMENT_BY_ID_PATH,
  summary: 'Delete an engagement',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    204: {
      description: 'Engagement deleted',
    },
    404: {
      description: ENGAGEMENT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Engagement has associated reports or invoices',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/engagements/client/{clientId}',
  summary: 'Get engagements by client ID',
  security,
  request: {
    params: z.object({ clientId: z.string() }),
  },
  responses: {
    200: {
      description: 'List of engagements for the client',
      content: {
        [MIME_JSON]: {
          schema: z.array(EngagementSchema),
        },
      },
    },
  },
});
