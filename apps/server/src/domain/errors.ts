import type { AppError, ErrorCode } from '@nodigloo/shared';

// Erreur "prévue" : le client doit la recevoir telle quelle (code + message).
// Tout ce qui n'est pas une DomainError est un vrai bug et ne doit pas fuiter au client.
export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }

  toAppError(): AppError {
    return { code: this.code, message: this.message };
  }
}

// Point d'entrée unique pour répondre à un client après une erreur.
// Une erreur prévue garde son message ; un vrai bug devient un INTERNAL_ERROR générique,
// pour ne pas exposer de détails internes (chemins, messages de librairie...). Le log reste au serveur.
export const toAppError = (error: unknown): AppError =>
  error instanceof DomainError
    ? error.toAppError()
    : { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' };
