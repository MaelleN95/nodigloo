import type {
  QuestionReveal,
  QuestionStart,
  RoomPublic,
} from '@nodigloo/shared';
import type { PendingAction } from '../types';

type QuizScreenProps = {
  room: RoomPublic;
  question: QuestionStart | null;
  reveal: QuestionReveal | null;
  selectedChoice: number | null;
  secondsLeft: number;
  pending: PendingAction;
  isPlayerKnown: boolean;
  onAnswer: (choice: number) => void;
};

export function QuizScreen({
  room,
  question,
  reveal,
  selectedChoice,
  secondsLeft,
  pending,
  isPlayerKnown,
  onAnswer,
}: QuizScreenProps) {
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
                    selectedChoice !== null ||
                    reveal !== null ||
                    pending === 'answer'
                  }
                  onClick={() => onAnswer(index)}
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
