import { describe, expect, it } from '@jest/globals';
import {
  createRoomSchema,
  joinRoomSchema,
  parsePayload,
  resumeSessionSchema,
} from './payloads.js';

const invalidPayload = expect.objectContaining({ code: 'INVALID_PAYLOAD' });

describe('parsePayload', () => {
  it('renvoie les données quand la forme est correcte', () => {
    expect(parsePayload(createRoomSchema, { nickname: 'Alice' })).toEqual({
      nickname: 'Alice',
    });
  });

  it.each([undefined, null, 'Alice', 42, [], {}, { nickname: 42 }])(
    'refuse %p pour room:create',
    (data) => {
      expect(() => parsePayload(createRoomSchema, data)).toThrow(
        invalidPayload,
      );
    },
  );

  it('refuse un pseudo démesuré', () => {
    expect(() =>
      parsePayload(createRoomSchema, { nickname: 'a'.repeat(101) }),
    ).toThrow(invalidPayload);
  });

  it('ignore les champs en trop', () => {
    expect(
      parsePayload(joinRoomSchema, { code: 'ABCDE', nickname: 'Bob', x: 1 }),
    ).toEqual({ code: 'ABCDE', nickname: 'Bob' });
  });

  it('refuse un room:join sans code', () => {
    expect(() => parsePayload(joinRoomSchema, { nickname: 'Bob' })).toThrow(
      invalidPayload,
    );
  });

  it('refuse un session:resume dont un champ n\'est pas un texte', () => {
    expect(() =>
      parsePayload(resumeSessionSchema, {
        code: 'ABCDE',
        playerId: 'p1',
        reconnectToken: 123,
      }),
    ).toThrow(invalidPayload);
  });

  it('ne laisse pas fuiter le détail de zod dans le message', () => {
    try {
      parsePayload(createRoomSchema, {});
      throw new Error('aurait dû échouer');
    } catch (error) {
      expect((error as Error).message).toBe('Données invalides');
    }
  });
});
