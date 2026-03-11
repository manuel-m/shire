import { Router, Request, Response } from 'express';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

// GET /api/dashboard
dashboardRouter.get('/', async (req: Request, res: Response) => {
  try {
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

    // Service name constants for logging
    const CLIENT_SERVICE = 'Client service';
    const ENGAGEMENT_SERVICE = 'Engagement service';
    const REPORT_SERVICE = 'Report service';
    const BILLING_SERVICE = 'Billing service';

    // Check if all services failed
    const allFailed = results.every(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200),
    );

    if (allFailed) {
      log('error', 'All dashboard services failed', { requestId: req.requestId });
      res.status(502).json({
        error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
      });
      return;
    }

    const extract = (
      r: PromiseSettledResult<{ status: number; data: { total?: number } }>,
      serviceName: string,
    ) => {
      if (r.status === 'fulfilled' && r.value.status === 200) {
        return r.value.data.total ?? 0;
      }
      if (r.status === 'rejected') {
        log('warn', `${serviceName} aggregation failed`, {
          error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
          requestId: req.requestId,
        });
      }
      return 0;
    };

    const dashboard = {
      totalClients: extract(results[0], CLIENT_SERVICE),
      totalEngagements: extract(results[1], ENGAGEMENT_SERVICE),
      totalReports: extract(results[2], REPORT_SERVICE),
      totalInvoices: extract(results[3], BILLING_SERVICE),
      activeEngagements: extract(results[4], ENGAGEMENT_SERVICE),
      draftInvoices: extract(results[5], BILLING_SERVICE),
      overdueInvoices: extract(results[6], BILLING_SERVICE),
    };

    log('info', 'Dashboard aggregated', { requestId: req.requestId });
    res.json(dashboard);
  } catch (err) {
    log('error', 'Dashboard request failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });
  }
});
