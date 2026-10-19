import { randomInt } from 'node:crypto';

// Pas de 0/O ni de 1/I/L : un code lu à voix haute ou recopié ne doit pas prêter à confusion
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

const MAX_ATTEMPTS = 100;

export const generateRoomCode = (): string => {
  let code = '';

  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }

  return code;
};

// On retire les espaces et on passe en majuscules
export const normalizeRoomCode = (raw: string): string =>
  raw.replace(/\s+/g, '').toUpperCase();

export const isValidRoomCodeFormat = (raw: string): boolean => {
  const code = normalizeRoomCode(raw);

  return (
    code.length === ROOM_CODE_LENGTH &&
    [...code].every((char) => ROOM_CODE_ALPHABET.includes(char))
  );
};

// `exists` dit si un code est déjà pris : c'est la salle qui sait, pas ce fichier
export const generateUniqueRoomCode = (
  exists: (code: string) => boolean,
  generate: () => string = generateRoomCode,
): string => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generate();

    if (!exists(code)) {
      return code;
    }
  }

  throw new Error('Impossible de générer un code de salle unique');
};
