export const ERROR_CODES = [
  'INVALID_PAYLOAD',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'GAME_ALREADY_STARTED',
  'NICKNAME_TAKEN',
  'FORBIDDEN',
  'NOT_ENOUGH_PLAYERS',
  'ALREADY_ANSWERED',
  'ANSWER_TOO_LATE',
  'SESSION_EXPIRED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface AppError {
  code: ErrorCode;
  message: string;
}
