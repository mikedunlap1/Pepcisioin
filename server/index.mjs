import { readConfig } from './config.mjs';
import { createApp } from './app.mjs';

try {
  const config = readConfig();
  const server = createApp(config);
  server.listen(config.port, config.host, () => {
    console.log(`Pepcision site listening on port ${server.address().port}. AI routing: ${config.aiEnabled ? 'enabled' : 'off (approved phrases only)'}.`);
    if (!config.production) console.log('Development mode. Logs are temporary unless CHAT_DB_PATH and stable secrets are configured.');
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(); setTimeout(() => process.exit(0), 10000).unref(); });
} catch {
  console.error('Startup failed. Check required environment settings, database permissions, and encryption key.');
  process.exitCode = 1;
}
