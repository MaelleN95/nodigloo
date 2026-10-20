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
  resumeSessionSchema,
} from './payloads.js';

type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type JoinedRoomAck = (result: Ack<JoinedRoom>) => void;

const reportError = <T>(
  ack: (result: Ack<T>) => void,
  error: unknown,
): void => {
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
  let membership: { roomCode: string; playerId: string } | undefined;

  socket.on('disconnect', () => {
    if (membership) {
      roomService.markDisconnected(
        membership.roomCode,
        membership.playerId,
        socket.id,
      );
    }
  });

  socket.on('room:create', async (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for room:create (${socket.id})`);
      return;
    }

    try {
      const { nickname } = parsePayload(createRoomSchema, payload);
      const { room, player } = roomService.createRoom(nickname, socket.id);

      await socket.join(room.code);
      membership = { roomCode: room.code, playerId: player.id };
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
      membership = { roomCode: room.code, playerId: player.id };
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

  socket.on('session:resume', async (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for session:resume (${socket.id})`);
      return;
    }

    try {
      const { code, playerId, reconnectToken } = parsePayload(
        resumeSessionSchema,
        payload,
      );
      const previousSocketId = roomService
        .getRoom(code)
        ?.players.get(playerId)?.socketId;
      const { room, player } = roomService.resumeSession(
        code,
        playerId,
        reconnectToken,
        socket.id,
      );

      await socket.join(room.code);
      membership = { roomCode: room.code, playerId: player.id };
      if (previousSocketId && previousSocketId !== socket.id) {
        socket.nsp.sockets.get(previousSocketId)?.disconnect(true);
      }

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

  socket.on('game:start', (ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for game:start (${socket.id})`);
      return;
    }

    try {
      if (!membership) {
        throw new DomainError('FORBIDDEN', 'Action réservée à l’hôte');
      }

      const room = roomService.startGame(
        membership.roomCode,
        membership.playerId,
        socket.id,
      );
      socket.nsp.to(room.code).emit('room:updated', toRoomPublic(room));
      ack({ ok: true, data: undefined });
    } catch (error) {
      reportError(ack, error);
    }
  });
};
