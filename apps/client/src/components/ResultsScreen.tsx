import type { RoomPublic } from '@nodigloo/shared';
import { useRoom } from '../context/RoomContext';
import { getFallbackRanking } from '../lib/ranking';
import { describeFinishedGame } from '../lib/results';

type ResultsScreenProps = {
  room: RoomPublic;
  playerId: string;
};

export function ResultsScreen({ room, playerId }: ResultsScreenProps) {
  const { ranking: serverRanking, leaveRoom } = useRoom();
  // Après une reconnexion tardive on n'a plus le classement du serveur : on le recalcule avec les scores de la salle.
  const ranking = serverRanking ?? getFallbackRanking(room);

  return (
    <section
      className="game-panel results-panel"
      aria-labelledby="results-title"
    >
      <p className="eyebrow">LA PARTIE EST TERMINÉE</p>
      <h1 id="results-title">Le classement du refuge</h1>
      <p className="description">{describeFinishedGame(room.settings)}</p>
      <ol className="ranking-list">
        {ranking.map((entry) => {
          const isMe = entry.playerId === playerId;

          return (
            <li
              className={isMe ? 'ranking-row ranking-row-me' : 'ranking-row'}
              key={entry.playerId}
              aria-current={isMe}
            >
              <span className="ranking-place">{entry.rank}</span>
              <span className="ranking-name">{entry.nickname}</span>
              <strong>{entry.score} pts</strong>
            </li>
          );
        })}
      </ol>
      <button
        className="button button-secondary finish-button"
        type="button"
        onClick={leaveRoom}
      >
        Terminer cette partie
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
