import { useEffect, useState } from 'react';
import {
  DEFAULT_ROUNDS,
  type GameSettings,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MIN_ROUNDS,
  type RoomPublic,
} from '@nodigloo/shared';
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied'>(
    'idle',
  );
  const isHost = room.hostId === playerId;
  // Un serveur pas encore mis à jour n'envoie pas les réglages : on affiche ceux par défaut
  // plutôt que de faire planter tout l'écran.
  const settings: GameSettings = room.settings ?? {
    game: 'quiz',
    rounds: DEFAULT_ROUNDS,
  };
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

  // Pas de mise à jour locale : on attend le room:updated du serveur, comme les invités
  const changeRounds = async (rounds: number) => {
    if (savingSettings || starting || leaving) {
      return;
    }
    setError(null);
    setSavingSettings(true);
    try {
      const socket = await getSocket();
      const result = await socket
        .timeout(8_000)
        .emitWithAck('room:settings:update', { ...settings, rounds });
      if (!result.ok) {
        setError(result.error.message);
      }
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setSavingSettings(false);
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

      <div className="players-heading">
        <h2>Réglages de la partie</h2>
        {!isHost && <span>Choisis par l’hôte</span>}
      </div>
      <dl className="settings-list">
        <div className="settings-row">
          <dt>Jeu</dt>
          <dd>Quiz</dd>
        </div>
        <div className="settings-row">
          <dt id="rounds-label">Manches</dt>
          <dd>
            {isHost ? (
              <div className="rounds-stepper" role="group" aria-labelledby="rounds-label">
                <button
                  type="button"
                  aria-label="Une manche de moins"
                  onClick={() => void changeRounds(settings.rounds - 1)}
                  disabled={savingSettings || starting || leaving || settings.rounds <= MIN_ROUNDS}
                >
                  −
                </button>
                <output aria-live="polite">{settings.rounds}</output>
                <button
                  type="button"
                  aria-label="Une manche de plus"
                  onClick={() => void changeRounds(settings.rounds + 1)}
                  disabled={savingSettings || starting || leaving || settings.rounds >= MAX_ROUNDS}
                >
                  +
                </button>
              </div>
            ) : (
              settings.rounds
            )}
          </dd>
        </div>
      </dl>

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
