import type { NodiglooSocket } from '../socket';

export const getServerError = (error: unknown): string => {
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return 'Le serveur met trop de temps à répondre. Réessaie dans un instant.';
  }

  return 'Impossible de joindre le serveur. Vérifie qu’il est démarré puis réessaie.';
};

export const connectSocket = (socket: NodiglooSocket): Promise<void> => {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Connection timeout'));
    }, 10_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });
};
