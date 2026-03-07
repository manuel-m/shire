import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { CreateContactSchema, UpdateContactSchema } from '@shire/shared-types';
import { getClientsCollection, getContactsCollection } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const contactsRouter = Router({ mergeParams: true });

contactsRouter.use(requireAuth);

async function verifyClientExists(clientId: string, res: Response): Promise<boolean> {
  const client = await getClientsCollection().findOne({ _id: clientId });
  if (!client) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found' } });
    return false;
  }
  return true;
}

// POST /clients/:id/contacts
contactsRouter.post('/', async (req: Request, res: Response) => {
  const clientId = req.params.id as string;
  if (!(await verifyClientExists(clientId, res))) return;

  const parsed = CreateContactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const now = new Date();
  const contact = {
    _id: randomUUID(),
    clientId,
    ...parsed.data,
    createdAt: now,
    updatedAt: now,
  };

  await getContactsCollection().insertOne(contact);
  res.status(201).json(contact);
});

// GET /clients/:id/contacts
contactsRouter.get('/', async (req: Request, res: Response) => {
  const clientId = req.params.id as string;
  if (!(await verifyClientExists(clientId, res))) return;

  const contacts = await getContactsCollection().find({ clientId }).toArray();
  res.json(contacts);
});

// PUT /clients/:id/contacts/:contactId
contactsRouter.put('/:contactId', async (req: Request, res: Response) => {
  const parsed = UpdateContactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const result = await getContactsCollection().findOneAndUpdate(
    { _id: req.params.contactId as string, clientId: req.params.id as string },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    return;
  }

  res.json(result);
});

// DELETE /clients/:id/contacts/:contactId
contactsRouter.delete('/:contactId', async (req: Request, res: Response) => {
  const result = await getContactsCollection().deleteOne({
    _id: req.params.contactId as string,
    clientId: req.params.id as string,
  });

  if (result.deletedCount === 0) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } });
    return;
  }

  res.status(204).end();
});
