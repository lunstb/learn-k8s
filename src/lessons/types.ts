import type { ClusterState } from '../simulation/types';

export interface LessonStep {
  id: string;
  trigger: 'onLoad' | 'beforeTick' | 'afterTick' | 'afterCommand';
  triggerCondition?: (state: ClusterState) => boolean;
  prediction?: {
    question: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
  };
  instruction?: string;
  goalCheck?: (state: ClusterState) => boolean;
}

export interface LectureSection {
  title: string;
  content: string;
  diagram?: string;
  keyTakeaway?: string;
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonGoal {
  description: string;
  check: (state: ClusterState) => boolean;
}

export interface LessonHint {
  text: string;
  exact?: boolean;
}

export interface PracticeExercise {
  title: string;
  goalDescription: string;
  successMessage: string;
  initialState: () => Partial<Omit<ClusterState, 'tick'>> &
    Pick<ClusterState, 'pods' | 'replicaSets' | 'deployments' | 'nodes' | 'services' | 'events'>;
  goals?: LessonGoal[];
  goalCheck?: (state: ClusterState) => boolean;
  hints?: LessonHint[];
  yamlTemplate?: string;
  podFailureRules?: Record<string, 'ImagePullError' | 'CrashLoopBackOff' | 'OOMKilled'>;
  afterTick?: (tick: number, state: ClusterState) => ClusterState;
  steps?: LessonStep[];
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  mode: 'full' | 'lecture-quiz';
  goalDescription: string;
  successMessage: string;
  yamlTemplate?: string;
  hints?: LessonHint[];
  goals?: LessonGoal[];
  initialState?: () => Partial<Omit<ClusterState, 'tick'>> & Pick<ClusterState, 'pods' | 'replicaSets' | 'deployments' | 'nodes' | 'services' | 'events'>;
  goalCheck?: (state: ClusterState) => boolean;
  podFailureRules?: Record<string, 'ImagePullError' | 'CrashLoopBackOff' | 'OOMKilled'>;
  afterTick?: (tick: number, state: ClusterState) => ClusterState;
  steps?: LessonStep[];
  practices?: PracticeExercise[];
  lecture: {
    sections: LectureSection[];
  };
  quiz: QuizQuestion[];
}

export interface CurriculumSection {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
