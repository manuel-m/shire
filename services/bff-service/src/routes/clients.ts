import { Router, Request, Response } from 'express';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
export const clientsRouter = Router();

const ERROR_MESSAGES = {
  BAD_GATEWAY: 'BAD_GATEWAY',
  CLIENT_UNAVAILABLE: 'Client service unavailable',
  BACKEND_UNAVAILABLE: 'Backend service unavailable',
  UNKNOWN_ERROR: 'Unknown error',
};

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
clientsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const clientId = req.params.id as string;
    const auth = req.headers.authorization;

    const results = await Promise.allSettled([
      fetchJson(config.clientServiceUrl, `/clients/${clientId}`, auth, req.requestId),
      fetchJson<{ total?: number }>(
        config.engagementServiceUrl,
        `/engagements?clientId=${clientId}&limit=1`,
        auth,
        req.requestId,
      ),
    ]);

    const clientResult = results[0];
    const engagementsResult = results[1];

    // Handle client fetch failure (critical path)
    if (clientResult.status === 'rejected') {
      log('error', ERROR_MESSAGES.CLIENT_UNAVAILABLE, {
        clientId,
        error:
          clientResult.reason instanceof Error
            ? clientResult.reason.message
            : ERROR_MESSAGES.UNKNOWN_ERROR,
        requestId: req.requestId,
      });
      res.status(502).json({
        error: { code: ERROR_MESSAGES.BAD_GATEWAY, message: ERROR_MESSAGES.CLIENT_UNAVAILABLE },
      });
      return;
    }

    const clientRes = clientResult.value;
    if (clientRes.status !== 200) {
      res.status(clientRes.status).json(clientRes.data);
      return;
    }

    const enriched = {
      ...(clientRes.data as object),
      engagementCount:
        engagementsResult.status === 'fulfilled' && engagementsResult.value.status === 200
          ? (engagementsResult.value.data.total ?? 0)
          : (() => {
              if (engagementsResult.status === 'rejected') {
                log('warn', 'Engagement enrichment failed', {
                  clientId,
                  error:
                    engagementsResult.reason instanceof Error
                      ? engagementsResult.reason.message
                      : ERROR_MESSAGES.UNKNOWN_ERROR,
                  requestId: req.requestId,
                });
              }
              return 0;
            })(),
    };

    res.json(enriched);
  } catch (err) {
    log('error', 'Client detail request failed', {
      error: err instanceof Error ? err.message : ERROR_MESSAGES.UNKNOWN_ERROR,
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: ERROR_MESSAGES.BAD_GATEWAY, message: ERROR_MESSAGES.BACKEND_UNAVAILABLE },
    });
  }
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
