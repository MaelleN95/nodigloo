import { describe, expect, it } from 'vitest';
import { describeFinishedGame } from './results';

describe('describeFinishedGame', () => {
  it('compte les questions du quiz', () => {
    expect(describeFinishedGame({ game: 'quiz', rounds: 3 })).toBe(
      '3 questions, quelques surprises et un chouette moment partagé.',
    );
  });

  it('compte les manches du jeu de réaction', () => {
    expect(describeFinishedGame({ game: 'reaction', rounds: 7 })).toBe(
      '7 manches de réflexes, quelques faux départs et un chouette moment partagé.',
    );
  });

  it('reste au singulier pour une seule manche', () => {
    expect(describeFinishedGame({ game: 'reaction', rounds: 1 })).toBe(
      '1 manche de réflexes, quelques faux départs et un chouette moment partagé.',
    );
  });

  it('retombe sur le quiz par défaut quand le serveur ne donne pas les réglages', () => {
    expect(describeFinishedGame(undefined)).toBe(
      '5 questions, quelques surprises et un chouette moment partagé.',
    );
  });
});
