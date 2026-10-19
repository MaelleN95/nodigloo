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

describe('RoomService.markDisconnected', () => {
  it('garde la place du joueur mais le marque comme déconnecté', () => {
    const service = makeService();
    const { room } = service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');

    service.markDisconnected('AAAAA', bob.id, 'socket-2');

    expect(room.players.has(bob.id)).toBe(true);
    expect(bob.socketId).toBeNull();
    expect(bob.disconnectedAt).toBe(5000);
    expect(room.abandonedAt).toBeNull();
  });

  it('ne change pas l\'hôte quand il se déconnecte', () => {
    const service = makeService();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    service.joinRoom('AAAAA', 'Bob', 'socket-2');

    service.markDisconnected('AAAAA', alice.id, 'socket-1');

    expect(room.hostId).toBe(alice.id);
  });

  it('marque la salle comme abandonnée quand le dernier joueur connecté part', () => {
    const service = makeService();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');

    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    expect(room.abandonedAt).toBeNull();

    service.markDisconnected('AAAAA', bob.id, 'socket-2');
    expect(room.abandonedAt).toBe(5000);
  });

  it('ignore une déconnexion venant d\'un ancien socket', () => {
    const service = makeService();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');

    service.markDisconnected('AAAAA', alice.id, 'vieux-socket');

    expect(alice.socketId).toBe('socket-1');
    expect(alice.disconnectedAt).toBeNull();
    expect(room.abandonedAt).toBeNull();
  });

  it('ne plante pas pour une salle ou un joueur inconnu', () => {
    const service = makeService();
    const { player: alice } = service.createRoom('Alice', 'socket-1');

    expect(() =>
      service.markDisconnected('XXXXX', alice.id, 'socket-1'),
    ).not.toThrow();
    expect(() =>
      service.markDisconnected('AAAAA', 'inconnu', 'socket-1'),
    ).not.toThrow();
    expect(alice.socketId).toBe('socket-1');
  });
});

// Un service dont on contrôle l'heure : clock.time avance quand on le décide
const makeServiceWithClock = () => {
  const clock = { time: 1000 };
  let playerCount = 0;
  let tokenCount = 0;

  const service = new RoomService({
    now: () => clock.time,
    generatePlayerId: () => `p${(playerCount += 1)}`,
    generateReconnectToken: () => `token-${(tokenCount += 1)}`,
    generateCode: () => 'AAAAA',
  });

  return { service, clock };
};

describe('RoomService.resumeSession', () => {
  it('rend la place au joueur déconnecté avec son nouveau socket', () => {
    const { service, clock } = makeServiceWithClock();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    clock.time += 30_000;

    const result = service.resumeSession('AAAAA', alice.id, 'token-1', 'socket-9');

    expect(result.room).toBe(room);
    expect(result.player).toBe(alice);
    expect(alice.id).toBe('p1');
    expect(alice.socketId).toBe('socket-9');
    expect(alice.disconnectedAt).toBeNull();
    expect(room.players.size).toBe(1);
  });

  it('accepte le retour pile à la fin du délai de 60 secondes', () => {
    const { service, clock } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    clock.time += 60_000;

    expect(() =>
      service.resumeSession('AAAAA', alice.id, 'token-1', 'socket-9'),
    ).not.toThrow();
  });

  it('refuse le retour après le délai de 60 secondes', () => {
    const { service, clock } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    clock.time += 60_001;

    expect(() =>
      service.resumeSession('AAAAA', alice.id, 'token-1', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
    expect(alice.socketId).toBeNull();
  });

  it('refuse un mauvais token et laisse le joueur déconnecté', () => {
    const { service } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');

    expect(() =>
      service.resumeSession('AAAAA', alice.id, 'token-faux', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
    expect(() =>
      service.resumeSession('AAAAA', alice.id, '', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
    expect(alice.socketId).toBeNull();
  });

  it('refuse le token d\'un autre joueur de la même salle', () => {
    const { service } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');
    service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');

    expect(() =>
      service.resumeSession('AAAAA', alice.id, 'token-2', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
  });

  it('renvoie la même erreur pour une salle ou un joueur inconnu', () => {
    const { service } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');

    expect(() =>
      service.resumeSession('XXXXX', alice.id, 'token-1', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
    expect(() =>
      service.resumeSession('AAAAA', 'inconnu', 'token-1', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
  });

  it('permet de reprendre sa place avec un nouveau socket alors que l\'ancien est encore ouvert', () => {
    const { service } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');

    service.resumeSession('AAAAA', alice.id, 'token-1', 'socket-2');
    // l'ancien socket finit par se fermer : il ne doit pas déconnecter le nouveau
    service.markDisconnected('AAAAA', alice.id, 'socket-1');

    expect(alice.socketId).toBe('socket-2');
    expect(alice.disconnectedAt).toBeNull();
  });

  it('remet la salle en état non abandonné', () => {
    const { service } = makeServiceWithClock();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    expect(room.abandonedAt).toBe(1000);

    service.resumeSession('AAAAA', alice.id, 'token-1', 'socket-9');

    expect(room.abandonedAt).toBeNull();
  });
});

describe('RoomService.expireDisconnectedPlayers', () => {
  it('retire un joueur absent depuis plus de 60 secondes, pas avant', () => {
    const { service, clock } = makeServiceWithClock();
    const { room } = service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', bob.id, 'socket-2');

    clock.time += 60_000;
    expect(service.expireDisconnectedPlayers()).toEqual([]);
    expect(room.players.has(bob.id)).toBe(true);

    clock.time += 1;
    expect(service.expireDisconnectedPlayers()).toEqual(['AAAAA']);
    expect(room.players.has(bob.id)).toBe(false);
    expect(room.players.size).toBe(1);
  });

  it('ne touche pas aux joueurs connectés', () => {
    const { service, clock } = makeServiceWithClock();
    const { room } = service.createRoom('Alice', 'socket-1');
    service.joinRoom('AAAAA', 'Bob', 'socket-2');

    clock.time += 10 * 60_000;

    expect(service.expireDisconnectedPlayers()).toEqual([]);
    expect(room.players.size).toBe(2);
  });

  it('ne change pas l\'hôte quand un autre joueur est retiré', () => {
    const { service, clock } = makeServiceWithClock();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', bob.id, 'socket-2');

    clock.time += 61_000;
    service.expireDisconnectedPlayers();

    expect(room.hostId).toBe(alice.id);
  });

  it('garde l\'hôte déconnecté tant que son délai de grâce n\'est pas passé', () => {
    const { service, clock } = makeServiceWithClock();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');

    clock.time += 59_000;
    service.expireDisconnectedPlayers();

    expect(room.hostId).toBe(alice.id);
    expect(room.players.has(alice.id)).toBe(true);
  });

  it('transfère le rôle d\'hôte au joueur connecté le plus ancien après expiration', () => {
    const { service, clock } = makeServiceWithClock();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    clock.time += 1000;
    service.joinRoom('AAAAA', 'Bob', 'socket-2');
    clock.time += 1000;
    const { player: carl } = service.joinRoom('AAAAA', 'Carl', 'socket-3');
    clock.time += 1000;
    const { player: dina } = service.joinRoom('AAAAA', 'Dina', 'socket-4');

    // Bob (le plus ancien après Alice) part aussi : il ne doit pas hériter du rôle
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    service.markDisconnected('AAAAA', 'p2', 'socket-2');
    clock.time += 61_000;

    expect(service.expireDisconnectedPlayers()).toEqual(['AAAAA']);
    expect(room.hostId).toBe(carl.id);
    expect(room.players.has(alice.id)).toBe(false);
    expect(room.players.has(dina.id)).toBe(true);
  });

  it('un nouvel hôte le reste, même si un joueur plus ancien revient ensuite', () => {
    const { service, clock } = makeServiceWithClock();
    const { room, player: alice } = service.createRoom('Alice', 'socket-1');
    clock.time += 1000;
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');
    clock.time += 1000;
    const { player: carl } = service.joinRoom('AAAAA', 'Carl', 'socket-3');
    clock.time += 1000;
    const { player: dina } = service.joinRoom('AAAAA', 'Dina', 'socket-4');

    // Alice (hôte) part, puis Bob 30 s plus tard : à l'expiration d'Alice, Bob est encore dans son délai
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    clock.time += 30_000;
    service.markDisconnected('AAAAA', bob.id, 'socket-2');
    clock.time += 31_000;
    service.expireDisconnectedPlayers();
    expect(room.hostId).toBe(carl.id);

    // Bob revient : il est plus ancien que Carl, mais Carl reste hôte
    service.resumeSession('AAAAA', bob.id, 'token-2', 'socket-9');
    service.markDisconnected('AAAAA', dina.id, 'socket-4');
    clock.time += 61_000;
    service.expireDisconnectedPlayers();

    expect(room.players.has(dina.id)).toBe(false);
    expect(room.hostId).toBe(carl.id);
  });

  it('supprime la salle dès que tous ses joueurs ont expiré', () => {
    const { service, clock } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    service.markDisconnected('AAAAA', bob.id, 'socket-2');

    clock.time += 60_000;
    service.expireDisconnectedPlayers();
    expect(service.getRoom('AAAAA')).toBeDefined();

    clock.time += 1;
    expect(service.expireDisconnectedPlayers()).toEqual([]);
    expect(service.getRoom('AAAAA')).toBeUndefined();
  });

  it('garde une salle sans connectés tant qu\'un joueur est dans son délai', () => {
    const { service, clock } = makeServiceWithClock();
    const { player: alice } = service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', alice.id, 'socket-1');
    clock.time += 30_000;
    service.markDisconnected('AAAAA', bob.id, 'socket-2');

    clock.time += 31_000;
    service.expireDisconnectedPlayers();

    const room = service.getRoom('AAAAA');
    expect(room?.players.size).toBe(2);
    expect(room?.hostId).toBe(alice.id);
  });

  it('un joueur expiré ne peut plus reprendre sa session', () => {
    const { service, clock } = makeServiceWithClock();
    service.createRoom('Alice', 'socket-1');
    const { player: bob } = service.joinRoom('AAAAA', 'Bob', 'socket-2');
    service.markDisconnected('AAAAA', bob.id, 'socket-2');
    clock.time += 61_000;
    service.expireDisconnectedPlayers();

    expect(() =>
      service.resumeSession('AAAAA', bob.id, 'token-2', 'socket-9'),
    ).toThrow(expect.objectContaining({ code: 'SESSION_EXPIRED' }));
  });
});
