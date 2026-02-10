import { useState } from 'react';
import { useSimulatorStore } from '../simulation/store';
import './LessonContent.css';

export function LessonContent() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const lessonPhase = useSimulatorStore((s) => s.lessonPhase);

  if (!currentLesson) return null;

  if (lessonPhase === 'lecture') {
    return <LectureView />;
  }

  if (lessonPhase === 'quiz') {
    return <QuizView />;
  }

  return null;
}

function LectureView() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const startQuiz = useSimulatorStore((s) => s.startQuiz);

  if (!currentLesson) return null;

  return (
    <div className="lesson-content">
      <div className="lesson-content-scroll">
        <div className="lecture-header">
          <h2>Lesson {currentLesson.id}: {currentLesson.title}</h2>
          <p className="lecture-subtitle">{currentLesson.description}</p>
        </div>

        {currentLesson.lecture.sections.map((section, i) => (
          <div key={i} className="lecture-section">
            <h3>{section.title}</h3>
            <div className="lecture-section-content">{section.content}</div>
            {section.diagram && (
              <pre className="lecture-diagram">{section.diagram}</pre>
            )}
            {section.keyTakeaway && (
              <div className="lecture-takeaway">{section.keyTakeaway}</div>
            )}
          </div>
        ))}
      </div>

      <div className="lesson-content-actions">
        <button className="btn-continue" onClick={startQuiz}>
          Continue to Quiz &rarr;
        </button>
      </div>
    </div>
  );
}

function QuizView() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const quizIndex = useSimulatorStore((s) => s.quizIndex);
  const quizAnswers = useSimulatorStore((s) => s.quizAnswers);
  const quizRevealed = useSimulatorStore((s) => s.quizRevealed);
  const submitQuizAnswer = useSimulatorStore((s) => s.submitQuizAnswer);
  const nextQuizQuestion = useSimulatorStore((s) => s.nextQuizQuestion);
  const startPractice = useSimulatorStore((s) => s.startPractice);

  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  if (!currentLesson) return null;

  const quiz = currentLesson.quiz;
  const totalQuestions = quiz.length;
  const isFinished = quizAnswers.length === totalQuestions;

  // Show score summary after all questions answered
  if (isFinished) {
    const correctCount = quizAnswers.filter((a) => a.correct).length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    const scoreClass = percentage >= 75 ? 'great' : percentage >= 50 ? 'okay' : 'needs-work';

    return (
      <div className="lesson-content">
        <div className="lesson-content-scroll">
          <div className="quiz-score">
            <h3>Quiz Complete!</h3>
            <div className={`quiz-score-value ${scoreClass}`}>
              {correctCount}/{totalQuestions}
            </div>
            <div className="quiz-score-label">
              {percentage >= 75
                ? "Great understanding! You're ready for hands-on practice."
                : percentage >= 50
                ? 'Good effort! The practice section will help reinforce these concepts.'
                : "Don't worry -- the practice section will help solidify these concepts."}
            </div>

            <div className="quiz-progress-bar" style={{ justifyContent: 'center', marginBottom: 24 }}>
              {quizAnswers.map((a, i) => (
                <div
                  key={i}
                  className={`quiz-progress-dot ${a.correct ? 'correct' : 'incorrect'}`}
                />
              ))}
            </div>

            <button className="btn-start-practice" onClick={startPractice}>
              Start Practice &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = quiz[quizIndex];

  const handleSubmit = () => {
    if (selectedChoice === null) return;
    submitQuizAnswer(selectedChoice);
  };

  const handleNext = () => {
    setSelectedChoice(null);
    nextQuizQuestion();
  };

  return (
    <div className="lesson-content">
      <div className="lesson-content-scroll">
        <div className="quiz-header">
          <h2>{currentLesson.title}: Quiz</h2>
          <div className="quiz-progress">
            Question {quizIndex + 1} of {totalQuestions}
          </div>
          <div className="quiz-progress-bar">
            {quiz.map((_, i) => {
              let cls = 'quiz-progress-dot';
              if (i < quizAnswers.length) {
                cls += quizAnswers[i].correct ? ' correct' : ' incorrect';
              } else if (i === quizIndex) {
                cls += ' current';
              }
              return <div key={i} className={cls} />;
            })}
          </div>
        </div>

        <div className="quiz-question">{question.question}</div>

        <div className="quiz-choices">
          {question.choices.map((choice, i) => {
            let cls = 'quiz-choice';
            if (quizRevealed) {
              cls += ' disabled';
              if (i === question.correctIndex) cls += ' correct-answer';
              if (i === selectedChoice && i !== question.correctIndex) cls += ' wrong-answer';
            } else if (i === selectedChoice) {
              cls += ' selected';
            }

            return (
              <label key={i} className={cls}>
                <input
                  type="radio"
                  name="quiz-choice"
                  checked={selectedChoice === i}
                  onChange={() => !quizRevealed && setSelectedChoice(i)}
                  disabled={quizRevealed}
                />
                {choice}
              </label>
            );
          })}
        </div>

        {quizRevealed && (
          <div className="quiz-explanation">
            <div className={`quiz-verdict ${quizAnswers[quizAnswers.length - 1]?.correct ? 'correct' : 'incorrect'}`}>
              {quizAnswers[quizAnswers.length - 1]?.correct ? 'Correct!' : 'Incorrect'}
            </div>
            <div className="quiz-explanation-text">{question.explanation}</div>
          </div>
        )}
      </div>

      <div className="lesson-content-actions">
        {!quizRevealed ? (
          <button
            className="btn-continue"
            onClick={handleSubmit}
            disabled={selectedChoice === null}
            style={{ opacity: selectedChoice === null ? 0.5 : 1 }}
          >
            Submit Answer
          </button>
        ) : (
          <button className="btn-continue" onClick={handleNext}>
            {quizIndex + 1 >= totalQuestions ? 'See Results' : 'Next Question \u2192'}
          </button>
        )}
      </div>
    </div>
  );
}
