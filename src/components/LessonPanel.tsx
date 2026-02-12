import { useState, useEffect, useMemo } from 'react';
import { useSimulatorStore } from '../simulation/store';
import type { LessonPhase } from '../simulation/store';
import { curriculum, lessonDisplayNumber } from '../lessons';
import type { CurriculumSection } from '../lessons';
import type { LessonGoal, PracticeExercise } from '../lessons/types';

const fullPhases: { key: LessonPhase; label: string }[] = [
  { key: 'lecture', label: 'Learn' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'practice', label: 'Practice' },
];

const lectureQuizPhases: { key: LessonPhase; label: string }[] = [
  { key: 'lecture', label: 'Learn' },
  { key: 'quiz', label: 'Quiz' },
];

export function LessonPanel() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const lessonCompleted = useSimulatorStore((s) => s.lessonCompleted);
  const lessonPhase = useSimulatorStore((s) => s.lessonPhase);
  const completedLessonIds = useSimulatorStore((s) => s.completedLessonIds);
  const loadLesson = useSimulatorStore((s) => s.loadLesson);
  const goToPhase = useSimulatorStore((s) => s.goToPhase);
  const hintIndex = useSimulatorStore((s) => s.hintIndex);
  const revealNextHint = useSimulatorStore((s) => s.revealNextHint);
  const currentExerciseIndex = useSimulatorStore((s) => s.currentExerciseIndex);
  const exerciseCompleted = useSimulatorStore((s) => s.exerciseCompleted);
  const startNextExercise = useSimulatorStore((s) => s.startNextExercise);

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(['fundamentals']);
  });

  // Auto-expand section containing current lesson
  useEffect(() => {
    if (currentLesson) {
      const section = curriculum.find((s) =>
        s.lessons.some((l) => l.id === currentLesson.id)
      );
      if (section && !expandedSections.has(section.id)) {
        setExpandedSections((prev) => new Set([...prev, section.id]));
      }
    }
  }, [currentLesson]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const phases = currentLesson?.mode === 'lecture-quiz' ? lectureQuizPhases : fullPhases;

  return (
    <div className="lesson-panel">
      <h2 className="lesson-panel-title">Lessons</h2>
      <div className="lesson-list">
        {curriculum.map((section) => (
          <SectionGroup
            key={section.id}
            section={section}
            expanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            currentLessonId={currentLesson?.id ?? null}
            completedLessonIds={completedLessonIds}
            onSelectLesson={loadLesson}
          />
        ))}
      </div>

      {currentLesson && (
        <div className="lesson-info">
          <div className="phase-indicator">
            {phases.map((phase, i) => {
              const phaseIndex = phases.findIndex((p) => p.key === lessonPhase);
              const thisIndex = i;
              const isLessonCompleted = completedLessonIds.includes(currentLesson.id);
              let dotClass = 'phase-dot';
              if (thisIndex < phaseIndex) dotClass += ' done';
              else if (thisIndex === phaseIndex) dotClass += ' active';
              if (isLessonCompleted && thisIndex !== phaseIndex) dotClass += ' done';

              const canClick = true;
              const isActive = thisIndex === phaseIndex;

              return (
                <div key={phase.key} className="phase-step">
                  <button
                    className={`phase-btn ${canClick ? 'clickable' : ''} ${isActive ? 'current' : ''}`}
                    onClick={() => canClick && !isActive && goToPhase(phase.key)}
                    disabled={!canClick || isActive}
                  >
                    <div className={dotClass} />
                    <span className={`phase-label ${isActive ? 'active' : ''} ${canClick && !isActive ? 'clickable' : ''}`}>
                      {phase.label}
                    </span>
                  </button>
                  {i < phases.length - 1 && <div className="phase-connector" />}
                </div>
              );
            })}
          </div>

          <h3>{currentLesson.title}</h3>
          <p className="lesson-description">{currentLesson.description}</p>

          {lessonPhase === 'practice' && (() => {
            const totalExercises = currentLesson.practices?.length ?? 1;
            const activeExercise: PracticeExercise | null = currentLesson.practices
              ? (currentLesson.practices[currentExerciseIndex] ?? null)
              : (currentLesson.initialState ? {
                  title: '',
                  goalDescription: currentLesson.goalDescription,
                  successMessage: currentLesson.successMessage,
                  initialState: currentLesson.initialState,
                  goals: currentLesson.goals,
                  goalCheck: currentLesson.goalCheck,
                  hints: currentLesson.hints,
                  yamlTemplate: currentLesson.yamlTemplate,
                  podFailureRules: currentLesson.podFailureRules,
                  afterTick: currentLesson.afterTick,
                  steps: currentLesson.steps,
                } : null);

            return (
              <>
                {totalExercises > 1 && (
                  <div className="exercise-progress">
                    <span className="exercise-progress-label">
                      Exercise {currentExerciseIndex + 1} of {totalExercises}
                    </span>
                    <div className="exercise-dots">
                      {Array.from({ length: totalExercises }, (_, i) => (
                        <span
                          key={i}
                          className={`exercise-dot${i < currentExerciseIndex ? ' completed' : ''}${i === currentExerciseIndex ? ' active' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {totalExercises > 1 && activeExercise?.title && (
                  <div className="exercise-title">{activeExercise.title}</div>
                )}
                <GoalsChecklist
                  lesson={currentLesson}
                  activeExercise={activeExercise}
                  hintIndex={hintIndex}
                  onRevealHint={revealNextHint}
                  lessonCompleted={lessonCompleted}
                  exerciseCompleted={exerciseCompleted}
                />
                {exerciseCompleted && !lessonCompleted && (
                  <button className="btn-next-exercise" onClick={startNextExercise}>
                    Next Exercise →
                  </button>
                )}
              </>
            );
          })()}
          {completedLessonIds.includes(currentLesson.id) && lessonPhase !== 'practice' && (
            <div className="lesson-success lesson-success-compact">
              Completed &#10003;
            </div>
          )}
          {lessonCompleted && lessonPhase === 'practice' && (
            <div className="lesson-success">
              {(currentLesson.practices
                ? currentLesson.practices[currentExerciseIndex]?.successMessage
                : currentLesson.successMessage) ?? currentLesson.successMessage}
            </div>
          )}
        </div>
      )}

      {!currentLesson && (
        <div className="lesson-info">
          <p className="lesson-hint">
            Select a lesson to get started.
          </p>
        </div>
      )}
    </div>
  );
}

function GoalsChecklist({
  lesson,
  activeExercise,
  hintIndex,
  onRevealHint,
  lessonCompleted,
  exerciseCompleted,
}: {
  lesson: NonNullable<ReturnType<typeof useSimulatorStore.getState>['currentLesson']>;
  activeExercise: PracticeExercise | null;
  hintIndex: number;
  onRevealHint: () => void;
  lessonCompleted: boolean;
  exerciseCompleted: boolean;
}) {
  const completedGoalIndices = useSimulatorStore((s) => s.completedGoalIndices);

  // Build goals list: use active exercise goals if available, else lesson-level
  const goals: LessonGoal[] = useMemo(() => {
    const exerciseGoals = activeExercise?.goals;
    const exerciseGoalCheck = activeExercise?.goalCheck;
    const exerciseGoalDesc = activeExercise?.goalDescription;

    if (exerciseGoals && exerciseGoals.length > 0) return exerciseGoals;
    if (exerciseGoalCheck && exerciseGoalDesc) {
      return [{ description: exerciseGoalDesc, check: exerciseGoalCheck }];
    }
    if (lesson.goals && lesson.goals.length > 0) return lesson.goals;
    if (lesson.goalCheck) {
      return [{ description: lesson.goalDescription, check: lesson.goalCheck }];
    }
    return [{ description: lesson.goalDescription, check: () => false }];
  }, [lesson, activeExercise]);

  const hints = activeExercise?.hints ?? lesson.hints;
  const completedCount = goals.filter((_, i) => completedGoalIndices.includes(i)).length;
  const totalCount = goals.length;
  const totalHints = hints?.length ?? 0;
  const allHintsRevealed = hintIndex >= totalHints;
  const isDone = lessonCompleted || exerciseCompleted;

  return (
    <div className="goals-checklist">
      <div className="goals-header">
        <span className="goals-title">Goals</span>
        <span className="goals-progress">{completedCount}/{totalCount}</span>
      </div>
      <div className="goals-list">
        {goals.map((goal, i) => {
          const done = completedGoalIndices.includes(i);
          return (
            <div key={i} className={`goal-item ${done ? 'completed' : ''}`}>
              <span className="goal-icon">{done ? '\u2705' : '\u25CB'}</span>
              <span className="goal-text">{goal.description}</span>
            </div>
          );
        })}
      </div>
      {totalHints > 0 && !isDone && (
        <button
          className={`hint-btn ${allHintsRevealed ? 'exhausted' : ''}`}
          onClick={onRevealHint}
          disabled={allHintsRevealed}
        >
          {allHintsRevealed
            ? `All hints revealed (${totalHints}/${totalHints})`
            : `Show Hint (${hintIndex}/${totalHints} revealed)`}
        </button>
      )}
    </div>
  );
}

function SectionGroup({
  section,
  expanded,
  onToggle,
  currentLessonId,
  completedLessonIds,
  onSelectLesson,
}: {
  section: CurriculumSection;
  expanded: boolean;
  onToggle: () => void;
  currentLessonId: number | null;
  completedLessonIds: number[];
  onSelectLesson: (lesson: CurriculumSection['lessons'][0]) => void;
}) {
  const completedCount = section.lessons.filter((l) =>
    completedLessonIds.includes(l.id)
  ).length;
  const totalCount = section.lessons.length;

  return (
    <div className="section-group">
      <button className="section-header" onClick={onToggle}>
        <span className={`section-chevron ${expanded ? 'expanded' : ''}`}>&#9656;</span>
        <span className="section-title">{section.title}</span>
        <span className={`section-progress ${completedCount === totalCount ? 'complete' : ''}`}>
          {completedCount}/{totalCount}
        </span>
      </button>
      {expanded && (
        <div className="section-lessons">
          {section.lessons.map((lesson) => {
            const isCompleted = completedLessonIds.includes(lesson.id);
            return (
              <button
                key={lesson.id}
                className={`lesson-btn ${
                  currentLessonId === lesson.id ? 'active' : ''
                } ${isCompleted ? 'completed' : ''}`}
                onClick={() => onSelectLesson(lesson)}
              >
                <span className="lesson-number">{lessonDisplayNumber[lesson.id] ?? lesson.id}</span>
                <span className="lesson-title">{lesson.title}</span>
                {isCompleted && (
                  <span className="lesson-check">&#10003;</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
