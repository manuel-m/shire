import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
export const clientsRouter = Router();

clientsRouter.use(requireAuth);

// GET /api/clients
clientsRouter.get('/', (req: Request, res: Response) => {
  void proxyRequest(config.clientServiceUrl, '/clients', req, res);
});

// POST /api/clients
clientsRouter.post('/', (req: Request, res: Response) => {
  void proxyRequest(config.clientServiceUrl, '/clients', req, res);
});

// GET /api/clients/:id — enriched with engagement count
clientsRouter.get('/:id', (req: Request, res: Response) => {
  void (async () => {
    const clientId = req.params.id as string;
    const auth = req.headers.authorization;

    const [clientRes, engagementsRes] = await Promise.all([
      fetchJson(config.clientServiceUrl, `/clients/${clientId}`, auth, req.requestId),
      fetchJson<{ total?: number }>(
        config.engagementServiceUrl,
        `/engagements?clientId=${clientId}&limit=1`,
        auth,
        req.requestId,
      ),
    ]);

    if (clientRes.status !== 200) {
      res.status(clientRes.status).json(clientRes.data);
      return;
    }

    const enriched = {
      ...(clientRes.data as object),
      engagementCount: engagementsRes.status === 200 ? (engagementsRes.data.total ?? 0) : 0,
    };

    res.json(enriched);
  })();
});

// PUT /api/clients/:id
clientsRouter.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.clientServiceUrl, `/clients/${id}`, req, res);
});

// DELETE /api/clients/:id
clientsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.clientServiceUrl, `/clients/${id}`, req, res);
});
