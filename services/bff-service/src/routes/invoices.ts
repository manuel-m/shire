import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { createLogger } from '@shire/shared';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);
export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);

// GET /api/invoices
invoicesRouter.get('/', (req: Request, res: Response) => {
  void proxyRequest(config.billingServiceUrl, '/invoices', req, res);
});

// POST /api/invoices
invoicesRouter.post('/', (req: Request, res: Response) => {
  void proxyRequest(config.billingServiceUrl, '/invoices', req, res);
});

// GET /api/invoices/client/:clientId
invoicesRouter.get('/client/:clientId', (req: Request, res: Response) => {
  const clientId = req.params.clientId as string;
  void proxyRequest(config.billingServiceUrl, `/invoices/client/${clientId}`, req, res);
});

// GET /api/invoices/engagement/:engagementId
invoicesRouter.get('/engagement/:engagementId', (req: Request, res: Response) => {
  const engagementId = req.params.engagementId as string;
  void proxyRequest(config.billingServiceUrl, `/invoices/engagement/${engagementId}`, req, res);
});

// GET /api/invoices/:id — enriched with client + engagement names
invoicesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const auth = req.headers.authorization;
    const UNKNOWN_ERROR = 'Unknown error';

    const invoiceRes = await fetchJson<{ clientId?: string; engagementId?: string }>(
      config.billingServiceUrl,
      `/invoices/${id}`,
      auth,
      req.requestId,
    );

    if (invoiceRes.status !== 200) {
      res.status(invoiceRes.status).json(invoiceRes.data);
      return;
    }

    const invoice = invoiceRes.data as Record<string, unknown>;

    const results = await Promise.allSettled([
      fetchJson<{ companyName?: string }>(
        config.clientServiceUrl,
        `/clients/${String(invoice.clientId)}`,
        auth,
        req.requestId,
      ),
      fetchJson<{ description?: string }>(
        config.engagementServiceUrl,
        `/engagements/${String(invoice.engagementId)}`,
        auth,
        req.requestId,
      ),
    ]);

    const clientResult = results[0];
    const engagementResult = results[1];

    if (clientResult.status === 'fulfilled' && clientResult.value.status === 200) {
      invoice.clientName = clientResult.value.data.companyName;
    } else if (clientResult.status === 'rejected') {
      log('warn', 'Client enrichment failed for invoice', {
        invoiceId: id,
        clientId: invoice.clientId,
        error: clientResult.reason instanceof Error ? clientResult.reason.message : UNKNOWN_ERROR,
        requestId: req.requestId,
      });
    }

    if (engagementResult.status === 'fulfilled' && engagementResult.value.status === 200) {
      invoice.engagementDescription = engagementResult.value.data.description;
    } else if (engagementResult.status === 'rejected') {
      log('warn', 'Engagement enrichment failed for invoice', {
        invoiceId: id,
        engagementId: invoice.engagementId,
        error:
          engagementResult.reason instanceof Error
            ? engagementResult.reason.message
            : UNKNOWN_ERROR,
        requestId: req.requestId,
      });
    }

    res.json(invoice);
  } catch (err) {
    const UNKNOWN_ERROR = 'Unknown error';
    log('error', 'Invoice detail request failed', {
      error: err instanceof Error ? err.message : UNKNOWN_ERROR,
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Billing service unavailable' },
    });
  }
});

// PUT /api/invoices/:id
invoicesRouter.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.billingServiceUrl, `/invoices/${id}`, req, res);
});

// PATCH /api/invoices/:id/status
invoicesRouter.patch('/:id/status', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.billingServiceUrl, `/invoices/${id}/status`, req, res);
});

// POST /api/invoices/:id/send
invoicesRouter.post('/:id/send', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.billingServiceUrl, `/invoices/${id}/send`, req, res);
});

// POST /api/invoices/:id/remind
invoicesRouter.post('/:id/remind', (req: Request, res: Response) => {
  const id = req.params.id as string;
  void proxyRequest(config.billingServiceUrl, `/invoices/${id}/remind`, req, res);
});
