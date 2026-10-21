import type { RankingEntry } from '@nodigloo/shared';

type ResultsScreenProps = {
  ranking: RankingEntry[];
  playerId: string | undefined;
  onFinish: () => void;
};

export function ResultsScreen({
  ranking,
  playerId,
  onFinish,
}: ResultsScreenProps) {
  return (
    <section
      className="game-panel results-panel"
      aria-labelledby="results-title"
    >
      <p className="eyebrow">LA PARTIE EST TERMINÉE</p>
      <h1 id="results-title">Le classement du refuge</h1>
      <p className="description">
        Cinq questions, quelques surprises et un joli moment partagé.
      </p>
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
        onClick={onFinish}
      >
        Terminer cette partie
        <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
