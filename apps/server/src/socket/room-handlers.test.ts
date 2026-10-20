import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AddressInfo } from 'node:net';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  Ack,
  CreateRoomPayload,
  JoinedRoom,
  RoomPublic,
} from '@nodigloo/shared';
import { createApp } from '../app.js';
import type { Config } from '../config.js';

const config: Config = {
  port: 0,
  allowedOrigins: [],
  nodeEnv: 'test',
};

describe('room Socket.IO handlers', () => {
  const clients: ClientSocket[] = [];
  let app: ReturnType<typeof createApp>;
  let port: number;

  beforeEach(async () => {
    app = createApp(config);
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
});
