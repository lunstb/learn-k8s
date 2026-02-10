import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson6: Lesson = {
  id: 6,
  title: 'Nodes and Scheduling',
  description:
    'Pods run on nodes. The scheduler assigns Pending pods to nodes with capacity, and you control placement with cordon and uncordon.',
  goalDescription:
    'Cordon a node, observe pod eviction and rescheduling, then uncordon to restore the cluster.',
  successMessage:
    'You\'ve mastered scheduling: cordon prevents placement, drain evicts pods, the RS recreates them, ' +
    'and the scheduler places them on healthy nodes.',
  hints: [
    'Use: kubectl cordon node-3 to mark the node as NotReady.',
    'Reconcile to see pods evicted from the NotReady node.',
    'Reconcile again to see replacement pods scheduled to healthy nodes.',
    'Use: kubectl uncordon node-3 to restore the node.',
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Where Do Pods Actually Run?',
        content:
          'So far we\'ve talked about pods, controllers, and services — but we\'ve hand-waved ' +
          'where pods physically execute. A pod needs CPU, memory, and disk to run its containers. ' +
          'Where does that come from?\n\n' +
          'The answer is nodes. Nodes are the machines — physical servers or virtual machines — that ' +
          'make up your cluster. Every pod runs on exactly one node. Each node runs a kubelet agent ' +
          'that communicates with the control plane, reports status, and starts containers.\n\n' +
          'Nodes have capacity. A node can only run a limited number of pods based on its CPU, memory, and ' +
          'configured resource limits. When a node is full, no more pods can be placed there. ' +
          'In this simulator, each node has a simple pod capacity number (e.g., 3 pods max).\n\n' +
          'Nodes also have a health status. A Ready node is healthy and accepting pods. A NotReady node ' +
          'has a problem — the machine crashed, lost network, or the kubelet stopped responding.',
        keyTakeaway:
          'Nodes are the physical (or virtual) machines that provide compute resources. Pods don\'t float in the cloud — they run on real machines with limited capacity.',
      },
      {
        title: 'The Scheduler: Automatic Pod Placement',
        content:
          'When a new pod is created, it starts Pending with no node assigned. You could manually assign pods ' +
          'to nodes, but that defeats the purpose of orchestration. Instead, the scheduler automatically finds ' +
          'the best node for each pod.\n\n' +
          'The scheduler\'s logic is straightforward: look at all nodes, filter out any that are ineligible ' +
          '(cordoned, NotReady, or full), then pick the one with the most available capacity. This spreads ' +
          'pods evenly across the cluster.\n\n' +
          'If no node has available capacity, the pod stays Pending with reason "Unschedulable." It remains ' +
          'in this state until capacity opens up — when a node is uncordoned, a new node is added, ' +
          'or existing pods are removed.\n\n' +
          'This automatic placement is what makes Kubernetes a true orchestrator. You declare "I want 5 pods" ' +
          'and the scheduler figures out where to put them. You don\'t think about individual machines.',
        diagram:
          '  New Pod (Pending, no node)\n' +
          '       │\n' +
          '       ▼\n' +
          '  Scheduler evaluates nodes:\n' +
          '  ┌─────────┬─────────┬─────────┐\n' +
          '  │ node-1  │ node-2  │ node-3  │\n' +
          '  │ 2/3 pods│ 1/3 pods│ CORDONED│\n' +
          '  │         │ ✓ BEST  │ ✗ skip  │\n' +
          '  └─────────┴─────────┴─────────┘\n' +
          '       │\n' +
          '       ▼\n' +
          '  Pod assigned to node-2',
        keyTakeaway:
          'The scheduler is the matchmaker between pods and nodes. It automatically picks the best node by filtering ineligible ones and choosing the least loaded. You never manually assign pods to machines.',
      },
      {
        title: 'Cordon, Drain, and Uncordon: Managing Node Availability',
        content:
          'What if you need to take a node offline for maintenance? You can\'t just shut it down — ' +
          'pods on that node would die unexpectedly. Kubernetes gives you three operations for graceful management:\n\n' +
          'Cordon: Marks a node as unschedulable. Existing pods continue running — nothing is disrupted. ' +
          'But the scheduler won\'t place new pods there. Use cordon when you want to "stop the bleeding" — ' +
          'no more pods go to this node, but current ones are left alone.\n\n' +
          'Drain: Cordon AND evict all pods. The evicted pods are marked Failed, their controllers detect ' +
          'the shortfall and create replacements, and the scheduler places them on healthy nodes. ' +
          'Drain is for when you need the node completely empty — hardware repair, OS upgrades, decommissioning.\n\n' +
          'Uncordon: Removes the unschedulable mark. The node becomes eligible for new pods again. ' +
          'Note: existing pods on other nodes are not moved back automatically. Kubernetes doesn\'t rebalance — ' +
          'but any future scheduling decisions will consider this node.',
        keyTakeaway:
          'Cordon = "no new pods here." Drain = "cordon + evict everything." Uncordon = "accept pods again." These are your tools for graceful node maintenance.',
      },
      {
        title: 'Node Failure and Automatic Recovery',
        content:
          'When a node becomes NotReady — hardware failure, network partition, kubelet crash — Kubernetes ' +
          'handles it automatically. The node lifecycle controller detects the NotReady status and evicts ' +
          'all pods from that node.\n\n' +
          'The ReplicaSet controllers then notice fewer Running pods than desired. They create replacements, ' +
          'which start as Pending. The scheduler assigns them to remaining healthy nodes with capacity.\n\n' +
          'But what if there isn\'t enough capacity? If you had 9 pods across 3 nodes (capacity 3 each) ' +
          'and one node fails, you need 9 pods on 2 nodes — but 2 nodes can only hold 6. Three pods remain ' +
          'Pending as "Unschedulable" until capacity returns.\n\n' +
          'When the failed node recovers and becomes Ready, the scheduler places the Pending pods on it. ' +
          'The cluster self-heals back to full capacity without human intervention.',
        keyTakeaway:
          'Node failures trigger the same reconciliation loop: pods are evicted, controllers create replacements, the scheduler places them. The system self-heals within the limits of available capacity.',
      },
    ],
  },
  quiz: [
    {
      question: 'What does "cordoning" a node do?',
      choices: [
        'Deletes the node from the cluster',
        'Prevents new pods from being scheduled on it',
        'Evicts all running pods immediately',
        'Shuts down the node',
      ],
      correctIndex: 1,
      explanation:
        'Cordoning marks a node as unschedulable. Existing pods continue running, but the scheduler ' +
        'won\'t place new pods there.',
    },
    {
      question:
        'A cluster has 3 nodes with capacity 3 each. All nodes are Ready with 2 pods each. Where does a new pod get scheduled?',
      choices: [
        'The node with the most pods',
        'The node with the fewest pods (least loaded)',
        'A random node',
        'It can\'t be scheduled',
      ],
      correctIndex: 1,
      explanation:
        'The scheduler picks the least-loaded eligible node. Since all have 2 pods, it picks the first ' +
        'available with capacity.',
    },
    {
      question: 'What happens when a node becomes NotReady?',
      choices: [
        'Its pods keep running normally',
        'Its pods are evicted (marked Failed) and controllers create replacements',
        'The cluster pauses until the node recovers',
        'All pods in the cluster restart',
      ],
      correctIndex: 1,
      explanation:
        'NotReady triggers pod eviction. The node lifecycle controller marks pods as Failed, then ReplicaSet ' +
        'controllers create replacements that get scheduled to healthy nodes.',
    },
    {
      question:
        'You drain node-3 (capacity 3, running 2 pods). The other 2 nodes have 2 pods each (capacity 3). What happens?',
      choices: [
        'The 2 evicted pods become Unschedulable',
        'Both evicted pods are rescheduled to the other nodes',
        'Only 1 pod can be rescheduled',
        'The drain fails',
      ],
      correctIndex: 1,
      explanation:
        'Each remaining node has 1 free slot (capacity 3, allocated 2). The 2 evicted pods fit — one on each node.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    const nodeNames = ['node-1', 'node-2', 'node-3'];
    const nodes = nodeNames.map((name) => ({
      kind: 'Node' as const,
      metadata: {
        name,
        uid: generateUID(),
        labels: { 'kubernetes.io/hostname': name },
        creationTimestamp: Date.now() - 300000,
      },
      spec: { capacity: { pods: 3 } },
      status: {
        conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
        allocatedPods: 2,
      },
    }));

    // 2 pods per node = 6 total
    const pods = nodeNames.flatMap((nodeName) =>
      Array.from({ length: 2 }, () => ({
        kind: 'Pod' as const,
        metadata: {
          name: generatePodName(`my-app-${hash.slice(0, 10)}`),
          uid: generateUID(),
          labels: { app: 'my-app', 'pod-template-hash': hash },
          ownerReference: {
            kind: 'ReplicaSet',
            name: `my-app-${hash.slice(0, 10)}`,
            uid: rsUid,
          },
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image, nodeName },
        status: { phase: 'Running' as const },
      }))
    );

    return {
      deployments: [
        {
          kind: 'Deployment' as const,
          metadata: {
            name: 'my-app',
            uid: depUid,
            labels: { app: 'my-app' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 6,
            selector: { app: 'my-app' },
            template: {
              labels: { app: 'my-app' },
              spec: { image },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 6,
            updatedReplicas: 6,
            readyReplicas: 6,
            availableReplicas: 6,
            conditions: [{ type: 'Available', status: 'True' }],
          },
        },
      ],
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `my-app-${hash.slice(0, 10)}`,
            uid: rsUid,
            labels: { app: 'my-app', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'Deployment',
              name: 'my-app',
              uid: depUid,
            },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 6,
            selector: { app: 'my-app', 'pod-template-hash': hash },
            template: {
              labels: { app: 'my-app', 'pod-template-hash': hash },
              spec: { image },
            },
          },
          status: { replicas: 6, readyReplicas: 6 },
        },
      ],
      pods,
      nodes,
      services: [],
      events: [],
    };
  },
  goalCheck: (state) => {
    const runningPods = state.pods.filter(
      (p) => p.status.phase === 'Running' && !p.metadata.deletionTimestamp
    );
    const readyNodes = state.nodes.filter(
      (n) => n.status.conditions[0].status === 'True'
    );
    return runningPods.length === 6 && readyNodes.length === 3;
  },
};
