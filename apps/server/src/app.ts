import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nodigloo/shared';
import type { Config } from './config.js';

export class OriginNotAllowedError extends Error {
  constructor() {
    super('Origin not allowed');
  }
}

export const createApp = (config: Config) => {
  // Les requêtes sans origine (curl, healthcheck Docker) passent, les navigateurs doivent être dans la liste
  const originAllowed = (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void,
  ) => {
    if (!origin || config.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new OriginNotAllowedError());
  };

  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: originAllowed,
        methods: ['GET', 'POST'],
      },
    },
  );

  app.use(cors({ origin: originAllowed, methods: ['GET', 'POST'] }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    if (error instanceof OriginNotAllowedError) {
      response.status(403).json({ error: 'Origin not allowed' });
      return;
    }

    console.error(
      'Request failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    response.status(500).json({ error: 'Internal server error' });
  };

  app.use(errorHandler);

  return { app, httpServer, io };
};
