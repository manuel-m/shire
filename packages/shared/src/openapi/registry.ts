import { createServiceRegistry, bearerAuth } from '@shire/shared-types';

export function createRegistry() {
  const registry = createServiceRegistry();
  registry.registerComponent('securitySchemes', 'BearerAuth', bearerAuth);
  return registry;
}
