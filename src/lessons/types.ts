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

export interface Lesson {
  id: number;
  title: string;
  description: string;
  goalDescription: string;
  successMessage: string;
  hints?: string[];
  initialState: () => Omit<ClusterState, 'tick'>;
  goalCheck: (state: ClusterState) => boolean;
  podFailureRules?: Record<string, 'ImagePullError' | 'CrashLoopBackOff'>;
  afterTick?: (tick: number, state: ClusterState) => ClusterState;
  steps?: LessonStep[];
  lecture: {
    sections: LectureSection[];
  };
  quiz: QuizQuestion[];
}
