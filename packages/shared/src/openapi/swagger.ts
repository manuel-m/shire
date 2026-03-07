import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument, type OpenAPIRegistry } from '@shire/shared-types';

export interface SwaggerInfo {
  title: string;
  version: string;
  description: string;
}

export function mountSwagger(app: Application, registry: OpenAPIRegistry, info: SwaggerInfo): void {
  const spec = generateOpenAPIDocument(registry, info);

  app.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(spec));
}
