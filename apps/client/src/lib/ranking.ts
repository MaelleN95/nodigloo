import type { RankingEntry, RoomPublic } from '@nodigloo/shared';

export const getFallbackRanking = (room: RoomPublic): RankingEntry[] => {
  const players = [...room.players].sort(
    (first, second) => second.score - first.score,
  );

  let rank = 0;
  let previousScore: number | undefined;

  return players.map((player, index) => {
    if (player.score !== previousScore) {
      rank = index + 1;
      previousScore = player.score;
    }

    return {
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      rank,
    };
  });
};
