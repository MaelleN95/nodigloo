// "lobby" = on attend les joueurs, "playing" = quiz en cours, "results" = classement affiché
export type RoomStatus = 'lobby' | 'playing' | 'results';

export type PlayerId = string;

// Seul le quiz existe pour l'instant, le jeu de réaction viendra s'ajouter ici
export const GAME_TYPES = ['quiz'] as const;
export type GameType = (typeof GAME_TYPES)[number];

export interface GameSettings {
  game: GameType;
  rounds: number;
}

// Ce que tout le monde a le droit de voir. L'id est l'identité logique du joueur,
// elle ne change pas quand le socket se reconnecte.
export interface PlayerPublic {
  id: PlayerId;
  nickname: string;
  connected: boolean;
  score: number;
}

export interface RoomPublic {
  code: string;
  status: RoomStatus;
  hostId: PlayerId;
  players: PlayerPublic[];
  settings: GameSettings;
}
