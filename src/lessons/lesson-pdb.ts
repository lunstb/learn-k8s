import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonPDB: Lesson = {
  id: 30,
  title: 'Pod Disruption Budgets',
  description:
    'PDBs protect your applications during voluntary disruptions like node drains and cluster upgrades by limiting how many pods can be down simultaneously.',
  mode: 'full',
  goalDescription:
    'Deploy a 3-replica app, apply a PDB with maxUnavailable=1, then drain a node. Observe that the PDB limits evictions so your app stays available.',
  successMessage:
    'The PDB protected your application during the node drain. Only the allowed number of pods were evicted at once, ensuring continuous availability.',
  yamlTemplate: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: web`,
  hints: [
    { text: 'Check which nodes your pods are running on to understand the current distribution.' },
    { text: 'Apply the PDB from the YAML Editor — it limits how many pods can be disrupted.' },
    { text: 'Use kubectl drain on one of the nodes that has a web pod to trigger a voluntary disruption.' },
    { text: 'kubectl drain node-2', exact: true },
  ],
  goals: [
    {
      description: 'PDB "web-pdb" exists',
      check: (s: ClusterState) => s.podDisruptionBudgets.some((p) => p.metadata.name === 'web-pdb'),
    },
    {
      description: 'Drain a node — observe PDB-limited eviction',
      check: (s: ClusterState) => {
        // A node has been drained (unschedulable or NotReady)
        return s.nodes.some((n) => n.spec.unschedulable === true);
      },
    },
    {
      description: 'All web pods running (rescheduled after drain)',
      check: (s: ClusterState) => {
        const runningWeb = s.pods.filter(
          (p) =>
            p.metadata.labels['app'] === 'web' &&
            p.status.phase === 'Running' &&
            !p.metadata.deletionTimestamp
        );
        return runningWeb.length >= 3;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'What PDBs Protect Against',
        content:
          'Kubernetes distinguishes between two types of disruptions:\n\n' +
          'Involuntary disruptions: Hardware failure, kernel panic, node crash, cloud provider issues. ' +
          'PDBs do NOT protect against these — you cannot prevent hardware from failing.\n\n' +
          'Voluntary disruptions: Node drain for maintenance, cluster upgrades, autoscaler consolidation, ' +
          'kubectl delete pod. PDBs protect against these.\n\n' +
          'Without a PDB, `kubectl drain` evicts ALL pods on a node simultaneously. If your 3-replica ' +
          'app has 2 pods on that node, both are evicted at once — leaving only 1 replica to handle all traffic. ' +
          'If that pod is also overloaded, your service goes down.\n\n' +
          'A PDB tells the eviction API: "you may only disrupt N pods from this set at a time." ' +
          'The drain process evicts pods one by one, waiting for each to be replaced before evicting the next.\n\n' +
          'This is critical in production: cluster upgrades drain every node, ' +
          'and Karpenter consolidation regularly moves pods between nodes. Without PDBs, ' +
          'these routine operations can cause outages.',
        keyTakeaway:
          'PDBs protect against voluntary disruptions (drains, upgrades, autoscaler). They limit simultaneous evictions to maintain application availability during planned operations.',
      },
      {
        title: 'minAvailable vs maxUnavailable',
        content:
          'PDBs support two modes (mutually exclusive — use one or the other):\n\n' +
          'maxUnavailable: The maximum number of pods that can be down at the same time.\n' +
          '  spec:\n' +
          '    maxUnavailable: 1\n' +
          'With 3 replicas and maxUnavailable=1, at most 1 pod can be disrupted. The drain process ' +
          'evicts 1 pod, waits for it to be rescheduled and Running, then evicts the next.\n\n' +
          'minAvailable: The minimum number of pods that must remain running.\n' +
          '  spec:\n' +
          '    minAvailable: 2\n' +
          'With 3 replicas and minAvailable=2, at least 2 pods must always be Running.\n\n' +
          'Both can be specified as absolute numbers (1, 2, 3) or as percentages ("25%", "50%").\n\n' +
          'Recommendation: prefer maxUnavailable. With minAvailable, if your app is already partially down ' +
          '(e.g., 2 of 3 replicas running due to a bug), the PDB blocks ALL evictions because ' +
          'minAvailable=2 is already barely met. maxUnavailable is more predictable.',
        keyTakeaway:
          'maxUnavailable limits how many can be down. minAvailable ensures a minimum stay up. Prefer maxUnavailable — it is more predictable when pods are already unhealthy.',
      },
      {
        title: 'PDB + Drain Interaction',
        content:
          'When you run `kubectl drain node-X`, the drain process:\n' +
          '1. Cordons the node (marks it unschedulable)\n' +
          '2. Lists all pods on the node\n' +
          '3. For each pod, calls the Eviction API\n' +
          '4. The Eviction API checks PDBs: if evicting this pod would violate a PDB, the eviction is rejected\n' +
          '5. The drain process retries rejected evictions with exponential backoff\n' +
          '6. Once the evicted pod is rescheduled and Running on another node, the PDB allows the next eviction\n\n' +
          'This means a drain with PDB is NOT instant — it can take minutes to drain a node as pods are ' +
          'evicted one by one and rescheduled. This is the correct tradeoff: slower drains, but zero downtime.\n\n' +
          'Cloud providers respect PDBs during cluster upgrades: GKE, EKS, and AKS all use the Eviction API ' +
          'when draining nodes for Kubernetes version upgrades.\n\n' +
          'Karpenter (node autoscaler) also respects PDBs: when consolidating underutilized nodes, ' +
          'it uses the Eviction API and waits for PDBs to allow evictions.',
        diagram:
          'PDB: maxUnavailable=1    (3 replicas running)\n' +
          '\n' +
          '  kubectl drain node-2:\n' +
          '  ┌─────────┐  ┌─────────┐  ┌─────────┐\n' +
          '  │ pod-1   │  │ pod-2   │  │ pod-3   │\n' +
          '  │ node-1  │  │ node-2  │  │ node-3  │\n' +
          '  └─────────┘  └────┬────┘  └─────────┘\n' +
          '                     │ evict\n' +
          '                     ▼\n' +
          '              pod-2 terminating (1 unavailable = max)\n' +
          '              drain waits until pod-2 replaced\n' +
          '              then continues',
        keyTakeaway:
          'Drain calls the Eviction API, which checks PDBs. Evictions are retried until PDB allows them. Cloud providers and autoscalers respect PDBs during node operations.',
      },
      {
        title: 'PDB Pitfalls and Best Practices',
        content:
          'maxUnavailable=0 deadlock: If you set maxUnavailable=0, the PDB blocks ALL evictions. ' +
          'Node drains hang forever. Cluster upgrades stall. Never use maxUnavailable=0 in production ' +
          'unless you have a very specific reason and a plan to temporarily adjust it.\n\n' +
          'PDB on single-replica apps: If you have replicas=1 and maxUnavailable=1, the PDB allows the ' +
          'only pod to be evicted (1 - 1 = 0 minimum). This effectively provides no protection. ' +
          'For real protection, you need replicas >= 2 AND a PDB.\n\n' +
          'PDB with HPA: If HPA scales your app from 5 to 2 replicas and your PDB says minAvailable=3, ' +
          'the HPA cannot scale down past 3 — the PDB blocks further evictions. ' +
          'Make sure PDB values are compatible with your minimum HPA replica count.\n\n' +
          'Best practice: Set maxUnavailable=1 for stateless services (web apps, APIs). ' +
          'For stateful services (databases), consider minAvailable equal to quorum size. ' +
          'Every production Deployment should have a PDB.',
        keyTakeaway:
          'Never use maxUnavailable=0 (causes deadlock). Single-replica PDBs provide no protection. Ensure PDB values are compatible with HPA min replicas. Every production app should have a PDB.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Your 3-replica web app has a PDB with maxUnavailable=1. You drain a node that has 2 of these pods. What happens?',
      choices: [
        'Both pods are evicted simultaneously because maxUnavailable=1 applies per node, not across the whole PDB group',
        'One pod is evicted first; the second eviction is blocked until the first pod is rescheduled and Running on another node',
        'The drain command fails with an error because having 2 pods on one node already exceeds the disruption budget',
        'Both pods are evicted together but flagged as "disrupted" so the controller creates 2 replacements at once',
      ],
      correctIndex: 1,
      explanation:
        'maxUnavailable=1 means at most 1 pod from this PDB group can be unavailable. The drain evicts the first pod, ' +
        'but the second eviction is blocked because 1 pod is already down (at the maxUnavailable limit). ' +
        'Once the first pod is rescheduled to another node and becomes Running, the PDB allows the second eviction.',
    },
    {
      question:
        'A team sets maxUnavailable=0 on their PDB. A cluster upgrade begins and tries to drain their node. What happens?',
      choices: [
        'The cluster upgrade skips this node entirely and upgrades all other nodes in the cluster first',
        'The cluster upgrade overrides the PDB because Kubernetes version upgrades take priority over disruption budgets',
        'The pods are gracefully terminated with an extended grace period to compensate for the strict PDB setting',
        'The drain hangs indefinitely because the PDB blocks all evictions and the upgrade cannot proceed past this node',
      ],
      correctIndex: 3,
      explanation:
        'maxUnavailable=0 means zero pods can be disrupted. The Eviction API rejects every eviction attempt. ' +
        'The drain retries indefinitely, and the cluster upgrade stalls on this node. This is a common ' +
        'production issue — maxUnavailable=0 should almost never be used unless there is an automated process ' +
        'to temporarily relax the PDB during maintenance windows.',
    },
    {
      question:
        'You have a PDB with minAvailable=2 for a 3-replica app. One pod crashes due to a bug (involuntary disruption). ' +
        'Now only 2 pods are running. You need to drain a node that has one of the remaining pods. What happens?',
      choices: [
        'The drain is blocked because evicting the pod would leave only 1 running, which violates the minAvailable=2 rule',
        'The drain succeeds because PDBs only apply to rolling updates initiated by Deployment changes, not node drains',
        'The drain evicts the pod because node drain operations always take priority over PDB constraints in the cluster',
        'The PDB automatically adjusts minAvailable down to 1 to account for the pod that already crashed involuntarily',
      ],
      correctIndex: 0,
      explanation:
        'minAvailable=2 means at least 2 pods must be running at all times. With 1 pod already crashed (2 running), ' +
        'evicting another would leave only 1 — violating the PDB. The drain is blocked. This is why maxUnavailable ' +
        'is often preferred: with maxUnavailable=1, the drain would still be allowed because only 1 pod is unavailable ' +
        '(the crashed one), and the PDB allows 1 disruption.',
    },
    {
      question:
        'Which voluntary operations respect PDBs?',
      choices: [
        'Only `kubectl drain` respects PDBs — all other pod deletion operations bypass disruption budget checks entirely',
        'All pod deletions respect PDBs including `kubectl delete pod`, since PDBs apply to every pod removal action',
        '`kubectl drain`, cluster upgrades, Karpenter consolidation, and any other operation using the Eviction API',
        'PDBs are advisory only and generate warning events — no Kubernetes operation is actually blocked by them',
      ],
      correctIndex: 2,
      explanation:
        'PDBs are enforced by the Eviction API. kubectl drain, cloud provider node upgrades, and Karpenter consolidation ' +
        'all use the Eviction API and respect PDBs. However, `kubectl delete pod` does NOT use the Eviction API — ' +
        'it directly deletes the pod, bypassing PDB checks. This is an important distinction for incident response.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.21';
    const hash = templateHash({ image });

    const pods = [
      {
        kind: 'Pod' as const,
        metadata: {
          name: generatePodName(`web-${hash.slice(0, 10)}`),
          uid: generateUID(),
          labels: { app: 'web', 'pod-template-hash': hash },
          ownerReference: { kind: 'ReplicaSet', name: `web-${hash.slice(0, 10)}`, uid: rsUid },
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image, nodeName: 'node-1' },
        status: { phase: 'Running' as const, ready: true, tickCreated: -5 },
      },
      {
        kind: 'Pod' as const,
        metadata: {
          name: generatePodName(`web-${hash.slice(0, 10)}`),
          uid: generateUID(),
          labels: { app: 'web', 'pod-template-hash': hash },
          ownerReference: { kind: 'ReplicaSet', name: `web-${hash.slice(0, 10)}`, uid: rsUid },
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image, nodeName: 'node-2' },
        status: { phase: 'Running' as const, ready: true, tickCreated: -5 },
      },
      {
        kind: 'Pod' as const,
        metadata: {
          name: generatePodName(`web-${hash.slice(0, 10)}`),
          uid: generateUID(),
          labels: { app: 'web', 'pod-template-hash': hash },
          ownerReference: { kind: 'ReplicaSet', name: `web-${hash.slice(0, 10)}`, uid: rsUid },
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image, nodeName: 'node-3' },
        status: { phase: 'Running' as const, ready: true, tickCreated: -5 },
      },
    ];

    return {
      pods,
      deployments: [
        {
          kind: 'Deployment' as const,
          metadata: { name: 'web', uid: depUid, labels: { app: 'web' }, creationTimestamp: Date.now() - 120000 },
          spec: {
            replicas: 3,
            selector: { app: 'web' },
            template: { labels: { app: 'web', 'pod-template-hash': hash }, spec: { image } },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: { replicas: 3, updatedReplicas: 3, readyReplicas: 3, availableReplicas: 3, conditions: [] },
        },
      ],
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `web-${hash.slice(0, 10)}`, uid: rsUid,
            labels: { app: 'web', 'pod-template-hash': hash },
            ownerReference: { kind: 'Deployment', name: 'web', uid: depUid },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3, selector: { app: 'web', 'pod-template-hash': hash },
            template: { labels: { app: 'web', 'pod-template-hash': hash }, spec: { image } },
          },
          status: { replicas: 3, readyReplicas: 3 },
        },
      ],
      nodes: [
        {
          kind: 'Node' as const,
          metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
        },
        {
          kind: 'Node' as const,
          metadata: { name: 'node-2', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-2' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
        },
        {
          kind: 'Node' as const,
          metadata: { name: 'node-3', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-3' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
        },
      ],
      services: [],
      events: [],
    };
  },
  goalCheck: (state: ClusterState) => {
    // PDB exists
    if (!state.podDisruptionBudgets.some((p) => p.metadata.name === 'web-pdb')) return false;
    // A node was drained
    if (!state.nodes.some((n) => n.spec.unschedulable === true)) return false;
    // All 3 pods running
    const runningWeb = state.pods.filter(
      (p) => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
    );
    return runningWeb.length >= 3;
  },
};
