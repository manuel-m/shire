import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
export const credentialsRouter = Router();

credentialsRouter.use(requireAuth);

// GET /api/clients/:clientId/credentials
credentialsRouter.get('/', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  void proxyRequest(config.clientServiceUrl, `/clients/${clientId}/credentials`, req, res);
});

// PUT /api/clients/:clientId/credentials
credentialsRouter.put('/', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  void proxyRequest(config.clientServiceUrl, `/clients/${clientId}/credentials`, req, res);
});
