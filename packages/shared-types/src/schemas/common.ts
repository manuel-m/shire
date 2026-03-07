import { z } from 'zod';
import '../openapi/init.js';

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).openapi('PaginationQuery');

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  });

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
}).openapi('ErrorResponse');

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
