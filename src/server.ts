import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const server = createApp(config).listen(config.port, config.host, () => {
  console.log(`Facet origin: http://${config.host}:${config.port} (${config.demo ? 'DEMO' : 'live'})`);
  if (!config.demo && (!config.glasserKey || !config.modelKey)) console.log('Live verification is unavailable until Glasser and model credentials are configured.');
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { server.close(); });
