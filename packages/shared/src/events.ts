import type { AppError } from './errors.js';
import type {
  ChoiceIndex,
  QuestionReveal,
  QuestionStart,
  RankingEntry,
} from './quiz.js';
import type { GameSettings, PlayerId, RoomPublic } from './room.js';
import type {
  ReactionRoundResults,
  ReactionRoundStart,
  ReactionSubmission,
} from './reaction.js';

// Chaque événement client -> serveur répond par un accusé : soit les données, soit une erreur.
export type Ack<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

// Le token sert à reprendre sa place après une coupure. Il n'est donné qu'au joueur concerné,
// donc il ne doit jamais apparaître dans RoomPublic.
export interface Session {
  playerId: PlayerId;
  reconnectToken: string;
}

export interface JoinedRoom {
  room: RoomPublic;
  session: Session;
}

export interface CreateRoomPayload {
  nickname: string;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
}

export interface ResumeSessionPayload {
  code: string;
  playerId: PlayerId;
  reconnectToken: string;
}

export interface SubmitQuizAnswerPayload {
  questionId: string;
  choice: ChoiceIndex;
}

// Heure du serveur en millisecondes (Date.now()), pour que chaque appareil calcule son décalage
export interface ClockPong {
  serverTime: number;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: CreateRoomPayload,
    ack: (result: Ack<JoinedRoom>) => void,
  ) => void;
  'room:join': (
    payload: JoinRoomPayload,
    ack: (result: Ack<JoinedRoom>) => void,
  ) => void;
  'session:resume': (
    payload: ResumeSessionPayload,
    ack: (result: Ack<JoinedRoom>) => void,
  ) => void;
  'room:settings:update': (
    payload: GameSettings,
    ack: (result: Ack) => void,
  ) => void;
  'game:start': (ack: (result: Ack) => void) => void;
  'room:leave': (ack: (result: Ack) => void) => void;
  'quiz:answer:submit': (
    payload: SubmitQuizAnswerPayload,
    ack: (result: Ack) => void,
  ) => void;
  'clock:ping': (ack: (result: Ack<ClockPong>) => void) => void;
  'reaction:submit': (
    payload: ReactionSubmission,
    ack: (result: Ack) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:updated': (room: RoomPublic) => void;
  'question:started': (payload: QuestionStart) => void;
  'question:revealed': (payload: QuestionReveal) => void;
  'reaction:round:started': (payload: ReactionRoundStart) => void;
  'reaction:round:finished': (payload: ReactionRoundResults) => void;
  'game:finished': (payload: { ranking: RankingEntry[] }) => void;
}
