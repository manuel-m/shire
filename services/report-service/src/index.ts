import { createApp } from './app.js';
import { connectDb } from './db.js';
import { config } from './config.js';
import { createLogger } from '@shire/shared';

const { log } = createLogger(config.serviceName);

async function main() {
  await connectDb();
  log('info', 'Connected to MongoDB');

  const app = createApp();
  app.listen(config.port, () => {
    log('info', `Report service listening on port ${config.port}`);
  });
}

main().catch((err) => {
  log('error', 'Failed to start report service', { error: String(err) });
  process.exit(1);
});
