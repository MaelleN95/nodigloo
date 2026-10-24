import type {
  Ack,
  ClientToServerEvents,
  JoinedRoom,
  ServerToClientEvents,
} from '@nodigloo/shared';
import type { Socket } from 'socket.io';
import { DomainError, toAppError } from '../domain/errors.js';
import { QuizService } from '../domain/games/quiz/quiz-service.js';
import { ReactionService } from '../domain/games/reaction/reaction-service.js';
import { RoomService } from '../domain/room-service.js';
import { toRoomPublic } from '../domain/room.js';
import {
  createRoomSchema,
  joinRoomSchema,
  parsePayload,
  reactionSubmissionSchema,
  resumeSessionSchema,
  submitQuizAnswerSchema,
  updateSettingsSchema,
} from './payloads.js';
import type { RateLimiter } from './rate-limiter.js';

type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type JoinedRoomAck = (result: Ack<JoinedRoom>) => void;

export interface GameServices {
  quiz: QuizService;
  reaction: ReactionService;
}

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
  games: GameServices,
  attemptLimiter?: RateLimiter,
): void => {
  let membership: { roomCode: string; playerId: string } | undefined;

  // Les tentatives sont comptées par adresse IP : se reconnecter ne remet pas le compteur à zéro
  const checkAttempts = (): void => {
    if (attemptLimiter && !attemptLimiter.allow(socket.handshake.address)) {
      throw new DomainError(
        'RATE_LIMITED',
        'Trop de tentatives, patiente un instant avant de réessayer',
      );
    }
  };

  socket.on('disconnect', () => {
    if (membership) {
      roomService.markDisconnected(
        membership.roomCode,
        membership.playerId,
        socket.id,
      );
    }
  });

  socket.on('room:leave', async (ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for room:leave (${socket.id})`);
      return;
    }
    try {
      if (!membership) {
        throw new DomainError('FORBIDDEN', 'Aucune salle à quitter');
      }
      const { roomCode, playerId } = membership;
      const room = roomService.leaveLobby(roomCode, playerId, socket.id);
      membership = undefined;
      await socket.leave(roomCode);
      if (room) {
        socket.nsp.to(roomCode).emit('room:updated', toRoomPublic(room));
      }
      ack({ ok: true, data: undefined });
    } catch (error) {
      reportError(ack, error);
    }
  });

  socket.on('room:create', async (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for room:create (${socket.id})`);
      return;
    }

    try {
      checkAttempts();
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
      checkAttempts();
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
      checkAttempts();
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
      if (room.status === 'playing') {
        if (room.settings.game === 'reaction') {
          const currentRound = games.reaction.getCurrentRound(room.code);
          if (currentRound) {
            socket.emit('reaction:round:started', currentRound);
          }
        } else {
          const currentQuestion = games.quiz.getCurrentQuestion(room.code);
          if (currentQuestion) {
            socket.emit('question:started', currentQuestion);
          }
        }
      }
    } catch (error) {
      reportError(ack, error);
    }
  });

  socket.on('room:settings:update', (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(
        `Missing acknowledgement for room:settings:update (${socket.id})`,
      );
      return;
    }

    try {
      const settings = parsePayload(updateSettingsSchema, payload);
      if (!membership) {
        throw new DomainError('FORBIDDEN', 'Action réservée à l’hôte');
      }

      const room = roomService.updateSettings(
        membership.roomCode,
        membership.playerId,
        socket.id,
        settings,
      );
      socket.nsp.to(room.code).emit('room:updated', toRoomPublic(room));
      ack({ ok: true, data: undefined });
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
      if (room.settings.game === 'reaction') {
        const firstRound = games.reaction.startGame(room);
        socket.nsp.to(room.code).emit('room:updated', toRoomPublic(room));
        socket.nsp.to(room.code).emit('reaction:round:started', firstRound);
      } else {
        const firstQuestion = games.quiz.startGame(room);
        socket.nsp.to(room.code).emit('room:updated', toRoomPublic(room));
        socket.nsp.to(room.code).emit('question:started', firstQuestion);
      }
      ack({ ok: true, data: undefined });
    } catch (error) {
      reportError(ack, error);
    }
  });

  socket.on('quiz:answer:submit', (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(
        `Missing acknowledgement for quiz:answer:submit (${socket.id})`,
      );
      return;
    }

    try {
      const { questionId, choice } = parsePayload(
        submitQuizAnswerSchema,
        payload,
      );
      if (!membership) {
        throw new DomainError(
          'FORBIDDEN',
          'Action réservée aux joueurs de la salle',
        );
      }

      games.quiz.submitAnswer(
        membership.roomCode,
        membership.playerId,
        socket.id,
        questionId,
        choice,
      );
      ack({ ok: true, data: undefined });
    } catch (error) {
      reportError(ack, error);
    }
  });

  socket.on('reaction:submit', (payload, ack) => {
    if (typeof ack !== 'function') {
      console.warn(`Missing acknowledgement for reaction:submit (${socket.id})`);
      return;
    }

    try {
      const submission = parsePayload(reactionSubmissionSchema, payload);
      if (!membership) {
        throw new DomainError(
          'FORBIDDEN',
          'Action réservée aux joueurs de la salle',
        );
      }

      games.reaction.submit(
        membership.roomCode,
        membership.playerId,
        socket.id,
        submission,
      );
      ack({ ok: true, data: undefined });
    } catch (error) {
      reportError(ack, error);
    }
  });
};
