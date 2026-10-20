import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nodigloo/shared';
import type { Server } from 'socket.io';
import type { RoomService } from '../domain/room-service.js';
import { toRoomPublic } from '../domain/room.js';

type RoomServer = Server<ClientToServerEvents, ServerToClientEvents>;

export const runRoomMaintenance = (
  io: RoomServer,
  roomService: RoomService,
): void => {
  for (const code of roomService.expireDisconnectedPlayers()) {
    const room = roomService.getRoom(code);
    if (room) {
      io.to(code).emit('room:updated', toRoomPublic(room));
    }
  }
};
