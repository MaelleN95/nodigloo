import { z } from 'zod';
import { DomainError } from '../domain/errors.js';

// Ici on vérifie seulement la forme (bon type, taille raisonnable).
// Les règles métier (pseudo de 2 à 20 caractères...) restent dans le domaine.
const nickname = z.string().max(100);
const roomCode = z.string().max(20);

export const createRoomSchema = z.object({ nickname });

export const joinRoomSchema = z.object({ code: roomCode, nickname });

export const resumeSessionSchema = z.object({
  code: roomCode,
  playerId: z.string().max(100),
  reconnectToken: z.string().max(200),
});

// Un client peut envoyer n'importe quoi : on ne fait jamais confiance au type annoncé
export const parsePayload = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new DomainError('INVALID_PAYLOAD', 'Données invalides');
  }

  return result.data;
};
