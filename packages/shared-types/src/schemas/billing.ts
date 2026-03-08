import { z } from 'zod';
import '../openapi/init.js';
import { PaginationQuerySchema } from './common.js';

export const InvoiceCurrencyEnum = z.enum(['EUR', 'USD', 'GBP']);
export const InvoiceStatusEnum = z.enum(['draft', 'issued', 'pending-payment', 'paid', 'overdue']);

export const LineItemSchema = z
  .object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    total: z.number().nonnegative(),
  })
  .openapi('LineItem');

export const InvoiceSchema = z
  .object({
    _id: z.string(),
    clientId: z.string(),
    engagementId: z.string(),
    invoiceNumber: z.string(),
    amount: z.number(),
    currency: InvoiceCurrencyEnum,
    status: InvoiceStatusEnum,
    lineItems: z.array(LineItemSchema),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    paidDate: z.coerce.date().optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .openapi('Invoice');

export const CreateInvoiceSchema = z
  .object({
    clientId: z.string().min(1),
    engagementId: z.string().min(1),
    currency: InvoiceCurrencyEnum,
    lineItems: z.array(LineItemSchema).min(1),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
  })
  .openapi('CreateInvoice');

export const UpdateInvoiceSchema = z
  .object({
    currency: InvoiceCurrencyEnum.optional(),
    lineItems: z.array(LineItemSchema).min(1).optional(),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
  })
  .openapi('UpdateInvoice');

export const UpdateInvoiceStatusSchema = z
  .object({
    status: InvoiceStatusEnum,
  })
  .openapi('UpdateInvoiceStatus');

export const InvoiceFilterQuerySchema = PaginationQuerySchema.extend({
  status: InvoiceStatusEnum.optional(),
  clientId: z.string().optional(),
  engagementId: z.string().optional(),
}).openapi('InvoiceFilterQuery');

export type Invoice = z.infer<typeof InvoiceSchema>;
export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;
export type UpdateInvoiceStatus = z.infer<typeof UpdateInvoiceStatusSchema>;
export type InvoiceFilterQuery = z.infer<typeof InvoiceFilterQuerySchema>;
