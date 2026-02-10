import { useState, useEffect } from 'react';
import { useSimulatorStore } from '../simulation/store';
import type { LessonPhase } from '../simulation/store';
import { curriculum } from '../lessons';
import type { CurriculumSection } from '../lessons';

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

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(curriculum.map((s) => s.id));
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
                <span className="lesson-number">{lesson.id}</span>
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
