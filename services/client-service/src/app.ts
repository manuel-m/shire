import express from 'express';
import { healthRouter } from './routes/health.js';
import { clientsRouter } from './routes/clients.js';
import { contactsRouter } from './routes/contacts.js';
import { credentialsRouter } from './routes/credentials.js';
import { metricsRouter, httpRequestDuration, httpRequestTotal } from './metrics.js';
import { requestId } from './middleware/request-id.js';
import { mountSwagger } from './openapi/swagger.js';

export function createApp(): express.Application {
  const app = express();

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
  app.use('/clients', clientsRouter);
  app.use('/clients/:id/contacts', contactsRouter);
  app.use('/clients/:id/credentials', credentialsRouter);

  mountSwagger(app);

  return app;
}
