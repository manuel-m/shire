import express from 'express';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { metricsRouter } from './metrics.js';
import { requestId } from './middleware/request-id.js';
import { httpRequestDuration, httpRequestTotal } from './metrics.js';
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
  app.use('/auth', authRouter);

  mountSwagger(app);

  return app;
}
