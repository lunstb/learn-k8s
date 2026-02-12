import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonClusterAutoscaling: Lesson = {
  id: 21,
  title: 'Karpenter / Cluster Autoscaling',
  description:
    'When pods cannot be scheduled due to insufficient node capacity, cluster autoscalers like Karpenter automatically provision new nodes.',
  mode: 'full',
  goalDescription:
    'Scale the "web" deployment to 5 replicas to exceed cluster capacity. Watch Karpenter automatically provision new nodes for the Pending pods, then verify all 5 pods are Running.',
  successMessage:
    'Karpenter provisioned new nodes to handle the Unschedulable pods you caused by scaling up. ' +
    'This is the HPA-to-Karpenter pipeline: pod demand exceeds node capacity, and the cluster auto-scales to match.',
  lecture: {
    sections: [
      {
        title: 'The Problem: HPA Scales Pods, But Who Scales Nodes?',
        content:
          'The HPA says "scale the deployment to 10 replicas." The Deployment creates 10 pods. ' +
          'But there are only 3 nodes with capacity for 9 pods total. One pod is stuck Pending with ' +
          'reason "Unschedulable" — no node has room for it.\n\n' +
          'You could manually add a node: provision a new VM, install Kubernetes, join it to the cluster. ' +
          'This takes minutes to hours and requires human intervention — defeating the purpose of autoscaling.\n\n' +
          'Cluster autoscaling closes this gap. When pods cannot be scheduled, the autoscaler provisions ' +
          'new nodes automatically. When nodes are underutilized, it removes them. The cluster right-sizes ' +
          'itself to match demand.\n\n' +
          'There are two main approaches: the Kubernetes Cluster Autoscaler (the original) and Karpenter ' +
          '(the modern alternative developed by AWS, now a CNCF project).',
        keyTakeaway:
          'HPA scales pods within the cluster. Cluster autoscaling scales the cluster itself by adding/removing nodes. Together they provide end-to-end automatic scaling.',
      },
      {
        title: 'Cluster Autoscaler vs Karpenter',
        content:
          'The Cluster Autoscaler (CA) is the traditional approach. It works with cloud provider node groups ' +
          '(AWS Auto Scaling Groups, GCP Managed Instance Groups). When pods are Unschedulable, CA increases ' +
          'the size of a node group. Limitations: node groups have fixed instance types, scaling is slow ' +
          '(minutes), and you must pre-define node group configurations.\n\n' +
          'Karpenter takes a different approach. Instead of scaling pre-defined node groups, it directly ' +
          'provisions the right instance type for the workload. Need a GPU pod? Karpenter launches a GPU instance. ' +
          'Need a memory-heavy pod? Karpenter picks a memory-optimized instance. It makes per-pod decisions ' +
          'rather than per-group decisions.\n\n' +
          'Key Karpenter advantages:\n' +
          '- Faster provisioning (seconds, not minutes)\n' +
          '- Right-sized instances for each workload\n' +
          '- No need to pre-configure node groups\n' +
          '- Better bin-packing and cost optimization',
        diagram:
          '  Cluster Autoscaler:              Karpenter:\n' +
          '  ┌─────────────────────┐          ┌─────────────────────┐\n' +
          '  │  Node Group A (m5)  │          │  NodePool            │\n' +
          '  │  min: 2, max: 10    │          │  constraints:        │\n' +
          '  │  fixed instance type │          │    instance-family:  │\n' +
          '  └─────────────────────┘          │    [m5, c5, r5]     │\n' +
          '  Scale: +1 node (same type)       │  Picks best fit     │\n' +
          '                                   └─────────────────────┘\n' +
          '                                   Scale: right instance for the pod',
        keyTakeaway:
          'Cluster Autoscaler scales fixed node groups. Karpenter dynamically selects the optimal instance type per workload. Karpenter is faster, more flexible, and more cost-efficient.',
      },
      {
        title: 'NodePools and Provisioning',
        content:
          'Karpenter uses NodePools to define constraints for provisioned nodes:\n\n' +
          '- Instance types: which instance families are allowed (m5, c5, r5)\n' +
          '- Availability zones: where nodes can be placed\n' +
          '- Architecture: amd64, arm64, or both\n' +
          '- Capacity type: on-demand, spot, or both\n' +
          '- Limits: maximum total CPU/memory across all provisioned nodes\n\n' +
          'When an Unschedulable pod appears, Karpenter evaluates its resource requirements against the NodePool ' +
          'constraints. It selects the cheapest instance type that satisfies the pod\'s needs. If multiple pods ' +
          'are pending, Karpenter may batch them onto a single larger instance.\n\n' +
          'NodePools replace the concept of pre-defined node groups. Instead of "I want 3 m5.xlarge nodes," ' +
          'you say "I need nodes from these families, in these zones, up to this total capacity." Karpenter ' +
          'handles the specifics.',
        keyTakeaway:
          'NodePools define what KIND of nodes Karpenter can create, not how many. Karpenter decides the quantity and exact instance type based on actual pod requirements.',
      },
      {
        title: 'Consolidation and Bin-Packing',
        content:
          'Scaling up is half the problem. Scaling down — removing underutilized nodes — is equally important ' +
          'for cost efficiency.\n\n' +
          'Karpenter continuously evaluates whether nodes can be consolidated. If pods on a node could fit on ' +
          'other existing nodes, Karpenter cordons the underutilized node, moves the pods (by deleting them and ' +
          'letting controllers recreate them elsewhere), and terminates the empty node.\n\n' +
          'This process is called consolidation. Karpenter makes two types of consolidation decisions:\n' +
          '- Delete: remove a node entirely if its pods fit elsewhere\n' +
          '- Replace: swap an expensive node for a cheaper one that still fits the workload\n\n' +
          'Bin-packing efficiency matters because cloud compute is billed per node-hour. ' +
          'Running 10 pods across 5 half-empty nodes costs twice as much as packing them onto 2-3 full nodes. ' +
          'Karpenter continuously optimizes this without manual intervention.\n\n' +
          'Consolidation respects pod disruption budgets (PDBs) and do-not-disrupt annotations. ' +
          'Critical pods are never involuntarily moved.',
        keyTakeaway:
          'Karpenter consolidates underutilized nodes by moving pods and terminating empty machines. This continuous optimization keeps cloud costs aligned with actual resource usage.',
      },
    ],
  },
  quiz: [
    {
      question:
        'HPA has scaled your deployment to 10 pods. You have 3 nodes, each with capacity for 3 pods (9 total). ' +
        'One pod is stuck in Pending with reason "Unschedulable." What happens next if Karpenter is installed?',
      choices: [
        'The HPA detects that a pod is Pending and reduces the desired replica count back to 9 to match capacity',
        'The scheduler retries placement and assigns the pod to the node with the lowest current CPU utilization',
        'Karpenter adjusts resource limits on existing nodes so they can accommodate one additional pod',
        'Karpenter detects the Unschedulable pod and provisions a new node with enough capacity to run it',
      ],
      correctIndex: 3,
      explanation:
        'Karpenter watches for pods with Unschedulable status. When it finds one, it evaluates the pod\'s resource ' +
        'requirements and provisions a new node that can accommodate it. This is the HPA-to-node-autoscaler pipeline: ' +
        'HPA scales pods, and when pod demand exceeds node capacity, Karpenter scales nodes. Neither the HPA ' +
        'nor the scheduler can solve the problem alone — new infrastructure is needed.',
    },
    {
      question:
        'Karpenter decides to consolidate an underutilized node that is running 2 pods owned by a Deployment. ' +
        'How does it "move" the pods to other nodes?',
      choices: [
        'It uses `kubectl drain` to invoke the native Kubernetes pod migration feature that transfers running pods',
        'It deletes the pods from the underutilized node and trusts the Deployment controller to recreate them elsewhere',
        'It live-migrates the running containers to another node while preserving their in-memory state and connections',
        'It patches each pod\'s nodeName field to point to a different node, and the target kubelet picks them up',
      ],
      correctIndex: 1,
      explanation:
        'Kubernetes does not support live migration of pods. Karpenter cordons the node (preventing new scheduling), ' +
        'then deletes the pods. Since the pods are owned by a Deployment (via ReplicaSet), the controller detects ' +
        'the replica count is below desired and creates new pods. The scheduler then places these new pods on nodes ' +
        'with available capacity. This is why workloads must be managed by controllers — standalone pods without ' +
        'an owner would simply be lost during consolidation.',
    },
    {
      question:
        'Your cluster uses the traditional Cluster Autoscaler with a node group of m5.large instances (2 vCPU, 8GiB RAM). ' +
        'A new pod requests 4 vCPU and 32GiB RAM. What happens?',
      choices: [
        'The Cluster Autoscaler adds an m5.large node, but the pod remains Unschedulable because no single node satisfies its requirements',
        'The Cluster Autoscaler provisions two m5.large nodes and distributes the pod\'s resource requests across them',
        'The Cluster Autoscaler detects the mismatch and automatically switches the node group to a larger instance type',
        'The pod is scheduled on existing nodes using resource overcommit since the total cluster capacity is sufficient',
      ],
      correctIndex: 0,
      explanation:
        'The traditional Cluster Autoscaler can only scale existing node groups — it cannot change instance types. ' +
        'If the node group uses m5.large (2 vCPU, 8GiB), adding more m5.large nodes will not help a pod that needs ' +
        '4 vCPU and 32GiB. The pod remains Unschedulable. This is a key limitation that Karpenter solves: Karpenter ' +
        'dynamically selects the right instance type per pod from its allowed set, instead of being locked to one type.',
    },
    {
      question:
        'After a traffic spike subsides, Karpenter identifies a node running 3 pods that could fit on other existing nodes. ' +
        'One of those pods has a PodDisruptionBudget requiring at least 2 replicas available at all times, and the Deployment ' +
        'currently has exactly 2 Running replicas. What does Karpenter do?',
      choices: [
        'Karpenter evicts all 3 pods simultaneously to consolidate the node and minimize the time spent underutilized',
        'Karpenter proceeds with consolidation after a fixed cooldown period regardless of the current PDB status',
        'Karpenter respects the PDB and will not disrupt the pod if doing so would violate the minimum availability rule',
        'Karpenter marks the node for deferred consolidation and retries only during the next maintenance window',
      ],
      correctIndex: 2,
      explanation:
        'Karpenter respects PodDisruptionBudgets during consolidation. If evicting a pod would bring the number of available ' +
        'replicas below what the PDB requires, Karpenter will not proceed with that eviction. In this case, with exactly ' +
        '2 replicas running and a PDB requiring 2 available, deleting one would violate the PDB. Karpenter will either ' +
        'wait for additional replicas to come up or skip consolidating that node. This ensures application availability ' +
        'is never sacrificed for cost optimization.',
    },
  ],
  practices: [
    {
      title: 'Trigger and Observe Node Autoscaling',
      goalDescription:
        'A deployment "web" has 2 replicas running on 2 nodes (each with capacity for 2 pods). ' +
        'Scale the deployment to 5 replicas to exceed cluster capacity. Watch Karpenter automatically ' +
        'provision new nodes for the Pending pods, then verify all 5 pods are Running.',
      successMessage:
        'Karpenter provisioned new nodes to handle the Unschedulable pods you caused by scaling up. ' +
        'This is the HPA-to-Karpenter pipeline in action: pod demand exceeds node capacity, and the cluster ' +
        'auto-scales to match. Together, HPA scales pods and Karpenter scales nodes.',
      hints: [
        { text: 'Run "kubectl get nodes" to see the current 2 nodes and their capacity.' },
        { text: 'kubectl scale deployment web --replicas=5', exact: true },
        { text: 'Run "kubectl get pods" — you should see 3 Pending pods. Reconcile to let Karpenter provision new nodes.' },
        { text: 'Keep reconciling — Karpenter adds nodes for Unschedulable pods, and the scheduler places them.' },
      ],
      goals: [
        {
          description: 'Use "kubectl get nodes" to see current cluster capacity',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-nodes'),
        },
        {
          description: 'Scale deployment to trigger Pending pods',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('scale'),
        },
        {
          description: 'Use "kubectl get pods" to observe Pending pods',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-pods'),
        },
        {
          description: 'All 5 "web" pods are Running (Karpenter provisioned nodes)',
          check: (s: ClusterState) => {
            return s.pods.filter(p => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length >= 5;
          },
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'web-app:1.0';
        const hash = templateHash({ image });

        // 2 nodes with capacity 2 each
        const nodeNames = ['node-1', 'node-2'];
        const nodes = nodeNames.map((name) => ({
          kind: 'Node' as const,
          metadata: {
            name,
            uid: generateUID(),
            labels: { 'kubernetes.io/hostname': name },
            creationTimestamp: Date.now() - 300000,
          },
          spec: { capacity: { pods: 2 } },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: 1,
          },
        }));

        // 2 Running pods, one per node
        const pods = nodeNames.map((nodeName) => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`web-${hash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'web', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `web-${hash.slice(0, 10)}`,
              uid: rsUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image, nodeName },
          status: { phase: 'Running' as const },
        }));

        return {
          pods,
          replicaSets: [
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `web-${hash.slice(0, 10)}`,
                uid: rsUid,
                labels: { app: 'web', 'pod-template-hash': hash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'web',
                  uid: depUid,
                },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'web', 'pod-template-hash': hash },
                template: {
                  labels: { app: 'web', 'pod-template-hash': hash },
                  spec: { image },
                },
              },
              status: { replicas: 2, readyReplicas: 2 },
            },
          ],
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'web',
                uid: depUid,
                labels: { app: 'web' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'web' },
                template: {
                  labels: { app: 'web' },
                  spec: { image },
                },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: {
                replicas: 2,
                updatedReplicas: 2,
                readyReplicas: 2,
                availableReplicas: 2,
                conditions: [{ type: 'Available', status: 'True' }],
              },
            },
          ],
          nodes,
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
          helmReleases: [],
        };
      },
      afterTick: (tick, state) => {
        // Simulate Karpenter: if any pods are Unschedulable, add a new node
        const unschedulablePods = state.pods.filter(
          (p) =>
            p.status.phase === 'Pending' &&
            p.status.reason === 'Unschedulable' &&
            !p.metadata.deletionTimestamp
        );

        if (unschedulablePods.length > 0) {
          const existingNodeCount = state.nodes.length;
          const newNodeName = `karpenter-node-${existingNodeCount + 1}`;

          // Check if we already added this node
          const alreadyExists = state.nodes.some((n) => n.metadata.name === newNodeName);
          if (!alreadyExists) {
            state.nodes.push({
              kind: 'Node' as const,
              metadata: {
                name: newNodeName,
                uid: generateUID(),
                labels: { 'kubernetes.io/hostname': newNodeName, 'karpenter.sh/provisioned': 'true' },
                creationTimestamp: Date.now(),
              },
              spec: { capacity: { pods: 4 } },
              status: {
                conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
                allocatedPods: 0,
              },
            });

            state.events.push({
              timestamp: Date.now(),
              tick,
              type: 'Normal' as const,
              reason: 'NodeProvisioned',
              objectKind: 'Node',
              objectName: newNodeName,
              message: `Karpenter provisioned node ${newNodeName} for ${unschedulablePods.length} unschedulable pod(s)`,
            });
          }
        }

        return state;
      },
      goalCheck: (state) => {
        const runningWebPods = state.pods.filter(
          (p) =>
            p.metadata.labels['app'] === 'web' &&
            p.status.phase === 'Running' &&
            !p.metadata.deletionTimestamp
        );

        return runningWebPods.length >= 5;
      },
    },
  ],
};
