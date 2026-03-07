import { z } from 'zod';
import {
  ContactSchema,
  CreateContactSchema,
  UpdateContactSchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const security = [{ BearerAuth: [] }];
const clientIdParam = z.object({ id: z.string().openapi({ description: 'Client ID' }) });

registry.registerPath({
  method: 'post',
  path: '/clients/{id}/contacts',
  summary: 'Create a contact for a client',
  security,
  request: {
    params: clientIdParam,
    body: {
      content: { 'application/json': { schema: CreateContactSchema } },
    },
  },
  responses: {
    201: {
      description: 'Contact created',
      content: { 'application/json': { schema: ContactSchema } },
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
  path: '/clients/{id}/contacts',
  summary: 'List contacts for a client',
  security,
  request: {
    params: clientIdParam,
  },
  responses: {
    200: {
      description: 'List of contacts',
      content: {
        'application/json': {
          schema: z.array(ContactSchema),
        },
      },
    },
    404: {
      description: 'Client not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/clients/{id}/contacts/{contactId}',
  summary: 'Update a contact',
  security,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Client ID' }),
      contactId: z.string().openapi({ description: 'Contact ID' }),
    }),
    body: {
      content: { 'application/json': { schema: UpdateContactSchema } },
    },
  },
  responses: {
    200: {
      description: 'Contact updated',
      content: { 'application/json': { schema: ContactSchema } },
    },
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Contact not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/clients/{id}/contacts/{contactId}',
  summary: 'Delete a contact',
  security,
  request: {
    params: z.object({
      id: z.string().openapi({ description: 'Client ID' }),
      contactId: z.string().openapi({ description: 'Contact ID' }),
    }),
  },
  responses: {
    204: {
      description: 'Contact deleted',
    },
    404: {
      description: 'Contact not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});
