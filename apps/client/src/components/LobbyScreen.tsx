import { useEffect, useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, type RoomPublic } from '@nodigloo/shared';
import { useRoom } from '../context/RoomContext';
import { getServerError } from '../lib/socketHelpers';

type LobbyScreenProps = {
  room: RoomPublic;
  playerId: string;
};

export function LobbyScreen({ room, playerId }: LobbyScreenProps) {
  const { setError, getSocket } = useRoom();
  const [starting, setStarting] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
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
    try {
      if (!navigator.clipboard?.writeText) {
        setCopyState('failed');
        return;
      }
      await navigator.clipboard.writeText(room.code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const startGame = async () => {
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
      {copyState === 'failed' && (
        <p className="notice notice-error" role="alert">
          Impossible de copier le code. Sélectionne-le et copie-le manuellement : {room.code}.
        </p>
      )}
      <p className="description">
        {isHost
          ? 'Partage le code avec tes amis. Le quiz peut commencer dès que vous êtes au moins deux.'
          : 'La salle est prête. L’hôte lancera le quiz quand tout le monde sera arrivé.'}
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
              {player.id === playerId && (
                <span className="you-label">toi</span>
              )}
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
            disabled={starting || connectedPlayers < MIN_PLAYERS}
          >
            {starting ? 'Préparation…' : 'Lancer le quiz'}
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
    </section>
  );
}
