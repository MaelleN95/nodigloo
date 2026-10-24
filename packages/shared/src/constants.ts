export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
// Une manche = une question pour le quiz. L'hôte choisit le nombre dans la salle d'attente.
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;
export const DEFAULT_ROUNDS = 5;
export const CHOICES_PER_QUESTION = 4;
export const QUESTION_DURATION_MS = 20_000;
export const REVEAL_DURATION_MS = 3_000;
export const POINTS_PER_CORRECT_ANSWER = 100;
export const RECONNECT_GRACE_MS = 60_000;

// Jeu de réaction : ambre pendant 2 à 6 s, puis vert, et il faut taper le plus vite possible
export const REACTION_MIN_DELAY_MS = 2_000;
export const REACTION_MAX_DELAY_MS = 6_000;
// En dessous, personne ne réagit vraiment : c'est de l'anticipation, compté comme un faux départ
export const REACTION_MIN_TIME_MS = 100;
// 1000 points jusqu'à 150 ms, puis de moins en moins, jusqu'à 0 à 1 s
export const REACTION_MAX_POINTS = 1_000;
export const REACTION_FULL_POINTS_MS = 150;
export const REACTION_ZERO_POINTS_MS = 1_000;
// Après le vert, on attend encore un peu les retardataires et le réseau avant de clore la manche
export const REACTION_ANSWER_WINDOW_MS = 3_000;
export const REACTION_RESULTS_DURATION_MS = 4_000;