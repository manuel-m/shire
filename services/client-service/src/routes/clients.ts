import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateClientSchema,
  UpdateClientSchema,
  ClientFilterQuerySchema,
} from '@shire/shared-types';
import { getClientsCollection, getContactsCollection } from '../db.js';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
import * as engagementCheck from '../engagement-check.js';

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

// POST /clients
clientsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const clients = getClientsCollection();
  const existing = await clients.findOne({ companyName: parsed.data.companyName });
  if (existing) {
    res.status(409).json({ error: { code: 'DUPLICATE_NAME', message: 'A client with this company name already exists' } });
    return;
  }

  const now = new Date();
  const client = {
    _id: randomUUID(),
    ...parsed.data,
    createdAt: now,
    updatedAt: now,
  };

  await clients.insertOne(client);
  log('info', 'Client created', { clientId: client._id, companyName: client.companyName, requestId: req.requestId });

  res.status(201).json(client);
});

// GET /clients
clientsRouter.get('/', async (req: Request, res: Response) => {
  const parsed = ClientFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { page, limit, industry, companyName } = parsed.data;
  const clients = getClientsCollection();

  const filter: Record<string, unknown> = {};
  if (industry) {
    filter.industry = { $regex: industry, $options: 'i' };
  }
  if (companyName) {
    filter.companyName = { $regex: companyName, $options: 'i' };
  }

  const [data, total] = await Promise.all([
    clients
      .find(filter, { projection: { codeCredentials: 0 } })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    clients.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// GET /clients/:id
clientsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const clients = getClientsCollection();
  const client = await clients.findOne(
    { _id: id },
    { projection: { codeCredentials: 0 } },
  );

  if (!client) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return;
  }

  res.json(client);
});

// PUT /clients/:id
clientsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = UpdateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const clients = getClientsCollection();

  if (parsed.data.companyName) {
    const existing = await clients.findOne({
      companyName: parsed.data.companyName,
      _id: { $ne: id },
    });
    if (existing) {
      res.status(409).json({ error: { code: 'DUPLICATE_NAME', message: 'A client with this company name already exists' } });
      return;
    }
  }

  const result = await clients.findOneAndUpdate(
    { _id: id },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: 'after', projection: { codeCredentials: 0 } },
  );

  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return;
  }

  log('info', 'Client updated', { clientId: id, requestId: req.requestId });
  res.json(result);
});

// DELETE /clients/:id
clientsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const hasActive = await engagementCheck.checkActiveEngagements(id);
  if (hasActive) {
    res.status(409).json({ error: { code: 'ACTIVE_ENGAGEMENTS', message: 'Cannot delete client with active engagements' } });
    return;
  }

  const clients = getClientsCollection();
  const result = await clients.deleteOne({ _id: id });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return;
  }

  // Cascade delete contacts
  const contacts = getContactsCollection();
  await contacts.deleteMany({ clientId: id });

  log('info', 'Client deleted', { clientId: id, requestId: req.requestId });
  res.status(204).end();
});
