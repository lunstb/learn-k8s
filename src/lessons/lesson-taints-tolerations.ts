import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lessonTaintsTolerations: Lesson = {
  id: 28,
  title: 'Taints & Tolerations',
  description:
    'Taints mark nodes to repel pods unless the pod has a matching toleration. Learn to use taints for dedicated workloads like GPU nodes and system pools.',
  mode: 'full',
  goalDescription:
    'Node "gpu-node" is tainted with dedicated=gpu:NoSchedule. Deploy an app — observe pods avoid the tainted node. Then apply a deployment YAML with a toleration so a pod schedules on gpu-node.',
  successMessage:
    'A pod with the correct toleration is now running on the tainted gpu-node. Taints and tolerations give you fine-grained control over pod placement.',
  yamlTemplate: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: gpu-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gpu-app
  template:
    metadata:
      labels:
        app: gpu-app
    spec:
      containers:
      - name: gpu-app
        image: gpu-worker:1.0
      tolerations:
      - key: dedicated
        operator: Equal
        value: gpu
        effect: NoSchedule`,
  hints: [
    { text: 'Start by creating a simple deployment (e.g., nginx) to see how the scheduler avoids the tainted node.' },
    { text: 'Run `kubectl get pods -o wide` to see which nodes pods are on — none should be on gpu-node.' },
    { text: 'Now switch to the YAML Editor tab. The pre-filled template has a toleration that matches the gpu-node taint.' },
    { text: 'kubectl create deployment web --image=nginx --replicas=3', exact: true },
  ],
  goals: [
    {
      description: 'A regular deployment exists with pods NOT on gpu-node',
      check: (s: ClusterState) => {
        const webPods = s.pods.filter(
          (p) => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
        );
        return webPods.length >= 1 && webPods.every((p) => p.spec.nodeName !== 'gpu-node');
      },
    },
    {
      description: 'Apply gpu-app deployment with toleration via YAML',
      check: (s: ClusterState) => {
        return s.deployments.some((d) => d.metadata.name === 'gpu-app');
      },
    },
    {
      description: 'A gpu-app pod is running on gpu-node',
      check: (s: ClusterState) => {
        return s.pods.some(
          (p) =>
            p.metadata.labels['app'] === 'gpu-app' &&
            p.spec.nodeName === 'gpu-node' &&
            p.status.phase === 'Running' &&
            !p.metadata.deletionTimestamp
        );
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'Taints: Marking Nodes to Repel Pods',
        content:
          'A taint is a property on a Node that prevents pods from being scheduled on it unless the pod ' +
          'explicitly tolerates the taint.\n\n' +
          'Taints have three components: key, value, and effect.\n' +
          '  kubectl taint nodes gpu-node dedicated=gpu:NoSchedule\n\n' +
          'There are three taint effects:\n\n' +
          'NoSchedule: New pods without a matching toleration will NOT be scheduled on this node. ' +
          'Existing pods are not affected.\n\n' +
          'PreferNoSchedule: Kubernetes will TRY to avoid scheduling on this node, but it is not guaranteed. ' +
          'If no other nodes have capacity, pods may still land here.\n\n' +
          'NoExecute: Stronger than NoSchedule — not only prevents new scheduling, but also evicts existing pods ' +
          'that do not have the toleration. Used when a node becomes problematic (e.g., node.kubernetes.io/unreachable).\n\n' +
          'Kubernetes automatically applies taints to problematic nodes: ' +
          'node.kubernetes.io/not-ready and node.kubernetes.io/unreachable with NoExecute effect.',
        keyTakeaway:
          'Taints (key=value:effect) mark nodes to repel pods. NoSchedule prevents new scheduling. PreferNoSchedule is a soft preference. NoExecute also evicts existing pods.',
      },
      {
        title: 'Tolerations: Allowing Pods on Tainted Nodes',
        content:
          'A toleration on a pod says "I can be scheduled on a node with this taint." ' +
          'Tolerations do not guarantee scheduling — they just remove the restriction.\n\n' +
          '  tolerations:\n' +
          '  - key: dedicated\n' +
          '    operator: Equal\n' +
          '    value: gpu\n' +
          '    effect: NoSchedule\n\n' +
          'This pod tolerates the taint `dedicated=gpu:NoSchedule`. It CAN be scheduled on the gpu node, ' +
          'but it can also be scheduled on untainted nodes.\n\n' +
          'The Exists operator matches any value for a key:\n' +
          '  tolerations:\n' +
          '  - key: dedicated\n' +
          '    operator: Exists\n' +
          '    effect: NoSchedule\n\n' +
          'This tolerates any "dedicated" taint regardless of value. An empty key with Exists operator ' +
          'tolerates ALL taints (used for DaemonSets that must run everywhere).\n\n' +
          'Important: tolerations are permissive, not prescriptive. A toleration does not mean "schedule me on tainted nodes" — ' +
          'it means "do not reject me from tainted nodes." To ensure a pod runs ONLY on tainted nodes, ' +
          'you need both a toleration AND a node affinity or nodeSelector.',
        diagram:
          'Node "gpu-node"                        Pod spec\n' +
          'Taint: dedicated=gpu:NoSchedule        tolerations:\n' +
          '                                        - key: dedicated\n' +
          '  pod WITHOUT toleration → REJECTED      value: gpu\n' +
          '  pod WITH toleration    → SCHEDULED     effect: NoSchedule',
        keyTakeaway:
          'Tolerations allow pods on tainted nodes but do not guarantee placement there. Use operator Equal for exact matches or Exists for any value. Combine with node affinity to force placement on specific nodes.',
      },
      {
        title: 'Real-World Patterns',
        content:
          'GPU nodes: Taint GPU nodes with `nvidia.com/gpu=present:NoSchedule`. Only ML workloads ' +
          'with the toleration can schedule there, preventing general workloads from wasting expensive GPU resources.\n\n' +
          'System pools: Taint system nodes with `node-role.kubernetes.io/system:NoSchedule`. Run only ' +
          'cluster infrastructure (monitoring, ingress controllers, CoreDNS) on these nodes.\n\n' +
          'Spot/preemptible instances: Taint spot nodes with `cloud.google.com/gke-spot=true:NoSchedule`. ' +
          'Only fault-tolerant workloads (batch jobs, stateless apps) should tolerate spot interruptions.\n\n' +
          'Dedicated tenant nodes: In multi-tenant clusters, taint nodes per tenant: ' +
          '`tenant=team-a:NoSchedule`. Each team\'s pods tolerate only their taint, ensuring workload isolation.\n\n' +
          'Maintenance: Before draining a node, it gets cordoned (unschedulable) and tainted with NoExecute ' +
          'to evict workloads. After maintenance, remove the taint and uncordon.',
        keyTakeaway:
          'Taints are used for GPU isolation, system node pools, spot instance management, multi-tenant isolation, and maintenance workflows. They are a core scheduling primitive in production clusters.',
      },
      {
        title: 'Topology Spread Constraints',
        content:
          'While taints control WHERE pods cannot go, topology spread constraints control HOW pods are distributed.\n\n' +
          '  topologySpreadConstraints:\n' +
          '  - maxSkew: 1\n' +
          '    topologyKey: topology.kubernetes.io/zone\n' +
          '    whenUnsatisfiable: DoNotSchedule\n' +
          '    labelSelector:\n' +
          '      matchLabels:\n' +
          '        app: web\n\n' +
          'This ensures web pods are spread evenly across availability zones. maxSkew=1 means the difference ' +
          'between the zone with the most pods and the zone with the fewest is at most 1.\n\n' +
          'Combined with taints: you might taint nodes by zone or instance type, use tolerations to allow ' +
          'scheduling, and topology spread constraints to ensure even distribution.\n\n' +
          'Inter-pod affinity and anti-affinity are similar: anti-affinity can prevent two pods from landing ' +
          'on the same node (e.g., Redis primary and replica should be on different nodes).\n\n' +
          'The scheduling landscape: nodeSelector (simple) → node affinity (expressive) → taints/tolerations (repulsion) ' +
          '→ topology spread (distribution) → pod affinity/anti-affinity (pod co-location rules).',
        keyTakeaway:
          'Topology spread constraints distribute pods evenly across zones/nodes. Combined with taints, node affinity, and pod anti-affinity, they form a comprehensive scheduling toolkit.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A node has taint `dedicated=gpu:NoSchedule`. A pod has toleration `key=dedicated, operator=Exists, effect=NoSchedule`. Does the pod tolerate the taint?',
      choices: [
        'No — the toleration must use operator=Equal with value=gpu to match a taint that specifies a concrete value',
        'Only if the pod also has a nodeSelector or node affinity rule that targets this specific node explicitly',
        'Yes — the Exists operator matches any value for the given key, so it tolerates dedicated=gpu and any other value',
        'It depends on whether the taint was applied before or after the pod was originally created in the cluster',
      ],
      correctIndex: 2,
      explanation:
        'The Exists operator matches any taint with the specified key, regardless of value. ' +
        'So a toleration with key=dedicated and operator=Exists tolerates dedicated=gpu, dedicated=ml, ' +
        'or any other value. This is useful when you want to tolerate a category of taints ' +
        'without specifying exact values.',
    },
    {
      question:
        'You add a NoExecute taint to a node that has 5 running pods. 2 pods have matching tolerations and 3 do not. What happens?',
      choices: [
        'The 3 pods without tolerations are evicted while the 2 pods with matching tolerations continue running',
        'All 5 pods continue running because taints only affect new scheduling decisions, not existing pods on the node',
        'All 5 pods are evicted because NoExecute clears the entire node regardless of any tolerations on the pods',
        'The 3 pods without tolerations become Pending on the same node and wait for the taint to be removed',
      ],
      correctIndex: 0,
      explanation:
        'NoExecute is the only taint effect that evicts existing pods. Pods without a matching toleration ' +
        'are evicted immediately (or after tolerationSeconds if specified). Pods with matching tolerations ' +
        'continue running undisturbed. NoSchedule only prevents NEW pods from being scheduled — it never evicts.',
    },
    {
      question:
        'You want GPU-intensive ML jobs to run ONLY on GPU nodes and never on regular nodes. A toleration alone is not enough. What else do you need?',
      choices: [
        'A toleration is sufficient by itself because pods with GPU tolerations are automatically scheduled to GPU nodes first',
        'A PriorityClass that gives ML pods higher scheduling priority so they preempt regular pods from GPU nodes',
        'A ResourceQuota on the ML namespace that restricts pod scheduling to only nodes with the GPU label present',
        'A taint on GPU nodes plus a toleration AND a nodeSelector or node affinity on the ML pods to force GPU-only placement',
      ],
      correctIndex: 3,
      explanation:
        'A toleration removes the restriction ("I can schedule on GPU nodes") but does not enforce placement there. ' +
        'Without a nodeSelector or node affinity, the pod can also schedule on regular untainted nodes. ' +
        'The correct setup is: (1) taint GPU nodes to keep regular pods away, (2) add toleration so ML pods are allowed, ' +
        'and (3) add nodeSelector or node affinity so ML pods are required to go to GPU nodes.',
    },
    {
      question:
        'Kubernetes automatically applies taints to nodes in certain failure scenarios. Which is an example?',
      choices: [
        '`node.kubernetes.io/not-ready:NoSchedule` when a node first stops responding to heartbeat checks from the API Server',
        'Both not-ready:NoExecute and disk-pressure:NoSchedule — Kubernetes auto-taints for node failures and resource pressure',
        '`node.kubernetes.io/not-ready:NoExecute` only, since Kubernetes auto-taints exclusively use the NoExecute effect',
        '`node.kubernetes.io/disk-pressure:NoSchedule` only, since Kubernetes auto-taints exclusively use the NoSchedule effect',
      ],
      correctIndex: 1,
      explanation:
        'Kubernetes automatically applies several taints: node.kubernetes.io/not-ready:NoExecute and ' +
        'node.kubernetes.io/unreachable:NoExecute when the node goes down (these evict pods after ~5 minutes), ' +
        'and condition-based taints like disk-pressure:NoSchedule, memory-pressure:NoSchedule, and pid-pressure:NoSchedule ' +
        'to prevent new workloads on nodes with resource pressure.',
    },
  ],
  initialState: () => {
    return {
      pods: [],
      replicaSets: [],
      deployments: [],
      nodes: [
        {
          kind: 'Node' as const,
          metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 0 },
        },
        {
          kind: 'Node' as const,
          metadata: { name: 'node-2', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-2' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 0 },
        },
        {
          kind: 'Node' as const,
          metadata: { name: 'gpu-node', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'gpu-node', 'nvidia.com/gpu': 'present' } as Record<string, string>, creationTimestamp: Date.now() - 300000 },
          spec: {
            capacity: { pods: 10 },
            taints: [{ key: 'dedicated', value: 'gpu', effect: 'NoSchedule' as const }],
          },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 0 },
        },
      ],
      services: [],
      events: [],
    };
  },
  goalCheck: (state: ClusterState) => {
    // Goal 1: A web pod running NOT on gpu-node
    const webPods = state.pods.filter(
      (p) => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
    );
    if (webPods.length === 0 || webPods.some((p) => p.spec.nodeName === 'gpu-node')) return false;

    // Goal 2: A gpu-app pod running ON gpu-node
    const gpuPods = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'gpu-app' &&
        p.spec.nodeName === 'gpu-node' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );
    return gpuPods.length >= 1;
  },
};
