import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nodigloo/shared';
import type { Socket } from 'socket.io';

type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Répond le plus vite possible : tout retard ici fausse le décalage mesuré par le client
export const registerClockHandlers = (socket: ClientSocket): void => {
  socket.on('clock:ping', (ack) => {
    if (typeof ack !== 'function') {
      return;
    }
    ack({ ok: true, data: { serverTime: Date.now() } });
  });
};
