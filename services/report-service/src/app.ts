import express from 'express';
import { requestId, createHealthRouter, createMetrics, mountSwagger } from '@shire/shared';
import { reportsRouter } from './routes/reports.js';
import { config } from './config.js';
import { registry } from './openapi/registry.js';

// Side-effect imports — register all OpenAPI paths
import './routes/health.openapi.js';
import './routes/reports.openapi.js';

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
  app.use('/reports', reportsRouter);

  mountSwagger(app, registry, {
    title: 'Shire Report Service',
    version: '0.1.0',
    description: 'Manages consulting reports, versioning, and document generation',
  });

  return app;
}
