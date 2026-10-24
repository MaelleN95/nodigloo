import { describe, expect, it } from '@jest/globals';
import {
  REACTION_ANSWER_WINDOW_MS,
  REACTION_MAX_DELAY_MS,
  REACTION_MIN_DELAY_MS,
  REACTION_RESULTS_DURATION_MS,
  type ReactionRoundResults,
} from '@nodigloo/shared';
import { RoomService } from '../../room-service.js';
import {
  getReactionPoints,
  ReactionService,
  type ReactionEvent,
} from './reaction-service.js';

const makeGame = ({ rounds = 3, random = 0.5 } = {}) => {
  let now = 1000;
  const timers: Array<{
    callback: () => void;
    delayMs: number;
    cancelled: boolean;
  }> = [];
  const events: ReactionEvent[] = [];
  let playerNumber = 0;
  const roomService = new RoomService({
    now: () => now,
    generatePlayerId: () => `p${(playerNumber += 1)}`,
  });
  const { room, player: alice } = roomService.createRoom('Alice', 'socket-1');
  roomService.joinRoom(room.code, 'Bob', 'socket-2');
  roomService.joinRoom(room.code, 'Carl', 'socket-3');
  roomService.updateSettings(room.code, alice.id, 'socket-1', {
    game: 'reaction',
    rounds,
  });
  const reactionService = new ReactionService(
    roomService,
    (_roomCode, event) => events.push(event),
    {
      now: () => now,
      random: () => random,
      schedule: (callback, delayMs) => {
        const timer = { callback, delayMs, cancelled: false };
        timers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
    },
  );

  roomService.startGame(room.code, alice.id, 'socket-1');
  const firstRound = reactionService.startGame(room);

  // Avance jusqu'au prochain chronomètre encore actif et le déclenche
  const advanceTimer = () => {
    let timer = timers.shift();
    while (timer?.cancelled) {
      timer = timers.shift();
    }
    if (!timer) {
      throw new Error('Aucun chronomètre de manche');
    }
    now += timer.delayMs;
    timer.callback();
  };

  const lastFinishedRound = (): ReactionRoundResults => {
    const finished = events.filter(
      (event) => event.type === 'reaction:round:finished',
    );
    const last = finished[finished.length - 1];
    if (!last) {
      throw new Error('Aucune manche terminée');
    }
    return last.payload;
  };

  return {
    advanceTimer,
    events,
    firstRound,
    lastFinishedRound,
    reactionService,
    room,
    roomService,
    setNow: (value: number) => {
      now = value;
    },
    timers,
  };
};

describe('getReactionPoints', () => {
  it('donne tous les points jusqu’à 150 ms', () => {
    expect(getReactionPoints(100)).toBe(1000);
    expect(getReactionPoints(150)).toBe(1000);
  });

  it('fait baisser les points jusqu’à 0 à une seconde', () => {
    expect(getReactionPoints(300)).toBe(824);
    expect(getReactionPoints(575)).toBe(500);
    expect(getReactionPoints(1000)).toBe(0);
    expect(getReactionPoints(2500)).toBe(0);
  });
});

describe('ReactionService', () => {
  it('lance la première manche avec une heure de vert tirée entre 2 et 6 secondes', () => {
    expect(makeGame({ random: 0 }).firstRound).toEqual({
      round: 1,
      totalRounds: 3,
      serverNow: 1000,
      greenAt: 1000 + REACTION_MIN_DELAY_MS,
    });
    expect(makeGame({ random: 1 }).firstRound.greenAt).toBe(
      1000 + REACTION_MAX_DELAY_MS,
    );
  });

  it('refuse de relancer une partie déjà en cours', () => {
    const { reactionService, room } = makeGame();

    expect(() => reactionService.startGame(room)).toThrow(
      expect.objectContaining({ code: 'GAME_ALREADY_STARTED' }),
    );
  });

  it('note les réactions et clôt la manche dès que tout le monde a joué', () => {
    const { firstRound, lastFinishedRound, reactionService, room, setNow } =
      makeGame();
    setNow(firstRound.greenAt + 400);

    reactionService.submit(room.code, 'p1', 'socket-1', {
      round: 1, kind: 'reaction', reactionMs: 150,
    });
    reactionService.submit(room.code, 'p2', 'socket-2', {
      round: 1, kind: 'reaction', reactionMs: 574.6,
    });
    reactionService.submit(room.code, 'p3', 'socket-3', {
      round: 1, kind: 'false-start',
    });

    expect(lastFinishedRound()).toEqual({
      round: 1,
      results: [
        { playerId: 'p1', outcome: 'reaction', reactionMs: 150, points: 1000 },
        { playerId: 'p2', outcome: 'reaction', reactionMs: 575, points: 500 },
        { playerId: 'p3', outcome: 'false-start', reactionMs: null, points: 0 },
      ],
      scores: { p1: 1000, p2: 500, p3: 0 },
    });
    expect(reactionService.getCurrentRound(room.code)).toBeUndefined();
  });

  it('compte comme faux départ un temps sous 100 ms ou un appui reçu avant le vert', () => {
    const { firstRound, lastFinishedRound, reactionService, room, setNow } =
      makeGame();
    setNow(firstRound.greenAt - 50);
    reactionService.submit(room.code, 'p1', 'socket-1', {
      round: 1, kind: 'reaction', reactionMs: 200,
    });
    setNow(firstRound.greenAt + 300);
    reactionService.submit(room.code, 'p2', 'socket-2', {
      round: 1, kind: 'reaction', reactionMs: 99,
    });
    reactionService.submit(room.code, 'p3', 'socket-3', {
      round: 1, kind: 'reaction', reactionMs: 250,
    });

    expect(lastFinishedRound().results.map((result) => result.outcome)).toEqual([
      'false-start',
      'false-start',
      'reaction',
    ]);
  });

  it('refuse un second appui dans la même manche', () => {
    const { firstRound, reactionService, room, setNow } = makeGame();
    setNow(firstRound.greenAt + 300);
    reactionService.submit(room.code, 'p1', 'socket-1', {
      round: 1, kind: 'reaction', reactionMs: 250,
    });

    expect(() =>
      reactionService.submit(room.code, 'p1', 'socket-1', {
        round: 1, kind: 'reaction', reactionMs: 200,
      }),
    ).toThrow(expect.objectContaining({ code: 'ALREADY_ANSWERED' }));
  });

  it('refuse un appui venant d’un autre socket que celui du joueur', () => {
    const { reactionService, room } = makeGame();

    expect(() =>
      reactionService.submit(room.code, 'p1', 'socket-2', {
        round: 1, kind: 'false-start',
      }),
    ).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('refuse un appui pour une autre manche que la manche en cours', () => {
    const { reactionService, room } = makeGame();

    expect(() =>
      reactionService.submit(room.code, 'p1', 'socket-1', {
        round: 2, kind: 'false-start',
      }),
    ).toThrow(expect.objectContaining({ code: 'ANSWER_TOO_LATE' }));
  });

  it('clôt la manche à la fin du délai et marque les absents comme sans réponse', () => {
    const { advanceTimer, firstRound, lastFinishedRound, reactionService, room, setNow } =
      makeGame();
    setNow(firstRound.greenAt + 300);
    reactionService.submit(room.code, 'p1', 'socket-1', {
      round: 1, kind: 'reaction', reactionMs: 300,
    });
    setNow(1000);
    advanceTimer();

    expect(lastFinishedRound().results.map((result) => result.outcome)).toEqual([
      'reaction',
      'missed',
      'missed',
    ]);
    expect(() =>
      reactionService.submit(room.code, 'p2', 'socket-2', {
        round: 1, kind: 'reaction', reactionMs: 300,
      }),
    ).toThrow(expect.objectContaining({ code: 'ANSWER_TOO_LATE' }));
  });

  it('refuse un appui arrivé après le délai même si le chronomètre n’est pas encore passé', () => {
    const { events, firstRound, reactionService, room, setNow } = makeGame();
    setNow(firstRound.greenAt + REACTION_ANSWER_WINDOW_MS);

    expect(() =>
      reactionService.submit(room.code, 'p1', 'socket-1', {
        round: 1, kind: 'reaction', reactionMs: 300,
      }),
    ).toThrow(expect.objectContaining({ code: 'ANSWER_TOO_LATE' }));
    expect(events.map((event) => event.type)).toEqual(['reaction:round:finished']);
  });

  it('n’attend pas les joueurs déconnectés pour clore la manche', () => {
    const { events, firstRound, reactionService, room, roomService, setNow } =
      makeGame();
    roomService.markDisconnected(room.code, 'p3', 'socket-3');
    setNow(firstRound.greenAt + 300);
    reactionService.submit(room.code, 'p1', 'socket-1', {
      round: 1, kind: 'reaction', reactionMs: 300,
    });
    reactionService.submit(room.code, 'p2', 'socket-2', {
      round: 1, kind: 'reaction', reactionMs: 300,
    });

    expect(events.map((event) => event.type)).toEqual(['reaction:round:finished']);
  });

  it('renvoie la manche en cours avec l’heure actuelle du serveur', () => {
    const { firstRound, reactionService, room, setNow } = makeGame();
    setNow(2500);

    expect(reactionService.getCurrentRound(room.code)).toEqual({
      ...firstRound,
      serverNow: 2500,
    });
  });

  it('enchaîne les manches puis termine avec le classement', () => {
    const { advanceTimer, events, reactionService, room } = makeGame({ rounds: 2 });

    advanceTimer();
    advanceTimer();
    const secondRound = reactionService.getCurrentRound(room.code);
    expect(secondRound?.round).toBe(2);
    expect(events.map((event) => event.type)).toEqual([
      'reaction:round:finished',
      'reaction:round:started',
    ]);

    advanceTimer();
    advanceTimer();
    const finished = events[events.length - 1];
    expect(finished.type).toBe('game:finished');
    expect(room.status).toBe('results');
    expect(reactionService.getCurrentRound(room.code)).toBeUndefined();
  });

  it('laisse les résultats affichés quelques secondes avant la manche suivante', () => {
    const { advanceTimer, events, timers } = makeGame();
    advanceTimer();

    const pending = timers.filter((timer) => !timer.cancelled);
    expect(pending.map((timer) => timer.delayMs)).toEqual([
      REACTION_RESULTS_DURATION_MS,
    ]);
    expect(events.map((event) => event.type)).toEqual(['reaction:round:finished']);
  });
});
