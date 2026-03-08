import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// GET /api/reports
reportsRouter.get('/', (req: Request, res: Response) => {
  void proxyRequest(config.reportServiceUrl, '/reports', req, res);
});

// POST /api/reports
reportsRouter.post('/', (req: Request, res: Response) => {
  void proxyRequest(config.reportServiceUrl, '/reports', req, res);
});

// GET /api/reports/:id — enriched with client + engagement names
reportsRouter.get('/:id', (req: Request, res: Response) => {
  void (async () => {
    const id = req.params.id as string;
    const auth = req.headers.authorization;

    const reportRes = await fetchJson<{ clientId?: string; engagementId?: string }>(
      config.reportServiceUrl,
      `/reports/${id}`,
      auth,
      req.requestId,
    );

    if (reportRes.status !== 200) {
      res.status(reportRes.status).json(reportRes.data);
      return;
    }

    const report = reportRes.data as Record<string, unknown>;
    try {
      const [clientRes, engRes] = await Promise.all([
        fetchJson<{ companyName?: string }>(
          config.clientServiceUrl,
          `/clients/${String(report.clientId)}`,
          auth,
          req.requestId,
        ),
        fetchJson<{ description?: string }>(
          config.engagementServiceUrl,
          `/engagements/${String(report.engagementId)}`,
          auth,
          req.requestId,
        ),
      ]);
      if (clientRes.status === 200) report.clientName = clientRes.data.companyName;
      if (engRes.status === 200) report.engagementDescription = engRes.data.description;
    } catch {
      // Enrichment is best-effort
    }

    res.json(report);
  })();
});

// PUT /api/reports/:id
reportsRouter.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.reportServiceUrl, `/reports/${id}`, req, res);
});

// GET /api/reports/:id/versions
reportsRouter.get('/:id/versions', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.reportServiceUrl, `/reports/${id}/versions`, req, res);
});

// GET /api/reports/:id/versions/:version
reportsRouter.get('/:id/versions/:version', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const version = req.params.version as string;
  void proxyRequest(config.reportServiceUrl, `/reports/${id}/versions/${version}`, req, res);
});

// POST /api/reports/:id/generate/markdown
reportsRouter.post('/:id/generate/markdown', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.reportServiceUrl, `/reports/${id}/generate/markdown`, req, res);
});
