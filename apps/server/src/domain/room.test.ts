import { describe, expect, it } from '@jest/globals';
import { toPlayerPublic, toRoomPublic, type Player, type Room } from './room.js';

const makePlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  nickname: 'Alice',
  reconnectToken: 'secret-token',
  socketId: 'socket-1',
  score: 0,
  joinedAt: 1000,
  disconnectedAt: null,
  ...overrides,
});

const makeRoom = (players: Player[]): Room => ({
  code: 'ABC23',
  status: 'lobby',
  hostId: players[0].id,
  players: new Map(players.map((player) => [player.id, player])),
  createdAt: 1000,
  abandonedAt: null,
});

describe('toPlayerPublic', () => {
  it('expose l\'id, le pseudo, le score et l\'état de connexion', () => {
    expect(toPlayerPublic(makePlayer({ score: 200 }))).toEqual({
      id: 'p1',
      nickname: 'Alice',
      connected: true,
      score: 200,
    });
  });

  it('marque le joueur comme déconnecté quand il n\'a plus de socket', () => {
    expect(toPlayerPublic(makePlayer({ socketId: null })).connected).toBe(false);
  });

  it('ne laisse fuiter aucune donnée privée', () => {
    const json = JSON.stringify(toPlayerPublic(makePlayer()));

    expect(json).not.toContain('secret-token');
    expect(json).not.toContain('socket-1');
    expect(json).not.toContain('reconnectToken');
  });
});

describe('toRoomPublic', () => {
  it('reprend le code, l\'état, l\'hôte et la liste des joueurs dans l\'ordre d\'arrivée', () => {
    const room = makeRoom([
      makePlayer({ id: 'p1', nickname: 'Alice' }),
      makePlayer({ id: 'p2', nickname: 'Bob' }),
    ]);

    const publicRoom = toRoomPublic(room);

    expect(publicRoom.code).toBe('ABC23');
    expect(publicRoom.status).toBe('lobby');
    expect(publicRoom.hostId).toBe('p1');
    expect(publicRoom.players.map((player) => player.nickname)).toEqual([
      'Alice',
      'Bob',
    ]);
  });

  it('ne laisse fuiter aucun token de reconnexion', () => {
    const room = makeRoom([
      makePlayer({ id: 'p1', reconnectToken: 'token-a' }),
      makePlayer({ id: 'p2', reconnectToken: 'token-b' }),
    ]);

    const json = JSON.stringify(toRoomPublic(room));

    expect(json).not.toContain('token-a');
    expect(json).not.toContain('token-b');
    expect(json).not.toContain('reconnectToken');
  });
});
