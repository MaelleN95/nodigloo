import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { httpServer, io } = createApp(config);

httpServer.listen(config.port, '0.0.0.0', () => {
  console.info(`Nodigloo server listening on port ${config.port}`);
});

const shutdown = () => {
  io.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
