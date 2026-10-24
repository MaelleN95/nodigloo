import { describe, expect, it } from '@jest/globals';
import { getRanking } from './ranking.js';
import type { Player, Room } from './room.js';

const makeRoom = (players: Array<Pick<Player, 'id' | 'score' | 'joinedAt'>>): Room => ({
  code: 'ABCDE',
  status: 'results',
  hostId: players[0].id,
  settings: { game: 'quiz', rounds: 5 },
  createdAt: 0,
  players: new Map(
    players.map((player) => [
      player.id,
      {
        ...player,
        nickname: `Joueur ${player.id}`,
        reconnectToken: 'token',
        socketId: null,
        disconnectedAt: null,
      },
    ]),
  ),
});

describe('getRanking', () => {
  it('classe du meilleur score au plus faible', () => {
    const ranking = getRanking(makeRoom([
      { id: 'p1', score: 100, joinedAt: 1 },
      { id: 'p2', score: 300, joinedAt: 2 },
      { id: 'p3', score: 200, joinedAt: 3 },
    ]));

    expect(ranking.map((entry) => [entry.playerId, entry.rank])).toEqual([
      ['p2', 1],
      ['p3', 2],
      ['p1', 3],
    ]);
  });

  it('met les ex æquo au même rang, dans l’ordre d’arrivée, puis saute un rang', () => {
    const ranking = getRanking(makeRoom([
      { id: 'p1', score: 100, joinedAt: 1 },
      { id: 'p2', score: 200, joinedAt: 3 },
      { id: 'p3', score: 200, joinedAt: 2 },
    ]));

    expect(ranking.map((entry) => [entry.playerId, entry.rank])).toEqual([
      ['p3', 1],
      ['p2', 1],
      ['p1', 3],
    ]);
  });
});
