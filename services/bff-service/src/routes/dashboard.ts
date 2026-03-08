import { Router, Request, Response } from 'express';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// GET /api/dashboard
dashboardRouter.get('/', (req: Request, res: Response) => {
  void (async () => {
    const auth = req.headers.authorization;

    const results = await Promise.allSettled([
      fetchJson<{ total?: number }>(
        config.clientServiceUrl,
        '/clients?limit=1',
        auth,
        req.requestId,
      ),
      fetchJson<{ total?: number }>(
        config.engagementServiceUrl,
        '/engagements?limit=1',
        auth,
        req.requestId,
      ),
      fetchJson<{ total?: number }>(
        config.reportServiceUrl,
        '/reports?limit=1',
        auth,
        req.requestId,
      ),
      fetchJson<{ total?: number }>(
        config.billingServiceUrl,
        '/invoices?limit=1',
        auth,
        req.requestId,
      ),
      // Active engagements (in-progress)
      fetchJson<{ total?: number }>(
        config.engagementServiceUrl,
        '/engagements?status=in-progress&limit=1',
        auth,
        req.requestId,
      ),
      // Draft invoices
      fetchJson<{ total?: number }>(
        config.billingServiceUrl,
        '/invoices?status=draft&limit=1',
        auth,
        req.requestId,
      ),
      // Overdue invoices
      fetchJson<{ total?: number }>(
        config.billingServiceUrl,
        '/invoices?status=overdue&limit=1',
        auth,
        req.requestId,
      ),
    ]);

    const extract = (r: PromiseSettledResult<{ status: number; data: { total?: number } }>) =>
      r.status === 'fulfilled' && r.value.status === 200 ? (r.value.data.total ?? 0) : 0;

    const dashboard = {
      totalClients: extract(results[0]),
      totalEngagements: extract(results[1]),
      totalReports: extract(results[2]),
      totalInvoices: extract(results[3]),
      activeEngagements: extract(results[4]),
      draftInvoices: extract(results[5]),
      overdueInvoices: extract(results[6]),
    };

    log('info', 'Dashboard aggregated', { requestId: req.requestId });
    res.json(dashboard);
  })();
});
