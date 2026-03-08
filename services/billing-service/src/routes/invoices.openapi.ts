import { z } from 'zod';
import {
  InvoiceSchema,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  UpdateInvoiceStatusSchema,
  InvoiceFilterQuerySchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const MIME_JSON = 'application/json';
const VALIDATION_ERROR_DESC = 'Validation error';
const INVOICE_NOT_FOUND_DESC = 'Invoice not found';
const INVOICE_BY_ID_PATH = '/invoices/{id}';
const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/invoices',
  summary: 'Create a new invoice',
  security,
  request: {
    body: {
      content: { [MIME_JSON]: { schema: CreateInvoiceSchema } },
    },
  },
  responses: {
    201: {
      description: 'Invoice created',
      content: { [MIME_JSON]: { schema: InvoiceSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Client or engagement not found',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/invoices',
  summary: 'List invoices with filtering and pagination',
  security,
  request: {
    query: InvoiceFilterQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of invoices',
      content: {
        [MIME_JSON]: {
          schema: z.object({
            data: z.array(InvoiceSchema),
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
  path: INVOICE_BY_ID_PATH,
  summary: 'Get an invoice by ID',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Invoice found',
      content: { [MIME_JSON]: { schema: InvoiceSchema } },
    },
    404: {
      description: INVOICE_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: INVOICE_BY_ID_PATH,
  summary: 'Update an invoice (draft only)',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { [MIME_JSON]: { schema: UpdateInvoiceSchema } },
    },
  },
  responses: {
    200: {
      description: 'Invoice updated',
      content: { [MIME_JSON]: { schema: InvoiceSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: INVOICE_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Invoice is not in draft status',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/invoices/{id}/status',
  summary: 'Update invoice status',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { [MIME_JSON]: { schema: UpdateInvoiceStatusSchema } },
    },
  },
  responses: {
    200: {
      description: 'Invoice status updated',
      content: { [MIME_JSON]: { schema: InvoiceSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: INVOICE_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Invalid status transition',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/invoices/{id}/send',
  summary: 'Send invoice to client',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Invoice sent',
      content: { [MIME_JSON]: { schema: InvoiceSchema } },
    },
    404: {
      description: INVOICE_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Invoice is not in issued status',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/invoices/{id}/remind',
  summary: 'Send payment reminder',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Payment reminder sent',
      content: {
        [MIME_JSON]: {
          schema: z.object({
            message: z.string(),
            invoiceId: z.string(),
          }),
        },
      },
    },
    404: {
      description: INVOICE_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Invoice status does not allow reminders',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/invoices/client/{clientId}',
  summary: 'Get invoices by client ID',
  security,
  request: {
    params: z.object({ clientId: z.string() }),
  },
  responses: {
    200: {
      description: 'List of invoices for the client',
      content: {
        [MIME_JSON]: {
          schema: z.array(InvoiceSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/invoices/engagement/{engagementId}',
  summary: 'Get invoices by engagement ID',
  security,
  request: {
    params: z.object({ engagementId: z.string() }),
  },
  responses: {
    200: {
      description: 'List of invoices for the engagement',
      content: {
        [MIME_JSON]: {
          schema: z.array(InvoiceSchema),
        },
      },
    },
  },
});
