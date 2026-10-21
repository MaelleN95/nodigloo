export interface RateLimitRule {
  max: number;
  windowMs: number;
}

export interface RateLimiter {
  allow(key: string): boolean;
}

// Fenêtre glissante : on garde l'heure de chaque tentative récente par clé
export const createRateLimiter = (
  { max, windowMs }: RateLimitRule,
  now: () => number = Date.now,
): RateLimiter => {
  const hits = new Map<string, number[]>();

  return {
    allow(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter(
        (time) => current - time < windowMs,
      );

      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }

      recent.push(current);
      hits.set(key, recent);

      // On ménage la mémoire : les clés inactives disparaissent
      if (hits.size > 1000) {
        for (const [otherKey, times] of hits) {
          if (times.every((time) => current - time >= windowMs)) {
            hits.delete(otherKey);
          }
        }
      }

      return true;
    },
  };
};
