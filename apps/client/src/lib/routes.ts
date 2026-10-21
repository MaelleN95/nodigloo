export type RoomStep = 'lobby' | 'quiz' | 'results';

// Une seule fonction pour fabriquer les URLs, comme ça elles ne sont écrites qu'à un endroit.
export const roomPath = (code: string, step: RoomStep = 'lobby'): string =>
  step === 'lobby' ? `/room/${code}` : `/room/${code}/${step}`;
