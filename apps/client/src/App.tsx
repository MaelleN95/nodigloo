import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  QUESTION_DURATION_MS,
  type Ack,
  type JoinedRoom,
  type QuestionReveal,
  type QuestionStart,
  type RankingEntry,
  type RoomPublic,
} from '@nodigloo/shared';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { QuizScreen } from './components/QuizScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { getFallbackRanking } from './lib/ranking';
import {
  readStoredSession,
  removeSavedSession,
  saveSession,
  type StoredSession,
} from './lib/session';
import { createNodiglooSocket, type NodiglooSocket } from './socket';
import './style.css';
import type { ConnectionState, PendingAction, Screen } from './types';

const getServerError = (error: unknown): string => {
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return 'Le serveur met trop de temps à répondre. Réessaie dans un instant.';
  }

  return 'Impossible de joindre le serveur. Vérifie qu’il est démarré puis réessaie.';
};

const connectSocket = (socket: NodiglooSocket): Promise<void> => {
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

export function App() {
  const socketRef = useRef<NodiglooSocket | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [question, setQuestion] = useState<QuestionStart | null>(null);
  const [reveal, setReveal] = useState<QuestionReveal | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(
    QUESTION_DURATION_MS / 1000,
  );
  const [pending, setPending] = useState<PendingAction>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const showJoinedRoom = (joined: JoinedRoom) => {
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

    const player = joined.room.players.find(
      (entry) => entry.id === storedSession.playerId,
    );
    if (player) {
      setNickname(player.nickname);
    }

    if (!saveSession(storedSession)) {
      setError(
        'La salle est ouverte, mais le navigateur ne pourra pas mémoriser ta session après fermeture.',
      );
    }

    if (joined.room.status === 'playing') {
      setScreen('quiz');
    } else if (joined.room.status === 'results') {
      setScreen('results');
    } else {
      setScreen('lobby');
    }
  };

  const resumeSession = async (
    socket: NodiglooSocket,
    storedSession: StoredSession,
  ) => {
    setPending('resume');
    try {
      const result: Ack<JoinedRoom> = await socket
        .timeout(8_000)
        .emitWithAck('session:resume', storedSession);

      if (!result.ok) {
        sessionRef.current = null;
        setSession(null);
        setRoom(null);
        setQuestion(null);
        setScreen('home');
        const cleared = removeSavedSession();
        setError(
          cleared
            ? result.error.message
            : `${result.error.message} Le navigateur n’a pas pu effacer la session locale.`,
        );
        return;
      }

      showJoinedRoom(result.data);
      setError(null);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending((current) => (current === 'resume' ? null : current));
    }
  };

  useEffect(() => {
    const socket = createNodiglooSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      const savedSession = sessionRef.current;
      if (savedSession) {
        void resumeSession(socket, savedSession);
      }
    });
    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      if (sessionRef.current) {
        setQuestion(null);
        setReveal(null);
        setSelectedChoice(null);
      }
    });
    socket.on('connect_error', () => setConnectionState('disconnected'));
    socket.on('room:updated', (updatedRoom) => setRoom(updatedRoom));
    socket.on('question:started', (startedQuestion) => {
      setQuestion(startedQuestion);
      setReveal(null);
      setSelectedChoice(null);
      setScreen('quiz');
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
      setScreen('results');
    });

    const saved = readStoredSession();
    if (saved.error) {
      setError(saved.error);
    }
    if (saved.session) {
      sessionRef.current = saved.session;
      setSession(saved.session);
      setPending('resume');
      socket.connect();
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!question || reveal) {
      return;
    }

    const localDeadline =
      performance.now() + Math.max(0, question.endsAt - question.serverNow);
    const updateCountdown = () => {
      setSecondsLeft(
        Math.max(0, Math.ceil((localDeadline - performance.now()) / 1000)),
      );
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [question, reveal]);

  const getCurrentSocket = async (): Promise<NodiglooSocket> => {
    const socket = socketRef.current;
    if (!socket) {
      throw new Error('La connexion au serveur n’est pas disponible.');
    }
    await connectSocket(socket);
    return socket;
  };

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending('create');

    try {
      const socket = await getCurrentSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:create', {
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      showJoinedRoom(result.data);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending(null);
    }
  };

  const joinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending('join');

    try {
      const socket = await getCurrentSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:join', {
        code: roomCode.trim().toUpperCase(),
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      showJoinedRoom(result.data);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending(null);
    }
  };

  const startGame = async () => {
    setError(null);
    setPending('start');
    try {
      const socket = await getCurrentSocket();
      const result = await socket.timeout(8_000).emitWithAck('game:start');
      if (!result.ok) {
        setError(result.error.message);
      }
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending(null);
    }
  };

  const submitAnswer = async (choice: number) => {
    if (!question || selectedChoice !== null || pending === 'answer') {
      return;
    }

    setError(null);
    setPending('answer');
    try {
      const socket = await getCurrentSocket();
      const result = await socket
        .timeout(8_000)
        .emitWithAck('quiz:answer:submit', {
          questionId: question.question.id,
          choice,
        });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSelectedChoice(choice);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setPending(null);
    }
  };

  const finishGame = () => {
    socketRef.current?.disconnect();
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    setQuestion(null);
    setReveal(null);
    setRanking(null);
    setSelectedChoice(null);
    setScreen('home');
    setError(null);
    if (!removeSavedSession()) {
      setError('Le navigateur n’a pas pu effacer la session locale.');
    }
  };

  const currentPlayer = room?.players.find(
    (player) => player.id === session?.playerId,
  );
  const isHost = Boolean(room && session && room.hostId === session.playerId);
  const finalRanking = ranking ?? (room ? getFallbackRanking(room) : []);

  return (
    <main className="shell">
      <Header connectionState={connectionState} />

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {screen === 'home' && (
        <HomeScreen
          nickname={nickname}
          roomCode={roomCode}
          pending={pending}
          onNicknameChange={setNickname}
          onRoomCodeChange={setRoomCode}
          onCreate={createRoom}
          onJoin={joinRoom}
        />
      )}

      {screen === 'lobby' && room && session && (
        <LobbyScreen
          room={room}
          playerId={session.playerId}
          isHost={isHost}
          pending={pending}
          onStart={() => void startGame()}
        />
      )}

      {screen === 'quiz' && room && (
        <QuizScreen
          room={room}
          question={question}
          reveal={reveal}
          selectedChoice={selectedChoice}
          secondsLeft={secondsLeft}
          pending={pending}
          isPlayerKnown={Boolean(currentPlayer)}
          onAnswer={(choice) => void submitAnswer(choice)}
        />
      )}

      {screen === 'results' && room && (
        <ResultsScreen
          ranking={finalRanking}
          playerId={session?.playerId}
          onFinish={finishGame}
        />
      )}

      <Footer />
    </main>
  );
}
