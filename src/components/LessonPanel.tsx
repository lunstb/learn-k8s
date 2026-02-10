import { useSimulatorStore } from '../simulation/store';
import type { LessonPhase } from '../simulation/store';
import { lessons } from '../lessons';

const phases: { key: LessonPhase; label: string }[] = [
  { key: 'lecture', label: 'Learn' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'practice', label: 'Practice' },
];

export function LessonPanel() {
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const lessonCompleted = useSimulatorStore((s) => s.lessonCompleted);
  const lessonPhase = useSimulatorStore((s) => s.lessonPhase);
  const completedLessonIds = useSimulatorStore((s) => s.completedLessonIds);
  const loadLesson = useSimulatorStore((s) => s.loadLesson);
  const goToPhase = useSimulatorStore((s) => s.goToPhase);

  return (
    <div className="lesson-panel">
      <h2 className="lesson-panel-title">Lessons</h2>
      <div className="lesson-list">
        {lessons.map((lesson) => {
          const isCompleted = completedLessonIds.includes(lesson.id);
          return (
            <button
              key={lesson.id}
              className={`lesson-btn ${
                currentLesson?.id === lesson.id ? 'active' : ''
              } ${isCompleted ? 'completed' : ''}`}
              onClick={() => loadLesson(lesson)}
            >
              <span className="lesson-number">{lesson.id}</span>
              <span className="lesson-title">{lesson.title}</span>
              {isCompleted && (
                <span className="lesson-check">&#10003;</span>
              )}
            </button>
          );
        })}
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

              const canClick = isLessonCompleted || thisIndex <= phaseIndex;
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

          {lessonPhase === 'practice' && (
            <div className="lesson-goal">
              <strong>Goal:</strong> {currentLesson.goalDescription}
            </div>
          )}
          {completedLessonIds.includes(currentLesson.id) && lessonPhase !== 'practice' && (
            <div className="lesson-success lesson-success-compact">
              Completed &#10003;
            </div>
          )}
          {lessonCompleted && lessonPhase === 'practice' && (
            <div className="lesson-success">
              {currentLesson.successMessage}
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
