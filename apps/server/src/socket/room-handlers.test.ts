import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AddressInfo } from 'node:net';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  Ack,
  CreateRoomPayload,
  JoinedRoom,
  QuestionReveal,
  QuestionStart,
  RankingEntry,
  ResumeSessionPayload,
  RoomPublic,
} from '@nodigloo/shared';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import { QUESTION_BANK } from '../domain/games/quiz/question-bank.js';
import { RoomService } from '../domain/room-service.js';
import { runRoomMaintenance } from './room-maintenance.js';

const config: Config = {
  port: 0,
  allowedOrigins: [],
  nodeEnv: 'test',
};

describe('room Socket.IO handlers', () => {
  const clients: ClientSocket[] = [];
  let app: ReturnType<typeof createApp>;
  let port: number;
  let now: number;
  let roomService: RoomService;
  let quizTimers: Array<{
    callback: () => void;
    delayMs: number;
    cancelled: boolean;
  }>;

  beforeEach(async () => {
    now = 1000;
    quizTimers = [];
    roomService = new RoomService({ now: () => now });
    app = createApp(config, roomService, {
      now: () => now,
      random: () => 0,
      schedule: (callback, delayMs) => {
        const timer = { callback, delayMs, cancelled: false };
        quizTimers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
    });
    await new Promise<void>((resolve, reject) => {
      app.httpServer.once('error', reject);
      app.httpServer.listen(0, '127.0.0.1', resolve);
    });
    port = (app.httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.disconnect();
    }
    await new Promise<void>((resolve) => app.io.close(() => resolve()));
  });

  const connectClient = async (): Promise<ClientSocket> => {
    const client = createSocketClient(`http://127.0.0.1:${port}`, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
      client.connect();
    });

    return client;
  };

  const requireSuccess = (result: Ack<JoinedRoom>): JoinedRoom => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.data;
  };

  const advanceQuizTimer = (): void => {
    const timer = quizTimers.shift();
    if (!timer) {
      throw new Error('Aucun chronomètre de quiz');
    }
    now += timer.delayMs;
    timer.callback();
  };

  it('crée une salle et ne renvoie le token qu’à son propriétaire', async () => {
    const client = await connectClient();
    const result = requireSuccess(
      await client.emitWithAck('room:create', { nickname: 'Alice' }),
    );

    expect(result.room.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(result.room.players).toHaveLength(1);
    expect(result.room.players[0]).toMatchObject({
      id: result.session.playerId,
      nickname: 'Alice',
      connected: true,
      score: 0,
    });
    expect(result.session.reconnectToken).toHaveLength(64);
    expect(JSON.stringify(result.room)).not.toContain(
      result.session.reconnectToken,
    );
  });

  it('fait rejoindre une salle et met à jour les joueurs déjà présents', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      host.once('room:updated', resolve);
    });

    const joined = requireSuccess(
      await guest.emitWithAck('room:join', {
        code: created.room.code,
        nickname: 'Bob',
      }),
    );
    const broadcast = await roomUpdated;

    expect(joined.room.players).toHaveLength(2);
    expect(joined.room.players.map((player) => player.nickname)).toEqual([
      'Alice',
      'Bob',
    ]);
    expect(broadcast).toEqual(joined.room);
    expect(joined.session.playerId).not.toBe(created.session.playerId);
  });

  it('renvoie une erreur métier quand la salle n’existe pas', async () => {
    const client = await connectClient();
    const result = await client.emitWithAck('room:join', {
      code: 'ZZZZZ',
      nickname: 'Alice',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ROOM_NOT_FOUND',
        message: 'Salle introuvable',
      },
    });
  });

  it('refuse un payload invalide sans déconnecter le socket', async () => {
    const client = await connectClient();
    const result = await client.emitWithAck('room:create', {
      nickname: 42,
    } as unknown as CreateRoomPayload);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(client.connected).toBe(true);
  });

  it('refuse les tentatives de jonction répétées depuis la même adresse', async () => {
    const client = await connectClient();
    let lastResult: Ack<JoinedRoom> | undefined;

    for (let attempt = 0; attempt < 31; attempt += 1) {
      lastResult = await client.emitWithAck('room:join', {
        code: 'ZZZZZ',
        nickname: 'Alice',
      });
    }

    expect(lastResult).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });
  });

  it('reprend une session et ferme l’ancienne connexion du joueur', async () => {
    const original = await connectClient();
    const observer = await connectClient();
    const created = requireSuccess(
      await original.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    await observer.emitWithAck('room:join', {
      code: created.room.code,
      nickname: 'Bob',
    });

    const resumedClient = await connectClient();
    const originalDisconnected = new Promise<void>((resolve) => {
      original.once('disconnect', () => resolve());
    });
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      observer.once('room:updated', resolve);
    });
    const resumed = requireSuccess(
      await resumedClient.emitWithAck('session:resume', {
        code: created.room.code,
        playerId: created.session.playerId,
        reconnectToken: created.session.reconnectToken,
      }),
    );

    await originalDisconnected;
    const broadcast = await roomUpdated;

    expect(resumed.session).toEqual(created.session);
    expect(resumed.room.players.find((player) => player.nickname === 'Alice'))
      .toMatchObject({ connected: true });
    expect(broadcast).toEqual(resumed.room);
    expect(original.connected).toBe(false);
  });

  it('refuse une session avec un token invalide', async () => {
    const original = await connectClient();
    const created = requireSuccess(
      await original.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const resumedClient = await connectClient();
    const result = await resumedClient.emitWithAck('session:resume', {
      code: created.room.code,
      playerId: created.session.playerId,
      reconnectToken: 'token-invalide',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session expirée ou invalide',
      },
    });
    expect(original.connected).toBe(true);
  });

  it('refuse un payload de reprise mal formé', async () => {
    const client = await connectClient();
    const result = await client.emitWithAck('session:resume', {
      code: 'ABCDE',
      playerId: 'p1',
      reconnectToken: 123,
    } as unknown as ResumeSessionPayload);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(client.connected).toBe(true);
  });

  it('retire les joueurs expirés et diffuse la salle mise à jour', async () => {
    const host = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const { player } = roomService.joinRoom(
      created.room.code,
      'Bob',
      'socket-hors-ligne',
    );
    roomService.markDisconnected(
      created.room.code,
      player.id,
      'socket-hors-ligne',
    );
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      host.once('room:updated', resolve);
    });

    now += 60_001;
    runRoomMaintenance(app.io, roomService);

    const updated = await roomUpdated;
    expect(updated.players.map((entry) => entry.nickname)).toEqual(['Alice']);
  });

  it('supprime une salle quand tous ses joueurs ont expiré', () => {
    const { room, player } = roomService.createRoom('Alice', 'socket-hors-ligne');
    roomService.markDisconnected(room.code, player.id, 'socket-hors-ligne');
    now += 60_001;

    runRoomMaintenance(app.io, roomService);

    expect(roomService.getRoom(room.code)).toBeUndefined();
  });

  it('permet à l’hôte de démarrer avec deux joueurs et diffuse le nouvel état', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    await guest.emitWithAck('room:join', {
      code: created.room.code,
      nickname: 'Bob',
    });
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      host.once('room:updated', resolve);
    });
    const questionStarted = new Promise<QuestionStart>((resolve) => {
      host.once('question:started', resolve);
    });

    const result = await host.emitWithAck('game:start');
    const updated = await roomUpdated;
    const question = await questionStarted;

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updated.status).toBe('playing');
    expect(question.questionNumber).toBe(1);
    expect(question.totalQuestions).toBe(5);
    expect(question.endsAt - question.serverNow).toBe(20_000);
    expect(question.question).not.toHaveProperty('correctChoice');
  });

  it('refuse le démarrage par un non-hôte', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    await guest.emitWithAck('room:join', {
      code: created.room.code,
      nickname: 'Bob',
    });

    const result = await guest.emitWithAck('game:start');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(roomService.getRoom(created.room.code)?.status).toBe('lobby');
  });

  it('refuse le démarrage avec un seul joueur connecté', async () => {
    const host = await connectClient();
    await host.emitWithAck('room:create', { nickname: 'Alice' });

    const result = await host.emitWithAck('game:start');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_PLAYERS' },
    });
  });

  it('renvoie la question en cours au joueur qui reprend pendant une partie', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const joined = requireSuccess(
      await guest.emitWithAck('room:join', {
        code: created.room.code,
        nickname: 'Bob',
      }),
    );
    const initialQuestion = new Promise<QuestionStart>((resolve) => {
      guest.once('question:started', resolve);
    });
    await host.emitWithAck('game:start');
    const currentQuestion = await initialQuestion;

    const resumedClient = await connectClient();
    const resumedQuestion = new Promise<QuestionStart>((resolve) => {
      resumedClient.once('question:started', resolve);
    });
    const resumed = requireSuccess(
      await resumedClient.emitWithAck('session:resume', {
        code: created.room.code,
        playerId: joined.session.playerId,
        reconnectToken: joined.session.reconnectToken,
      }),
    );
    const questionAfterResume = await resumedQuestion;

    expect(resumed.room.status).toBe('playing');
    expect(questionAfterResume).toEqual(currentQuestion);
  });

  it('accepte une réponse et refuse une seconde réponse à la même question', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const joined = requireSuccess(
      await guest.emitWithAck('room:join', {
        code: created.room.code,
        nickname: 'Bob',
      }),
    );
    const questionStarted = new Promise<QuestionStart>((resolve) => {
      guest.once('question:started', resolve);
    });
    await host.emitWithAck('game:start');
    const question = await questionStarted;
    const answer = { questionId: question.question.id, choice: 0 };

    const accepted = await guest.emitWithAck('quiz:answer:submit', answer);
    const duplicate = await guest.emitWithAck('quiz:answer:submit', answer);

    expect(accepted).toEqual({ ok: true, data: undefined });
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: 'ALREADY_ANSWERED' },
    });
    expect(
      roomService.getRoom(created.room.code)?.players.get(joined.session.playerId)
        ?.score,
    ).toBe(0);
  });

  it('termine une partie Socket.IO complète et calcule les scores côté serveur', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const joined = requireSuccess(
      await guest.emitWithAck('room:join', {
        code: created.room.code,
        nickname: 'Bob',
      }),
    );
    const firstQuestion = new Promise<QuestionStart>((resolve) => {
      guest.once('question:started', resolve);
    });
    const gameFinished = new Promise<{ ranking: RankingEntry[] }>((resolve) => {
      host.once('game:finished', resolve);
    });

    await host.emitWithAck('game:start');
    let currentQuestion = await firstQuestion;

    for (let index = 0; index < 5; index += 1) {
      const reveal = new Promise<QuestionReveal>((resolve) => {
        guest.once('question:revealed', resolve);
      });
      const correctChoice = QUESTION_BANK.find(
        (question) => question.id === currentQuestion.question.id,
      )?.correctChoice;
      if (correctChoice === undefined) {
        throw new Error('La bonne réponse devrait exister');
      }

      expect(
        await host.emitWithAck('quiz:answer:submit', {
          questionId: currentQuestion.question.id,
          choice: correctChoice,
        }),
      ).toEqual({ ok: true, data: undefined });
      expect(
        await guest.emitWithAck('quiz:answer:submit', {
          questionId: currentQuestion.question.id,
          choice: (correctChoice + 1) % currentQuestion.question.choices.length,
        }),
      ).toEqual({ ok: true, data: undefined });

      let nextQuestion: Promise<QuestionStart> | undefined;
      if (index < 4) {
        nextQuestion = new Promise<QuestionStart>((resolve) => {
          host.once('question:started', resolve);
        });
      }

      advanceQuizTimer();
      const revealed = await reveal;
      expect(revealed.questionId).toBe(currentQuestion.question.id);
      expect(revealed.scores[joined.session.playerId]).toBe(0);

      if (nextQuestion) {
        advanceQuizTimer();
        currentQuestion = await nextQuestion;
      } else {
        advanceQuizTimer();
      }
    }

    const finished = await gameFinished;

    expect(
      roomService.getRoom(created.room.code)?.players.get(created.session.playerId)
        ?.score,
    ).toBe(500);
    expect(finished.ranking.map(({ playerId, score, rank }) => ({
      playerId,
      score,
      rank,
    }))).toEqual([
      { playerId: created.session.playerId, score: 500, rank: 1 },
      { playerId: joined.session.playerId, score: 0, rank: 2 },
    ]);
    expect(roomService.getRoom(created.room.code)?.status).toBe('results');
  });
});
