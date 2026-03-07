import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from '@shire/shared-types';
import { registry } from './registry.js';

// Side-effect imports — register all paths
import '../routes/health.openapi.js';
import '../routes/auth.openapi.js';

const spec = generateOpenAPIDocument(registry, {
  title: 'Shire Auth Service',
  version: '0.1.0',
  description: 'JWT authentication and user management',
});

export function mountSwagger(app: Application): void {
  app.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(spec));
}
