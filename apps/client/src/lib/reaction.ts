import type { ReactionResult } from '@nodigloo/shared';

export const formatReactionResult = (result: ReactionResult): string => {
  if (result.outcome === 'reaction' && result.reactionMs !== null) {
    return `${result.reactionMs} ms`;
  }
  return result.outcome === 'false-start' ? 'Faux départ' : 'Pas de réponse';
};

const outcomeOrder: Record<ReactionResult['outcome'], number> = {
  reaction: 0,
  'false-start': 1,
  missed: 2,
};

// Les plus rapides d'abord, puis les faux départs, puis ceux qui n'ont pas joué
export const sortReactionResults = (
  results: ReactionResult[],
): ReactionResult[] =>
  [...results].sort(
    (first, second) =>
      outcomeOrder[first.outcome] - outcomeOrder[second.outcome] ||
      (first.reactionMs ?? 0) - (second.reactionMs ?? 0),
  );
