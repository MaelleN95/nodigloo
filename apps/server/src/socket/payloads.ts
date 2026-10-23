import { z } from 'zod';
import { CHOICES_PER_QUESTION, GAME_TYPES, MAX_ROUNDS } from '@nodigloo/shared';
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

export const submitQuizAnswerSchema = z.object({
  questionId: z.string().min(1).max(100),
  choice: z
    .number()
    .int()
    .min(0)
    .max(CHOICES_PER_QUESTION - 1),
});

// Les bornes du nombre de manches sont vérifiées dans le domaine
export const updateSettingsSchema = z.object({
  game: z.enum(GAME_TYPES),
  rounds: z.number().int(),
});

// Le seuil des 100 ms est appliqué par le domaine : ici on écarte juste les valeurs absurdes
const reactionRound = z.number().int().min(1).max(MAX_ROUNDS);
export const reactionSubmissionSchema = z.discriminatedUnion('kind', [
  z.object({
    round: reactionRound,
    kind: z.literal('reaction'),
    reactionMs: z.number().finite().min(0).max(60_000),
  }),
  z.object({ round: reactionRound, kind: z.literal('false-start') }),
]);

// Un client peut envoyer n'importe quoi : on ne fait jamais confiance au type annoncé
export const parsePayload = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new DomainError('INVALID_PAYLOAD', 'Données invalides');
  }

  return result.data;
};
