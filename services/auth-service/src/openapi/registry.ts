import { createServiceRegistry, bearerAuth } from '@shire/shared-types';

export const registry = createServiceRegistry();

registry.registerComponent('securitySchemes', 'BearerAuth', bearerAuth);
