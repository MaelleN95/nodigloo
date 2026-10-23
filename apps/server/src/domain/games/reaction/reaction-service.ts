import {
  REACTION_ANSWER_WINDOW_MS,
  REACTION_FULL_POINTS_MS,
  REACTION_MAX_DELAY_MS,
  REACTION_MAX_POINTS,
  REACTION_MIN_DELAY_MS,
  REACTION_MIN_TIME_MS,
  REACTION_RESULTS_DURATION_MS,
  REACTION_ZERO_POINTS_MS,
  type PlayerId,
  type RankingEntry,
  type ReactionResult,
  type ReactionRoundResults,
  type ReactionRoundStart,
  type ReactionSubmission,
} from '@nodigloo/shared';
import { DomainError } from '../../errors.js';
import { getRanking } from '../../ranking.js';
import type { Room } from '../../room.js';
import { RoomService } from '../../room-service.js';

export type ReactionEvent =
  | { type: 'reaction:round:started'; payload: ReactionRoundStart }
  | { type: 'reaction:round:finished'; payload: ReactionRoundResults }
  | { type: 'game:finished'; payload: { ranking: RankingEntry[] } };

export interface ReactionServiceDeps {
  now: () => number;
  random: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
}

type RecordedAnswer = Pick<ReactionResult, 'outcome' | 'reactionMs'>;

interface ActiveGame {
  round: number;
  totalRounds: number;
  answers: Map<PlayerId, RecordedAnswer>;
  // vide pendant l'affichage des résultats, entre deux manches
  currentRound?: ReactionRoundStart;
  cancelTimer: () => void;
}

const defaultDeps: ReactionServiceDeps = {
  now: () => Date.now(),
  random: () => Math.random(),
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

export const getReactionPoints = (reactionMs: number): number => {
  if (reactionMs <= REACTION_FULL_POINTS_MS) {
    return REACTION_MAX_POINTS;
  }
  if (reactionMs >= REACTION_ZERO_POINTS_MS) {
    return 0;
  }

  return Math.round(
    (REACTION_MAX_POINTS * (REACTION_ZERO_POINTS_MS - reactionMs)) /
      (REACTION_ZERO_POINTS_MS - REACTION_FULL_POINTS_MS),
  );
};

export class ReactionService {
  private readonly games = new Map<string, ActiveGame>();
  private readonly deps: ReactionServiceDeps;

  constructor(
    private readonly roomService: RoomService,
    private readonly emit: (roomCode: string, event: ReactionEvent) => void,
    deps: Partial<ReactionServiceDeps> = {},
  ) {
    this.deps = { ...defaultDeps, ...deps };
  }

  startGame(room: Room): ReactionRoundStart {
    if (room.status !== 'playing' || this.games.has(room.code)) {
      throw new DomainError('GAME_ALREADY_STARTED', 'La partie a déjà commencé');
    }

    const game: ActiveGame = {
      round: 1,
      totalRounds: room.settings.rounds,
      answers: new Map(),
      cancelTimer: () => undefined,
    };
    this.games.set(room.code, game);

    return this.startRound(room.code, game);
  }

  close(): void {
    for (const game of this.games.values()) {
      game.cancelTimer();
    }
    this.games.clear();
  }

  getCurrentRound(roomCode: string): ReactionRoundStart | undefined {
    const round = this.games.get(roomCode)?.currentRound;
    return round ? { ...round, serverNow: this.deps.now() } : undefined;
  }

  submit(
    roomCode: string,
    playerId: string,
    socketId: string,
    submission: ReactionSubmission,
  ): void {
    const room = this.roomService.getRoom(roomCode);
    const game = this.games.get(roomCode);
    const player = room?.players.get(playerId);
    const currentRound = game?.currentRound;

    if (!room || room.status !== 'playing' || !game || !currentRound) {
      throw new DomainError('ANSWER_TOO_LATE', 'La manche est terminée');
    }

    if (!player || player.socketId !== socketId) {
      throw new DomainError(
        'FORBIDDEN',
        'Cette connexion ne correspond pas au joueur',
      );
    }

    if (submission.round !== currentRound.round) {
      throw new DomainError('ANSWER_TOO_LATE', 'Cette manche est terminée');
    }

    const now = this.deps.now();
    if (now >= currentRound.greenAt + REACTION_ANSWER_WINDOW_MS) {
      this.finishRound(roomCode);
      throw new DomainError('ANSWER_TOO_LATE', 'Le délai de la manche est dépassé');
    }

    if (game.answers.has(playerId)) {
      throw new DomainError('ALREADY_ANSWERED', 'Tu as déjà joué cette manche');
    }

    // Un temps trop court, ou un appui reçu avant le vert, ne peut pas être une vraie réaction
    const isRealReaction =
      submission.kind === 'reaction' &&
      submission.reactionMs >= REACTION_MIN_TIME_MS &&
      now >= currentRound.greenAt;
    game.answers.set(
      playerId,
      isRealReaction
        ? { outcome: 'reaction', reactionMs: Math.round(submission.reactionMs) }
        : { outcome: 'false-start', reactionMs: null },
    );

    // Inutile d'attendre la fin du délai si tous les joueurs connectés ont joué
    const everyoneAnswered = [...room.players.values()]
      .filter((roomPlayer) => roomPlayer.socketId !== null)
      .every((roomPlayer) => game.answers.has(roomPlayer.id));
    if (everyoneAnswered) {
      this.finishRound(roomCode);
    }
  }

  private startRound(roomCode: string, game: ActiveGame): ReactionRoundStart {
    const serverNow = this.deps.now();
    const delayMs =
      REACTION_MIN_DELAY_MS +
      Math.round(
        this.deps.random() * (REACTION_MAX_DELAY_MS - REACTION_MIN_DELAY_MS),
      );
    const start: ReactionRoundStart = {
      round: game.round,
      totalRounds: game.totalRounds,
      serverNow,
      greenAt: serverNow + delayMs,
    };

    game.currentRound = start;
    game.answers.clear();
    game.cancelTimer = this.deps.schedule(
      () => this.finishRound(roomCode),
      delayMs + REACTION_ANSWER_WINDOW_MS,
    );

    return start;
  }

  private finishRound(roomCode: string): void {
    const game = this.games.get(roomCode);
    const room = this.roomService.getRoom(roomCode);
    if (!game || !room || !game.currentRound) {
      this.games.delete(roomCode);
      return;
    }

    game.cancelTimer();
    const results: ReactionResult[] = [...room.players.values()].map(
      (player) => {
        const answer: RecordedAnswer = game.answers.get(player.id) ?? {
          outcome: 'missed',
          reactionMs: null,
        };
        const points =
          answer.outcome === 'reaction' && answer.reactionMs !== null
            ? getReactionPoints(answer.reactionMs)
            : 0;
        player.score += points;
        return { playerId: player.id, ...answer, points };
      },
    );

    this.emit(roomCode, {
      type: 'reaction:round:finished',
      payload: {
        round: game.round,
        results,
        scores: Object.fromEntries(
          [...room.players.values()].map((player) => [player.id, player.score]),
        ),
      },
    });

    game.currentRound = undefined;
    game.cancelTimer = this.deps.schedule(
      () => this.advanceAfterResults(roomCode),
      REACTION_RESULTS_DURATION_MS,
    );
  }

  private advanceAfterResults(roomCode: string): void {
    const game = this.games.get(roomCode);
    const room = this.roomService.getRoom(roomCode);
    if (!game || !room) {
      this.games.delete(roomCode);
      return;
    }

    game.cancelTimer = () => undefined;
    if (game.round >= game.totalRounds) {
      room.status = 'results';
      this.games.delete(roomCode);
      this.emit(roomCode, {
        type: 'game:finished',
        payload: { ranking: getRanking(room) },
      });
      return;
    }

    game.round += 1;
    const nextRound = this.startRound(roomCode, game);
    this.emit(roomCode, { type: 'reaction:round:started', payload: nextRound });
  }
}
