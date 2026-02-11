export interface ObjectMeta {
  name: string;
  uid: string;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  namespace?: string;
  ownerReference?: {
    kind: string;
    name: string;
    uid: string;
  };
  deletionTimestamp?: number;
  creationTimestamp: number;
}

export interface ResourceRequirements {
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}

export interface Probe {
  type: 'httpGet' | 'exec' | 'tcpSocket';
  path?: string;
  port?: number;
  command?: string[];
  initialDelaySeconds?: number;
  periodSeconds?: number;
  failureThreshold?: number;
}

export interface PodSpec {
  image: string;
  nodeName?: string;
  failureMode?: 'ImagePullError' | 'CrashLoopBackOff' | 'OOMKilled' | null;
  namespace?: string;
  resources?: ResourceRequirements;
  livenessProbe?: Probe;
  readinessProbe?: Probe;
  startupProbe?: Probe;
  envFrom?: { configMapRef?: string; secretRef?: string }[];
  env?: { name: string; value?: string; valueFrom?: { configMapKeyRef?: { name: string; key: string }; secretKeyRef?: { name: string; key: string } } }[];
  completionTicks?: number;
  restartPolicy?: 'Always' | 'OnFailure' | 'Never';
  logs?: string[];
  tolerations?: { key: string; operator?: 'Equal' | 'Exists'; value?: string; effect?: string }[];
  volumes?: Array<{ name: string; persistentVolumeClaim?: { claimName: string } }>;
  initContainers?: { name: string; image: string; failureMode?: 'fail' }[];
}

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Terminating' | 'CrashLoopBackOff';

export interface PodStatus {
  phase: PodPhase;
  tickCreated?: number;
  reason?: string;
  message?: string;
  restartCount?: number;
  ready?: boolean;
  cpuUsage?: number;
  initContainerStatuses?: { name: string; state: 'waiting' | 'running' | 'completed' }[];
  startupProbeCompleted?: boolean;
}

export interface Pod {
  kind: 'Pod';
  metadata: ObjectMeta;
  spec: PodSpec;
  status: PodStatus;
}

export interface ReplicaSetSpec {
  replicas: number;
  selector: Record<string, string>;
  template: {
    labels: Record<string, string>;
    spec: PodSpec;
  };
}

export interface ReplicaSetStatus {
  replicas: number;
  readyReplicas: number;
}

export interface ReplicaSet {
  kind: 'ReplicaSet';
  metadata: ObjectMeta;
  spec: ReplicaSetSpec;
  status: ReplicaSetStatus;
}

export interface DeploymentSpec {
  replicas: number;
  selector: Record<string, string>;
  template: {
    labels: Record<string, string>;
    spec: PodSpec;
  };
  strategy: {
    type: 'RollingUpdate' | 'Recreate';
    maxSurge: number;
    maxUnavailable: number;
  };
}

export interface DeploymentStatus {
  replicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  availableReplicas: number;
  conditions: Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
  }>;
}

export interface Deployment {
  kind: 'Deployment';
  metadata: ObjectMeta;
  spec: DeploymentSpec;
  status: DeploymentStatus;
}

// --- Events ---

export interface SimEvent {
  timestamp: number;
  tick: number;
  type: 'Normal' | 'Warning';
  reason: string;
  objectKind: string;
  objectName: string;
  message: string;
}

// --- Nodes ---

export interface SimNode {
  kind: 'Node';
  metadata: ObjectMeta;
  spec: {
    capacity: { pods: number };
    taints?: { key: string; value?: string; effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute' }[];
    unschedulable?: boolean;
  };
  status: {
    conditions: [{ type: 'Ready'; status: 'True' | 'False' }];
    allocatedPods: number;
  };
}

// --- Services ---

export interface Service {
  kind: 'Service';
  metadata: ObjectMeta;
  spec: { selector: Record<string, string>; port: number; type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' };
  status: { endpoints: string[] };
}

// --- Namespaces ---

export interface Namespace {
  kind: 'Namespace';
  metadata: ObjectMeta;
  status: { phase: 'Active' | 'Terminating' };
}

// --- ConfigMaps ---

export interface ConfigMap {
  kind: 'ConfigMap';
  metadata: ObjectMeta;
  data: Record<string, string>;
}

// --- Secrets ---

export interface Secret {
  kind: 'Secret';
  metadata: ObjectMeta;
  type: string;
  data: Record<string, string>;
}

// --- Ingress ---

export interface IngressRule {
  host: string;
  path: string;
  serviceName: string;
  servicePort: number;
}

export interface Ingress {
  kind: 'Ingress';
  metadata: ObjectMeta;
  spec: { rules: IngressRule[] };
  status: { loadBalancer?: { ip: string } };
}

// --- StatefulSets ---

export interface StatefulSetSpec {
  replicas: number;
  selector: Record<string, string>;
  serviceName: string;
  template: {
    labels: Record<string, string>;
    spec: PodSpec;
  };
}

export interface StatefulSet {
  kind: 'StatefulSet';
  metadata: ObjectMeta;
  spec: StatefulSetSpec;
  status: { replicas: number; readyReplicas: number; currentReplicas: number };
}

// --- DaemonSets ---

export interface DaemonSetSpec {
  selector: Record<string, string>;
  template: {
    labels: Record<string, string>;
    spec: PodSpec;
  };
}

export interface DaemonSet {
  kind: 'DaemonSet';
  metadata: ObjectMeta;
  spec: DaemonSetSpec;
  status: { desiredNumberScheduled: number; currentNumberScheduled: number; numberReady: number };
}

// --- Jobs ---

export interface JobSpec {
  completions: number;
  parallelism: number;
  backoffLimit: number;
  template: {
    labels: Record<string, string>;
    spec: PodSpec;
  };
}

export interface Job {
  kind: 'Job';
  metadata: ObjectMeta;
  spec: JobSpec;
  status: { succeeded: number; failed: number; active: number; startTime?: number; completionTime?: number };
}

// --- CronJobs ---

export interface CronJobSpec {
  schedule: string;
  jobTemplate: {
    spec: JobSpec;
  };
}

export interface CronJob {
  kind: 'CronJob';
  metadata: ObjectMeta;
  spec: CronJobSpec;
  status: { lastScheduleTime?: number; active: number };
}

// --- HPA ---

export interface HorizontalPodAutoscaler {
  kind: 'HorizontalPodAutoscaler';
  metadata: ObjectMeta;
  spec: {
    scaleTargetRef: { kind: string; name: string };
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilizationPercentage: number;
  };
  status: { currentReplicas: number; desiredReplicas: number; currentCPUUtilizationPercentage?: number };
}

// --- Storage ---

export interface StorageClass {
  kind: 'StorageClass';
  metadata: ObjectMeta;
  provisioner: string;
  reclaimPolicy: 'Delete' | 'Retain';
}

export interface PersistentVolume {
  kind: 'PersistentVolume';
  metadata: ObjectMeta;
  spec: {
    capacity: { storage: string };
    accessModes: string[];
    storageClassName: string;
    claimRef?: { name: string; uid: string };
  };
  status: { phase: 'Available' | 'Bound' | 'Released' };
}

export interface PersistentVolumeClaim {
  kind: 'PersistentVolumeClaim';
  metadata: ObjectMeta;
  spec: {
    accessModes: string[];
    resources: { requests: { storage: string } };
    storageClassName?: string;
  };
  status: { phase: 'Pending' | 'Bound'; volumeName?: string };
}

// --- PodDisruptionBudget ---

export interface PodDisruptionBudget {
  kind: 'PodDisruptionBudget';
  metadata: ObjectMeta;
  spec: {
    selector: Record<string, string>;
    minAvailable?: number;
    maxUnavailable?: number;
  };
  status: { disruptionsAllowed: number; currentHealthy: number; desiredHealthy: number; expectedPods: number };
}

// --- Helm ---

export interface HelmRelease {
  name: string;
  chart: string;
  status: 'deployed' | 'uninstalled';
  deploymentName: string;
}

export type KubeObject = Pod | ReplicaSet | Deployment | SimNode | Service | Namespace | ConfigMap | Secret | Ingress | StatefulSet | DaemonSet | Job | CronJob | HorizontalPodAutoscaler | StorageClass | PersistentVolume | PersistentVolumeClaim | PodDisruptionBudget;

export interface ClusterState {
  pods: Pod[];
  replicaSets: ReplicaSet[];
  deployments: Deployment[];
  nodes: SimNode[];
  services: Service[];
  events: SimEvent[];
  namespaces: Namespace[];
  configMaps: ConfigMap[];
  secrets: Secret[];
  ingresses: Ingress[];
  statefulSets: StatefulSet[];
  daemonSets: DaemonSet[];
  jobs: Job[];
  cronJobs: CronJob[];
  hpas: HorizontalPodAutoscaler[];
  storageClasses: StorageClass[];
  persistentVolumes: PersistentVolume[];
  persistentVolumeClaims: PersistentVolumeClaim[];
  podDisruptionBudgets: PodDisruptionBudget[];
  helmReleases: HelmRelease[];
  tick: number;
}

export interface ControllerAction {
  controller: string;
  action: string;
  details: string;
}
