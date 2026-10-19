export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

// On enlève les espaces autour et on écrase les espaces multiples : "  Jo   Ann " devient "Jo Ann"
export const normalizeNickname = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ');

export const isValidNickname = (raw: string): boolean => {
  const nickname = normalizeNickname(raw);

  return (
    nickname.length >= NICKNAME_MIN_LENGTH &&
    nickname.length <= NICKNAME_MAX_LENGTH
  );
};

// Sert à détecter les doublons : "Alice" et "alice" sont le même pseudo dans une salle
export const nicknameKey = (raw: string): string =>
  normalizeNickname(raw).toLocaleLowerCase('fr');
