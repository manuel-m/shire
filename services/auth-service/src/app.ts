import express from 'express';
import { requestId, createHealthRouter, createMetrics, mountSwagger } from '@shire/shared';
import { authRouter } from './routes/auth.js';
import { config } from './config.js';
import { registry } from './openapi/registry.js';

// Side-effect imports — register all OpenAPI paths
import './routes/health.openapi.js';
import './routes/auth.openapi.js';

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
      const route = req.route?.path || req.path;
      const labels = { method: req.method, route, status_code: res.statusCode.toString() };
      end(labels);
      httpRequestTotal.inc(labels);
    });
    next();
  });

  app.use(healthRouter);
  app.use(metricsRouter);
  app.use('/auth', authRouter);

  mountSwagger(app, registry, {
    title: 'Shire Auth Service',
    version: '0.1.0',
    description: 'JWT authentication and user management',
  });

  return app;
}
