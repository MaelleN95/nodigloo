import { useEffect, useState } from 'react';
import { QUESTION_DURATION_MS, type RoomPublic } from '@nodigloo/shared';
import { useRoom } from '../context/RoomContext';
import { getServerError } from '../lib/socketHelpers';

type QuizScreenProps = {
  room: RoomPublic;
  playerId: string;
};

export function QuizScreen({ room, playerId }: QuizScreenProps) {
  const { question, reveal, setError, getSocket } = useRoom();
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_DURATION_MS / 1000);
  const [sending, setSending] = useState(false);
  const isPlayerKnown = room.players.some((player) => player.id === playerId);

  // Une nouvelle question (ou une déconnexion) efface la réponse précédente.
  useEffect(() => {
    setSelectedChoice(null);
  }, [question]);

  useEffect(() => {
    if (!question || reveal) {
      return;
    }

    const localDeadline =
      performance.now() + Math.max(0, question.endsAt - question.serverNow);
    const updateCountdown = () => {
      setSecondsLeft(
        Math.max(0, Math.ceil((localDeadline - performance.now()) / 1000)),
      );
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [question, reveal]);

  const submitAnswer = async (choice: number) => {
    if (!question || selectedChoice !== null || sending) {
      return;
    }

    setError(null);
    setSending(true);
    try {
      const socket = await getSocket();
      const result = await socket
        .timeout(8_000)
        .emitWithAck('quiz:answer:submit', {
          questionId: question.question.id,
          choice,
        });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSelectedChoice(choice);
    } catch (caught) {
      setError(getServerError(caught));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="game-panel quiz-panel" aria-labelledby="quiz-title">
      <div className="quiz-heading">
        <div>
          <p className="eyebrow">LE QUIZ DU REFUGE</p>
          <p className="question-count">
            Question{' '}
            {question
              ? `${question.questionNumber} / ${question.totalQuestions}`
              : ''}
          </p>
        </div>
        {question && !reveal && (
          <div
            className={`timer ${secondsLeft <= 5 ? 'timer-urgent' : ''}`}
            role="timer"
            aria-label={`${secondsLeft} secondes restantes`}
          >
            00:{String(secondsLeft).padStart(2, '0')}
          </div>
        )}
      </div>

      {question ? (
        <>
          <h1 id="quiz-title" className="question-title">
            {question.question.text}
          </h1>
          <div className="choice-grid">
            {question.question.choices.map((choice, index) => {
              const isCorrect = reveal?.correctChoice === index;
              const isSelected = selectedChoice === index;
              const choiceClass = isCorrect
                ? 'choice-button choice-correct'
                : reveal && isSelected
                  ? 'choice-button choice-incorrect'
                  : isSelected
                    ? 'choice-button choice-selected'
                    : 'choice-button';

              return (
                <button
                  className={choiceClass}
                  key={`${question.question.id}-${index}`}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={
                    selectedChoice !== null || reveal !== null || sending
                  }
                  onClick={() => void submitAnswer(index)}
                >
                  <span className="choice-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{choice}</span>
                  {isCorrect && (
                    <span className="choice-result">Bonne réponse</span>
                  )}
                  {isSelected && !reveal && (
                    <span className="choice-result">Ton choix</span>
                  )}
                </button>
              );
            })}
          </div>
          {reveal ? (
            <p className="answer-feedback" role="status">
              {selectedChoice === reveal.correctChoice
                ? 'Bien joué, bonne réponse !'
                : 'La bonne réponse est mise en évidence.'}
            </p>
          ) : (
            <p className="field-hint">
              {selectedChoice !== null
                ? 'Réponse enregistrée. On découvre la suite dans un instant.'
                : isPlayerKnown
                  ? 'Choisis une réponse avant la fin du temps.'
                  : 'Reconnexion à ta session…'}
            </p>
          )}
        </>
      ) : (
        <div className="question-wait" role="status">
          <span className="waiting-dot" />
          La prochaine question arrive…
        </div>
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
