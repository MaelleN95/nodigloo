import type { ResumeSessionPayload } from '@nodigloo/shared';

export type StoredSession = ResumeSessionPayload;

const SESSION_KEY = 'nodigloo.session';

const isStoredSession = (value: unknown): value is StoredSession => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const session = value as Record<string, unknown>;
  return (
    typeof session.code === 'string' &&
    typeof session.playerId === 'string' &&
    typeof session.reconnectToken === 'string'
  );
};

export const readStoredSession = (): {
  session: StoredSession | null;
  error: string | null;
} => {
  let stored: string | null;
  try {
    stored = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return {
      session: null,
      error: 'Le navigateur ne permet pas de lire la session précédente.',
    };
  }

  if (!stored) {
    return { session: null, error: null };
  }

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return {
      session: null,
      error: 'La session précédente est illisible. Tu peux créer une nouvelle salle.',
    };
  }

  if (!isStoredSession(value)) {
    return {
      session: null,
      error: 'La session précédente est invalide. Tu peux créer une nouvelle salle.',
    };
  }

  return { session: value, error: null };
};

export const saveSession = (value: StoredSession): boolean => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const removeSavedSession = (): boolean => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch {
    return false;
  }
};
