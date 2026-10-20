import type {
  Ack,
  ClientToServerEvents,
  JoinedRoom,
  ServerToClientEvents,
} from '@nodigloo/shared';
import type { Socket } from 'socket.io';
import { DomainError, toAppError } from '../domain/errors.js';
import { RoomService } from '../domain/room-service.js';
import { toRoomPublic } from '../domain/room.js';
import {
  createRoomSchema,
  joinRoomSchema,
  parsePayload,
} from './payloads.js';

type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type JoinedRoomAck = (result: Ack<JoinedRoom>) => void;

const reportError = (ack: JoinedRoomAck, error: unknown): void => {
  if (!(error instanceof DomainError)) {
    console.error(
      'Socket event failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }

  ack({ ok: false, error: toAppError(error) });
};

export const registerRoomHandlers = (
  socket: ClientSocket,
  roomService: RoomService,
): void => {
  socket.on('room:create', async (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for room:create (${socket.id})`);
      return;
    }

    try {
      const { nickname } = parsePayload(createRoomSchema, payload);
      const { room, player } = roomService.createRoom(nickname, socket.id);

      await socket.join(room.code);
      ack({
        ok: true,
        data: {
          room: toRoomPublic(room),
          session: {
            playerId: player.id,
            reconnectToken: player.reconnectToken,
          },
        },
      });
    } catch (error) {
      reportError(ack, error);
    }
  });

  socket.on('room:join', async (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for room:join (${socket.id})`);
      return;
    }

    try {
      const { code, nickname } = parsePayload(joinRoomSchema, payload);
      const { room, player } = roomService.joinRoom(
        code,
        nickname,
        socket.id,
      );

      await socket.join(room.code);
      socket.to(room.code).emit('room:updated', toRoomPublic(room));
      ack({
        ok: true,
        data: {
          room: toRoomPublic(room),
          session: {
            playerId: player.id,
            reconnectToken: player.reconnectToken,
          },
        },
      });
    } catch (error) {
      reportError(ack, error);
    }
  });
};
