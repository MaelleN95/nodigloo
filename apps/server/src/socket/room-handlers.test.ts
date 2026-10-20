import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AddressInfo } from 'node:net';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  Ack,
  CreateRoomPayload,
  JoinedRoom,
  ResumeSessionPayload,
  RoomPublic,
} from '@nodigloo/shared';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import { RoomService } from '../domain/room-service.js';
import { runRoomMaintenance } from './room-maintenance.js';

const config: Config = {
  port: 0,
  allowedOrigins: [],
  nodeEnv: 'test',
};

describe('room Socket.IO handlers', () => {
  const clients: ClientSocket[] = [];
  let app: ReturnType<typeof createApp>;
  let port: number;
  let now: number;
  let roomService: RoomService;

  beforeEach(async () => {
    now = 1000;
    roomService = new RoomService({ now: () => now });
    app = createApp(config, roomService);
    await new Promise<void>((resolve, reject) => {
      app.httpServer.once('error', reject);
      app.httpServer.listen(0, '127.0.0.1', resolve);
    });
    port = (app.httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.disconnect();
    }
    await new Promise<void>((resolve) => app.io.close(() => resolve()));
  });

  const connectClient = async (): Promise<ClientSocket> => {
    const client = createSocketClient(`http://127.0.0.1:${port}`, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
      client.connect();
    });

    return client;
  };

  const requireSuccess = (result: Ack<JoinedRoom>): JoinedRoom => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.data;
  };

  it('crée une salle et ne renvoie le token qu’à son propriétaire', async () => {
    const client = await connectClient();
    const result = requireSuccess(
      await client.emitWithAck('room:create', { nickname: 'Alice' }),
    );

    expect(result.room.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(result.room.players).toHaveLength(1);
    expect(result.room.players[0]).toMatchObject({
      id: result.session.playerId,
      nickname: 'Alice',
      connected: true,
      score: 0,
    });
    expect(result.session.reconnectToken).toHaveLength(64);
    expect(JSON.stringify(result.room)).not.toContain(
      result.session.reconnectToken,
    );
  });

  it('fait rejoindre une salle et met à jour les joueurs déjà présents', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      host.once('room:updated', resolve);
    });

    const joined = requireSuccess(
      await guest.emitWithAck('room:join', {
        code: created.room.code,
        nickname: 'Bob',
      }),
    );
    const broadcast = await roomUpdated;

    expect(joined.room.players).toHaveLength(2);
    expect(joined.room.players.map((player) => player.nickname)).toEqual([
      'Alice',
      'Bob',
    ]);
    expect(broadcast).toEqual(joined.room);
    expect(joined.session.playerId).not.toBe(created.session.playerId);
  });

  it('renvoie une erreur métier quand la salle n’existe pas', async () => {
    const client = await connectClient();
    const result = await client.emitWithAck('room:join', {
      code: 'ZZZZZ',
      nickname: 'Alice',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'ROOM_NOT_FOUND',
        message: 'Salle introuvable',
      },
    });
  });

  it('refuse un payload invalide sans déconnecter le socket', async () => {
    const client = await connectClient();
    const result = await client.emitWithAck('room:create', {
      nickname: 42,
    } as unknown as CreateRoomPayload);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(client.connected).toBe(true);
  });

  it('reprend une session et ferme l’ancienne connexion du joueur', async () => {
    const original = await connectClient();
    const observer = await connectClient();
    const created = requireSuccess(
      await original.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    await observer.emitWithAck('room:join', {
      code: created.room.code,
      nickname: 'Bob',
    });

    const resumedClient = await connectClient();
    const originalDisconnected = new Promise<void>((resolve) => {
      original.once('disconnect', () => resolve());
    });
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      observer.once('room:updated', resolve);
    });
    const resumed = requireSuccess(
      await resumedClient.emitWithAck('session:resume', {
        code: created.room.code,
        playerId: created.session.playerId,
        reconnectToken: created.session.reconnectToken,
      }),
    );

    await originalDisconnected;
    const broadcast = await roomUpdated;

    expect(resumed.session).toEqual(created.session);
    expect(resumed.room.players.find((player) => player.nickname === 'Alice'))
      .toMatchObject({ connected: true });
    expect(broadcast).toEqual(resumed.room);
    expect(original.connected).toBe(false);
  });

  it('refuse une session avec un token invalide', async () => {
    const original = await connectClient();
    const created = requireSuccess(
      await original.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const resumedClient = await connectClient();
    const result = await resumedClient.emitWithAck('session:resume', {
      code: created.room.code,
      playerId: created.session.playerId,
      reconnectToken: 'token-invalide',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Session expirée ou invalide',
      },
    });
    expect(original.connected).toBe(true);
  });

  it('refuse un payload de reprise mal formé', async () => {
    const client = await connectClient();
    const result = await client.emitWithAck('session:resume', {
      code: 'ABCDE',
      playerId: 'p1',
      reconnectToken: 123,
    } as unknown as ResumeSessionPayload);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(client.connected).toBe(true);
  });

  it('retire les joueurs expirés et diffuse la salle mise à jour', async () => {
    const host = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    const { player } = roomService.joinRoom(
      created.room.code,
      'Bob',
      'socket-hors-ligne',
    );
    roomService.markDisconnected(
      created.room.code,
      player.id,
      'socket-hors-ligne',
    );
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      host.once('room:updated', resolve);
    });

    now += 60_001;
    runRoomMaintenance(app.io, roomService);

    const updated = await roomUpdated;
    expect(updated.players.map((entry) => entry.nickname)).toEqual(['Alice']);
  });

  it('supprime une salle quand tous ses joueurs ont expiré', () => {
    const { room, player } = roomService.createRoom('Alice', 'socket-hors-ligne');
    roomService.markDisconnected(room.code, player.id, 'socket-hors-ligne');
    now += 60_001;

    runRoomMaintenance(app.io, roomService);

    expect(roomService.getRoom(room.code)).toBeUndefined();
  });

  it('permet à l’hôte de démarrer avec deux joueurs et diffuse le nouvel état', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    await guest.emitWithAck('room:join', {
      code: created.room.code,
      nickname: 'Bob',
    });
    const roomUpdated = new Promise<RoomPublic>((resolve) => {
      host.once('room:updated', resolve);
    });

    const result = await host.emitWithAck('game:start');
    const updated = await roomUpdated;

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updated.status).toBe('playing');
  });

  it('refuse le démarrage par un non-hôte', async () => {
    const host = await connectClient();
    const guest = await connectClient();
    const created = requireSuccess(
      await host.emitWithAck('room:create', { nickname: 'Alice' }),
    );
    await guest.emitWithAck('room:join', {
      code: created.room.code,
      nickname: 'Bob',
    });

    const result = await guest.emitWithAck('game:start');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(roomService.getRoom(created.room.code)?.status).toBe('lobby');
  });

  it('refuse le démarrage avec un seul joueur connecté', async () => {
    const host = await connectClient();
    await host.emitWithAck('room:create', { nickname: 'Alice' });

    const result = await host.emitWithAck('game:start');

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_PLAYERS' },
    });
  });
});
