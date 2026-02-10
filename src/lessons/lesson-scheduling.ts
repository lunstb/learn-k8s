import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonScheduling: Lesson = {
  id: 6,
  title: 'Nodes and Scheduling',
  description:
    'Pods run on nodes. The scheduler assigns Pending pods to nodes with capacity, and you control placement with cordon and uncordon.',
  mode: 'full',
  goalDescription:
    'Cordon node-3 to mark it NotReady, observe pod eviction and rescheduling on healthy nodes, then uncordon node-3 to restore the cluster. End state: 6 Running pods across 3 Ready nodes.',
  successMessage:
    'You\'ve mastered scheduling: cordon prevents placement, drain evicts pods, the RS recreates them, ' +
    'and the scheduler places them on healthy nodes.',
  hints: [
    { text: 'Use kubectl cordon to mark a node as unschedulable (NotReady).' },
    { text: 'kubectl cordon node-3', exact: true },
    { text: 'After pods are evicted and rescheduled, restore the node.' },
    { text: 'kubectl uncordon node-3', exact: true },
  ],
  goals: [
    {
      description: 'Cordon node-3 (mark as NotReady)',
      check: (s: ClusterState) => {
        const node = s.nodes.find(n => n.metadata.name === 'node-3');
        return !!node && (node.status.conditions[0].status === 'False' || node.spec.unschedulable === true);
      },
    },
    {
      description: 'Uncordon node-3 (restore to Ready)',
      check: (s: ClusterState) => {
        const node = s.nodes.find(n => n.metadata.name === 'node-3');
        return !!node && node.status.conditions[0].status === 'True';
      },
    },
    {
      description: 'All 6 pods Running across 3 Ready nodes',
      check: (s: ClusterState) => {
        const running = s.pods.filter(p => p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
        const ready = s.nodes.filter(n => n.status.conditions[0].status === 'True');
        return running.length === 6 && ready.length === 3;
      },
    },
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
      question:
        'You cordon node-2 to prepare for maintenance. What happens to the 4 pods currently running on node-2?',
      choices: [
        'All 4 pods are immediately evicted and rescheduled to other nodes',
        'The pods are gracefully terminated one at a time over the next 5 minutes',
        'Nothing — the 4 pods continue running; cordon only prevents NEW pods from being scheduled there',
        'The pods enter Pending state until the node is uncordoned',
      ],
      correctIndex: 2,
      explanation:
        'This is one of the most common misconceptions about cordon. Cordoning only sets the node as unschedulable — it does NOT evict existing pods. ' +
        'Your 4 pods continue running normally. If you need to remove pods from the node, you must use "kubectl drain," which cordons the node AND evicts all pods. ' +
        'Cordon is useful when you want to stop the bleeding (no more pods go here) while you plan the drain.',
    },
    {
      question:
        'You drained node-3, and its pods were rescheduled to node-1 and node-2. After maintenance, you uncordon node-3. Do the pods move back?',
      choices: [
        'Yes — Kubernetes automatically rebalances pods across all available nodes',
        'Yes — but only after a 5-minute stabilization period',
        'No — Kubernetes does not rebalance existing pods; node-3 stays empty until new pods are created or a manual intervention occurs',
        'No — uncordoning has no effect; you must delete and recreate the node',
      ],
      correctIndex: 2,
      explanation:
        'Kubernetes does NOT rebalance running pods. Uncordoning makes the node eligible for future scheduling, but existing pods on other nodes are not moved. ' +
        'Node-3 will remain empty until new pods are created (by scaling up, rolling updates, or pod failures triggering replacements). ' +
        'If you want immediate rebalancing, you would need to use a tool like "kubectl rollout restart" to trigger new pod creation, ' +
        'or use the descheduler (a separate project) to evict pods for rescheduling.',
    },
    {
      question:
        'A cluster has 3 nodes with capacity 3 each, running 9 total pods (3 per node). Node-1 fails and becomes NotReady. Its 3 pods are evicted. What happens next?',
      choices: [
        'All 3 replacement pods are scheduled to node-2 and node-3 immediately',
        'The ReplicaSet reduces its desired count to 6 to match available capacity',
        'Kubernetes automatically increases node-2 and node-3 capacity to accommodate the extra pods',
        'The RS creates 3 replacement pods, but they remain Pending because node-2 and node-3 are already at full capacity (3/3 each)',
      ],
      correctIndex: 3,
      explanation:
        'The ReplicaSet does not know or care about node capacity — it always creates enough pods to match the desired count. But the scheduler cannot place them: ' +
        'node-2 and node-3 each have 3 pods already (full capacity). The 3 replacement pods stay Pending with reason "Unschedulable." ' +
        'They will remain Pending until capacity opens up — either node-1 recovers, a new node is added, or existing pods are removed from other nodes. ' +
        'The desired count is NEVER automatically reduced; the controller faithfully maintains what you declared.',
    },
    {
      question:
        'Two nodes have equal available capacity. Node-1 is in zone-a and node-2 is in zone-b. A new pod has no node affinity or zone preferences. Which node does the scheduler pick?',
      choices: [
        'Always node-1 because it has a lower node number',
        'The scheduler picks based on a scoring algorithm that considers factors like spreading pods across nodes, but with equal scores either node could be chosen',
        'The pod stays Pending because the scheduler cannot break ties',
        'The scheduler always places pods in zone-a first, then zone-b',
      ],
      correctIndex: 1,
      explanation:
        'The Kubernetes scheduler uses a two-phase approach: filtering (eliminate ineligible nodes) then scoring (rank the remaining ones). ' +
        'Scoring considers many factors including resource balance, pod spreading across topology zones, and affinity rules. ' +
        'With no preferences set and truly equal conditions, the scheduler uses its internal scoring algorithm to pick — there is no simple alphabetical or numbered ordering. ' +
        'In practice, you can influence placement with nodeAffinity, podAntiAffinity, and topology spread constraints.',
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
