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
    'Drain node-3 to evict its pods, watch them reschedule on healthy nodes, then uncordon node-3 to restore the cluster. End state: 6 Running pods across 3 schedulable nodes.',
  successMessage:
    'You\'ve mastered scheduling: cordon prevents placement, drain evicts pods, the RS recreates them, ' +
    'and the scheduler places them on healthy nodes.',
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
          'The real Kubernetes scheduler uses a two-phase approach:\n\n' +
          '1. Filtering: eliminate ineligible nodes (cordoned, NotReady, insufficient resources)\n' +
          '2. Scoring: rank the remaining nodes using multiple factors — available resources, pod spreading ' +
          'across zones, affinity rules, and more. The highest-scoring node wins.\n\n' +
          'A critical detail: the scheduler uses resource requests, not actual CPU/memory usage. ' +
          'If a node has 4 CPU cores and existing pods have requested 3 cores total (even if they are only using 1), ' +
          'the scheduler sees only 1 core available. Scheduling is based on reservations, not utilization. ' +
          'This can lead to nodes appearing underutilized while the scheduler treats them as nearly full.\n\n' +
          'In this simulator, scheduling is simplified to a pod-count capacity model. ' +
          'But the concept is the same: if no node has capacity, the pod stays Pending with reason "Unschedulable." ' +
          'It remains in this state until capacity opens up — when a node is uncordoned, a new node is added, ' +
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
          'The scheduler filters ineligible nodes, then scores the rest. Scheduling is based on resource requests (reservations), not actual usage. You never manually assign pods to machines.',
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
        'Nothing — the 4 pods continue running; cordon only prevents NEW pods from being scheduled there',
        'All 4 pods are immediately evicted and rescheduled to other nodes with available capacity',
        'The pods are gracefully terminated one at a time over the next 5 minutes by the node controller',
        'The pods enter a Pending state and remain paused until the node is uncordoned again',
      ],
      correctIndex: 0,
      explanation:
        'This is one of the most common misconceptions about cordon. Cordoning only sets the node as unschedulable — it does NOT evict existing pods. ' +
        'Your 4 pods continue running normally. If you need to remove pods from the node, you must use "kubectl drain," which cordons the node AND evicts all pods. ' +
        'Cordon is useful when you want to stop the bleeding (no more pods go here) while you plan the drain.',
    },
    {
      question:
        'You drained node-3, and its pods were rescheduled to node-1 and node-2. After maintenance, you uncordon node-3. Do the pods move back?',
      choices: [
        'Yes — Kubernetes automatically rebalances running pods across all available nodes once capacity changes',
        'Yes — but only after a 5-minute stabilization period to ensure the node is stable before moving pods',
        'No — Kubernetes does not rebalance existing pods; node-3 stays empty until new pods are created',
        'No — uncordoning only allows scheduling of pods from other namespaces, not the original ones',
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
        'All 3 replacement pods are scheduled to node-2 and node-3 immediately by splitting them evenly',
        'The ReplicaSet reduces its desired count to 6 to match the current available node capacity',
        'The cluster autoscaler automatically provisions a new node to handle the displaced pods',
        'The RS creates 3 replacement pods, but they stay Pending because node-2 and node-3 are at full capacity (3/3)',
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
        'Always node-1 because node names are sorted alphabetically and the first eligible node wins',
        'The scheduler picks based on a scoring algorithm that considers pod spreading and resource balance, so either node could be chosen',
        'The pod stays Pending because the scheduler requires explicit zone preferences to break ties',
        'The scheduler always prioritizes zone-a over zone-b due to the default topology ordering rules',
      ],
      correctIndex: 1,
      explanation:
        'The Kubernetes scheduler uses a two-phase approach: filtering (eliminate ineligible nodes) then scoring (rank the remaining ones). ' +
        'Scoring considers many factors including resource balance, pod spreading across topology zones, and affinity rules. ' +
        'With no preferences set and truly equal conditions, the scheduler uses its internal scoring algorithm to pick — there is no simple alphabetical or numbered ordering. ' +
        'In practice, you can influence placement with nodeAffinity, podAntiAffinity, and topology spread constraints.',
    },
    {
      question:
        'A pod requests 2 CPU cores. Node-1 has 4 cores total with 3 cores already committed to other pod requests (but actual usage is only 1 core). Can the scheduler place this pod on node-1?',
      choices: [
        'Yes — the scheduler uses actual CPU usage (1 core), leaving 3 cores free for the new pod',
        'Yes — the node has 3 idle CPU cores based on real-time metrics, which exceeds the 2-core request',
        'It depends on the pod\'s QoS class — BestEffort pods bypass request-based scheduling checks',
        'No — the scheduler uses committed requests (3 of 4 allocated), leaving only 1 core, which is insufficient',
      ],
      correctIndex: 3,
      explanation:
        'The scheduler makes decisions based on resource requests, not actual usage. Even though the node is only using 1 of its 4 cores, ' +
        '3 cores are committed (requested by existing pods). The scheduler sees only 1 core available, which is insufficient for a 2-core request. ' +
        'The pod would stay Pending. This is a fundamental concept: scheduling is based on reservations, not utilization. ' +
        'This can lead to situations where nodes appear underutilized but cannot accept new pods — a common source of confusion in capacity planning.',
    },
    {
      question:
        'Node-2 becomes NotReady due to a network partition. It was running 3 pods from a Deployment with 6 replicas. What happens over the next few minutes?',
      choices: [
        'The 3 pods on node-2 continue running in isolation and rejoin the cluster when the network recovers',
        'The Deployment reduces its desired count from 6 to 3 to match the remaining healthy capacity',
        'The node lifecycle controller evicts the 3 pods, the RS creates 3 replacements, and the scheduler places them on healthy nodes (if capacity exists)',
        'Kubernetes immediately migrates the 3 running pods from node-2 to healthy nodes via live migration',
      ],
      correctIndex: 2,
      explanation:
        'When a node becomes NotReady, the node lifecycle controller marks its pods for eviction. The ReplicaSet detects that it now has fewer pods than desired ' +
        'and creates replacements. The scheduler places these new pods on healthy nodes — if those nodes have capacity. If remaining nodes are full, ' +
        'the replacement pods stay Pending as Unschedulable. The desired count is never automatically reduced. ' +
        'Kubernetes does not support live migration of pods — pods are always recreated, not moved.',
    },
  ],
  practices: [
    {
      title: 'Drain and Restore a Node',
      goalDescription:
        'Drain node-3 to evict its pods, watch them reschedule on healthy nodes, then uncordon node-3 to restore the cluster. End state: 6 Running pods across 3 schedulable nodes.',
      successMessage:
        'You\'ve mastered scheduling: cordon prevents placement, drain evicts pods, the RS recreates them, and the scheduler places them on healthy nodes.',
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        const nodeNames = ['node-1', 'node-2', 'node-3'];
        const nodes = nodeNames.map((name) => ({
          kind: 'Node' as const,
          metadata: { name, uid: generateUID(), labels: { 'kubernetes.io/hostname': name }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 3 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 2 },
        }));

        const pods = nodeNames.flatMap((nodeName) =>
          Array.from({ length: 2 }, () => ({
            kind: 'Pod' as const,
            metadata: {
              name: generatePodName(`my-app-${hash.slice(0, 10)}`), uid: generateUID(),
              labels: { app: 'my-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'ReplicaSet', name: `my-app-${hash.slice(0, 10)}`, uid: rsUid },
              creationTimestamp: Date.now() - 60000,
            },
            spec: { image, nodeName },
            status: { phase: 'Running' as const },
          }))
        );

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'my-app', uid: depUid, labels: { app: 'my-app' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 6, selector: { app: 'my-app' },
              template: { labels: { app: 'my-app' }, spec: { image } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 6, updatedReplicas: 6, readyReplicas: 6, availableReplicas: 6, conditions: [{ type: 'Available', status: 'True' }] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `my-app-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'my-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'my-app', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 6, selector: { app: 'my-app', 'pod-template-hash': hash },
              template: { labels: { app: 'my-app', 'pod-template-hash': hash }, spec: { image } },
            },
            status: { replicas: 6, readyReplicas: 6 },
          }],
          pods, nodes, services: [], events: [],
        };
      },
      goals: [
        {
          description: 'Use "kubectl drain" to evict pods from a node',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('drain'),
        },
        {
          description: 'Use "kubectl uncordon" to restore the node',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('uncordon'),
        },
        {
          description: 'Drain node-3 (evict pods and mark unschedulable)',
          check: (s: ClusterState) => {
            const node = s.nodes.find(n => n.metadata.name === 'node-3');
            return !!node && node.spec.unschedulable === true;
          },
        },
        {
          description: 'Uncordon node-3 (mark as schedulable again)',
          check: (s: ClusterState) => {
            const node = s.nodes.find(n => n.metadata.name === 'node-3');
            return !!node && !node.spec.unschedulable;
          },
        },
        {
          description: 'All 6 pods Running across 3 schedulable nodes',
          check: (s: ClusterState) => {
            const running = s.pods.filter(p => p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
            const schedulable = s.nodes.filter(n => !n.spec.unschedulable && n.status.conditions[0].status === 'True');
            return running.length === 6 && schedulable.length === 3;
          },
        },
      ],
      hints: [
        { text: 'Use kubectl drain to evict all pods from a node and mark it unschedulable.' },
        { text: 'kubectl drain node-3', exact: true },
        { text: 'After pods are rescheduled to other nodes, restore node-3 with uncordon.' },
        { text: 'kubectl uncordon node-3', exact: true },
      ],
    },
    {
      title: 'Investigate Node Capacity',
      goalDescription:
        'Nodes are full and one is cordoned. Use describe node and get events to understand why pods are Pending, then uncordon node-3 to fix scheduling.',
      successMessage:
        'You diagnosed unschedulable pods by inspecting node capacity and events. When pods are Pending, always check node status first.',
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        const nodes = [
          { name: 'node-1', podCount: 3 },
          { name: 'node-2', podCount: 3 },
          { name: 'node-3', podCount: 0, cordoned: true },
        ].map(({ name, podCount, cordoned }) => ({
          kind: 'Node' as const,
          metadata: { name, uid: generateUID(), labels: { 'kubernetes.io/hostname': name }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 3 }, ...(cordoned ? { unschedulable: true } : {}) },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: podCount },
        }));

        // 3 pods on node-1, 3 on node-2
        const runningPods = ['node-1', 'node-2'].flatMap(nodeName =>
          Array.from({ length: 3 }, () => ({
            kind: 'Pod' as const,
            metadata: {
              name: generatePodName(`my-app-${hash.slice(0, 10)}`), uid: generateUID(),
              labels: { app: 'my-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'ReplicaSet', name: `my-app-${hash.slice(0, 10)}`, uid: rsUid },
              creationTimestamp: Date.now() - 60000,
            },
            spec: { image, nodeName },
            status: { phase: 'Running' as const },
          }))
        );

        // 2 pending pods (unschedulable)
        const pendingPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`my-app-${hash.slice(0, 10)}`), uid: generateUID(),
            labels: { app: 'my-app', 'pod-template-hash': hash },
            ownerReference: { kind: 'ReplicaSet', name: `my-app-${hash.slice(0, 10)}`, uid: rsUid },
            creationTimestamp: Date.now() - 10000,
          },
          spec: { image },
          status: { phase: 'Pending' as const, reason: 'Unschedulable', message: '0/3 nodes are available: 2 nodes have reached pod capacity, 1 node is unschedulable' },
        }));

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'my-app', uid: depUid, labels: { app: 'my-app' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 8, selector: { app: 'my-app' },
              template: { labels: { app: 'my-app' }, spec: { image } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 8, updatedReplicas: 8, readyReplicas: 6, availableReplicas: 6, conditions: [{ type: 'Available', status: 'True' }] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `my-app-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'my-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'my-app', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 8, selector: { app: 'my-app', 'pod-template-hash': hash },
              template: { labels: { app: 'my-app', 'pod-template-hash': hash }, spec: { image } },
            },
            status: { replicas: 8, readyReplicas: 6 },
          }],
          pods: [...runningPods, ...pendingPods],
          nodes,
          services: [],
          events: [{
            timestamp: Date.now() - 10000, tick: 0, type: 'Warning' as const, reason: 'FailedScheduling',
            objectKind: 'Pod', objectName: 'my-app-pending',
            message: '0/3 nodes are available: 2 nodes have reached pod capacity, 1 node is unschedulable',
          }],
        };
      },
      goals: [
        {
          description: 'Use "kubectl describe node" to inspect node capacity',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('describe-node'),
        },
        {
          description: 'Use "kubectl get events" to see scheduling failures',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-events'),
        },
        {
          description: 'Use "kubectl uncordon" to fix the scheduling issue',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('uncordon'),
        },
        {
          description: 'Uncordon node-3 to restore scheduling',
          check: (s: ClusterState) => {
            const node = s.nodes.find(n => n.metadata.name === 'node-3');
            return !!node && !node.spec.unschedulable;
          },
        },
        {
          description: 'All 8 pods Running',
          check: (s: ClusterState) => {
            const running = s.pods.filter(p => p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
            const pending = s.pods.filter(p => p.status.phase === 'Pending' && !p.metadata.deletionTimestamp);
            return running.length === 8 && pending.length === 0;
          },
        },
      ],
      hints: [
        { text: 'Run "kubectl describe node node-3" to see its status.' },
        { text: 'Run "kubectl get events" to see the FailedScheduling warnings.' },
        { text: 'node-3 is cordoned (unschedulable). Use uncordon to restore it.' },
        { text: 'kubectl uncordon node-3', exact: true },
      ],
    },
  ],
};
