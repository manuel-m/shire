import { z } from 'zod';
import {
  ReportSchema,
  CreateReportSchema,
  UpdateReportSchema,
  ReportFilterQuerySchema,
  ErrorResponseSchema,
} from '@shire/shared-types';
import { registry } from '../openapi/registry.js';

const MIME_JSON = 'application/json';
const VALIDATION_ERROR_DESC = 'Validation error';
const REPORT_NOT_FOUND_DESC = 'Report not found';
const REPORT_BY_ID_PATH = '/reports/{id}';
const security = [{ BearerAuth: [] }];

registry.registerPath({
  method: 'post',
  path: '/reports',
  summary: 'Create a new report',
  security,
  request: {
    body: {
      content: { [MIME_JSON]: { schema: CreateReportSchema } },
    },
  },
  responses: {
    201: {
      description: 'Report created',
      content: { [MIME_JSON]: { schema: ReportSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Engagement or client not found',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/reports',
  summary: 'List reports with filtering and pagination',
  security,
  request: {
    query: ReportFilterQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of reports',
      content: {
        [MIME_JSON]: {
          schema: z.object({
            data: z.array(ReportSchema),
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
  path: REPORT_BY_ID_PATH,
  summary: 'Get a report by ID',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Report found',
      content: { [MIME_JSON]: { schema: ReportSchema } },
    },
    404: {
      description: REPORT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: REPORT_BY_ID_PATH,
  summary: 'Update a report (creates new version)',
  security,
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { [MIME_JSON]: { schema: UpdateReportSchema } },
    },
  },
  responses: {
    200: {
      description: 'Report updated',
      content: { [MIME_JSON]: { schema: ReportSchema } },
    },
    400: {
      description: VALIDATION_ERROR_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    404: {
      description: REPORT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
    422: {
      description: 'Report is not in draft status',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/reports/{id}/versions',
  summary: 'List all versions of a report',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'List of report versions',
      content: {
        [MIME_JSON]: {
          schema: z.array(ReportSchema),
        },
      },
    },
    404: {
      description: REPORT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/reports/{id}/versions/{version}',
  summary: 'Get a specific version of a report',
  security,
  request: {
    params: z.object({ id: z.string(), version: z.string() }),
  },
  responses: {
    200: {
      description: 'Report version found',
      content: { [MIME_JSON]: { schema: ReportSchema } },
    },
    404: {
      description: 'Report or version not found',
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/reports/{id}/generate/markdown',
  summary: 'Generate markdown document from report',
  security,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: 'Markdown generated',
      content: {
        [MIME_JSON]: {
          schema: z.object({ markdown: z.string() }),
        },
      },
    },
    404: {
      description: REPORT_NOT_FOUND_DESC,
      content: { [MIME_JSON]: { schema: ErrorResponseSchema } },
    },
  },
});
