import type { PlayerId } from './room.js';

// Index de la proposition choisie (0 à 3)
export type ChoiceIndex = number;

// La question telle que les joueurs la voient pendant le chrono : pas de bonne réponse ici.
// La version avec la bonne réponse reste côté serveur uniquement.
export interface QuestionPublic {
  id: string;
  text: string;
  choices: string[];
}

export interface QuestionStart {
  question: QuestionPublic;
  questionNumber: number;
  totalQuestions: number;
  // timestamps du serveur en ms, pour que le client puisse afficher un compte à rebours
  serverNow: number;
  endsAt: number;
}

// Envoyé seulement au moment de la révélation
export interface QuestionReveal {
  questionId: string;
  correctChoice: ChoiceIndex;
  scores: Record<PlayerId, number>;
}

export interface RankingEntry {
  playerId: PlayerId;
  nickname: string;
  score: number;
  // deux joueurs à égalité ont le même rang
  rank: number;
}
