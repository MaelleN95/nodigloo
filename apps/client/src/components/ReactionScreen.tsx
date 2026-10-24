import { useEffect, useRef, useState } from 'react';
import type { ReactionSubmission, RoomPublic } from '@nodigloo/shared';
import { useRoom } from '../context/RoomContext';
import { formatReactionResult, sortReactionResults } from '../lib/reaction';
import { getServerError } from '../lib/socketHelpers';

type ReactionScreenProps = {
  room: RoomPublic;
  playerId: string;
};

export function ReactionScreen({ room, playerId }: ReactionScreenProps) {
  const { reactionRound: round, reactionResults, setError, getSocket, serverNow } =
    useRoom();
  const [isGreen, setIsGreen] = useState(false);
  const [press, setPress] = useState<ReactionSubmission | null>(null);
  // Les refs sont lues au moment de l'appui : pas besoin d'attendre un nouveau rendu de React
  const greenShownAtRef = useRef<number | null>(null);
  const pressedRef = useRef(false);
  const isPlayerKnown = room.players.some((player) => player.id === playerId);
  const roundResults =
    round && reactionResults?.round === round.round ? reactionResults : null;

  useEffect(() => {
    setPress(null);
    setIsGreen(false);
    greenShownAtRef.current = null;
    pressedRef.current = false;
    if (!round) {
      return;
    }

    let frame = 0;
    const showGreen = () => {
      greenShownAtRef.current = performance.now();
      setIsGreen(true);
      // On recale le départ sur l'image où le vert est réellement dessiné
      frame = window.requestAnimationFrame(() => {
        greenShownAtRef.current = performance.now();
      });
    };

    // Le serveur donne l'heure du vert avec son horloge, serverNow() la ramène à celle de l'appareil
    const delayMs = round.greenAt - serverNow();
    const timeout = window.setTimeout(showGreen, Math.max(0, delayMs));
    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
    };
    // serverNow change à chaque rendu mais lit toujours le même décalage : seule la manche compte ici
  }, [round]);

  const react = async () => {
    const pressedAt = performance.now();
    if (!round || roundResults || pressedRef.current || !isPlayerKnown) {
      return;
    }
    pressedRef.current = true;

    const greenShownAt = greenShownAtRef.current;
    const submission: ReactionSubmission =
      greenShownAt === null
        ? { round: round.round, kind: 'false-start' }
        : {
            round: round.round,
            kind: 'reaction',
            reactionMs: Math.round(pressedAt - greenShownAt),
          };
    setPress(submission);

    try {
      const socket = await getSocket();
      const result = await socket
        .timeout(8_000)
        .emitWithAck('reaction:submit', submission);
      if (!result.ok) {
        setError(result.error.message);
      }
    } catch (caught) {
      setError(getServerError(caught));
    }
  };

  // L'écouteur clavier n'est posé qu'une fois : la ref lui donne toujours la version à jour de react
  const reactRef = useRef(react);
  reactRef.current = react;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) {
        return;
      }
      event.preventDefault();
      void reactRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const zoneState = press
    ? press.kind === 'false-start'
      ? 'false-start'
      : 'pressed'
    : isGreen
      ? 'green'
      : 'amber';

  const nicknameOf = (id: string) =>
    room.players.find((player) => player.id === id)?.nickname ?? 'Joueur parti';

  return (
    <section className="game-panel reaction-panel" aria-labelledby="reaction-title">
      <div className="quiz-heading">
        <div>
          <p className="eyebrow">LE JEU DE RÉACTION</p>
          <p className="question-count">
            Manche {round ? `${round.round} / ${round.totalRounds}` : ''}
          </p>
        </div>
      </div>

      <h1 id="reaction-title" className="reaction-title">
        {roundResults ? 'Les temps de la manche' : 'Tape dès que ça passe au vert'}
      </h1>

      {!round ? (
        <div className="question-wait" role="status">
          <span className="waiting-dot" />
          La prochaine manche arrive…
        </div>
      ) : roundResults ? (
        <ol className="reaction-results" aria-label="Temps de la manche">
          {sortReactionResults(roundResults.results).map((result) => (
            <li
              className={`reaction-result is-${result.outcome}`}
              key={result.playerId}
            >
              <span className="reaction-result-name">
                {nicknameOf(result.playerId)}
                {result.playerId === playerId && (
                  <span className="you-label">toi</span>
                )}
              </span>
              <span className="reaction-result-time">
                {formatReactionResult(result)}
              </span>
              <strong>+{result.points}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <button
          className={`reaction-zone is-${zoneState}`}
          type="button"
          disabled={!isPlayerKnown}
          onPointerDown={(event) => {
            event.preventDefault();
            void react();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.repeat) {
              event.preventDefault();
              void react();
            }
          }}
        >
          <span className="reaction-zone-label" role="status" aria-live="assertive">
            {zoneState === 'amber' && 'Attends le vert…'}
            {zoneState === 'green' && 'Maintenant !'}
            {zoneState === 'pressed' &&
              press?.kind === 'reaction' &&
              `${press.reactionMs} ms`}
            {zoneState === 'false-start' && 'Faux départ'}
          </span>
          <span className="reaction-zone-hint">
            {zoneState === 'amber' && 'Taper avant le vert compte comme un faux départ.'}
            {zoneState === 'green' && 'Espace, clic ou toucher.'}
            {zoneState === 'pressed' && 'Envoyé ! On attend les autres…'}
            {zoneState === 'false-start' && 'Pas de point pour cette manche.'}
          </span>
        </button>
      )}

      {!roundResults && (
        <p className="field-hint">
          {isPlayerKnown
            ? 'Espace, clic ou toucher : à toi de choisir.'
            : 'Reconnexion à ta session…'}
        </p>
      )}

      <div className="quiz-players">
        {room.players.map((player) => (
          <span className="quiz-player" key={player.id}>
            {player.nickname}
            <strong>{player.score} pts</strong>
          </span>
        ))}
      </div>
    </section>
  );
}
