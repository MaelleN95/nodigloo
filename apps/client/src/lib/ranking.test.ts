import { describe, expect, it } from 'vitest';
import type { RoomPublic } from '@nodigloo/shared';
import { getFallbackRanking } from './ranking';

const roomWithScores = (scores: Record<string, number>): RoomPublic => ({
  code: 'ABCDEF',
  hostId: 'p1',
  status: 'results',
  settings: { game: 'quiz', rounds: 5 },
  players: Object.entries(scores).map(([id, score]) => ({
    id,
    nickname: `Joueur ${id}`,
    score,
    connected: true,
  })),
});

describe('getFallbackRanking', () => {
  it('classe les joueurs du meilleur score au plus faible', () => {
    const ranking = getFallbackRanking(roomWithScores({ p1: 100, p2: 300, p3: 200 }));

    expect(ranking.map((entry) => entry.playerId)).toEqual(['p2', 'p3', 'p1']);
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('donne le même rang aux ex æquo puis saute le rang suivant', () => {
    const ranking = getFallbackRanking(roomWithScores({ p1: 200, p2: 200, p3: 100 }));

    expect(ranking.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  it('ne modifie pas la liste des joueurs de la salle', () => {
    const room = roomWithScores({ p1: 100, p2: 300 });

    getFallbackRanking(room);

    expect(room.players.map((player) => player.id)).toEqual(['p1', 'p2']);
  });
});
