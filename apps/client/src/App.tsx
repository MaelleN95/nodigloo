import { useEffect, useState, type FormEvent } from 'react';
import { QUESTION_DURATION_MS } from '@nodigloo/shared';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { QuizScreen } from './components/QuizScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { useRoom } from './context/RoomContext';
import { getFallbackRanking } from './lib/ranking';
import { getServerError } from './lib/socketHelpers';
import './style.css';
import type { PendingAction } from './types';
import type { RoomPublic } from '@nodigloo/shared';
import type { StoredSession } from './lib/session';

export function App() {
  const {
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
    enterRoom,
    leaveRoom,
  } = useRoom();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(
    QUESTION_DURATION_MS / 1000,
  );
  const [pending, setPending] = useState<PendingAction>(null);

  // Une nouvelle question (ou une déconnexion) efface la réponse précédente.
  useEffect(() => {
    setSelectedChoice(null);
  }, [question]);

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

  const createRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending('create');

    try {
      const socket = await getSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:create', {
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      enterRoom(result.data);
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
      const socket = await getSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:join', {
        code: roomCode.trim().toUpperCase(),
        nickname: nickname.trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      enterRoom(result.data);
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
      const socket = await getSocket();
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
      const socket = await getSocket();
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

  const currentPlayer = room?.players.find(
    (player) => player.id === session?.playerId,
  );
  const isHost = Boolean(room && session && room.hostId === session.playerId);
  const finalRanking = ranking ?? (room ? getFallbackRanking(room) : []);

  // Pas de salle (URL tapée à la main, session expirée) : retour à l'accueil, sauf si on est en train de reprendre la session.
  const inRoom = (
    render: (room: RoomPublic, session: StoredSession) => JSX.Element,
  ) => {
    if (room && session) {
      return render(room, session);
    }
    return resuming ? null : <Navigate to="/" replace />;
  };

  return (
    <main className="shell">
      <Header connectionState={connectionState} />

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <HomeScreen
              nickname={nickname}
              roomCode={roomCode}
              pending={resuming ? 'resume' : pending}
              onNicknameChange={setNickname}
              onRoomCodeChange={setRoomCode}
              onCreate={createRoom}
              onJoin={joinRoom}
            />
          }
        />
        <Route
          path="/room/:code"
          element={inRoom((currentRoom, currentSession) => (
            <LobbyScreen
              room={currentRoom}
              playerId={currentSession.playerId}
              isHost={isHost}
              pending={pending}
              onStart={() => void startGame()}
            />
          ))}
        />
        <Route
          path="/room/:code/quiz"
          element={inRoom((currentRoom) => (
            <QuizScreen
              room={currentRoom}
              question={question}
              reveal={reveal}
              selectedChoice={selectedChoice}
              secondsLeft={secondsLeft}
              pending={pending}
              isPlayerKnown={Boolean(currentPlayer)}
              onAnswer={(choice) => void submitAnswer(choice)}
            />
          ))}
        />
        <Route
          path="/room/:code/results"
          element={inRoom((_currentRoom, currentSession) => (
            <ResultsScreen
              ranking={finalRanking}
              playerId={currentSession.playerId}
              onFinish={leaveRoom}
            />
          ))}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </main>
  );
}
