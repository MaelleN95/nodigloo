import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { httpServer, io } = createApp(config);

httpServer.listen(config.port, '0.0.0.0', () => {
  console.info(`Nodigloo server listening on port ${config.port}`);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

const shutdown = (signal: string) => {
  console.info(`${signal} reçu, arrêt du serveur`);

  // Si une connexion traîne, on ne veut pas rester bloqué pour toujours
  const forceExit = setTimeout(() => {
    console.error('Arrêt trop long, sortie forcée');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  io.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
