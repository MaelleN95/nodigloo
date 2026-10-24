import type { RankingEntry } from '@nodigloo/shared';
import type { Room } from './room.js';

// Classement commun à tous les jeux : meilleur score d'abord, et à égalité de score,
// même rang. L'ordre d'arrivée départage seulement l'affichage.
export const getRanking = (room: Room): RankingEntry[] => {
  const players = [...room.players.values()].sort(
    (first, second) =>
      second.score - first.score || first.joinedAt - second.joinedAt,
  );
  const ranking: RankingEntry[] = [];

  players.forEach((player, index) => {
    const previous = ranking[index - 1];
    ranking.push({
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      rank:
        previous && previous.score === player.score
          ? previous.rank
          : index + 1,
    });
  });

  return ranking;
};
