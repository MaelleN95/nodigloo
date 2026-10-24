import type { PlayerId } from './room.js';

// Envoyé au début de chaque manche. Les heures sont celles du serveur, en ms :
// chaque appareil les convertit avec son décalage d'horloge pour passer au vert en même temps que les autres.
export interface ReactionRoundStart {
  round: number;
  totalRounds: number;
  serverNow: number;
  greenAt: number;
}

// Le temps est mesuré sur l'appareil, entre l'affichage du vert et l'appui
export type ReactionSubmission =
  | { round: number; kind: 'reaction'; reactionMs: number }
  | { round: number; kind: 'false-start' };

// "missed" = aucun appui reçu avant la fin de la manche
export type ReactionOutcome = 'reaction' | 'false-start' | 'missed';

export interface ReactionResult {
  playerId: PlayerId;
  outcome: ReactionOutcome;
  // seulement pour une vraie réaction
  reactionMs: number | null;
  points: number;
}

export interface ReactionRoundResults {
  round: number;
  results: ReactionResult[];
  scores: Record<PlayerId, number>;
}
