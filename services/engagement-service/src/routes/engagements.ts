import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateEngagementSchema,
  UpdateEngagementSchema,
  UpdateEngagementStatusSchema,
  EngagementFilterQuerySchema,
} from '@shire/shared-types';
import { getEngagementsCollection } from '../db.js';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { config } from '../config.js';
import * as clientCheck from '../client-check.js';
import * as reportInvoiceCheck from '../report-invoice-check.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);

const ENGAGEMENT_NOT_FOUND = 'Engagement not found';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['diagnosis'],
  diagnosis: ['in-progress'],
  'in-progress': ['waiting-for-client', 'completed'],
  'waiting-for-client': ['in-progress'],
};

export const engagementsRouter = Router();

engagementsRouter.use(requireAuth);

// POST /engagements
engagementsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateEngagementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const authHeader = req.headers.authorization || '';

  // Validate clientId exists
  const { exists, hasCodeCredentials } = await clientCheck.validateClient(
    parsed.data.clientId,
    authHeader.replace('Bearer ', ''),
  );
  if (!exists) {
    res.status(404).json({
      error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' },
    });
    return;
  }

  // Validate code-credentials access type requires client to have credentials
  if (parsed.data.accessType === 'code-credentials' && !hasCodeCredentials) {
    res.status(422).json({
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Client must have code credentials stored for access type code-credentials',
      },
    });
    return;
  }

  const now = new Date();
  const engagement = {
    _id: randomUUID(),
    ...parsed.data,
    status: 'requested' as const,
    creationDate: now,
    updatedAt: now,
  };

  const engagements = getEngagementsCollection();
  await engagements.insertOne(engagement);

  log('info', 'Engagement created', {
    engagementId: engagement._id,
    clientId: engagement.clientId,
    requestId: req.requestId,
  });

  res.status(201).json(engagement);
});

// GET /engagements
engagementsRouter.get('/', async (req: Request, res: Response) => {
  const parsed = EngagementFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { page, limit, status, type, priority, clientId } = parsed.data;
  const engagements = getEngagementsCollection();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (priority) filter.priority = priority;
  if (clientId) filter.clientId = clientId;

  const [data, total] = await Promise.all([
    engagements
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    engagements.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// GET /engagements/client/:clientId
engagementsRouter.get('/client/:clientId', async (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const engagements = getEngagementsCollection();
  const data = await engagements.find({ clientId }).toArray();
  res.json(data);
});

// GET /engagements/:id
engagementsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const engagements = getEngagementsCollection();
  const engagement = await engagements.findOne({ _id: id });

  if (!engagement) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: ENGAGEMENT_NOT_FOUND } });
    return;
  }

  res.json(engagement);
});

// PUT /engagements/:id
engagementsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = UpdateEngagementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const engagements = getEngagementsCollection();

  // type and creationDate are immutable — UpdateEngagementSchema already excludes them
  const result = await engagements.findOneAndUpdate(
    { _id: id },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: ENGAGEMENT_NOT_FOUND } });
    return;
  }

  log('info', 'Engagement updated', { engagementId: id, requestId: req.requestId });
  res.json(result);
});

// PATCH /engagements/:id/status
engagementsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = UpdateEngagementStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const engagements = getEngagementsCollection();
  const existing = await engagements.findOne({ _id: id });

  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: ENGAGEMENT_NOT_FOUND } });
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

  // Auto-set timeline.endDate when transitioning to completed
  if (parsed.data.status === 'completed' && !existing.timeline?.endDate) {
    updates['timeline.endDate'] = new Date();
  }

  const result = await engagements.findOneAndUpdate(
    { _id: id },
    { $set: updates },
    { returnDocument: 'after' },
  );

  log('info', 'Engagement status updated', {
    engagementId: id,
    from: existing.status,
    to: parsed.data.status,
    requestId: req.requestId,
  });

  res.json(result);
});

// DELETE /engagements/:id
engagementsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const authToken = (req.headers.authorization || '').replace('Bearer ', '');

  const hasAssociated = await reportInvoiceCheck.checkAssociatedReportsOrInvoices(id, authToken);
  if (hasAssociated) {
    res.status(422).json({
      error: {
        code: 'HAS_ASSOCIATED_RECORDS',
        message: 'Cannot delete engagement with associated reports or invoices',
      },
    });
    return;
  }

  const engagements = getEngagementsCollection();
  const result = await engagements.deleteOne({ _id: id });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: ENGAGEMENT_NOT_FOUND } });
    return;
  }

  log('info', 'Engagement deleted', { engagementId: id, requestId: req.requestId });
  res.status(204).end();
});
