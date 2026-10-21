import { MAX_PLAYERS, MIN_PLAYERS, type RoomPublic } from '@nodigloo/shared';
import type { PendingAction } from '../types';

type LobbyScreenProps = {
  room: RoomPublic;
  playerId: string;
  isHost: boolean;
  pending: PendingAction;
  onStart: () => void;
};

export function LobbyScreen({
  room,
  playerId,
  isHost,
  pending,
  onStart,
}: LobbyScreenProps) {
  const connectedPlayers = room.players.filter(
    (player) => player.connected,
  ).length;

  return (
    <section className="game-panel" aria-labelledby="lobby-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LA SALLE EST OUVERTE</p>
          <h1 id="lobby-title">
            {isHost ? 'Les invités arrivent.' : 'Tu es au chaud.'}
          </h1>
        </div>
        <div className="room-code-block">
          <span>CODE DE LA SALLE</span>
          <strong>{room.code}</strong>
        </div>
      </div>
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
            onClick={onStart}
            disabled={pending !== null || connectedPlayers < MIN_PLAYERS}
          >
            {pending === 'start' ? 'Préparation…' : 'Lancer le quiz'}
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
