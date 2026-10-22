import type { NodiglooSocket } from '../socket';

export const getServerError = (error: unknown): string => {
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return 'Le serveur met trop de temps à répondre. Réessaie dans un instant.';
  }

  return 'Impossible de joindre le serveur. Vérifie qu’il est démarré puis réessaie.';
};

export type ConnectionOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export const connectSocket = (
  socket: NodiglooSocket,
  { timeoutMs = 10_000, signal }: ConnectionOptions = {},
): Promise<void> => {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Connexion annulée', 'AbortError'));
  }
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      // Une erreur de transport pendant le réveil laisse Socket.IO réessayer.
      if (socket.active) {
        return;
      }
      cleanup();
      reject(error);
    };
    const onAbort = () => {
      cleanup();
      socket.disconnect();
      reject(new DOMException('Connexion annulée', 'AbortError'));
    };

    socket.once('connect', onConnect);
    socket.on('connect_error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });
    socket.connect();
  });
};
