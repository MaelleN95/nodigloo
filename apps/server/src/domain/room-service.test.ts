import { describe, expect, it } from '@jest/globals';
import { DomainError } from './errors.js';
import { RoomService } from './room-service.js';

// Des générateurs prévisibles : "p1", "p2"... et "token-1", "token-2"...
const makeService = () => {
  let playerCount = 0;
  let tokenCount = 0;
  const codes = ['AAAAA', 'BBBBB', 'CCCCC'];

  return new RoomService({
    now: () => 5000,
    generatePlayerId: () => `p${(playerCount += 1)}`,
    generateReconnectToken: () => `token-${(tokenCount += 1)}`,
    generateCode: () => codes.shift() ?? 'ZZZZZ',
  });
};

describe('RoomService.createRoom', () => {
  it('crée une salle en lobby avec le créateur comme hôte', () => {
    const service = makeService();

    const { room, player } = service.createRoom('Alice', 'socket-1');

    expect(room.code).toBe('AAAAA');
    expect(room.status).toBe('lobby');
    expect(room.hostId).toBe(player.id);
    expect(room.players.size).toBe(1);
    expect(room.createdAt).toBe(5000);
    expect(room.abandonedAt).toBeNull();
  });

  it('donne au joueur une identité distincte du socket, un token et un score à 0', () => {
    const service = makeService();

    const { player } = service.createRoom('Alice', 'socket-1');

    expect(player.id).toBe('p1');
    expect(player.id).not.toBe(player.socketId);
    expect(player.socketId).toBe('socket-1');
    expect(player.reconnectToken).toBe('token-1');
    expect(player.score).toBe(0);
    expect(player.joinedAt).toBe(5000);
    expect(player.disconnectedAt).toBeNull();
  });

  it('nettoie le pseudonyme avant de le stocker', () => {
    const service = makeService();

    const { player } = service.createRoom('  Jo    Ann ', 'socket-1');

    expect(player.nickname).toBe('Jo Ann');
  });

  it('retrouve la salle avec son code', () => {
    const service = makeService();

    const { room } = service.createRoom('Alice', 'socket-1');

    expect(service.getRoom('AAAAA')).toBe(room);
    expect(service.getRoom('XXXXX')).toBeUndefined();
  });

  it('refuse un pseudonyme invalide sans créer de salle', () => {
    const service = makeService();

    expect(() => service.createRoom('A', 'socket-1')).toThrow(DomainError);
    expect(() => service.createRoom('   ', 'socket-1')).toThrow(
      'Pseudonyme invalide',
    );
    expect(service.getRoom('AAAAA')).toBeUndefined();
  });

  it('donne un code différent à chaque salle', () => {
    const service = makeService();

    const first = service.createRoom('Alice', 'socket-1');
    const second = service.createRoom('Bob', 'socket-2');

    expect(first.room.code).toBe('AAAAA');
    expect(second.room.code).toBe('BBBBB');
  });

  it('évite un code déjà pris', () => {
    const codes = ['AAAAA', 'AAAAA', 'BBBBB'];
    const service = new RoomService({ generateCode: () => codes.shift() ?? 'ZZZZZ' });

    service.createRoom('Alice', 'socket-1');
    const second = service.createRoom('Bob', 'socket-2');

    expect(second.room.code).toBe('BBBBB');
  });
});
