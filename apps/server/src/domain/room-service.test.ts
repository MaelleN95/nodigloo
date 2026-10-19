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

describe('RoomService.joinRoom', () => {
  it('ajoute le joueur à la salle avec son propre id, token et socket', () => {
    const service = makeService();
    const { room } = service.createRoom('Alice', 'socket-1');

    const { player } = service.joinRoom('AAAAA', 'Bob', 'socket-2');

    expect(player.id).toBe('p2');
    expect(player.reconnectToken).toBe('token-2');
    expect(player.socketId).toBe('socket-2');
    expect(room.players.size).toBe(2);
    expect(room.players.get('p2')).toBe(player);
  });

  it('ne change pas l\'hôte quand quelqu\'un rejoint', () => {
    const service = makeService();
    const { room, player: host } = service.createRoom('Alice', 'socket-1');

    service.joinRoom('AAAAA', 'Bob', 'socket-2');

    expect(room.hostId).toBe(host.id);
  });

  it('accepte un code en minuscules avec des espaces', () => {
    const service = makeService();
    service.createRoom('Alice', 'socket-1');

    const { room } = service.joinRoom(' aaaaa ', 'Bob', 'socket-2');

    expect(room.code).toBe('AAAAA');
  });

  it('refuse un code inconnu', () => {
    const service = makeService();

    expect(() => service.joinRoom('XXXXX', 'Bob', 'socket-2')).toThrow(
      expect.objectContaining({ code: 'ROOM_NOT_FOUND' }),
    );
  });

  it('refuse un pseudonyme invalide', () => {
    const service = makeService();
    service.createRoom('Alice', 'socket-1');

    expect(() => service.joinRoom('AAAAA', 'B', 'socket-2')).toThrow(
      expect.objectContaining({ code: 'INVALID_PAYLOAD' }),
    );
  });

  it('refuse un pseudonyme déjà pris, sans tenir compte de la casse', () => {
    const service = makeService();
    service.createRoom('Alice', 'socket-1');

    expect(() => service.joinRoom('AAAAA', ' ALICE ', 'socket-2')).toThrow(
      expect.objectContaining({ code: 'NICKNAME_TAKEN' }),
    );
  });

  it('accepte le même pseudonyme dans une autre salle', () => {
    const service = makeService();
    service.createRoom('Alice', 'socket-1');
    service.createRoom('Carl', 'socket-2');

    const { player } = service.joinRoom('BBBBB', 'Alice', 'socket-3');

    expect(player.nickname).toBe('Alice');
  });

  it('accepte 8 joueurs et refuse le neuvième', () => {
    const service = makeService();
    const { room } = service.createRoom('Joueur1', 'socket-1');

    for (let i = 2; i <= 8; i += 1) {
      service.joinRoom('AAAAA', `Joueur${i}`, `socket-${i}`);
    }
    expect(room.players.size).toBe(8);

    expect(() => service.joinRoom('AAAAA', 'Joueur9', 'socket-9')).toThrow(
      expect.objectContaining({ code: 'ROOM_FULL' }),
    );
    expect(room.players.size).toBe(8);
  });

  it('refuse de rejoindre une partie en cours ou terminée', () => {
    const service = makeService();
    const { room } = service.createRoom('Alice', 'socket-1');

    room.status = 'playing';
    expect(() => service.joinRoom('AAAAA', 'Bob', 'socket-2')).toThrow(
      expect.objectContaining({ code: 'GAME_ALREADY_STARTED' }),
    );

    room.status = 'results';
    expect(() => service.joinRoom('AAAAA', 'Bob', 'socket-2')).toThrow(
      expect.objectContaining({ code: 'GAME_ALREADY_STARTED' }),
    );
    expect(room.players.size).toBe(1);
  });

  it('remet à zéro le marqueur d\'abandon de la salle', () => {
    const service = makeService();
    const { room } = service.createRoom('Alice', 'socket-1');
    room.abandonedAt = 1234;

    service.joinRoom('AAAAA', 'Bob', 'socket-2');

    expect(room.abandonedAt).toBeNull();
  });
});
