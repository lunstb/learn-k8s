import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSimulatorStore } from '../simulation/store';
import { glossary } from '../glossary';
import { GlossaryTooltip } from './GlossaryTooltip';
import './LessonContent.css';

// Build glossary regex once — sorted longest-first to avoid partial matches
const glossaryTerms = Object.keys(glossary).sort((a, b) => b.length - a.length);
const glossaryPattern = glossaryTerms.length > 0
  ? new RegExp(`\\b(${glossaryTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g')
  : null;

function parseInlineFormatting(text: string): ReactNode[] {
  // Phase 1: split on **bold** and `code` spans
  const tokenPattern = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  const segments: { type: 'plain' | 'strong' | 'code'; text: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'plain', text: text.slice(lastIndex, match.index) });
    }
    if (match[2] != null) {
      segments.push({ type: 'strong', text: match[2] });
    } else if (match[3] != null) {
      segments.push({ type: 'code', text: match[3] });
    }
    lastIndex = tokenPattern.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'plain', text: text.slice(lastIndex) });
  }

  // Phase 2: annotate glossary terms in plain-text segments (first occurrence only)
  const seen = new Set<string>();
  let key = 0;
  const result: ReactNode[] = [];

  for (const seg of segments) {
    if (seg.type === 'strong') {
      result.push(<strong key={key++}>{seg.text}</strong>);
    } else if (seg.type === 'code') {
      result.push(<code key={key++} className="inline-code">{seg.text}</code>);
    } else {
      // plain text — scan for glossary terms
      if (!glossaryPattern) {
        result.push(seg.text);
        continue;
      }
      glossaryPattern.lastIndex = 0;
      let plainLast = 0;
      let gmatch: RegExpExecArray | null;
      while ((gmatch = glossaryPattern.exec(seg.text)) !== null) {
        const term = gmatch[1];
        if (seen.has(term)) continue;
        seen.add(term);
        if (gmatch.index > plainLast) {
          result.push(seg.text.slice(plainLast, gmatch.index));
        }
        result.push(
          <GlossaryTooltip key={key++} term={term} definition={glossary[term]}>
            {term}
          </GlossaryTooltip>
        );
        plainLast = glossaryPattern.lastIndex;
      }
      if (plainLast < seg.text.length) {
        result.push(seg.text.slice(plainLast));
      }
    }
  }

  return result;
}

function renderLectureContent(content: string): ReactNode[] {
  const lines = content.split('\n');
  const blocks: { type: 'prose' | 'code' | 'list'; text: string; items?: string[] }[] = [];
  let currentLines: string[] = [];
  let currentType: 'prose' | 'code' | 'list' | null = null;

  const isListLine = (line: string) => /^\d+\.\s/.test(line) || /^[-*]\s/.test(line);

  const flush = () => {
    if (currentType && currentLines.length > 0) {
      if (currentType === 'list') {
        blocks.push({ type: 'list', text: '', items: [...currentLines] });
      } else {
        blocks.push({ type: currentType, text: currentLines.join('\n') });
      }
    }
    currentLines = [];
    currentType = null;
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }

    let type: 'prose' | 'code' | 'list';
    if (line.startsWith('  ')) {
      type = 'code';
    } else if (isListLine(line)) {
      type = 'list';
    } else {
      type = 'prose';
    }
    if (type !== currentType) {
      flush();
    }
    currentType = type;
    currentLines.push(line);
  }
  flush();

  return blocks.map((block, i) => {
    if (block.type === 'code') {
      return <pre key={i} className="lecture-code">{block.text}</pre>;
    }
    if (block.type === 'list' && block.items) {
      const isOrdered = /^\d+\.\s/.test(block.items[0]);
      const listItems = block.items.map((item, j) => {
        const text = item.replace(/^\d+\.\s/, '').replace(/^[-*]\s/, '');
        return <li key={j}>{parseInlineFormatting(text)}</li>;
      });
      return isOrdered
        ? <ol key={i} className="lecture-list">{listItems}</ol>
        : <ul key={i} className="lecture-list">{listItems}</ul>;
    }
    return <p key={i} className="lecture-prose">{parseInlineFormatting(block.text)}</p>;
  });
}

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
          <p className="lecture-subtitle">{parseInlineFormatting(currentLesson.description)}</p>
        </div>

        {currentLesson.lecture.sections.map((section, i) => (
          <div key={i} className="lecture-section">
            <h3>{section.title}</h3>
            <div className="lecture-section-content">{renderLectureContent(section.content)}</div>
            {section.diagram && (
              <pre className="lecture-diagram">{section.diagram}</pre>
            )}
            {section.keyTakeaway && (
              <div className="lecture-takeaway">{parseInlineFormatting(section.keyTakeaway)}</div>
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
  const completeLectureQuiz = useSimulatorStore((s) => s.completeLectureQuiz);

  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const handleSubmit = useCallback(() => {
    if (selectedChoice === null) return;
    submitQuizAnswer(selectedChoice);
  }, [selectedChoice, submitQuizAnswer]);

  const handleNext = useCallback(() => {
    setSelectedChoice(null);
    nextQuizQuestion();
  }, [nextQuizQuestion]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const numChoices = currentLesson?.quiz[quizIndex]?.choices.length ?? 0;

      // Number keys 1-4 to select choices (only before revealing answer)
      if (!quizRevealed && e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        if (idx < numChoices) {
          setSelectedChoice(idx);
        }
        return;
      }

      // Enter to submit or advance
      if (e.key === 'Enter') {
        if (!quizRevealed && selectedChoice !== null) {
          handleSubmit();
        } else if (quizRevealed) {
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentLesson, quizIndex, quizRevealed, selectedChoice, handleSubmit, handleNext]);

  if (!currentLesson) return null;

  const quiz = currentLesson.quiz;
  const totalQuestions = quiz.length;
  const isFinished = quizAnswers.length === totalQuestions;
  const isLectureQuiz = currentLesson.mode === 'lecture-quiz';

  // Show score summary only after the user dismisses the last explanation
  if (isFinished && !quizRevealed) {
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
              {isLectureQuiz
                ? (percentage >= 75
                    ? "Great understanding! You've completed this lesson."
                    : percentage >= 50
                    ? 'Good effort! Review the lecture to strengthen your understanding.'
                    : "Don't worry -- review the lecture and try again to solidify these concepts.")
                : (percentage >= 75
                    ? "Great understanding! You're ready for hands-on practice."
                    : percentage >= 50
                    ? 'Good effort! The practice section will help reinforce these concepts.'
                    : "Don't worry -- the practice section will help solidify these concepts.")}
            </div>

            <div className="quiz-progress-bar" style={{ justifyContent: 'center', marginBottom: 24 }}>
              {quizAnswers.map((a, i) => (
                <div
                  key={i}
                  className={`quiz-progress-dot ${a.correct ? 'correct' : 'incorrect'}`}
                />
              ))}
            </div>

            {isLectureQuiz ? (
              <button className="btn-start-practice" onClick={completeLectureQuiz}>
                Complete Lesson &#10003;
              </button>
            ) : (
              <button className="btn-start-practice" onClick={startPractice}>
                Start Practice &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const question = quiz[quizIndex];

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
              <div
                key={i}
                className={cls}
                onClick={() => !quizRevealed && setSelectedChoice(i)}
                role="button"
                tabIndex={quizRevealed ? -1 : 0}
              >
                <span className="quiz-choice-key">{i + 1}</span>
                {choice}
              </div>
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
