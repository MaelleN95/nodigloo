// Une mesure : quand j'ai envoyé le ping, quand la réponse est revenue, et l'heure lue par le serveur entre les deux
export type ClockSample = {
  sentAt: number;
  receivedAt: number;
  serverTime: number;
};

export type MeasureOptions = {
  samples?: number;
  now?: () => number;
};

// On suppose que l'aller et le retour durent autant : le serveur a lu son heure au milieu du trajet.
// Le ping le plus rapide est celui où cette supposition se trompe le moins, donc on garde celui-là.
export const estimateClockOffset = (samples: ClockSample[]): number => {
  if (samples.length === 0) {
    throw new Error('Aucune mesure pour estimer le décalage d’horloge');
  }

  const fastest = samples.reduce((best, sample) =>
    sample.receivedAt - sample.sentAt < best.receivedAt - best.sentAt
      ? sample
      : best,
  );

  return Math.round(
    fastest.serverTime - (fastest.sentAt + fastest.receivedAt) / 2,
  );
};

// Les pings partent l'un après l'autre pour ne pas se gêner. Un ping raté est ignoré,
// on n'abandonne que si aucun n'a répondu.
export const measureClockOffset = async (
  ping: () => Promise<number>,
  { samples = 5, now = Date.now }: MeasureOptions = {},
): Promise<number> => {
  const collected: ClockSample[] = [];

  for (let index = 0; index < samples; index += 1) {
    const sentAt = now();
    try {
      const serverTime = await ping();
      collected.push({ sentAt, receivedAt: now(), serverTime });
    } catch {
      // Tant pis pour ce ping, les suivants suffiront
    }
  }

  return estimateClockOffset(collected);
};
