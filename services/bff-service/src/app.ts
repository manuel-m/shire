import express from 'express';
import { requestId, createHealthRouter, createMetrics, mountSwagger } from '@shire/shared';
import { config } from './config.js';
import { registry } from './openapi/registry.js';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { contactsRouter } from './routes/contacts.js';
import { credentialsRouter } from './routes/credentials.js';
import { engagementsRouter } from './routes/engagements.js';
import { reportsRouter } from './routes/reports.js';
import { invoicesRouter } from './routes/invoices.js';
import { dashboardRouter } from './routes/dashboard.js';

// Side-effect imports — register all OpenAPI paths
import './routes/health.openapi.js';

export function createApp(): express.Application {
  const app = express();
  const { metricsRouter, httpRequestDuration, httpRequestTotal } = createMetrics();
  const healthRouter = createHealthRouter(config.serviceName);

  app.use(express.json());
  app.use(requestId);

  // Metrics middleware
  app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const route: string = req.route?.path || req.path;
      const labels = { method: req.method, route, status_code: res.statusCode.toString() };
      end(labels);
      httpRequestTotal.inc(labels);
    });
    next();
  });

  app.use(healthRouter);
  app.use(metricsRouter);

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/clients/:clientId/contacts', contactsRouter);
  app.use('/api/clients/:clientId/credentials', credentialsRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/engagements', engagementsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/dashboard', dashboardRouter);

  mountSwagger(app, registry, {
    title: 'Shire BFF Service',
    version: '0.1.0',
    description: 'Backend-for-Frontend — single entry point for the Shire web application',
  });

  return app;
}
