// "lobby" = on attend les joueurs, "playing" = partie en cours (quiz ou réaction), "results" = classement affiché
export type RoomStatus = 'lobby' | 'playing' | 'results';

export type PlayerId = string;

export const GAME_TYPES = ['quiz', 'reaction'] as const;
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
