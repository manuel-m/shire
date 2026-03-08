import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
export const engagementsRouter = Router();

engagementsRouter.use(requireAuth);

// GET /api/engagements
engagementsRouter.get('/', (req: Request, res: Response) => {
  void proxyRequest(config.engagementServiceUrl, '/engagements', req, res);
});

// POST /api/engagements
engagementsRouter.post('/', (req: Request, res: Response) => {
  void proxyRequest(config.engagementServiceUrl, '/engagements', req, res);
});

// GET /api/engagements/client/:clientId
engagementsRouter.get('/client/:clientId', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  void proxyRequest(config.engagementServiceUrl, `/engagements/client/${clientId}`, req, res);
});

// GET /api/engagements/:id — enriched with client name
engagementsRouter.get('/:id', (req: Request, res: Response) => {
  void (async () => {
    const id = req.params.id as string;
    const auth = req.headers.authorization;

    const engRes = await fetchJson<{ clientId?: string }>(
      config.engagementServiceUrl,
      `/engagements/${id}`,
      auth,
      req.requestId,
    );

    if (engRes.status !== 200) {
      res.status(engRes.status).json(engRes.data);
      return;
    }

    const engagement = engRes.data as Record<string, unknown>;
    try {
      const clientRes = await fetchJson<{ companyName?: string }>(
        config.clientServiceUrl,
        `/clients/${String(engagement.clientId)}`,
        auth,
        req.requestId,
      );
      if (clientRes.status === 200) {
        engagement.clientName = clientRes.data.companyName;
      }
    } catch {
      // Client enrichment is best-effort
    }

    res.json(engagement);
  })();
});

// PUT /api/engagements/:id
engagementsRouter.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.engagementServiceUrl, `/engagements/${id}`, req, res);
});

// PATCH /api/engagements/:id/status
engagementsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.engagementServiceUrl, `/engagements/${id}/status`, req, res);
});

// DELETE /api/engagements/:id
engagementsRouter.delete('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.engagementServiceUrl, `/engagements/${id}`, req, res);
});
