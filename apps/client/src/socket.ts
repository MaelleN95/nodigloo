import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@nodigloo/shared';

export type NodiglooSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export const createNodiglooSocket = (): NodiglooSocket =>
  io(
    import.meta.env.VITE_SERVER_URL || 'http://localhost:3001',
    { autoConnect: false },
  ) as NodiglooSocket;
