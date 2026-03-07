import { createApp } from './app.js';
import { connectDb } from './db.js';
import { config } from './config.js';
import { log } from './logger.js';

async function main() {
  await connectDb();
  log('info', 'Connected to MongoDB');

  const app = createApp();
  app.listen(config.port, () => {
    log('info', `Client service listening on port ${config.port}`);
  });
}

main().catch((err) => {
  log('error', 'Failed to start client service', { error: String(err) });
  process.exit(1);
});
