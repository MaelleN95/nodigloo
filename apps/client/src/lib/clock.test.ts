import { describe, expect, it } from 'vitest';
import { estimateClockOffset, measureClockOffset } from './clock';

describe('estimateClockOffset', () => {
  it('place l’heure du serveur au milieu de l’aller-retour', () => {
    // Envoi à 1000, réponse à 1100 : le serveur a répondu vers 1050 de mon horloge
    const offset = estimateClockOffset([
      { sentAt: 1000, receivedAt: 1100, serverTime: 1550 },
    ]);

    expect(offset).toBe(500);
  });

  it('garde la mesure avec l’aller-retour le plus court', () => {
    const offset = estimateClockOffset([
      { sentAt: 0, receivedAt: 400, serverTime: 900 },
      { sentAt: 1000, receivedAt: 1020, serverTime: 1210 },
      { sentAt: 2000, receivedAt: 2300, serverTime: 2000 },
    ]);

    expect(offset).toBe(200);
  });

  it('donne un écart négatif quand mon horloge est en avance', () => {
    const offset = estimateClockOffset([
      { sentAt: 5000, receivedAt: 5040, serverTime: 4020 },
    ]);

    expect(offset).toBe(-1000);
  });

  it('refuse d’estimer sans aucune mesure', () => {
    expect(() => estimateClockOffset([])).toThrow();
  });
});

describe('measureClockOffset', () => {
  // Fausse horloge : chaque lecture avance de 10 ms, comme si le réseau prenait du temps
  const fakeClock = () => {
    let time = 0;
    return () => {
      time += 10;
      return time;
    };
  };

  it('envoie le nombre de pings demandé et calcule l’écart', async () => {
    let calls = 0;
    const ping = async () => {
      calls += 1;
      return 1_000_000;
    };

    const offset = await measureClockOffset(ping, { samples: 3, now: fakeClock() });

    expect(calls).toBe(3);
    // Premier ping : envoyé à 10, reçu à 20, le serveur était donc à 15 de mon horloge
    expect(offset).toBe(1_000_000 - 15);
  });

  it('ignore les pings ratés tant qu’au moins un répond', async () => {
    let calls = 0;
    const ping = async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('timeout');
      }
      return 500;
    };

    // Les deux échecs lisent l'horloge à 10 et 20, le seul succès part à 30 et revient à 40
    await expect(measureClockOffset(ping, { samples: 3, now: fakeClock() })).resolves.toBe(500 - 35);
  });

  it('échoue si aucun ping ne répond', async () => {
    const ping = async (): Promise<number> => {
      throw new Error('timeout');
    };

    await expect(measureClockOffset(ping, { samples: 2 })).rejects.toThrow();
  });
});
