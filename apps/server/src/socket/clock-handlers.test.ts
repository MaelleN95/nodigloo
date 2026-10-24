import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AddressInfo } from 'node:net';
import { io as createSocketClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../app.js';
import type { Config } from '../config.js';

const config: Config = {
  port: 0,
  allowedOrigins: [],
  nodeEnv: 'test',
  attemptLimit: { max: 30, windowMs: 60_000 },
};

describe('clock Socket.IO handlers', () => {
  let app: ReturnType<typeof createApp>;
  let client: ClientSocket;

  beforeEach(async () => {
    app = createApp(config);
    await new Promise<void>((resolve, reject) => {
      app.httpServer.once('error', reject);
      app.httpServer.listen(0, '127.0.0.1', resolve);
    });
    const { port } = app.httpServer.address() as AddressInfo;
    client = createSocketClient(`http://127.0.0.1:${port}`, {
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
  });

  afterEach(async () => {
    client.disconnect();
    await new Promise<void>((resolve) => app.io.close(() => resolve()));
  });

  it('renvoie l’heure du serveur sans avoir rejoint de salle', async () => {
    const before = Date.now();
    const result = await client.emitWithAck('clock:ping');
    const after = Date.now();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.serverTime).toBeGreaterThanOrEqual(before);
      expect(result.data.serverTime).toBeLessThanOrEqual(after);
    }
  });
});
