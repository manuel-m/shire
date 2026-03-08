import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  UpdateInvoiceStatusSchema,
  InvoiceFilterQuerySchema,
} from '@shire/shared-types';
import { getInvoicesCollection } from '../db.js';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { config } from '../config.js';
import * as entityCheck from '../entity-check.js';
import { generateInvoiceNumber } from '../invoice-number.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);

const INVOICE_NOT_FOUND = 'Invoice not found';
const PENDING_PAYMENT = 'pending-payment';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['issued'],
  issued: [PENDING_PAYMENT],
  [PENDING_PAYMENT]: ['paid', 'overdue'],
  overdue: ['paid'],
};

function computeAmount(
  lineItems: { quantity: number; unitPrice: number; total: number }[],
): number {
  return lineItems.reduce((sum, item) => sum + item.total, 0);
}

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);

// POST /invoices
invoicesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const authToken = (req.headers.authorization || '').replace('Bearer ', '');

  // Validate clientId
  const clientExists = await entityCheck.validateClient(parsed.data.clientId, authToken);
  if (!clientExists) {
    res.status(404).json({ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } });
    return;
  }

  // Validate engagementId
  const engagementExists = await entityCheck.validateEngagement(
    parsed.data.engagementId,
    authToken,
  );
  if (!engagementExists) {
    res
      .status(404)
      .json({ error: { code: 'ENGAGEMENT_NOT_FOUND', message: 'Engagement not found' } });
    return;
  }

  const now = new Date();
  const invoiceNumber = await generateInvoiceNumber();
  const amount = computeAmount(parsed.data.lineItems);

  const invoice = {
    _id: randomUUID(),
    ...parsed.data,
    invoiceNumber,
    amount,
    status: 'draft' as const,
    createdAt: now,
    updatedAt: now,
  };

  const invoices = getInvoicesCollection();
  await invoices.insertOne(invoice);

  log('info', 'Invoice created', {
    invoiceId: invoice._id,
    invoiceNumber,
    engagementId: invoice.engagementId,
    requestId: req.requestId,
  });

  res.status(201).json(invoice);
});

// GET /invoices
invoicesRouter.get('/', async (req: Request, res: Response) => {
  const parsed = InvoiceFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { page, limit, status, clientId, engagementId } = parsed.data;
  const invoices = getInvoicesCollection();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (clientId) filter.clientId = clientId;
  if (engagementId) filter.engagementId = engagementId;

  const [data, total] = await Promise.all([
    invoices
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    invoices.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// GET /invoices/client/:clientId
invoicesRouter.get('/client/:clientId', async (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const invoices = getInvoicesCollection();
  const data = await invoices.find({ clientId }).toArray();
  res.json(data);
});

// GET /invoices/engagement/:engagementId
invoicesRouter.get('/engagement/:engagementId', async (req: Request, res: Response) => {
  const engagementId = req.params.engagementId as string;
  const invoices = getInvoicesCollection();
  const data = await invoices.find({ engagementId }).toArray();
  res.json(data);
});

// GET /invoices/:id
invoicesRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const invoices = getInvoicesCollection();
  const invoice = await invoices.findOne({ _id: id });

  if (!invoice) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: INVOICE_NOT_FOUND } });
    return;
  }

  res.json(invoice);
});

// PUT /invoices/:id — only draft invoices can be edited
invoicesRouter.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = UpdateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const invoices = getInvoicesCollection();
  const existing = await invoices.findOne({ _id: id });

  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: INVOICE_NOT_FOUND } });
    return;
  }

  if (existing.status !== 'draft') {
    res.status(422).json({
      error: {
        code: 'NOT_EDITABLE',
        message: 'Only draft invoices can be edited',
      },
    });
    return;
  }

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  // Recompute amount if lineItems changed
  if (parsed.data.lineItems) {
    updates.amount = computeAmount(parsed.data.lineItems);
  }

  const result = await invoices.findOneAndUpdate(
    { _id: id },
    { $set: updates },
    { returnDocument: 'after' },
  );

  log('info', 'Invoice updated', { invoiceId: id, requestId: req.requestId });
  res.json(result);
});

// PATCH /invoices/:id/status
invoicesRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = UpdateInvoiceStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const invoices = getInvoicesCollection();
  const existing = await invoices.findOne({ _id: id });

  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: INVOICE_NOT_FOUND } });
    return;
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
  if (!allowedTransitions.includes(parsed.data.status)) {
    res.status(422).json({
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition from '${existing.status}' to '${parsed.data.status}'`,
      },
    });
    return;
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    updatedAt: new Date(),
  };

  // Auto-set paidDate when transitioning to paid
  if (parsed.data.status === 'paid') {
    updates.paidDate = new Date();
  }

  const result = await invoices.findOneAndUpdate(
    { _id: id },
    { $set: updates },
    { returnDocument: 'after' },
  );

  log('info', 'Invoice status updated', {
    invoiceId: id,
    from: existing.status,
    to: parsed.data.status,
    requestId: req.requestId,
  });

  res.json(result);
});

// POST /invoices/:id/send
invoicesRouter.post('/:id/send', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const invoices = getInvoicesCollection();
  const invoice = await invoices.findOne({ _id: id });

  if (!invoice) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: INVOICE_NOT_FOUND } });
    return;
  }

  if (invoice.status !== 'issued') {
    res.status(422).json({
      error: {
        code: 'INVALID_OPERATION',
        message: 'Only issued invoices can be sent',
      },
    });
    return;
  }

  // Transition to pending-payment when sent
  const result = await invoices.findOneAndUpdate(
    { _id: id },
    { $set: { status: PENDING_PAYMENT, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  log('info', 'Invoice sent', { invoiceId: id, requestId: req.requestId });
  res.json(result);
});

// POST /invoices/:id/remind
invoicesRouter.post('/:id/remind', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const invoices = getInvoicesCollection();
  const invoice = await invoices.findOne({ _id: id });

  if (!invoice) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: INVOICE_NOT_FOUND } });
    return;
  }

  if (invoice.status !== PENDING_PAYMENT && invoice.status !== 'overdue') {
    res.status(422).json({
      error: {
        code: 'INVALID_OPERATION',
        message: 'Payment reminders can only be sent for pending-payment or overdue invoices',
      },
    });
    return;
  }

  log('info', 'Payment reminder sent', { invoiceId: id, requestId: req.requestId });
  res.json({ message: 'Payment reminder sent', invoiceId: id });
});
