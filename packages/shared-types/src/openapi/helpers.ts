import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';

export function createServiceRegistry(): OpenAPIRegistry {
  return new OpenAPIRegistry();
}

export function generateOpenAPIDocument(
  registry: OpenAPIRegistry,
  info: { title: string; version: string; description?: string },
): OpenAPIObject {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info,
  });
}

export const bearerAuth = {
  type: 'http' as const,
  scheme: 'bearer',
  bearerFormat: 'JWT',
};
