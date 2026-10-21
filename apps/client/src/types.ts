export type PendingAction =
  | 'create'
  | 'join'
  | 'start'
  | 'answer'
  | 'resume'
  | null;

export type ConnectionState = 'disconnected' | 'connected';
