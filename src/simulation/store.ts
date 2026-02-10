import { create } from 'zustand';
import type {
  ClusterState,
  Pod,
  ReplicaSet,
  Deployment,
  SimNode,
  Service,
  SimEvent,
  ControllerAction,
} from './types';
import { reconcileReplicaSets } from './controllers/replicaset';
import { reconcileDeployments } from './controllers/deployment';
import { runScheduler } from './controllers/scheduler';
import { runNodeLifecycle } from './controllers/nodelifecycle';
import { reconcileEndpoints } from './controllers/endpoints';
import type { Lesson } from '../lessons/types';

export type LessonPhase = 'lecture' | 'quiz' | 'practice';

export interface SimulatorStore {
  // Cluster state
  cluster: ClusterState;
  actions: ControllerAction[];
  terminalOutput: string[];
  isAutoRunning: boolean;
  autoRunInterval: number;

  // Lesson state
  currentLesson: Lesson | null;
  lessonCompleted: boolean;
  lessonPhase: LessonPhase;
  completedLessonIds: number[];

  // Quiz state
  quizIndex: number;
  quizAnswers: { choiceIndex: number; correct: boolean }[];
  quizRevealed: boolean;

  // Prediction state
  currentStep: number;
  predictionPending: boolean;
  predictionResult: 'correct' | 'incorrect' | null;

  // Actions
  setCluster: (cluster: ClusterState) => void;
  addPod: (pod: Pod) => void;
  removePod: (uid: string) => void;
  addReplicaSet: (rs: ReplicaSet) => void;
  removeReplicaSet: (uid: string) => void;
  addDeployment: (dep: Deployment) => void;
  removeDeployment: (uid: string) => void;
  updateDeployment: (uid: string, updates: Partial<Deployment>) => void;
  updateReplicaSet: (uid: string, updates: Partial<ReplicaSet>) => void;
  updatePod: (uid: string, updates: Partial<Pod>) => void;
  addNode: (node: SimNode) => void;
  removeNode: (uid: string) => void;
  updateNode: (uid: string, updates: Partial<SimNode>) => void;
  addService: (svc: Service) => void;
  removeService: (uid: string) => void;
  addEvent: (event: SimEvent) => void;

  // Simulation controls
  tick: () => void;
  reset: () => void;
  toggleAutoRun: () => void;
  setAutoRunning: (running: boolean) => void;

  // Terminal
  appendOutput: (line: string) => void;
  clearOutput: () => void;

  // Lessons
  loadLesson: (lesson: Lesson) => void;
  checkGoal: () => void;
  setLessonCompleted: (completed: boolean) => void;

  // Lesson phase actions
  startQuiz: () => void;
  submitQuizAnswer: (choiceIndex: number) => void;
  nextQuizQuestion: () => void;
  startPractice: () => void;
  goToPhase: (phase: LessonPhase) => void;

  // Predictions
  submitPrediction: (choiceIndex: number) => void;
  advanceStep: () => void;
}

const STORAGE_KEY = 'k8s-sim-completed-lessons';

function loadCompletedLessons(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function saveCompletedLessons(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

const initialClusterState: ClusterState = {
  pods: [],
  replicaSets: [],
  deployments: [],
  nodes: [],
  services: [],
  events: [],
  tick: 0,
};

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  cluster: { ...initialClusterState },
  actions: [],
  terminalOutput: ['Welcome to the Kubernetes Simulator!', 'Type "help" for available commands.', ''],
  isAutoRunning: false,
  autoRunInterval: 1500,
  currentLesson: null,
  lessonCompleted: false,
  lessonPhase: 'lecture',
  completedLessonIds: loadCompletedLessons(),
  quizIndex: 0,
  quizAnswers: [],
  quizRevealed: false,
  currentStep: 0,
  predictionPending: false,
  predictionResult: null,

  setCluster: (cluster) => set({ cluster }),

  addPod: (pod) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        pods: [...state.cluster.pods, pod],
      },
    })),

  removePod: (uid) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        pods: state.cluster.pods.filter((p) => p.metadata.uid !== uid),
      },
    })),

  addReplicaSet: (rs) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        replicaSets: [...state.cluster.replicaSets, rs],
      },
    })),

  removeReplicaSet: (uid) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        replicaSets: state.cluster.replicaSets.filter(
          (rs) => rs.metadata.uid !== uid
        ),
      },
    })),

  addDeployment: (dep) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        deployments: [...state.cluster.deployments, dep],
      },
    })),

  removeDeployment: (uid) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        deployments: state.cluster.deployments.filter(
          (d) => d.metadata.uid !== uid
        ),
      },
    })),

  updateDeployment: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        deployments: state.cluster.deployments.map((d) =>
          d.metadata.uid === uid ? { ...d, ...updates } : d
        ),
      },
    })),

  updateReplicaSet: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        replicaSets: state.cluster.replicaSets.map((rs) =>
          rs.metadata.uid === uid ? { ...rs, ...updates } : rs
        ),
      },
    })),

  updatePod: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        pods: state.cluster.pods.map((p) =>
          p.metadata.uid === uid ? { ...p, ...updates } : p
        ),
      },
    })),

  addNode: (node) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        nodes: [...state.cluster.nodes, node],
      },
    })),

  removeNode: (uid) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        nodes: state.cluster.nodes.filter((n) => n.metadata.uid !== uid),
      },
    })),

  updateNode: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        nodes: state.cluster.nodes.map((n) =>
          n.metadata.uid === uid ? { ...n, ...updates } : n
        ),
      },
    })),

  addService: (svc) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        services: [...state.cluster.services, svc],
      },
    })),

  removeService: (uid) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        services: state.cluster.services.filter((s) => s.metadata.uid !== uid),
      },
    })),

  addEvent: (event) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        events: [...state.cluster.events, event].slice(-50),
      },
    })),

  tick: () => {
    const state = get();

    // Block tick if prediction is pending
    if (state.predictionPending) {
      set((s) => ({
        terminalOutput: [
          ...s.terminalOutput,
          '[Blocked] Answer the prediction question before reconciling.',
          '',
        ],
      }));
      return;
    }

    const cluster = {
      ...state.cluster,
      pods: state.cluster.pods.map((p) => ({ ...p })),
      replicaSets: state.cluster.replicaSets.map((rs) => ({ ...rs })),
      deployments: state.cluster.deployments.map((d) => ({ ...d })),
      nodes: state.cluster.nodes.map((n) => ({ ...n, status: { ...n.status, conditions: [...n.status.conditions] as [{ type: 'Ready'; status: 'True' | 'False' }] } })),
      services: state.cluster.services.map((s) => ({ ...s, status: { ...s.status, endpoints: [...s.status.endpoints] } })),
      events: [...state.cluster.events],
    };
    const allActions: ControllerAction[] = [];
    const allEvents: SimEvent[] = [];

    // Check beforeTick step triggers
    const lesson = state.currentLesson;
    if (lesson?.steps) {
      const step = lesson.steps[state.currentStep];
      if (step && step.trigger === 'beforeTick') {
        const conditionMet = !step.triggerCondition || step.triggerCondition(cluster);
        if (conditionMet && step.prediction && !state.predictionPending) {
          set({ predictionPending: true, predictionResult: null });
          if (step.instruction) {
            set((s) => ({
              terminalOutput: [...s.terminalOutput, step.instruction!, ''],
            }));
          }
          return;
        }
      }
    }

    // Run Deployment controller first
    const deployResult = reconcileDeployments(cluster);
    cluster.deployments = deployResult.deployments;
    cluster.replicaSets = deployResult.replicaSets;
    cluster.pods = deployResult.pods;
    allActions.push(...deployResult.actions);
    allEvents.push(...deployResult.events);

    // Then ReplicaSet controller
    const rsResult = reconcileReplicaSets({
      ...cluster,
      replicaSets: cluster.replicaSets,
      pods: cluster.pods,
    });
    cluster.replicaSets = rsResult.replicaSets;
    cluster.pods = rsResult.pods;
    allActions.push(...rsResult.actions);
    allEvents.push(...rsResult.events);

    // Scheduler (assigns pods to nodes)
    const schedulerResult = runScheduler(cluster);
    allActions.push(...schedulerResult.actions);
    allEvents.push(...schedulerResult.events);

    // Pod Lifecycle Controller: handle Pending→Running transitions and failure modes
    const podLifecycleEvents = runPodLifecycle(cluster, lesson);
    allEvents.push(...podLifecycleEvents);

    // Node Lifecycle Controller: evict pods from NotReady nodes
    const nodeResult = runNodeLifecycle(cluster);
    allActions.push(...nodeResult.actions);
    allEvents.push(...nodeResult.events);

    // Garbage collection: remove objects marked for deletion with no dependents
    const garbageActions = garbageCollect(cluster);
    allActions.push(...garbageActions);

    // Endpoints controller (service → pod resolution)
    const endpointsResult = reconcileEndpoints(cluster);
    allActions.push(...endpointsResult.actions);
    allEvents.push(...endpointsResult.events);

    // Lesson afterTick hook
    if (lesson?.afterTick) {
      const mutated = lesson.afterTick(cluster.tick + 1, cluster);
      if (mutated) {
        cluster.pods = mutated.pods;
        cluster.replicaSets = mutated.replicaSets;
        cluster.deployments = mutated.deployments;
        cluster.nodes = mutated.nodes;
        cluster.services = mutated.services;
        cluster.events = mutated.events;
      }
    }

    cluster.tick += 1;

    // Accumulate events (cap at 50)
    cluster.events = [...cluster.events, ...allEvents].slice(-50);

    // Build output
    const outputLines: string[] = [];
    if (allActions.length === 0) {
      outputLines.push(`[Tick ${cluster.tick}] No changes - cluster is at desired state.`);
    } else {
      outputLines.push(`[Tick ${cluster.tick}] Controllers reconciled:`);
      for (const action of allActions) {
        outputLines.push(`  ${action.controller}: ${action.details}`);
      }
    }

    set((s) => ({
      cluster,
      actions: allActions,
      terminalOutput: [...s.terminalOutput, ...outputLines, ''],
    }));

    // Check afterTick step triggers
    if (lesson?.steps) {
      const currentStep = get().currentStep;
      const step = lesson.steps[currentStep];
      if (step && step.trigger === 'afterTick') {
        const conditionMet = !step.triggerCondition || step.triggerCondition(cluster);
        if (conditionMet && step.prediction && !get().predictionPending) {
          set({ predictionPending: true, predictionResult: null });
          if (step.instruction) {
            set((s) => ({
              terminalOutput: [...s.terminalOutput, step.instruction!, ''],
            }));
          }
        }
        if (conditionMet && step.instruction && !step.prediction) {
          set((s) => ({
            terminalOutput: [...s.terminalOutput, step.instruction!, ''],
          }));
          // Auto-advance non-prediction steps
          if (step.goalCheck?.(cluster)) {
            get().advanceStep();
          }
        }
      }
    }

    // Check lesson goal after tick
    setTimeout(() => get().checkGoal(), 0);
  },

  reset: () => {
    const { currentLesson, lessonPhase } = get();
    if (currentLesson) {
      if (lessonPhase === 'practice') {
        // Re-enter practice phase without going back to lecture
        get().startPractice();
      } else {
        get().loadLesson(currentLesson);
      }
    } else {
      set({
        cluster: { ...initialClusterState, events: [] },
        actions: [],
        terminalOutput: ['Cluster reset.', ''],
        lessonCompleted: false,
        lessonPhase: 'lecture',
        quizIndex: 0,
        quizAnswers: [],
        quizRevealed: false,
        currentStep: 0,
        predictionPending: false,
        predictionResult: null,
      });
    }
  },

  toggleAutoRun: () => set((state) => ({ isAutoRunning: !state.isAutoRunning })),
  setAutoRunning: (running) => set({ isAutoRunning: running }),

  appendOutput: (line) =>
    set((state) => ({
      terminalOutput: [...state.terminalOutput, line],
    })),

  clearOutput: () => set({ terminalOutput: [] }),

  loadLesson: (lesson) => {
    const isCompleted = get().completedLessonIds.includes(lesson.id);
    set({
      cluster: { ...initialClusterState, events: [] },
      currentLesson: lesson,
      lessonCompleted: isCompleted,
      lessonPhase: 'lecture',
      quizIndex: 0,
      quizAnswers: [],
      quizRevealed: false,
      actions: [],
      terminalOutput: ['Welcome to the Kubernetes Simulator!', 'Type "help" for available commands.', ''],
      isAutoRunning: false,
      currentStep: 0,
      predictionPending: false,
      predictionResult: null,
    });
  },

  checkGoal: () => {
    const { currentLesson, cluster, lessonCompleted, currentStep } = get();
    if (!currentLesson || lessonCompleted) return;

    // Check step-level goalCheck
    if (currentLesson.steps) {
      const step = currentLesson.steps[currentStep];
      if (step?.goalCheck?.(cluster) && !get().predictionPending) {
        get().advanceStep();
      }
    }

    // Check overall lesson goal
    if (currentLesson.goalCheck(cluster)) {
      const { completedLessonIds } = get();
      const newCompleted = completedLessonIds.includes(currentLesson.id)
        ? completedLessonIds
        : [...completedLessonIds, currentLesson.id];
      saveCompletedLessons(newCompleted);
      set((s) => ({
        lessonCompleted: true,
        completedLessonIds: newCompleted,
        terminalOutput: [
          ...s.terminalOutput,
          '',
          `\u2705 ${currentLesson.successMessage}`,
          '',
        ],
      }));
    }
  },

  setLessonCompleted: (completed) => set({ lessonCompleted: completed }),

  startQuiz: () => {
    set({
      lessonPhase: 'quiz',
      quizIndex: 0,
      quizAnswers: [],
      quizRevealed: false,
    });
  },

  submitQuizAnswer: (choiceIndex: number) => {
    const { currentLesson, quizIndex } = get();
    if (!currentLesson?.quiz) return;

    const question = currentLesson.quiz[quizIndex];
    if (!question) return;

    const correct = choiceIndex === question.correctIndex;
    set((s) => ({
      quizRevealed: true,
      quizAnswers: [...s.quizAnswers, { choiceIndex, correct }],
    }));
  },

  nextQuizQuestion: () => {
    const { currentLesson, quizIndex } = get();
    if (!currentLesson?.quiz) return;

    if (quizIndex + 1 >= currentLesson.quiz.length) {
      // Stay on quiz phase to show score summary — startPractice transitions
      set({ quizRevealed: false });
      return;
    }

    set({
      quizIndex: quizIndex + 1,
      quizRevealed: false,
    });
  },

  startPractice: () => {
    const { currentLesson } = get();
    if (!currentLesson) return;

    const state = currentLesson.initialState();
    const cluster: ClusterState = {
      pods: state.pods || [],
      replicaSets: state.replicaSets || [],
      deployments: state.deployments || [],
      nodes: state.nodes || [],
      services: state.services || [],
      events: state.events || [],
      tick: 0,
    };

    const terminalOutput = [
      `--- Lesson ${currentLesson.id}: ${currentLesson.title} (Practice) ---`,
      '',
      `Goal: ${currentLesson.goalDescription}`,
      '',
      ...(currentLesson.hints || []).map((h: string) => `Hint: ${h}`),
      '',
    ];

    // Show first step instruction if it triggers onLoad
    let predictionPending = false;
    if (currentLesson.steps && currentLesson.steps.length > 0) {
      const firstStep = currentLesson.steps[0];
      if (firstStep.trigger === 'onLoad') {
        if (firstStep.instruction) {
          terminalOutput.push(firstStep.instruction, '');
        }
        if (firstStep.prediction) {
          predictionPending = true;
        }
      }
    }

    set({
      lessonPhase: 'practice',
      lessonCompleted: false,
      cluster,
      actions: [],
      terminalOutput,
      isAutoRunning: false,
      currentStep: 0,
      predictionPending,
      predictionResult: null,
    });
  },

  goToPhase: (phase) => {
    const { currentLesson } = get();
    if (!currentLesson) return;

    if (phase === 'lecture') {
      set({ lessonPhase: 'lecture' });
    } else if (phase === 'quiz') {
      get().startQuiz();
    } else if (phase === 'practice') {
      // startPractice resets lessonCompleted — user is doing a fresh run.
      // The checkmark in the sidebar persists via completedLessonIds.
      get().startPractice();
    }
  },

  submitPrediction: (choiceIndex: number) => {
    const { currentLesson, currentStep } = get();
    if (!currentLesson?.steps) return;

    const step = currentLesson.steps[currentStep];
    if (!step?.prediction) return;

    const isCorrect = choiceIndex === step.prediction.correctIndex;

    set((s) => ({
      predictionPending: false,
      predictionResult: isCorrect ? 'correct' : 'incorrect',
      terminalOutput: [
        ...s.terminalOutput,
        isCorrect ? 'Correct!' : `Incorrect. The answer was: ${step.prediction!.choices[step.prediction!.correctIndex]}`,
        step.prediction!.explanation,
        '',
      ],
    }));
  },

  advanceStep: () => {
    const { currentLesson, currentStep, cluster } = get();
    if (!currentLesson?.steps) return;

    const nextStep = currentStep + 1;
    if (nextStep >= currentLesson.steps.length) {
      set({ currentStep: nextStep, predictionPending: false, predictionResult: null });
      return;
    }

    const step = currentLesson.steps[nextStep];
    let predictionPending = false;

    if (step.trigger === 'onLoad' || step.trigger === 'afterCommand') {
      const conditionMet = !step.triggerCondition || step.triggerCondition(cluster);
      if (conditionMet) {
        if (step.instruction) {
          set((s) => ({
            terminalOutput: [...s.terminalOutput, step.instruction!, ''],
          }));
        }
        if (step.prediction) {
          predictionPending = true;
        }
      }
    }

    set({
      currentStep: nextStep,
      predictionPending,
      predictionResult: null,
    });
  },
}));

function runPodLifecycle(cluster: ClusterState, lesson: Lesson | null): SimEvent[] {
  const events: SimEvent[] = [];
  const currentTick = cluster.tick;

  for (const pod of cluster.pods) {
    if (pod.metadata.deletionTimestamp) continue;

    // Apply lesson failure rules to newly created pods
    if (lesson?.podFailureRules && pod.status.phase === 'Pending' && !pod.spec.failureMode) {
      const failure = lesson.podFailureRules[pod.spec.image];
      if (failure) {
        pod.spec.failureMode = failure;
      }
    }

    // Handle failure modes
    if (pod.spec.failureMode === 'ImagePullError') {
      if (pod.status.phase === 'Pending') {
        pod.status.reason = 'ImagePullError';
        pod.status.message = `Failed to pull image "${pod.spec.image}": image not found`;
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Warning',
          reason: 'Failed',
          objectKind: 'Pod',
          objectName: pod.metadata.name,
          message: `Error: ImagePullError - image "${pod.spec.image}" not found`,
        });
      }
      continue; // Don't transition to Running
    }

    if (pod.spec.failureMode === 'CrashLoopBackOff') {
      if (pod.status.phase === 'Pending' && pod.status.tickCreated !== undefined && currentTick > pod.status.tickCreated) {
        // First transition: Pending → Running (briefly)
        pod.status.phase = 'Running';
        pod.status.reason = undefined;
        continue;
      }
      if (pod.status.phase === 'Running') {
        // Crash: Running → CrashLoopBackOff
        pod.status.phase = 'CrashLoopBackOff';
        pod.status.reason = 'CrashLoopBackOff';
        pod.status.message = 'Back-off restarting failed container';
        pod.status.restartCount = (pod.status.restartCount || 0) + 1;
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Warning',
          reason: 'BackOff',
          objectKind: 'Pod',
          objectName: pod.metadata.name,
          message: `Back-off restarting failed container (restart count: ${pod.status.restartCount})`,
        });
        continue;
      }
      if (pod.status.phase === 'CrashLoopBackOff') {
        // Restart attempt: CrashLoopBackOff → Running (then will crash again)
        pod.status.phase = 'Running';
        pod.status.reason = undefined;
        continue;
      }
    }

    // Normal lifecycle: Pending → Running after 1 tick
    if (pod.status.phase === 'Pending' && !pod.status.reason) {
      if (pod.status.tickCreated !== undefined && currentTick > pod.status.tickCreated) {
        // If nodes exist and pod has no nodeName, it needs scheduling first
        if (cluster.nodes.length > 0 && !pod.spec.nodeName) {
          continue; // Scheduler hasn't assigned it yet
        }
        pod.status.phase = 'Running';
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'Started',
          objectKind: 'Pod',
          objectName: pod.metadata.name,
          message: `Started container with image "${pod.spec.image}"`,
        });
      }
    }

    // Handle Failed pods (from node eviction) - RS controller will recreate
    // Remove the failed pod's nodeName so RS sees it as gone
    if (pod.status.phase === 'Failed' && pod.status.reason === 'NodeNotReady') {
      pod.metadata.deletionTimestamp = Date.now();
    }
  }

  return events;
}

function garbageCollect(cluster: ClusterState): ControllerAction[] {
  const actions: ControllerAction[] = [];

  // Remove ReplicaSets marked for deletion that have 0 pods
  const rsToRemove: string[] = [];
  for (const rs of cluster.replicaSets) {
    if (rs.metadata.deletionTimestamp) {
      const ownedPods = cluster.pods.filter(
        (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
      );
      if (ownedPods.length === 0) {
        rsToRemove.push(rs.metadata.uid);
        actions.push({
          controller: 'GarbageCollector',
          action: 'delete',
          details: `Deleted ReplicaSet ${rs.metadata.name} (no remaining pods)`,
        });
      }
    }
  }
  cluster.replicaSets = cluster.replicaSets.filter(
    (rs) => !rsToRemove.includes(rs.metadata.uid)
  );

  // Remove Pods marked for deletion
  const podsBefore = cluster.pods.length;
  cluster.pods = cluster.pods.filter((p) => !p.metadata.deletionTimestamp);
  if (cluster.pods.length < podsBefore) {
    actions.push({
      controller: 'GarbageCollector',
      action: 'delete',
      details: `Cleaned up ${podsBefore - cluster.pods.length} terminating pod(s)`,
    });
  }

  return actions;
}
