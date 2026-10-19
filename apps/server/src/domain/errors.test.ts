import { describe, expect, it } from '@jest/globals';
import { DomainError, toAppError } from './errors.js';

describe('DomainError', () => {
  it('garde le code et le message', () => {
    const error = new DomainError('ROOM_FULL', 'La salle est pleine');

    expect(error.code).toBe('ROOM_FULL');
    expect(error.message).toBe('La salle est pleine');
  });

  it('se reconnaît avec instanceof, comme une Error classique', () => {
    const error = new DomainError('FORBIDDEN', 'Action interdite');

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it('se convertit en AppError pour le client', () => {
    const error = new DomainError('ROOM_NOT_FOUND', 'Salle introuvable');

    expect(error.toAppError()).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: 'Salle introuvable',
    });
  });
});

describe('toAppError', () => {
  it('garde le code et le message d\'une erreur prévue', () => {
    const error = new DomainError('ROOM_FULL', 'La salle est pleine');

    expect(toAppError(error)).toEqual({
      code: 'ROOM_FULL',
      message: 'La salle est pleine',
    });
  });

  it('transforme un vrai bug en INTERNAL_ERROR sans exposer son message', () => {
    const result = toAppError(new Error('connexion à /secret/chemin refusée'));

    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).not.toContain('secret');
  });

  it('gère aussi ce qui n\'est pas une Error (ex: un throw "texte")', () => {
    expect(toAppError('boom').code).toBe('INTERNAL_ERROR');
    expect(toAppError(undefined).code).toBe('INTERNAL_ERROR');
  });
});
