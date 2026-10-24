export interface GameDeps {
  now: () => number;
  random: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
}

export const defaultGameDeps: GameDeps = {
  now: () => Date.now(),
  random: () => Math.random(),
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};
