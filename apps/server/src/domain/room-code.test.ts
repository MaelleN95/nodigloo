import { describe, expect, it } from '@jest/globals';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  generateUniqueRoomCode,
  isValidRoomCodeFormat,
  normalizeRoomCode,
} from './room-code.js';

describe('generateRoomCode', () => {
  it('produit un code de la bonne longueur avec uniquement les caractères autorisés', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();

      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...code].every((char) => ROOM_CODE_ALPHABET.includes(char))).toBe(
        true,
      );
    }
  });

  it('n\'utilise pas de caractères ambigus', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('ne renvoie pas toujours le même code', () => {
    const codes = new Set(Array.from({ length: 50 }, generateRoomCode));

    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('normalizeRoomCode', () => {
  it('passe en majuscules et enlève les espaces', () => {
    expect(normalizeRoomCode(' ab c23 ')).toBe('ABC23');
  });
});

describe('isValidRoomCodeFormat', () => {
  it('accepte un code bien formé, même en minuscules', () => {
    expect(isValidRoomCodeFormat('ABC23')).toBe(true);
    expect(isValidRoomCodeFormat('abc23')).toBe(true);
  });

  it('refuse une mauvaise longueur', () => {
    expect(isValidRoomCodeFormat('ABC2')).toBe(false);
    expect(isValidRoomCodeFormat('ABC234')).toBe(false);
    expect(isValidRoomCodeFormat('')).toBe(false);
  });

  it('refuse les caractères hors alphabet', () => {
    expect(isValidRoomCodeFormat('ABC0O')).toBe(false);
    expect(isValidRoomCodeFormat('ABC2!')).toBe(false);
  });
});

describe('generateUniqueRoomCode', () => {
  it('renvoie le premier code libre', () => {
    const code = generateUniqueRoomCode(() => false, () => 'ABC23');

    expect(code).toBe('ABC23');
  });

  it('en cas de collision, retente avec un autre code', () => {
    const candidates = ['AAAAA', 'AAAAA', 'BBBBB'];
    const taken = new Set(['AAAAA']);

    const code = generateUniqueRoomCode(
      (candidate) => taken.has(candidate),
      () => candidates.shift() as string,
    );

    expect(code).toBe('BBBBB');
  });

  it('abandonne avec une erreur si tous les codes sont pris', () => {
    expect(() =>
      generateUniqueRoomCode(() => true, () => 'AAAAA'),
    ).toThrow('code de salle unique');
  });
});
