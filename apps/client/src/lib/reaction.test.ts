import { describe, expect, it } from 'vitest';
import type { ReactionResult } from '@nodigloo/shared';
import { formatReactionResult, sortReactionResults } from './reaction';

const reaction = (playerId: string, reactionMs: number): ReactionResult => ({
  playerId,
  outcome: 'reaction',
  reactionMs,
  points: 0,
});

const without = (
  playerId: string,
  outcome: 'false-start' | 'missed',
): ReactionResult => ({ playerId, outcome, reactionMs: null, points: 0 });

describe('formatReactionResult', () => {
  it('affiche le temps en millisecondes', () => {
    expect(formatReactionResult(reaction('p1', 231))).toBe('231 ms');
  });

  it('nomme le faux départ et l’absence de réponse', () => {
    expect(formatReactionResult(without('p1', 'false-start'))).toBe('Faux départ');
    expect(formatReactionResult(without('p1', 'missed'))).toBe('Pas de réponse');
  });
});

describe('sortReactionResults', () => {
  it('met les plus rapides devant, puis les faux départs, puis les absents', () => {
    const sorted = sortReactionResults([
      without('absent', 'missed'),
      reaction('lent', 480),
      without('presse', 'false-start'),
      reaction('rapide', 190),
    ]);

    expect(sorted.map((result) => result.playerId)).toEqual([
      'rapide',
      'lent',
      'presse',
      'absent',
    ]);
  });

  it('ne modifie pas la liste reçue', () => {
    const results = [reaction('lent', 480), reaction('rapide', 190)];

    sortReactionResults(results);

    expect(results.map((result) => result.playerId)).toEqual(['lent', 'rapide']);
  });
});
