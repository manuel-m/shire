import { Router, Request, Response } from 'express';
import { createAuthMiddleware } from '@shire/shared';
import { proxyRequest, fetchJson } from '../lib/service-client.js';
import { config } from '../config.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
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
invoicesRouter.get('/:id', (req: Request, res: Response) => {
  void (async () => {
    const id = req.params.id as string;
    const auth = req.headers.authorization;

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
    try {
      const [clientRes, engRes] = await Promise.all([
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
      if (clientRes.status === 200) invoice.clientName = clientRes.data.companyName;
      if (engRes.status === 200) invoice.engagementDescription = engRes.data.description;
    } catch {
      // Enrichment is best-effort
    }

    res.json(invoice);
  })();
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
