import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  Ack,
  ClockPong,
  JoinedRoom,
  QuestionReveal,
  QuestionStart,
  RankingEntry,
  RoomPublic,
} from '@nodigloo/shared';
import { measureClockOffset } from '../lib/clock';
import { roomPath, type RoomStep } from '../lib/routes';
import {
  readStoredSession,
  removeSavedSession,
  saveSession,
  type StoredSession,
} from '../lib/session';
import { connectSocket, getServerError, type ConnectionOptions } from '../lib/socketHelpers';
import { createNodiglooSocket, type NodiglooSocket } from '../socket';
import type { ConnectionState } from '../types';

type RoomContextValue = {
  connectionState: ConnectionState;
  session: StoredSession | null;
  room: RoomPublic | null;
  question: QuestionStart | null;
  reveal: QuestionReveal | null;
  ranking: RankingEntry[] | null;
  resuming: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  getSocket: (options?: ConnectionOptions) => Promise<NodiglooSocket>;
  // Heure du serveur vue depuis cet appareil, pour démarrer les manches en même temps chez tout le monde
  serverNow: () => number;
  enterRoom: (joined: JoinedRoom) => void;
  leaveRoom: () => void;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  // Les écouteurs Socket.IO sont créés une seule fois : la ref leur donne toujours le navigate à jour.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const socketRef = useRef<NodiglooSocket | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  // Écart en ms entre l'horloge du serveur et celle de l'appareil, mesuré à chaque connexion
  const clockOffsetRef = useRef(0);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [question, setQuestion] = useState<QuestionStart | null>(null);
  const [reveal, setReveal] = useState<QuestionReveal | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null);
  // Si une session est mémorisée, on attend sa reprise avant de juger l'URL (sinon on renverrait à l'accueil).
  const [resuming, setResuming] = useState(() =>
    Boolean(readStoredSession().session),
  );
  const [error, setError] = useState<string | null>(null);

  const goToRoom = (code: string, step: RoomStep) => {
    navigateRef.current(roomPath(code, step));
  };

  const enterRoom = (joined: JoinedRoom) => {
    const storedSession: StoredSession = {
      code: joined.room.code,
      ...joined.session,
    };
    sessionRef.current = storedSession;
    setSession(storedSession);
    setRoom(joined.room);
    setQuestion(null);
    setReveal(null);
    setRanking(null);

    if (!saveSession(storedSession)) {
      setError(
        'La salle est ouverte, mais le navigateur ne pourra pas mémoriser ta session après fermeture.',
      );
    }

    if (joined.room.status === 'playing') {
      goToRoom(storedSession.code, 'quiz');
    } else if (joined.room.status === 'results') {
      goToRoom(storedSession.code, 'results');
    } else {
      goToRoom(storedSession.code, 'lobby');
    }
  };

  const resumeSession = async (
    socket: NodiglooSocket,
    storedSession: StoredSession,
  ) => {
    setResuming(true);
    try {
      const result: Ack<JoinedRoom> = await socket
        .timeout(8_000)
        .emitWithAck('session:resume', storedSession);

      if (!result.ok) {
        sessionRef.current = null;
        setSession(null);
        setRoom(null);
        setQuestion(null);
        navigateRef.current('/');
        const cleared = removeSavedSession();
        setError(
          cleared
            ? result.error.message
            : `${result.error.message} Le navigateur n’a pas pu effacer la session locale.`,
        );
        return;
      }

      enterRoom(result.data);
      setError(null);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setResuming(false);
    }
  };

  const syncClock = async (socket: NodiglooSocket) => {
    try {
      clockOffsetRef.current = await measureClockOffset(async () => {
        const result: Ack<ClockPong> = await socket
          .timeout(2_000)
          .emitWithAck('clock:ping');
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        return result.data.serverTime;
      });
    } catch {
      // Sans mesure, on garde l'horloge de l'appareil : on peut jouer, c'est juste moins précis
    }
  };

  useEffect(() => {
    const socket = createNodiglooSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      void syncClock(socket);
      const savedSession = sessionRef.current;
      if (savedSession) {
        void resumeSession(socket, savedSession);
      }
    });
    socket.on('disconnect', (reason) => {
      // Une coupure volontaire ne doit pas passer pour une reconnexion
      const willRetry = reason !== 'io client disconnect';
      setConnectionState(
        willRetry && sessionRef.current ? 'reconnecting' : 'disconnected',
      );
      if (sessionRef.current) {
        setQuestion(null);
        setReveal(null);
      }
    });
    socket.on('connect_error', () => {
      setConnectionState(sessionRef.current ? 'reconnecting' : 'disconnected');
    });
    // Après toutes les tentatives automatiques, on arrête de promettre une reconnexion
    socket.io.on('reconnect_failed', () => setConnectionState('disconnected'));
    socket.on('room:updated', (updatedRoom) => setRoom(updatedRoom));
    socket.on('question:started', (startedQuestion) => {
      setQuestion(startedQuestion);
      setReveal(null);
      if (sessionRef.current) {
        goToRoom(sessionRef.current.code, 'quiz');
      }
    });
    socket.on('question:revealed', (questionReveal) => {
      setReveal(questionReveal);
      setRoom((currentRoom) =>
        currentRoom
          ? {
              ...currentRoom,
              players: currentRoom.players.map((player) => ({
                ...player,
                score: questionReveal.scores[player.id] ?? player.score,
              })),
            }
          : currentRoom,
      );
    });
    socket.on('game:finished', (finishedGame) => {
      setRanking(finishedGame.ranking);
      if (sessionRef.current) {
        goToRoom(sessionRef.current.code, 'results');
      }
    });

    const saved = readStoredSession();
    if (saved.error) {
      setError(saved.error);
    }
    if (saved.session) {
      sessionRef.current = saved.session;
      setSession(saved.session);
      socket.connect();
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const getSocket = async (options?: ConnectionOptions): Promise<NodiglooSocket> => {
    const socket = socketRef.current;
    if (!socket) {
      throw new Error('La connexion au serveur n’est pas disponible.');
    }
    await connectSocket(socket, options);
    return socket;
  };

  const serverNow = () => Date.now() + clockOffsetRef.current;

  const leaveRoom = () => {
    socketRef.current?.disconnect();
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    setQuestion(null);
    setReveal(null);
    setRanking(null);
    navigate('/');
    setError(null);
    if (!removeSavedSession()) {
      setError('Le navigateur n’a pas pu effacer la session locale.');
    }
  };

  return (
    <RoomContext.Provider
      value={{
        connectionState,
        session,
        room,
        question,
        reveal,
        ranking,
        resuming,
        error,
        setError,
        getSocket,
        serverNow,
        enterRoom,
        leaveRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom doit être utilisé à l’intérieur d’un RoomProvider.');
  }
  return context;
}
