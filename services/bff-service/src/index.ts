import { createApp } from './app.js';
import { config } from './config.js';
import { createLogger } from '@shire/shared';

const { log } = createLogger(config.serviceName);

const app = createApp();
app.listen(config.port, () => {
  log('info', `BFF service listening on port ${config.port}`);
});
