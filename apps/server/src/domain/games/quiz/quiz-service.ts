import {
  type ChoiceIndex,
  POINTS_PER_CORRECT_ANSWER,
  QUESTION_DURATION_MS,
  REVEAL_DURATION_MS,
  type QuestionReveal,
  type QuestionStart,
  type RankingEntry,
} from '@nodigloo/shared';
import { DomainError } from '../../errors.js';
import type { Room } from '../../room.js';
import { getRanking } from '../../ranking.js';
import { QUESTION_BANK, type QuizQuestion } from './question-bank.js';
import { RoomService } from '../../room-service.js';

export type QuizEvent =
  | { type: 'question:started'; payload: QuestionStart }
  | { type: 'question:revealed'; payload: QuestionReveal }
  | { type: 'game:finished'; payload: { ranking: RankingEntry[] } };

export interface QuizServiceDeps {
  now: () => number;
  random: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
}

interface ActiveGame {
  questions: QuizQuestion[];
  questionIndex: number;
  answers: Map<string, number>;
  currentQuestion?: QuestionStart;
  cancelTimer: () => void;
}

const defaultDeps: QuizServiceDeps = {
  now: () => Date.now(),
  random: () => Math.random(),
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

const selectQuestions = (
  bank: QuizQuestion[],
  count: number,
  random: () => number,
): QuizQuestion[] => {
  const shuffled = [...bank];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled.slice(0, count);
};

export class QuizService {
  private readonly games = new Map<string, ActiveGame>();
  private readonly deps: QuizServiceDeps;

  constructor(
    private readonly roomService: RoomService,
    private readonly emit: (roomCode: string, event: QuizEvent) => void,
    deps: Partial<QuizServiceDeps> = {},
  ) {
    this.deps = { ...defaultDeps, ...deps };
  }

  startGame(room: Room): QuestionStart {
    if (room.status !== 'playing' || this.games.has(room.code)) {
      throw new DomainError('GAME_ALREADY_STARTED', 'La partie a déjà commencé');
    }

    const game: ActiveGame = {
      questions: selectQuestions(
        QUESTION_BANK,
        room.settings.rounds,
        this.deps.random,
      ),
      questionIndex: 0,
      answers: new Map(),
      cancelTimer: () => undefined,
    };
    this.games.set(room.code, game);

    return this.startQuestion(room.code, game);
  }

  close(): void {
    for (const game of this.games.values()) {
      game.cancelTimer();
    }
    this.games.clear();
  }

  getCurrentQuestion(roomCode: string): QuestionStart | undefined {
    const question = this.games.get(roomCode)?.currentQuestion;
    return question
      ? { ...question, serverNow: this.deps.now() }
      : undefined;
  }

  submitAnswer(
    roomCode: string,
    playerId: string,
    socketId: string,
    questionId: string,
    choice: ChoiceIndex,
  ): void {
    const room = this.roomService.getRoom(roomCode);
    const game = this.games.get(roomCode);
    const player = room?.players.get(playerId);
    const currentQuestion = game?.currentQuestion;

    if (!room || room.status !== 'playing' || !game || !currentQuestion) {
      throw new DomainError(
        'ANSWER_TOO_LATE',
        'La question n’accepte plus de réponse',
      );
    }

    if (!player || player.socketId !== socketId) {
      throw new DomainError(
        'FORBIDDEN',
        'Cette connexion ne correspond pas au joueur',
      );
    }

    if (this.deps.now() >= currentQuestion.endsAt) {
      this.revealQuestion(roomCode);
      throw new DomainError('ANSWER_TOO_LATE', 'Le délai de réponse est dépassé');
    }

    if (currentQuestion.question.id !== questionId) {
      throw new DomainError(
        'ANSWER_TOO_LATE',
        'Cette question n’accepte plus de réponse',
      );
    }

    if (game.answers.has(playerId)) {
      throw new DomainError(
        'ALREADY_ANSWERED',
        'Tu as déjà répondu à cette question',
      );
    }

    game.answers.set(playerId, choice);
  }

  private startQuestion(roomCode: string, game: ActiveGame): QuestionStart {
    const question = game.questions[game.questionIndex];
    const serverNow = this.deps.now();
    const start: QuestionStart = {
      question: {
        id: question.id,
        text: question.text,
        choices: [...question.choices],
      },
      questionNumber: game.questionIndex + 1,
      totalQuestions: game.questions.length,
      serverNow,
      endsAt: serverNow + QUESTION_DURATION_MS,
    };

    game.currentQuestion = start;
    game.cancelTimer = this.deps.schedule(
      () => this.revealQuestion(roomCode),
      QUESTION_DURATION_MS,
    );

    return start;
  }

  private revealQuestion(roomCode: string): void {
    const game = this.games.get(roomCode);
    const room = this.roomService.getRoom(roomCode);
    if (!game || !room || !game.currentQuestion) {
      this.games.delete(roomCode);
      return;
    }

    game.cancelTimer();
    game.cancelTimer = () => undefined;
    const question = game.questions[game.questionIndex];
    for (const [playerId, choice] of game.answers) {
      if (choice === question.correctChoice) {
        const player = room.players.get(playerId);
        if (player) {
          player.score += POINTS_PER_CORRECT_ANSWER;
        }
      }
    }

    const scores = Object.fromEntries(
      [...room.players.values()].map((player) => [player.id, player.score]),
    );
    this.emit(roomCode, {
      type: 'question:revealed',
      payload: {
        questionId: question.id,
        correctChoice: question.correctChoice,
        scores,
      },
    });

    game.currentQuestion = undefined;
    game.answers.clear();
    game.cancelTimer = this.deps.schedule(
      () => this.advanceAfterReveal(roomCode),
      REVEAL_DURATION_MS,
    );
  }

  private advanceAfterReveal(roomCode: string): void {
    const game = this.games.get(roomCode);
    const room = this.roomService.getRoom(roomCode);
    if (!game || !room) {
      this.games.delete(roomCode);
      return;
    }

    game.cancelTimer = () => undefined;
    if (game.questionIndex === game.questions.length - 1) {
      room.status = 'results';
      this.games.delete(roomCode);
      this.emit(roomCode, {
        type: 'game:finished',
        payload: { ranking: getRanking(room) },
      });
      return;
    }

    game.questionIndex += 1;
    const nextQuestion = this.startQuestion(roomCode, game);
    this.emit(roomCode, { type: 'question:started', payload: nextQuestion });
  }
}
