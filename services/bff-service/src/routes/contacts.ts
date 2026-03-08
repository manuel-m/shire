import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
export const contactsRouter = Router();

contactsRouter.use(requireAuth);

// GET /api/clients/:clientId/contacts
contactsRouter.get('/', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  void proxyRequest(config.clientServiceUrl, `/clients/${clientId}/contacts`, req, res);
});

// POST /api/clients/:clientId/contacts
contactsRouter.post('/', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  void proxyRequest(config.clientServiceUrl, `/clients/${clientId}/contacts`, req, res);
});

// PUT /api/clients/:clientId/contacts/:contactId
contactsRouter.put('/:contactId', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const contactId = req.params.contactId as string;
  void proxyRequest(
    config.clientServiceUrl,
    `/clients/${clientId}/contacts/${contactId}`,
    req,
    res,
  );
});

// DELETE /api/clients/:clientId/contacts/:contactId
contactsRouter.delete('/:contactId', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  const contactId = req.params.contactId as string;
  void proxyRequest(
    config.clientServiceUrl,
    `/clients/${clientId}/contacts/${contactId}`,
    req,
    res,
  );
});
