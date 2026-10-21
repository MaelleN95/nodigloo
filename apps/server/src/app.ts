import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nodigloo/shared';
import type { Config } from './config.js';
import {
  QuizService,
  type QuizServiceDeps,
} from './domain/games/quiz/quiz-service.js';
import { RoomService } from './domain/room-service.js';
import { runRoomMaintenance } from './socket/room-maintenance.js';
import { registerRoomHandlers } from './socket/room-handlers.js';
import { createRateLimiter } from './socket/rate-limiter.js';

export class OriginNotAllowedError extends Error {
  constructor() {
    super('Origin not allowed');
  }
}

export const createApp = (
  config: Config,
  roomService: RoomService = new RoomService(),
  quizServiceDeps: Partial<QuizServiceDeps> = {},
) => {
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

  const quizService = new QuizService(
    roomService,
    (roomCode, event) => {
      switch (event.type) {
        case 'question:started':
          io.to(roomCode).emit('question:started', event.payload);
          break;
        case 'question:revealed':
          io.to(roomCode).emit('question:revealed', event.payload);
          break;
        case 'game:finished':
          io.to(roomCode).emit('game:finished', event.payload);
          break;
      }
    },
    quizServiceDeps,
  );

  const maintenanceTimer = setInterval(
    () => runRoomMaintenance(io, roomService),
    1000,
  );
  maintenanceTimer.unref();
  httpServer.once('close', () => {
    clearInterval(maintenanceTimer);
    quizService.close();
  });

  // Tentatives de création, jonction ou reprise, comptées par IP
  const attemptLimiter = createRateLimiter(config.attemptLimit);

  // On ne logue que l'id technique du socket, jamais de pseudo ni de contenu
  io.on('connection', (socket) => {
    console.info(`Socket connected: ${socket.id}`);
    registerRoomHandlers(socket, roomService, quizService, attemptLimiter);

    socket.on('disconnect', (reason) => {
      console.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return { app, httpServer, io };
};
