import { Router, Request, Response } from 'express';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
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
reportsRouter.get('/:id', async (req: Request, res: Response) => {
  const UNKNOWN_ERROR = 'Unknown error';
  try {
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

    const results = await Promise.allSettled([
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

    const clientResult = results[0];
    const engagementResult = results[1];

    if (clientResult.status === 'fulfilled' && clientResult.value.status === 200) {
      report.clientName = clientResult.value.data.companyName;
    } else if (clientResult.status === 'rejected') {
      log('warn', 'Client enrichment failed for report', {
        reportId: id,
        clientId: report.clientId,
        error: clientResult.reason instanceof Error ? clientResult.reason.message : UNKNOWN_ERROR,
        requestId: req.requestId,
      });
    }

    if (engagementResult.status === 'fulfilled' && engagementResult.value.status === 200) {
      report.engagementDescription = engagementResult.value.data.description;
    } else if (engagementResult.status === 'rejected') {
      log('warn', 'Engagement enrichment failed for report', {
        reportId: id,
        engagementId: report.engagementId,
        error:
          engagementResult.reason instanceof Error
            ? engagementResult.reason.message
            : UNKNOWN_ERROR,
        requestId: req.requestId,
      });
    }

    res.json(report);
  } catch (err) {
    log('error', 'Report detail request failed', {
      error: err instanceof Error ? err.message : UNKNOWN_ERROR,
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Report service unavailable' },
    });
  }
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
