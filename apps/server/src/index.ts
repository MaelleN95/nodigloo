import 'dotenv/config';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nodigloo/shared';

const port = Number(process.env.PORT ?? 3001);
const allowedOrigins = (process.env.CLIENT_ORIGINS ?? 'http://localhost:8080')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const originAllowed = (
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin not allowed'));
};

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: originAllowed,
    methods: ['GET', 'POST'],
  },
});

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
  const status =
    error instanceof Error && error.message === 'Origin not allowed'
      ? 403
      : 500;
  console.error(
    'Request failed',
    error instanceof Error ? error.message : 'Unknown error',
  );
  response
    .status(status)
    .json({
      error: status === 403 ? 'Origin not allowed' : 'Internal server error',
    });
};

app.use(errorHandler);

httpServer.listen(port, '0.0.0.0', () => {
  console.info(`Nodigloo server listening on port ${port}`);
});

const shutdown = () => {
  io.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
