import type { RoomPublic } from '@nodigloo/shared';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { QuizScreen } from './components/QuizScreen';
import { ReactionScreen } from './components/ReactionScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { useRoom } from './context/RoomContext';
import type { StoredSession } from './lib/session';
import './style.css';

export function App() {
  const { connectionState, session, room, resuming, error, setError } = useRoom();

  // Une nouvelle erreur relance le délai ; le bouton × permet de la fermer avant.
  useEffect(() => {
    if (!error) {
      return;
    }
    const timeout = window.setTimeout(() => setError(null), 6_000);
    return () => window.clearTimeout(timeout);
  }, [error, setError]);

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
        <div className="error-toast" role="alert">
          <p>{error}</p>
          <button
            className="error-toast-close"
            type="button"
            aria-label="Fermer le message d’erreur"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route
          path="/room/:code"
          element={inRoom((currentRoom, currentSession) => (
            <LobbyScreen
              room={currentRoom}
              playerId={currentSession.playerId}
            />
          ))}
        />
        <Route
          path="/room/:code/quiz"
          element={inRoom((currentRoom, currentSession) => (
            <QuizScreen
              room={currentRoom}
              playerId={currentSession.playerId}
            />
          ))}
        />
        <Route
          path="/room/:code/reaction"
          element={inRoom((currentRoom, currentSession) => (
            <ReactionScreen
              room={currentRoom}
              playerId={currentSession.playerId}
            />
          ))}
        />
        <Route
          path="/room/:code/results"
          element={inRoom((currentRoom, currentSession) => (
            <ResultsScreen
              room={currentRoom}
              playerId={currentSession.playerId}
            />
          ))}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </main>
  );
}
