import { useEffect, useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, type RoomPublic } from '@nodigloo/shared';
import { useRoom } from '../context/RoomContext';
import { getServerError } from '../lib/socketHelpers';

type LobbyScreenProps = {
  room: RoomPublic;
  playerId: string;
};

export function LobbyScreen({ room, playerId }: LobbyScreenProps) {
  const { setError, getSocket, leaveRoom } = useRoom();
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>(
    'idle',
  );
  const isHost = room.hostId === playerId;
  const connectedPlayers = room.players.filter(
    (player) => player.connected,
  ).length;

  useEffect(() => {
    if (copyState !== 'copied') {
      return;
    }
    const timeout = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyRoomCode = async () => {
    if (copyState === 'copying') {
      return;
    }
    setCopyState('copying');
    const copyFailed = () => {
      setCopyState('idle');
      setError(
        `Impossible de copier le code. Sélectionne-le et copie-le manuellement : ${room.code}.`,
      );
    };
    try {
      if (!navigator.clipboard?.writeText) {
        copyFailed();
        return;
      }
      await navigator.clipboard.writeText(room.code);
      setCopyState('copied');
    } catch {
      copyFailed();
    }
  };

  const quitLobby = async () => {
    if (starting || leaving) {
      return;
    }
    setError(null);
    setLeaving(true);
    try {
      const socket = await getSocket();
      const result = await socket.timeout(8_000).emitWithAck('room:leave');
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      leaveRoom();
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setLeaving(false);
    }
  };

  const startGame = async () => {
    if (starting || leaving) {
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const socket = await getSocket();
      const result = await socket.timeout(8_000).emitWithAck('game:start');
      if (!result.ok) {
        setError(result.error.message);
      }
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="game-panel" aria-labelledby="lobby-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LA SALLE EST OUVERTE</p>
          <h1 id="lobby-title">
            {isHost ? 'Les invités arrivent.' : 'Tu es au chaud.'}
          </h1>
        </div>
        <div
          className="room-code-copy"
          onClick={(event) => {
            const selection = window.getSelection();
            if (
              event.detail > 0 &&
              selection &&
              !selection.isCollapsed &&
              selection.containsNode(event.currentTarget, true)
            ) {
              return;
            }
            void copyRoomCode();
          }}
        >
          <div className="room-code-block">
            <span>CODE DE LA SALLE</span>
            <strong>{room.code}</strong>
            <button
              className="room-code-action"
              type="button"
              disabled={copyState === 'copying'}
              aria-label={`Copier le code de la salle : ${room.code}`}
            >
              {copyState === 'copying' ? 'Copie…' : 'Copier le code'}
            </button>
          </div>
          {copyState === 'copied' && (
            <span className="room-code-tooltip" role="status">
              Code copié
            </span>
          )}
        </div>
      </div>
      <p className="description">
        {isHost
          ? 'Partage le code avec tes amis. La partie peut commencer dès que vous êtes au moins deux.'
          : 'La salle est prête. L’hôte lancera la partie quand tout le monde sera arrivé.'}
      </p>

      <div className="players-heading">
        <h2>Autour du feu</h2>
        <span>
          {connectedPlayers} / {MAX_PLAYERS} connectés
        </span>
      </div>
      <ul className="player-list" aria-label="Joueurs dans la salle">
        {room.players.map((player) => (
          <li className="player-row" key={player.id}>
            <span className="player-avatar" aria-hidden="true">
              {player.nickname.slice(0, 1).toUpperCase()}
            </span>
            <span className="player-name">
              {player.nickname}
              {player.id === playerId && <span className="you-label">toi</span>}
            </span>
            {player.id === room.hostId && (
              <span className="host-label">HÔTE</span>
            )}
            <span
              className={`player-status ${player.connected ? 'is-online' : ''}`}
            >
              {player.connected ? 'En salle' : 'Reconnexion…'}
            </span>
          </li>
        ))}
      </ul>

      {isHost ? (
        <div className="lobby-action">
          <button
            className="button button-primary"
            type="button"
            onClick={() => void startGame()}
            disabled={starting || leaving || connectedPlayers < MIN_PLAYERS}
          >
            {starting ? 'Préparation…' : 'Lancer la partie'}
            <span aria-hidden="true">↗</span>
          </button>
          {connectedPlayers < MIN_PLAYERS && (
            <p className="field-hint">
              Il faut au moins deux joueurs connectés.
            </p>
          )}
        </div>
      ) : (
        <p className="waiting-note" role="status">
          <span className="waiting-dot" />
          En attente du lancement par l’hôte…
        </p>
      )}
      <div className="lobby-back">
        <button
          className="lobby-back-button"
          type="button"
          onClick={() => void quitLobby()}
          disabled={starting || leaving}
        >
          <span aria-hidden="true">←</span>
          {leaving ? 'Sortie…' : 'Retour à l’accueil'}
        </button>
        <p className="field-hint">
          Tu quittes la salle et libères ta place.
          {isHost &&
            room.players.length > 1 &&
            ' Un autre joueur reprendra le rôle d’hôte.'}
        </p>
      </div>
    </section>
  );
}
