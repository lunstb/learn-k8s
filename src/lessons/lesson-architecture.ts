import type { Lesson } from './types';

export const lessonArchitecture: Lesson = {
  id: 25,
  title: 'Kubernetes Architecture Deep Dive',
  description:
    'Understand the control plane and node components that make Kubernetes work — API server, etcd, scheduler, controller manager, kubelet, and kube-proxy.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand the architecture of a Kubernetes cluster.',
  lecture: {
    sections: [
      {
        title: 'Control Plane: The Brain of the Cluster',
        content:
          'The control plane runs on one or more master nodes and makes all scheduling and lifecycle decisions.\n\n' +
          'API Server (kube-apiserver): The front door to the cluster. Every kubectl command, every controller, ' +
          'and every kubelet communicates through the API Server. It validates and persists objects to etcd. ' +
          'It is the only component that talks to etcd directly.\n\n' +
          'etcd: A distributed key-value store that holds all cluster state — every Pod, Deployment, Service, ' +
          'ConfigMap, and Secret. If etcd is lost without backup, the entire cluster state is gone. ' +
          'etcd uses the Raft consensus protocol for high availability across multiple nodes.\n\n' +
          'Scheduler (kube-scheduler): Watches for newly created Pods with no Node assigned. ' +
          'It evaluates constraints (resource requests, node affinity, taints/tolerations, topology spread) ' +
          'and picks the best Node. The Scheduler does NOT run pods — it just writes the nodeName assignment.\n\n' +
          'Controller Manager (kube-controller-manager): Runs all built-in control loops — Deployment controller, ' +
          'ReplicaSet controller, Job controller, Endpoints controller, and more. Each controller watches for ' +
          'changes to its resources and reconciles desired state with actual state.',
        diagram:
          '  ┌─────────────────────────────────────────────┐\n' +
          '  │              Control Plane                   │\n' +
          '  │                                              │\n' +
          '  │  kubectl ──▶ API Server ──▶ etcd             │\n' +
          '  │                  ▲                            │\n' +
          '  │    Scheduler ────┘──── Controller Manager     │\n' +
          '  └─────────────────────────────────────────────┘',
        keyTakeaway:
          'The control plane has four core components: API Server (gateway), etcd (state store), Scheduler (pod placement), and Controller Manager (reconciliation loops).',
      },
      {
        title: 'Node Components: Where Pods Actually Run',
        content:
          'Every worker Node runs three components:\n\n' +
          'kubelet: The agent on each Node that receives PodSpecs from the API Server and ensures ' +
          'the described containers are running and healthy. It reports node status and pod status back to the API Server. ' +
          'If the kubelet stops, the control plane loses visibility into that node — pods appear "Unknown" and ' +
          'eventually get rescheduled elsewhere.\n\n' +
          'kube-proxy: Maintains network rules (iptables or IPVS) on each Node so that Service ClusterIPs ' +
          'route traffic to the correct pod IPs. When you create a Service, kube-proxy on every Node ' +
          'updates its rules so any pod on any node can reach the service.\n\n' +
          'Container Runtime: The software that actually runs containers — containerd (most common), ' +
          'CRI-O, or another CRI-compatible runtime. Docker was used historically but was removed as a direct ' +
          'runtime in Kubernetes 1.24 (containerd underneath Docker still works).\n\n' +
          'Together, the kubelet pulls the image, the container runtime starts it, and kube-proxy ensures ' +
          'network connectivity to Services.',
        keyTakeaway:
          'Nodes run kubelet (pod lifecycle), kube-proxy (service networking), and a container runtime (container execution). The kubelet is the critical link between control plane and node.',
      },
      {
        title: 'Request Flow: kubectl create deployment',
        content:
          'What happens when you run `kubectl create deployment nginx --image=nginx --replicas=3`?\n\n' +
          '1. kubectl sends an HTTP POST to the API Server with the Deployment spec.\n' +
          '2. API Server authenticates and authorizes the request (RBAC), validates the spec, ' +
          'and persists the Deployment object to etcd.\n' +
          '3. The Deployment controller (in Controller Manager) notices the new Deployment. ' +
          'It creates a ReplicaSet with replicas=3.\n' +
          '4. The ReplicaSet controller notices the ReplicaSet and creates 3 Pod objects (phase=Pending, no nodeName).\n' +
          '5. The Scheduler notices 3 unassigned Pods. For each Pod, it evaluates nodes, picks the best one, ' +
          'and writes the nodeName into the Pod spec.\n' +
          '6. The kubelet on each assigned Node detects a Pod assigned to it. It pulls the container image ' +
          'and starts the container.\n' +
          '7. The kubelet reports the Pod status back (Running, Ready). The Endpoints controller sees a Running Pod ' +
          'matching a Service selector and adds it to the Service endpoints.\n\n' +
          'Every step is asynchronous and declarative. No component "calls" another — they all watch the API Server for changes.',
        keyTakeaway:
          'A deployment flows through: API Server → etcd → Deployment controller → ReplicaSet controller → Scheduler → kubelet → container runtime. Each step is a watch-and-reconcile loop, not a synchronous call chain.',
      },
      {
        title: 'Failure Scenarios: What Breaks When',
        content:
          'Understanding which component failures cause which symptoms is critical for debugging:\n\n' +
          'etcd down: No state changes can be persisted. Existing pods keep running (kubelet caches its PodSpecs), ' +
          'but no new pods can be created, no scaling can happen, and no updates can be applied. ' +
          'This is the most severe failure — restore etcd from backup.\n\n' +
          'Scheduler down: Existing pods keep running. New pods stay Pending with no nodeName. ' +
          'Symptom: "0/N nodes are available" events never appear because the Scheduler is not even trying.\n\n' +
          'Controller Manager down: Existing pods keep running. But deployments cannot create ReplicaSets, ' +
          'ReplicaSets cannot create Pods, failed pods are not replaced, and endpoints are not updated. ' +
          'The cluster is alive but cannot self-heal.\n\n' +
          'kubelet down on a node: Pods on that node keep running (container runtime still has them) but ' +
          'the control plane sees the node as NotReady. After ~5 minutes (node-monitor-grace-period), ' +
          'pods are marked for eviction and rescheduled to healthy nodes.\n\n' +
          'API Server down: Nothing can change. kubectl commands fail. But existing pods continue running ' +
          'because the kubelet keeps its cached state.',
        keyTakeaway:
          'etcd loss is catastrophic (no state). Scheduler loss stops new placements. Controller Manager loss stops reconciliation. kubelet loss makes a node go dark. API Server loss freezes all changes but running pods survive.',
      },
    ],
  },
  quiz: [
    {
      question:
        'The Scheduler has been down for 10 minutes but etcd, API Server, and Controller Manager are healthy. You run `kubectl create deployment test --image=nginx --replicas=3`. What is the current state of the cluster?',
      choices: [
        'The Deployment exists but no ReplicaSet or Pods are created because the Controller Manager waits for the Scheduler',
        'The Pods are created and scheduled to nodes because the kubelet can request placement without the Scheduler',
        'The API Server rejects the command because it requires the Scheduler to validate resource availability first',
        'The Deployment, ReplicaSet, and 3 Pods all exist in etcd, but every Pod remains Pending with no nodeName assigned',
      ],
      correctIndex: 3,
      explanation:
        'The API Server persists the Deployment. The Controller Manager creates the ReplicaSet and Pods. ' +
        'But the Scheduler (which assigns Pods to Nodes) is down, so all 3 Pods stay Pending with no nodeName. ' +
        'The kubelet only acts on Pods assigned to its node, so nothing starts. When the Scheduler recovers, ' +
        'it will immediately assign the pending Pods.',
    },
    {
      question:
        'Which component is the ONLY one that directly reads from and writes to etcd?',
      choices: [
        'kubelet — it persists pod status directly to etcd to reduce latency on status updates',
        'Controller Manager — it reads desired state from etcd and writes reconciliation results back directly',
        'API Server — all other components communicate exclusively through the API Server',
        'Scheduler — it reads pending pods from etcd and writes node assignment decisions back directly',
      ],
      correctIndex: 2,
      explanation:
        'The API Server is the single gateway to etcd. Every component — kubectl, Scheduler, Controller Manager, ' +
        'kubelet — talks to the API Server via its REST API. The API Server validates, authorizes, and persists ' +
        'changes to etcd. This design ensures consistent access control and validation in one place.',
    },
    {
      question:
        'Your cluster has 5 nodes. One node\'s kubelet crashes but the container runtime continues working. What happens to the pods on that node?',
      choices: [
        'The pods continue running, but the control plane marks the node NotReady and eventually reschedules pods elsewhere',
        'The containers are immediately stopped because the container runtime requires the kubelet to maintain its process table',
        'kube-proxy detects the kubelet failure and takes over pod lifecycle management on that node temporarily',
        'The API Server connects directly to the container runtime via CRI to manage pods when the kubelet is down',
      ],
      correctIndex: 0,
      explanation:
        'The container runtime is independent of the kubelet — running containers continue running. However, ' +
        'the kubelet is responsible for reporting node health. When heartbeats stop, the node is marked NotReady ' +
        'after the node-monitor-grace-period (~40s). After the pod-eviction-timeout (~5min), the pods are evicted ' +
        'and rescheduled to healthy nodes by the Node Lifecycle Controller.',
    },
    {
      question:
        'A developer asks: "Where does my Deployment actually run? On the control plane or worker nodes?" What is the correct answer?',
      choices: [
        'The Deployment object and its controller run on the control plane, while only the Pod containers execute on worker nodes',
        'The Deployment object is stored in etcd, its controller logic runs in Controller Manager, and the containers run on worker nodes via kubelet',
        'Everything runs on worker nodes — the control plane only persists configuration data and does not execute any logic',
        'The Deployment runs on whichever node the Scheduler selects, co-located with the Pods it manages for efficiency',
      ],
      correctIndex: 1,
      explanation:
        'A Deployment is a declarative object stored in etcd on the control plane. The Deployment controller ' +
        '(part of Controller Manager on the control plane) reconciles it by managing ReplicaSets and Pods. ' +
        'The actual container workloads run on worker nodes where the kubelet starts them. ' +
        'This separation of "what should exist" (control plane) from "what is running" (worker nodes) is fundamental to Kubernetes architecture.',
    },
  ],
};
