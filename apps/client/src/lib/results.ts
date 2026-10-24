import { DEFAULT_ROUNDS, type GameSettings } from '@nodigloo/shared';

// La phrase sous le titre suit les réglages de la partie : jeu choisi et nombre de manches
export function describeFinishedGame(settings: GameSettings | undefined): string {
  const rounds = settings?.rounds ?? DEFAULT_ROUNDS;
  const plural = rounds > 1 ? 's' : '';

  if (settings?.game === 'reaction') {
    return `${rounds} manche${plural} de réflexes, quelques faux départs et un chouette moment partagé.`;
  }
  return `${rounds} question${plural}, quelques surprises et un chouette moment partagé.`;
}
