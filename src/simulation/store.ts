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
  Namespace,
  ConfigMap,
  Secret,
  Ingress,
  StatefulSet,
  DaemonSet,
  Job,
  CronJob,
  HorizontalPodAutoscaler,
  HelmRelease,
  StorageClass,
  PersistentVolume,
  PersistentVolumeClaim,
  PodDisruptionBudget,
} from './types';
import { reconcileReplicaSets } from './controllers/replicaset';
import { reconcileDeployments } from './controllers/deployment';
import { runScheduler } from './controllers/scheduler';
import { runNodeLifecycle } from './controllers/nodelifecycle';
import { reconcileEndpoints } from './controllers/endpoints';
import { reconcileStatefulSets } from './controllers/statefulset';
import { reconcileDaemonSets } from './controllers/daemonset';
import { reconcileJobs } from './controllers/job';
import { reconcileCronJobs } from './controllers/cronjob';
import { reconcileHPAs } from './controllers/hpa';
import { reconcileStorage } from './controllers/storage';
import { lessonDisplayNumber } from '../lessons/curriculum';
import type { Lesson, PracticeExercise } from '../lessons/types';

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

  // Hint state
  hintIndex: number;
  practiceInitialized: boolean;

  // Exercise state (multi-exercise per lesson)
  currentExerciseIndex: number;
  exerciseCompleted: boolean;

  // Goal tracking (latched: once achieved, stays achieved; sequential: requires prior goals)
  completedGoalIndices: number[];

  // Prediction state
  currentStep: number;
  predictionPending: boolean;
  predictionResult: 'correct' | 'incorrect' | null;

  // YAML Editor state
  yamlEditorContent: string;
  activeBottomTab: 'terminal' | 'yaml';

  // UI state
  selectedResource: { kind: string; uid: string } | null;
  viewMode: 'logical' | 'infrastructure';
  showNetworkOverlay: boolean;

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

  // New resource CRUD
  addNamespace: (ns: Namespace) => void;
  removeNamespace: (uid: string) => void;
  addConfigMap: (cm: ConfigMap) => void;
  removeConfigMap: (uid: string) => void;
  addSecret: (secret: Secret) => void;
  removeSecret: (uid: string) => void;
  addIngress: (ing: Ingress) => void;
  removeIngress: (uid: string) => void;
  addStatefulSet: (sts: StatefulSet) => void;
  removeStatefulSet: (uid: string) => void;
  updateStatefulSet: (uid: string, updates: Partial<StatefulSet>) => void;
  addDaemonSet: (ds: DaemonSet) => void;
  removeDaemonSet: (uid: string) => void;
  updateDaemonSet: (uid: string, updates: Partial<DaemonSet>) => void;
  addJob: (job: Job) => void;
  removeJob: (uid: string) => void;
  updateJob: (uid: string, updates: Partial<Job>) => void;
  addCronJob: (cj: CronJob) => void;
  removeCronJob: (uid: string) => void;
  addHPA: (hpa: HorizontalPodAutoscaler) => void;
  removeHPA: (uid: string) => void;
  addHelmRelease: (release: HelmRelease) => void;
  removeHelmRelease: (name: string) => void;
  addStorageClass: (sc: StorageClass) => void;
  removeStorageClass: (uid: string) => void;
  addPV: (pv: PersistentVolume) => void;
  removePV: (uid: string) => void;
  addPVC: (pvc: PersistentVolumeClaim) => void;
  removePVC: (uid: string) => void;
  updatePVC: (uid: string, updates: Partial<PersistentVolumeClaim>) => void;
  addPDB: (pdb: PodDisruptionBudget) => void;
  removePDB: (uid: string) => void;

  // Simulation controls
  tick: (auto?: boolean) => void;
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
  completeLectureQuiz: () => void;

  // Lesson phase actions
  startQuiz: () => void;
  submitQuizAnswer: (choiceIndex: number) => void;
  nextQuizQuestion: () => void;
  startPractice: () => void;
  startNextExercise: () => void;
  goToPhase: (phase: LessonPhase) => void;
  revealNextHint: () => void;

  // Predictions
  submitPrediction: (choiceIndex: number) => void;
  advanceStep: () => void;

  // YAML Editor
  setYamlEditorContent: (content: string) => void;
  setActiveBottomTab: (tab: 'terminal' | 'yaml') => void;

  // UI
  setSelectedResource: (resource: { kind: string; uid: string } | null) => void;
  setViewMode: (mode: 'logical' | 'infrastructure') => void;
  toggleNetworkOverlay: () => void;
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
  namespaces: [],
  configMaps: [],
  secrets: [],
  ingresses: [],
  statefulSets: [],
  daemonSets: [],
  jobs: [],
  cronJobs: [],
  hpas: [],
  storageClasses: [],
  persistentVolumes: [],
  persistentVolumeClaims: [],
  podDisruptionBudgets: [],
  helmReleases: [],
  tick: 0,
};

function getActiveExercise(lesson: Lesson, index: number): PracticeExercise | null {
  if (lesson.practices && lesson.practices.length > 0) {
    return lesson.practices[index] ?? null;
  }
  // Synthesize from top-level fields
  if (!lesson.initialState) return null;
  return {
    title: '',
    goalDescription: lesson.goalDescription,
    successMessage: lesson.successMessage,
    initialState: lesson.initialState,
    goals: lesson.goals,
    goalCheck: lesson.goalCheck,
    hints: lesson.hints,
    yamlTemplate: lesson.yamlTemplate,
    podFailureRules: lesson.podFailureRules,
    afterTick: lesson.afterTick,
    steps: lesson.steps,
  };
}

export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  cluster: { ...initialClusterState },
  actions: [],
  terminalOutput: ['Welcome to the Kubernetes Simulator!', 'Type "help" for available commands.', ''],
  isAutoRunning: true,
  autoRunInterval: 1500,
  currentLesson: null,
  lessonCompleted: false,
  lessonPhase: 'lecture',
  completedLessonIds: loadCompletedLessons(),
  quizIndex: 0,
  quizAnswers: [],
  quizRevealed: false,
  hintIndex: 0,
  practiceInitialized: false,
  currentExerciseIndex: 0,
  exerciseCompleted: false,
  completedGoalIndices: [],
  currentStep: 0,
  predictionPending: false,
  predictionResult: null,
  yamlEditorContent: '',
  activeBottomTab: 'terminal',
  selectedResource: null,
  viewMode: 'infrastructure',
  showNetworkOverlay: false,

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

  // --- New resource CRUD ---

  addNamespace: (ns) =>
    set((state) => ({
      cluster: { ...state.cluster, namespaces: [...state.cluster.namespaces, ns] },
    })),

  removeNamespace: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, namespaces: state.cluster.namespaces.filter((n) => n.metadata.uid !== uid) },
    })),

  addConfigMap: (cm) =>
    set((state) => ({
      cluster: { ...state.cluster, configMaps: [...state.cluster.configMaps, cm] },
    })),

  removeConfigMap: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, configMaps: state.cluster.configMaps.filter((c) => c.metadata.uid !== uid) },
    })),

  addSecret: (secret) =>
    set((state) => ({
      cluster: { ...state.cluster, secrets: [...state.cluster.secrets, secret] },
    })),

  removeSecret: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, secrets: state.cluster.secrets.filter((s) => s.metadata.uid !== uid) },
    })),

  addIngress: (ing) =>
    set((state) => ({
      cluster: { ...state.cluster, ingresses: [...state.cluster.ingresses, ing] },
    })),

  removeIngress: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, ingresses: state.cluster.ingresses.filter((i) => i.metadata.uid !== uid) },
    })),

  addStatefulSet: (sts) =>
    set((state) => ({
      cluster: { ...state.cluster, statefulSets: [...state.cluster.statefulSets, sts] },
    })),

  removeStatefulSet: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, statefulSets: state.cluster.statefulSets.filter((s) => s.metadata.uid !== uid) },
    })),

  updateStatefulSet: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        statefulSets: state.cluster.statefulSets.map((s) =>
          s.metadata.uid === uid ? { ...s, ...updates } : s
        ),
      },
    })),

  addDaemonSet: (ds) =>
    set((state) => ({
      cluster: { ...state.cluster, daemonSets: [...state.cluster.daemonSets, ds] },
    })),

  removeDaemonSet: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, daemonSets: state.cluster.daemonSets.filter((d) => d.metadata.uid !== uid) },
    })),

  updateDaemonSet: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        daemonSets: state.cluster.daemonSets.map((d) =>
          d.metadata.uid === uid ? { ...d, ...updates } : d
        ),
      },
    })),

  addJob: (job) =>
    set((state) => ({
      cluster: { ...state.cluster, jobs: [...state.cluster.jobs, job] },
    })),

  removeJob: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, jobs: state.cluster.jobs.filter((j) => j.metadata.uid !== uid) },
    })),

  updateJob: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        jobs: state.cluster.jobs.map((j) =>
          j.metadata.uid === uid ? { ...j, ...updates } : j
        ),
      },
    })),

  addCronJob: (cj) =>
    set((state) => ({
      cluster: { ...state.cluster, cronJobs: [...state.cluster.cronJobs, cj] },
    })),

  removeCronJob: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, cronJobs: state.cluster.cronJobs.filter((c) => c.metadata.uid !== uid) },
    })),

  addHPA: (hpa) =>
    set((state) => ({
      cluster: { ...state.cluster, hpas: [...state.cluster.hpas, hpa] },
    })),

  removeHPA: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, hpas: state.cluster.hpas.filter((h) => h.metadata.uid !== uid) },
    })),

  addHelmRelease: (release) =>
    set((state) => ({
      cluster: { ...state.cluster, helmReleases: [...state.cluster.helmReleases, release] },
    })),

  removeHelmRelease: (name) =>
    set((state) => ({
      cluster: { ...state.cluster, helmReleases: state.cluster.helmReleases.filter((r) => r.name !== name) },
    })),

  addStorageClass: (sc) =>
    set((state) => ({
      cluster: { ...state.cluster, storageClasses: [...state.cluster.storageClasses, sc] },
    })),

  removeStorageClass: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, storageClasses: state.cluster.storageClasses.filter((s) => s.metadata.uid !== uid) },
    })),

  addPV: (pv) =>
    set((state) => ({
      cluster: { ...state.cluster, persistentVolumes: [...state.cluster.persistentVolumes, pv] },
    })),

  removePV: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, persistentVolumes: state.cluster.persistentVolumes.filter((p) => p.metadata.uid !== uid) },
    })),

  addPVC: (pvc) =>
    set((state) => ({
      cluster: { ...state.cluster, persistentVolumeClaims: [...state.cluster.persistentVolumeClaims, pvc] },
    })),

  removePVC: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, persistentVolumeClaims: state.cluster.persistentVolumeClaims.filter((p) => p.metadata.uid !== uid) },
    })),

  updatePVC: (uid, updates) =>
    set((state) => ({
      cluster: {
        ...state.cluster,
        persistentVolumeClaims: state.cluster.persistentVolumeClaims.map((p) =>
          p.metadata.uid === uid ? { ...p, ...updates } : p
        ),
      },
    })),

  addPDB: (pdb) =>
    set((state) => ({
      cluster: { ...state.cluster, podDisruptionBudgets: [...state.cluster.podDisruptionBudgets, pdb] },
    })),

  removePDB: (uid) =>
    set((state) => ({
      cluster: { ...state.cluster, podDisruptionBudgets: state.cluster.podDisruptionBudgets.filter((p) => p.metadata.uid !== uid) },
    })),

  setYamlEditorContent: (content) => set({ yamlEditorContent: content }),
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),

  setSelectedResource: (resource) => set({ selectedResource: resource }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleNetworkOverlay: () => set((s) => ({ showNetworkOverlay: !s.showNetworkOverlay })),

  tick: (auto?: boolean) => {
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
      namespaces: [...state.cluster.namespaces],
      configMaps: [...state.cluster.configMaps],
      secrets: [...state.cluster.secrets],
      ingresses: [...state.cluster.ingresses],
      statefulSets: state.cluster.statefulSets.map((s) => ({ ...s })),
      daemonSets: state.cluster.daemonSets.map((d) => ({ ...d })),
      jobs: state.cluster.jobs.map((j) => ({ ...j })),
      cronJobs: state.cluster.cronJobs.map((c) => ({ ...c })),
      hpas: state.cluster.hpas.map((h) => ({ ...h })),
      storageClasses: [...state.cluster.storageClasses],
      persistentVolumes: state.cluster.persistentVolumes.map((pv) => ({ ...pv })),
      persistentVolumeClaims: state.cluster.persistentVolumeClaims.map((pvc) => ({ ...pvc })),
      podDisruptionBudgets: state.cluster.podDisruptionBudgets.map((p) => ({ ...p })),
      helmReleases: [...state.cluster.helmReleases],
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

    // StatefulSet controller
    const stsResult = reconcileStatefulSets(cluster);
    cluster.pods = stsResult.pods;
    cluster.statefulSets = stsResult.statefulSets;
    allActions.push(...stsResult.actions);
    allEvents.push(...stsResult.events);

    // DaemonSet controller
    const dsResult = reconcileDaemonSets(cluster);
    cluster.pods = dsResult.pods;
    cluster.daemonSets = dsResult.daemonSets;
    allActions.push(...dsResult.actions);
    allEvents.push(...dsResult.events);

    // Job controller
    const jobResult = reconcileJobs(cluster);
    cluster.pods = jobResult.pods;
    cluster.jobs = jobResult.jobs;
    allActions.push(...jobResult.actions);
    allEvents.push(...jobResult.events);

    // CronJob controller
    const cronResult = reconcileCronJobs(cluster);
    cluster.jobs = cronResult.jobs;
    cluster.cronJobs = cronResult.cronJobs;
    allActions.push(...cronResult.actions);
    allEvents.push(...cronResult.events);

    // HPA controller
    const hpaResult = reconcileHPAs(cluster);
    cluster.deployments = hpaResult.deployments;
    cluster.hpas = hpaResult.hpas;
    allActions.push(...hpaResult.actions);
    allEvents.push(...hpaResult.events);

    // Storage controller (bind PVCs before scheduler)
    const storageResult = reconcileStorage(cluster);
    cluster.persistentVolumes = storageResult.persistentVolumes;
    cluster.persistentVolumeClaims = storageResult.persistentVolumeClaims;
    allActions.push(...storageResult.actions);
    allEvents.push(...storageResult.events);

    // Scheduler (assigns pods to nodes)
    const schedulerResult = runScheduler(cluster);
    allActions.push(...schedulerResult.actions);
    allEvents.push(...schedulerResult.events);

    // Pod Lifecycle Controller: handle Pending→Running transitions and failure modes
    const activeExercise = lesson ? getActiveExercise(lesson, state.currentExerciseIndex) : null;
    const podLifecycleEvents = runPodLifecycle(cluster, lesson, activeExercise);
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

    // Exercise afterTick hook (from active exercise, falls back to lesson)
    const afterTickFn = activeExercise?.afterTick ?? lesson?.afterTick;
    if (afterTickFn) {
      const mutated = afterTickFn(cluster.tick + 1, cluster);
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

    // Build output — suppress "no changes" noise during auto-run
    const outputLines: string[] = [];
    if (allActions.length === 0) {
      if (!auto) {
        outputLines.push(`[Tick ${cluster.tick}] No changes - cluster is at desired state.`);
      }
    } else {
      outputLines.push(`[Tick ${cluster.tick}] Controllers reconciled:`);
      for (const action of allActions) {
        outputLines.push(`  ${action.controller}: ${action.details}`);
      }
    }

    set((s) => ({
      cluster,
      actions: allActions,
      terminalOutput: outputLines.length > 0
        ? [...s.terminalOutput, ...outputLines, '']
        : s.terminalOutput,
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
      isAutoRunning: true,
      currentStep: 0,
      predictionPending: false,
      predictionResult: null,
      practiceInitialized: false,
      currentExerciseIndex: 0,
      exerciseCompleted: false,
      completedGoalIndices: [],
      yamlEditorContent: '',
      activeBottomTab: 'terminal',
    });
  },

  checkGoal: () => {
    const { currentLesson, cluster, lessonCompleted, currentStep, completedGoalIndices, exerciseCompleted, currentExerciseIndex } = get();
    if (!currentLesson || lessonCompleted || exerciseCompleted) return;

    const activeExercise = getActiveExercise(currentLesson, currentExerciseIndex);

    // Check step-level goalCheck (from active exercise or lesson)
    const steps = activeExercise?.steps ?? currentLesson.steps;
    if (steps) {
      const step = steps[currentStep];
      if (step?.goalCheck?.(cluster) && !get().predictionPending) {
        get().advanceStep();
      }
    }

    // Use goals from active exercise if available, else from lesson
    const goals = activeExercise?.goals ?? currentLesson.goals;
    const goalCheck = activeExercise?.goalCheck ?? currentLesson.goalCheck;
    const successMessage = activeExercise?.successMessage ?? currentLesson.successMessage;

    // Determine total exercises count
    const totalExercises = currentLesson.practices?.length ?? 1;
    const isLastExercise = currentExerciseIndex >= totalExercises - 1;

    // Update individual goal progress (latched + sequential)
    if (goals && goals.length > 0) {
      const newCompleted = [...completedGoalIndices];
      for (let i = 0; i < goals.length; i++) {
        if (newCompleted.includes(i)) continue; // already latched
        // Sequential: all prior goals must be latched first
        const allPriorDone = Array.from({ length: i }, (_, j) => j).every(j => newCompleted.includes(j));
        if (!allPriorDone) break; // can't skip ahead
        if (goals[i].check(cluster)) {
          newCompleted.push(i);
        }
      }
      if (newCompleted.length !== completedGoalIndices.length) {
        set({ completedGoalIndices: newCompleted });
      }

      // All exercise goals latched
      if (newCompleted.length === goals.length) {
        if (isLastExercise) {
          // Last exercise: mark lesson complete
          const { completedLessonIds } = get();
          const newLessonCompleted = completedLessonIds.includes(currentLesson.id)
            ? completedLessonIds
            : [...completedLessonIds, currentLesson.id];
          saveCompletedLessons(newLessonCompleted);
          set((s) => ({
            lessonCompleted: true,
            completedLessonIds: newLessonCompleted,
            terminalOutput: [
              ...s.terminalOutput,
              '',
              `\u2705 ${successMessage}`,
              '',
            ],
          }));
        } else {
          // More exercises remain: mark exercise completed
          set((s) => ({
            exerciseCompleted: true,
            terminalOutput: [
              ...s.terminalOutput,
              '',
              `\u2705 ${successMessage}`,
              '',
            ],
          }));
        }
      }
      return;
    }

    // Fallback: lessons/exercises without individual goals use goalCheck directly
    if (!goalCheck) return;
    if (goalCheck(cluster)) {
      if (isLastExercise) {
        const { completedLessonIds } = get();
        const newCompleted = completedLessonIds.includes(currentLesson.id)
          ? completedLessonIds
          : [...completedLessonIds, currentLesson.id];
        saveCompletedLessons(newCompleted);
        set((s) => ({
          lessonCompleted: true,
          completedGoalIndices: [0],
          completedLessonIds: newCompleted,
          terminalOutput: [
            ...s.terminalOutput,
            '',
            `\u2705 ${successMessage}`,
            '',
          ],
        }));
      } else {
        set((s) => ({
          exerciseCompleted: true,
          completedGoalIndices: [0],
          terminalOutput: [
            ...s.terminalOutput,
            '',
            `\u2705 ${successMessage}`,
            '',
          ],
        }));
      }
    }
  },

  setLessonCompleted: (completed) => set({ lessonCompleted: completed }),

  completeLectureQuiz: () => {
    const { currentLesson, completedLessonIds } = get();
    if (!currentLesson) return;

    const newCompleted = completedLessonIds.includes(currentLesson.id)
      ? completedLessonIds
      : [...completedLessonIds, currentLesson.id];
    saveCompletedLessons(newCompleted);
    set({
      lessonCompleted: true,
      completedLessonIds: newCompleted,
    });
  },

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
    const { currentLesson, currentExerciseIndex } = get();
    if (!currentLesson) return;

    const exercise = getActiveExercise(currentLesson, currentExerciseIndex);
    if (!exercise) return;

    const initState = exercise.initialState();
    const cluster: ClusterState = {
      pods: initState.pods || [],
      replicaSets: initState.replicaSets || [],
      deployments: initState.deployments || [],
      nodes: initState.nodes || [],
      services: initState.services || [],
      events: initState.events || [],
      namespaces: initState.namespaces || [],
      configMaps: initState.configMaps || [],
      secrets: initState.secrets || [],
      ingresses: initState.ingresses || [],
      statefulSets: initState.statefulSets || [],
      daemonSets: initState.daemonSets || [],
      jobs: initState.jobs || [],
      cronJobs: initState.cronJobs || [],
      hpas: initState.hpas || [],
      storageClasses: initState.storageClasses || [],
      persistentVolumes: initState.persistentVolumes || [],
      persistentVolumeClaims: initState.persistentVolumeClaims || [],
      podDisruptionBudgets: initState.podDisruptionBudgets || [],
      helmReleases: initState.helmReleases || [],
      _commandsUsed: [],
      tick: 0,
    };

    const totalExercises = currentLesson.practices?.length ?? 1;
    const exerciseLabel = totalExercises > 1 ? ` (Exercise ${currentExerciseIndex + 1} of ${totalExercises})` : '';

    const terminalOutput = [
      `--- Lesson ${lessonDisplayNumber[currentLesson.id] ?? currentLesson.id}: ${currentLesson.title} (Practice)${exerciseLabel} ---`,
      '',
      `Goal: ${exercise.goalDescription}`,
      '',
      'Type "hint" for a hint if you get stuck.',
      '',
    ];

    // Show first step instruction if it triggers onLoad
    let predictionPending = false;
    const steps = exercise.steps;
    if (steps && steps.length > 0) {
      const firstStep = steps[0];
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
      exerciseCompleted: false,
      practiceInitialized: true,
      completedGoalIndices: [],
      cluster,
      actions: [],
      terminalOutput,
      isAutoRunning: true,
      currentStep: 0,
      hintIndex: 0,
      predictionPending,
      predictionResult: null,
      yamlEditorContent: exercise.yamlTemplate || '',
      activeBottomTab: exercise.yamlTemplate ? 'yaml' : 'terminal',
    });
  },

  startNextExercise: () => {
    const { currentLesson, currentExerciseIndex } = get();
    if (!currentLesson) return;

    const nextIndex = currentExerciseIndex + 1;
    set({ currentExerciseIndex: nextIndex, exerciseCompleted: false });
    get().startPractice();
  },

  goToPhase: (phase) => {
    const { currentLesson, lessonPhase: currentPhase, practiceInitialized } = get();
    if (!currentLesson) return;

    if (phase === 'lecture') {
      set({ lessonPhase: 'lecture' });
    } else if (phase === 'quiz') {
      if (currentPhase === 'practice') {
        // Going backward from practice: show quiz results without resetting
        set({ lessonPhase: 'quiz' });
      } else {
        get().startQuiz();
      }
    } else if (phase === 'practice') {
      if (currentLesson.mode === 'lecture-quiz') return;
      if (practiceInitialized) {
        // Practice was already running — just switch back without resetting
        set({ lessonPhase: 'practice' });
      } else {
        get().startPractice();
      }
    }
  },

  revealNextHint: () => {
    const { currentLesson, hintIndex, currentExerciseIndex } = get();
    if (!currentLesson) return;
    const exercise = getActiveExercise(currentLesson, currentExerciseIndex);
    const hints = exercise?.hints ?? currentLesson.hints;
    if (!hints || hints.length === 0) {
      set((s) => ({
        terminalOutput: [...s.terminalOutput, 'No hints available for this lesson.', ''],
      }));
      return;
    }
    if (hintIndex >= hints.length) {
      set((s) => ({
        terminalOutput: [...s.terminalOutput, 'No more hints available.', ''],
      }));
      return;
    }
    const hint = hints[hintIndex];
    const prefix = hint.exact ? 'Hint: ' : 'Hint: ';
    const formatted = hint.exact ? `${prefix}\`${hint.text}\`` : `${prefix}${hint.text}`;
    set((s) => ({
      hintIndex: s.hintIndex + 1,
      terminalOutput: [...s.terminalOutput, formatted, ''],
    }));
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

function runPodLifecycle(cluster: ClusterState, lesson: Lesson | null, activeExercise?: PracticeExercise | null): SimEvent[] {
  const events: SimEvent[] = [];
  const currentTick = cluster.tick;
  const failureRules = activeExercise?.podFailureRules ?? lesson?.podFailureRules;

  for (const pod of cluster.pods) {
    if (pod.metadata.deletionTimestamp) continue;

    // Apply lesson/exercise failure rules to newly created pods
    if (failureRules && pod.status.phase === 'Pending' && !pod.spec.failureMode) {
      const failure = failureRules[pod.spec.image];
      if (failure) {
        pod.spec.failureMode = failure;
      }
    }

    // Check ConfigMap/Secret dependencies for Pending pods
    if (pod.status.phase === 'Pending' && pod.spec.envFrom && !pod.spec.failureMode) {
      let missingRef: string | null = null;
      for (const ref of pod.spec.envFrom) {
        if (ref.configMapRef && !cluster.configMaps.find((c) => c.metadata.name === ref.configMapRef)) {
          missingRef = `configmap "${ref.configMapRef}" not found`;
          break;
        }
        if (ref.secretRef && !cluster.secrets.find((s) => s.metadata.name === ref.secretRef)) {
          missingRef = `secret "${ref.secretRef}" not found`;
          break;
        }
      }
      if (missingRef) {
        if (pod.status.reason !== 'CreateContainerConfigError') {
          pod.status.reason = 'CreateContainerConfigError';
          pod.status.message = missingRef;
          if (!pod.spec.logs) pod.spec.logs = [];
          pod.spec.logs.push(`[error] ${missingRef}`);
          events.push({
            timestamp: Date.now(), tick: currentTick, type: 'Warning', reason: 'Failed',
            objectKind: 'Pod', objectName: pod.metadata.name,
            message: `CreateContainerConfigError: ${missingRef}`,
          });
        }
        continue;
      } else if (pod.status.reason === 'CreateContainerConfigError') {
        // Dependency now exists, clear the error
        pod.status.reason = undefined;
        pod.status.message = undefined;
        if (!pod.spec.logs) pod.spec.logs = [];
        pod.spec.logs.push('[info] Dependencies resolved, starting container');
      }
    }

    // Check PVC dependencies for Pending pods
    if (pod.status.phase === 'Pending' && pod.spec.volumes && !pod.spec.failureMode) {
      let unboundPVC: string | null = null;
      for (const vol of pod.spec.volumes) {
        if (vol.persistentVolumeClaim) {
          const pvc = cluster.persistentVolumeClaims.find(
            (p) => p.metadata.name === vol.persistentVolumeClaim!.claimName
          );
          if (!pvc || pvc.status.phase !== 'Bound') {
            unboundPVC = vol.persistentVolumeClaim.claimName;
            break;
          }
        }
      }
      if (unboundPVC) {
        if (pod.status.reason !== 'Pending') {
          pod.status.reason = 'Pending';
          pod.status.message = `persistentvolumeclaim "${unboundPVC}" not bound`;
          events.push({
            timestamp: Date.now(), tick: currentTick, type: 'Warning', reason: 'FailedScheduling',
            objectKind: 'Pod', objectName: pod.metadata.name,
            message: `persistentvolumeclaim "${unboundPVC}" not bound`,
          });
        }
        continue;
      } else if (pod.status.reason === 'Pending' && pod.status.message?.includes('persistentvolumeclaim')) {
        // PVC is now bound, clear the error
        pod.status.reason = undefined;
        pod.status.message = undefined;
      }
    }

    // Handle init containers: run them sequentially before main container
    if (pod.spec.initContainers && pod.spec.initContainers.length > 0 && pod.status.phase === 'Pending' && !pod.status.reason) {
      if (!pod.status.initContainerStatuses) {
        pod.status.initContainerStatuses = pod.spec.initContainers.map((ic) => ({
          name: ic.name,
          state: 'waiting' as const,
        }));
      }
      const statuses = pod.status.initContainerStatuses!;
      const allCompleted = statuses.every((s) => s.state === 'completed');
      if (!allCompleted) {
        // Find the current init container to process
        const currentIdx = statuses.findIndex((s) => s.state !== 'completed');
        if (currentIdx >= 0) {
          const icStatus = statuses[currentIdx];
          const icSpec = pod.spec.initContainers[currentIdx];
          if (icStatus.state === 'waiting') {
            icStatus.state = 'running';
            if (!pod.spec.logs) pod.spec.logs = [];
            pod.spec.logs.push(`[init:${icSpec.name}] Starting init container`);
            events.push({
              timestamp: Date.now(), tick: currentTick, type: 'Normal', reason: 'Started',
              objectKind: 'Pod', objectName: pod.metadata.name,
              message: `Started init container "${icSpec.name}" with image "${icSpec.image}"`,
            });
          } else if (icStatus.state === 'running') {
            if (icSpec.failureMode === 'fail') {
              pod.status.reason = 'Init:Error';
              pod.status.message = `Init container "${icSpec.name}" failed`;
              if (!pod.spec.logs) pod.spec.logs = [];
              pod.spec.logs.push(`[init:${icSpec.name}] Error: init container failed`);
              events.push({
                timestamp: Date.now(), tick: currentTick, type: 'Warning', reason: 'Failed',
                objectKind: 'Pod', objectName: pod.metadata.name,
                message: `Init container "${icSpec.name}" failed`,
              });
              continue;
            }
            icStatus.state = 'completed';
            if (!pod.spec.logs) pod.spec.logs = [];
            pod.spec.logs.push(`[init:${icSpec.name}] Completed successfully`);
            events.push({
              timestamp: Date.now(), tick: currentTick, type: 'Normal', reason: 'Completed',
              objectKind: 'Pod', objectName: pod.metadata.name,
              message: `Init container "${icSpec.name}" completed`,
            });
          }
        }
        // If not all completed yet, skip the rest of the lifecycle for this tick
        const nowAllCompleted = statuses.every((s) => s.state === 'completed');
        if (!nowAllCompleted) continue;
        // All init containers done — fall through to normal lifecycle
      }
    }

    // Handle failure modes
    if (pod.spec.failureMode === 'ImagePullError') {
      if (pod.status.phase === 'Pending') {
        pod.status.reason = 'ImagePullError';
        pod.status.message = `Failed to pull image "${pod.spec.image}": image not found`;
        if (!pod.spec.logs) pod.spec.logs = [];
        pod.spec.logs.push(`[error] Failed to pull image "${pod.spec.image}": not found in registry`);
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
      if (!pod.spec.logs) pod.spec.logs = [];
      if (pod.status.phase === 'Pending' && pod.status.tickCreated !== undefined && currentTick > pod.status.tickCreated) {
        pod.status.phase = 'Running';
        pod.status.reason = undefined;
        pod.spec.logs.push(`[startup] Container started with image ${pod.spec.image}`);
        continue;
      }
      if (pod.status.phase === 'Running') {
        pod.status.phase = 'CrashLoopBackOff';
        pod.status.reason = 'CrashLoopBackOff';
        pod.status.message = 'Back-off restarting failed container';
        pod.status.restartCount = (pod.status.restartCount || 0) + 1;
        (pod.status as any)._crashTick = currentTick;
        pod.spec.logs.push(`[fatal] Process exited with code 1`);
        pod.spec.logs.push(`[error] Back-off restarting failed container`);
        events.push({
          timestamp: Date.now(), tick: currentTick, type: 'Warning', reason: 'BackOff',
          objectKind: 'Pod', objectName: pod.metadata.name,
          message: `Back-off restarting failed container (restart count: ${pod.status.restartCount})`,
        });
        continue;
      }
      if (pod.status.phase === 'CrashLoopBackOff') {
        // Exponential backoff: wait longer between restarts (simulates real K8s 10s, 20s, 40s... up to 5min)
        const restarts = pod.status.restartCount || 1;
        const backoffTicks = Math.min(restarts, 4); // 1, 2, 3, 4 ticks backoff
        const crashTick = (pod.status as any)._crashTick ?? currentTick;
        if (currentTick - crashTick >= backoffTicks) {
          pod.status.phase = 'Running';
          pod.status.reason = undefined;
        }
        continue;
      }
    }

    if (pod.spec.failureMode === 'OOMKilled') {
      if (!pod.spec.logs) pod.spec.logs = [];
      if (pod.status.phase === 'Pending' && pod.status.tickCreated !== undefined && currentTick > pod.status.tickCreated) {
        pod.status.phase = 'Running';
        pod.status.reason = undefined;
        pod.spec.logs.push(`[startup] Container started with image ${pod.spec.image}`);
        continue;
      }
      if (pod.status.phase === 'Running') {
        pod.status.phase = 'Failed';
        pod.status.reason = 'OOMKilled';
        pod.status.message = 'Container exceeded memory limit';
        pod.status.restartCount = (pod.status.restartCount || 0) + 1;
        pod.spec.logs.push(`[fatal] Container killed: OOMKilled — memory limit exceeded`);
        events.push({
          timestamp: Date.now(), tick: currentTick, type: 'Warning', reason: 'OOMKilled',
          objectKind: 'Pod', objectName: pod.metadata.name,
          message: `OOMKilled - container exceeded memory limit`,
        });
        pod.metadata.deletionTimestamp = Date.now();
        continue;
      }
    }

    // Handle Job pods: complete after completionTicks
    if (pod.spec.completionTicks && pod.status.phase === 'Running') {
      const age = currentTick - (pod.status.tickCreated || 0);
      if (age >= pod.spec.completionTicks) {
        pod.status.phase = 'Succeeded';
        if (!pod.spec.logs) pod.spec.logs = [];
        pod.spec.logs.push(`[info] Task completed successfully, exit code 0`);
        events.push({
          timestamp: Date.now(), tick: currentTick, type: 'Normal', reason: 'Completed',
          objectKind: 'Pod', objectName: pod.metadata.name,
          message: `Pod completed successfully`,
        });
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
        if (!pod.spec.logs) pod.spec.logs = [];
        pod.spec.logs.push(`[startup] Container started with image ${pod.spec.image}`);
        pod.spec.logs.push(`[info] Listening on port 8080`);

        // Set readiness based on readiness probe
        if (pod.spec.readinessProbe) {
          const delay = pod.spec.readinessProbe.initialDelaySeconds || 0;
          const age = currentTick - (pod.status.tickCreated || 0);
          pod.status.ready = age > delay;
        } else {
          pod.status.ready = true;
        }

        events.push({
          timestamp: Date.now(), tick: currentTick, type: 'Normal', reason: 'Started',
          objectKind: 'Pod', objectName: pod.metadata.name,
          message: `Started container with image "${pod.spec.image}"`,
        });
      }
    }

    // Startup probe lifecycle: keep ready=false and suspend liveness until startup probe passes
    if (pod.status.phase === 'Running' && pod.spec.startupProbe && !pod.status.startupProbeCompleted) {
      const probe = pod.spec.startupProbe;
      const failureThreshold = probe.failureThreshold || 3;
      const periodSeconds = probe.periodSeconds || 1;
      const ticksNeeded = failureThreshold * periodSeconds;
      const age = currentTick - (pod.status.tickCreated || 0);
      if (age >= ticksNeeded) {
        // Startup probe passes
        pod.status.startupProbeCompleted = true;
        pod.status.ready = true;
        if (!pod.spec.logs) pod.spec.logs = [];
        pod.spec.logs.push(`[startup-probe] Startup probe passed after ${age} ticks`);
        events.push({
          timestamp: Date.now(), tick: currentTick, type: 'Normal', reason: 'StartupProbeSucceeded',
          objectKind: 'Pod', objectName: pod.metadata.name,
          message: `Startup probe passed — liveness and readiness probes now active`,
        });
      } else {
        // Startup probe still running — keep not ready, suspend liveness
        pod.status.ready = false;
      }
      continue;
    }

    // Liveness probe: restart pods that fail liveness checks after initialDelaySeconds
    // Only active after startup probe passes (or if no startup probe)
    if (pod.status.phase === 'Running' && pod.spec.livenessProbe && (!pod.spec.startupProbe || pod.status.startupProbeCompleted)) {
      const probe = pod.spec.livenessProbe;
      const delay = probe.initialDelaySeconds || 0;
      const period = probe.periodSeconds || 10;
      const failureThreshold = probe.failureThreshold || 3;
      const age = currentTick - (pod.status.tickCreated || 0);
      // After initial delay, check periodically
      if (age > delay && (age - delay) % period === 0) {
        // In the simulator, a pod "fails" liveness if it has a failureMode set
        // This models real K8s where a crashing/unhealthy app fails the probe
        if (pod.spec.failureMode) {
          // Increment a liveness failure counter
          const livenessFailures = ((pod.status as any)._livenessFailures || 0) + 1;
          (pod.status as any)._livenessFailures = livenessFailures;
          if (livenessFailures >= failureThreshold) {
            // Restart the pod (like kubelet would)
            pod.status.restartCount = (pod.status.restartCount || 0) + 1;
            pod.status.phase = 'Pending';
            pod.status.ready = false;
            pod.status.tickCreated = currentTick;
            (pod.status as any)._livenessFailures = 0;
            if (!pod.spec.logs) pod.spec.logs = [];
            pod.spec.logs.push(`[liveness-probe] Liveness probe failed ${failureThreshold} times — restarting container`);
            events.push({
              timestamp: Date.now(), tick: currentTick, type: 'Warning', reason: 'Unhealthy',
              objectKind: 'Pod', objectName: pod.metadata.name,
              message: `Liveness probe failed — container restarted (restart count: ${pod.status.restartCount})`,
            });
            continue;
          }
        } else {
          // Probe passes — reset failure counter
          (pod.status as any)._livenessFailures = 0;
        }
      }
    }

    // Update readiness for running pods with readiness probes
    if (pod.status.phase === 'Running' && pod.spec.readinessProbe) {
      const delay = pod.spec.readinessProbe.initialDelaySeconds || 0;
      const age = currentTick - (pod.status.tickCreated || 0);
      pod.status.ready = age > delay;
    }

    // Generate periodic running logs for long-lived pods
    if (pod.status.phase === 'Running' && !pod.spec.completionTicks) {
      if (!pod.spec.logs) pod.spec.logs = [];
      if (currentTick % 3 === 0) {
        pod.spec.logs.push(`[info] Serving requests on :8080`);
      }
      // Cap log lines to avoid memory bloat
      if (pod.spec.logs.length > 50) {
        pod.spec.logs = pod.spec.logs.slice(-50);
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
