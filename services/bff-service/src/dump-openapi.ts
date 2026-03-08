import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOpenAPIDocument } from '@shire/shared-types';
import { registry } from './openapi/registry.js';

// Import all openapi registrations
import './routes/health.openapi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const spec = generateOpenAPIDocument(registry, {
  title: 'Shire BFF API',
  version: '0.1.0',
  description: 'Shire Back-Office Platform API',
});

const outPath = resolve(__dirname, '..', 'openapi.json');
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written to ${outPath}`);
