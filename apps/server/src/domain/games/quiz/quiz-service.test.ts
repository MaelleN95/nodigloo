import { describe, expect, it } from '@jest/globals';
import {
  QUESTIONS_PER_GAME,
  QUESTION_DURATION_MS,
} from '@nodigloo/shared';
import { QuizService, type QuizEvent } from './quiz-service.js';
import { QUESTION_BANK } from './question-bank.js';
import { RoomService } from '../../room-service.js';

const makeGame = () => {
  let now = 1000;
  const timers: Array<{
    callback: () => void;
    delayMs: number;
    cancelled: boolean;
  }> = [];
  const events: Array<{ roomCode: string; event: QuizEvent }> = [];
  let playerNumber = 0;
  const roomService = new RoomService({
    now: () => now,
    generatePlayerId: () => `p${(playerNumber += 1)}`,
  });
  const { room, player: alice } = roomService.createRoom('Alice', 'socket-1');
  roomService.joinRoom(room.code, 'Bob', 'socket-2');
  roomService.joinRoom(room.code, 'Carl', 'socket-3');
  const quizService = new QuizService(
    roomService,
    (roomCode, event) => events.push({ roomCode, event }),
    {
      now: () => now,
      random: () => 0,
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

  return {
    advanceToNextQuestion: () => {
      const timer = timers.shift();
      if (!timer) {
        throw new Error('Aucun chronomètre de question');
      }
      now += timer.delayMs;
      timer.callback();
    },
    events,
    quizService,
    room,
    setNow: (value: number) => {
      now = value;
    },
    timers,
  };
};

describe('QUESTION_BANK', () => {
  it('contient 20 questions distinctes avec quatre choix et une réponse valide', () => {
    expect(QUESTION_BANK).toHaveLength(20);
    expect(new Set(QUESTION_BANK.map((question) => question.id)).size).toBe(20);

    for (const question of QUESTION_BANK) {
      expect(question.choices).toHaveLength(4);
      expect(question.correctChoice).toBeGreaterThanOrEqual(0);
      expect(question.correctChoice).toBeLessThan(question.choices.length);
    }
  });
});

describe('QuizService', () => {
  it('sélectionne cinq questions différentes et ne révèle pas la réponse au départ', () => {
    const fixture = makeGame();
    const firstQuestion = fixture.quizService.startGame(fixture.room);

    expect(firstQuestion.questionNumber).toBe(1);
    expect(firstQuestion.totalQuestions).toBe(QUESTIONS_PER_GAME);
    expect(firstQuestion.endsAt - firstQuestion.serverNow).toBe(
      QUESTION_DURATION_MS,
    );
    expect(firstQuestion.question).not.toHaveProperty('correctChoice');

    const selectedIds = [firstQuestion.question.id];
    for (let index = 1; index < QUESTIONS_PER_GAME; index += 1) {
      fixture.advanceToNextQuestion();
      const started = fixture.events.filter(
        (entry) => entry.event.type === 'question:started',
      );
      const nextEvent = started[started.length - 1];
      if (nextEvent?.event.type === 'question:started') {
        selectedIds.push(nextEvent.event.payload.question.id);
      }
    }

    expect(new Set(selectedIds).size).toBe(QUESTIONS_PER_GAME);
  });

  it('révèle les cinq réponses au terme de leur durée puis termine la partie', () => {
    const fixture = makeGame();
    fixture.room.players.get('p1')!.score = 100;
    fixture.room.players.get('p2')!.score = 100;
    fixture.room.players.get('p3')!.score = 50;
    fixture.quizService.startGame(fixture.room);

    for (let question = 0; question < QUESTIONS_PER_GAME; question += 1) {
      fixture.advanceToNextQuestion();
    }

    const reveals = fixture.events.filter(
      (entry) => entry.event.type === 'question:revealed',
    );
    const finished = fixture.events.find(
      (entry) => entry.event.type === 'game:finished',
    );

    expect(reveals).toHaveLength(QUESTIONS_PER_GAME);
    expect(finished?.event.type).toBe('game:finished');
    if (finished?.event.type === 'game:finished') {
      expect(finished.event.payload.ranking.map((entry) => entry.rank)).toEqual([
        1, 1, 3,
      ]);
    }
    expect(fixture.room.status).toBe('results');
  });

  it('annule les chronomètres quand le service s’arrête', () => {
    const fixture = makeGame();
    fixture.quizService.startGame(fixture.room);

    fixture.quizService.close();

    expect(fixture.timers[0].cancelled).toBe(true);
  });

  it('enregistre une réponse et n’ajoute les points qu’à la révélation', () => {
    const fixture = makeGame();
    fixture.quizService.startGame(fixture.room);
    const question = fixture.quizService.getCurrentQuestion(fixture.room.code);
    if (!question) {
      throw new Error('La question devrait être active');
    }
    const correctChoice = QUESTION_BANK.find(
      (entry) => entry.id === question.question.id,
    )?.correctChoice;
    if (correctChoice === undefined) {
      throw new Error('La bonne réponse devrait exister');
    }

    fixture.quizService.submitAnswer(
      fixture.room.code,
      'p1',
      'socket-1',
      question.question.id,
      correctChoice,
    );
    fixture.quizService.submitAnswer(
      fixture.room.code,
      'p2',
      'socket-2',
      question.question.id,
      (correctChoice + 1) % question.question.choices.length,
    );
    expect(fixture.room.players.get('p1')?.score).toBe(0);
    expect(fixture.room.players.get('p2')?.score).toBe(0);

    fixture.advanceToNextQuestion();

    expect(fixture.room.players.get('p1')?.score).toBe(100);
    expect(fixture.room.players.get('p2')?.score).toBe(0);
  });

  it('refuse une deuxième réponse du même joueur à la même question', () => {
    const fixture = makeGame();
    fixture.quizService.startGame(fixture.room);
    const question = fixture.quizService.getCurrentQuestion(fixture.room.code);
    if (!question) {
      throw new Error('La question devrait être active');
    }

    fixture.quizService.submitAnswer(
      fixture.room.code,
      'p1',
      'socket-1',
      question.question.id,
      0,
    );

    expect(() =>
      fixture.quizService.submitAnswer(
        fixture.room.code,
        'p1',
        'socket-1',
        question.question.id,
        1,
      ),
    ).toThrow(expect.objectContaining({ code: 'ALREADY_ANSWERED' }));
  });

  it('refuse une réponse faite depuis un ancien socket', () => {
    const fixture = makeGame();
    fixture.quizService.startGame(fixture.room);
    const question = fixture.quizService.getCurrentQuestion(fixture.room.code);
    if (!question) {
      throw new Error('La question devrait être active');
    }

    expect(() =>
      fixture.quizService.submitAnswer(
        fixture.room.code,
        'p1',
        'ancien-socket',
        question.question.id,
        0,
      ),
    ).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('révèle la question expirée avant de refuser une réponse tardive', () => {
    const fixture = makeGame();
    fixture.quizService.startGame(fixture.room);
    const question = fixture.quizService.getCurrentQuestion(fixture.room.code);
    if (!question) {
      throw new Error('La question devrait être active');
    }

    fixture.setNow(question.endsAt);

    expect(() =>
      fixture.quizService.submitAnswer(
        fixture.room.code,
        'p1',
        'socket-1',
        question.question.id,
        0,
      ),
    ).toThrow(expect.objectContaining({ code: 'ANSWER_TOO_LATE' }));

    expect(fixture.timers[0].cancelled).toBe(true);
    expect(fixture.quizService.getCurrentQuestion(fixture.room.code)?.questionNumber)
      .toBe(2);
  });

  it('refuse un identifiant qui ne correspond pas à la question active', () => {
    const fixture = makeGame();
    fixture.quizService.startGame(fixture.room);
    const question = fixture.quizService.getCurrentQuestion(fixture.room.code);
    if (!question) {
      throw new Error('La question devrait être active');
    }

    expect(() =>
      fixture.quizService.submitAnswer(
        fixture.room.code,
        'p1',
        'socket-1',
        'ancienne-question',
        0,
      ),
    ).toThrow(expect.objectContaining({ code: 'ANSWER_TOO_LATE' }));
  });
});
