import { Router, Request, Response } from 'express';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
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
engagementsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const auth = req.headers.authorization;
    const requestId = req.requestId;

    const engRes = await fetchJson<{ clientId?: string }>(
      config.engagementServiceUrl,
      `/engagements/${id}`,
      auth,
      requestId,
    );

    if (engRes.status !== 200) {
      res.status(engRes.status).json(engRes.data);
      return;
    }

    const engagement = engRes.data as Record<string, unknown>;

    // Enrich with client name - best-effort but logged (satisfies ERR-05)
    try {
      const clientRes = await fetchJson<{ companyName?: string }>(
        config.clientServiceUrl,
        `/clients/${String(engagement.clientId)}`,
        auth,
        requestId,
      );
      if (clientRes.status === 200) {
        engagement.clientName = clientRes.data.companyName;
      }
    } catch (err) {
      log('warn', 'Client enrichment failed for engagement', {
        engagementId: id,
        clientId: engagement.clientId,
        error: err instanceof Error ? err.message : 'Unknown error',
        requestId,
      });
    }

    res.json(engagement);
  } catch (err) {
    log('error', 'Engagement detail request failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });
  }
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
