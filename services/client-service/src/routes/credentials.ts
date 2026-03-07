import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CodeCredentialsInputSchema } from '@shire/shared-types';
import { getClientsCollection, getCredentialAccessLogsCollection } from '../db.js';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { encryptArray, decryptArray } from '../crypto.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);

export const credentialsRouter = Router({ mergeParams: true });

credentialsRouter.use(requireAuth);

// PUT /clients/:id/credentials
credentialsRouter.put('/', async (req: Request, res: Response) => {
  const clientId = req.params.id as string;
  const clients = getClientsCollection();
  const client = await clients.findOne({ _id: clientId });
  if (!client) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return;
  }

  const parsed = CodeCredentialsInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const encrypted = {
    repoUrls: parsed.data.repoUrls,
    sshKeys: parsed.data.sshKeys ? encryptArray(parsed.data.sshKeys) : undefined,
    tokens: parsed.data.tokens ? encryptArray(parsed.data.tokens) : undefined,
  };

  await clients.updateOne(
    { _id: clientId },
    { $set: { codeCredentials: encrypted, updatedAt: new Date() } },
  );

  // Audit log
  await getCredentialAccessLogsCollection().insertOne({
    _id: randomUUID(),
    clientId: clientId,
    userId: req.user!.userId,
    action: 'write',
    timestamp: new Date(),
  });

  log('info', 'Credentials updated', {
    clientId: clientId,
    userId: req.user!.userId,
    requestId: req.requestId,
  });
  res.json({ message: 'Credentials updated' });
});

// GET /clients/:id/credentials
credentialsRouter.get('/', async (req: Request, res: Response) => {
  const clientId = req.params.id as string;
  const clients = getClientsCollection();
  const client = await clients.findOne({ _id: clientId });
  if (!client) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return;
  }

  const creds = client.codeCredentials;
  const decrypted = {
    repoUrls: creds?.repoUrls ?? [],
    sshKeys: creds?.sshKeys ? decryptArray(creds.sshKeys) : [],
    tokens: creds?.tokens ? decryptArray(creds.tokens) : [],
  };

  // Audit log
  await getCredentialAccessLogsCollection().insertOne({
    _id: randomUUID(),
    clientId: clientId,
    userId: req.user!.userId,
    action: 'read',
    timestamp: new Date(),
  });

  log('info', 'Credentials accessed', {
    clientId: clientId,
    userId: req.user!.userId,
    requestId: req.requestId,
  });
  res.json(decrypted);
});
