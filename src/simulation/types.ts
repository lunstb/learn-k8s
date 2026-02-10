export interface ObjectMeta {
  name: string;
  uid: string;
  labels: Record<string, string>;
  ownerReference?: {
    kind: string;
    name: string;
    uid: string;
  };
  deletionTimestamp?: number;
  creationTimestamp: number;
}

export interface PodSpec {
  image: string;
  nodeName?: string;
  failureMode?: 'ImagePullError' | 'CrashLoopBackOff' | null;
}

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Terminating' | 'CrashLoopBackOff';

export interface PodStatus {
  phase: PodPhase;
  tickCreated?: number;
  reason?: string;
  message?: string;
  restartCount?: number;
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
  spec: { capacity: { pods: number } };
  status: {
    conditions: [{ type: 'Ready'; status: 'True' | 'False' }];
    allocatedPods: number;
  };
}

// --- Services ---

export interface Service {
  kind: 'Service';
  metadata: ObjectMeta;
  spec: { selector: Record<string, string>; port: number };
  status: { endpoints: string[] };
}

export type KubeObject = Pod | ReplicaSet | Deployment | SimNode | Service;

export interface ClusterState {
  pods: Pod[];
  replicaSets: ReplicaSet[];
  deployments: Deployment[];
  nodes: SimNode[];
  services: Service[];
  events: SimEvent[];
  tick: number;
}

export interface ControllerAction {
  controller: string;
  action: string;
  details: string;
}
