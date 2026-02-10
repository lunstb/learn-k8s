import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lesson17: Lesson = {
  id: 17,
  title: 'DaemonSets',
  description:
    'DaemonSets ensure exactly one pod runs on every node — perfect for logging agents, monitoring daemons, and network plugins.',
  mode: 'full',
  goalDescription:
    'Create a DaemonSet named "log-collector" with image fluentd:latest. Verify one pod runs on each node in the cluster.',
  successMessage:
    'The DaemonSet is running one log-collector pod on every node. DaemonSets automatically adapt to cluster changes — ' +
    'when a new node joins, a pod is created; when a node leaves, the pod is cleaned up.',
  hints: [
    { text: 'The syntax is: kubectl create daemonset <name> --image=<image>. You don\'t specify replicas — a DaemonSet runs one pod per node automatically.' },
    { text: 'kubectl create daemonset log-collector --image=fluentd:latest', exact: true },
    { text: 'Reconcile multiple times until pods transition from Pending to Running on all nodes.' },
  ],
  goals: [
    {
      description: 'Create a DaemonSet named "log-collector"',
      check: (s: ClusterState) => !!s.daemonSets.find(ds => ds.metadata.name === 'log-collector'),
    },
    {
      description: 'One Running pod on every Ready node',
      check: (s: ClusterState) => {
        const readyNodes = s.nodes.filter(n => n.status.conditions[0].status === 'True');
        const runningPods = s.pods.filter(p => p.metadata.labels['app'] === 'log-collector' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
        return readyNodes.length > 0 && runningPods.length >= readyNodes.length;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: One Pod Per Node',
        content:
          'Some workloads need to run on every node in the cluster — not a specific number of replicas, ' +
          'but exactly one instance per machine. Think about:\n\n' +
          'Log collection: Every node generates logs. You need a Fluentd or Filebeat agent on each node ' +
          'to ship logs to your central logging system.\n\n' +
          'Monitoring: Node-level metrics (CPU, memory, disk) require a Prometheus node-exporter on each node.\n\n' +
          'Networking: CNI plugins like Calico or Cilium need a network agent on every node to manage pod networking.\n\n' +
          'Storage: Distributed storage systems like GlusterFS need a daemon on each node.\n\n' +
          'A Deployment with replicas=3 does not solve this. If you add a fourth node, you still have 3 pods. ' +
          'If a node has no pod, it has no log collection. You need a controller that automatically places ' +
          'exactly one pod per node and adapts as nodes join or leave.',
        keyTakeaway:
          'DaemonSets solve the "one per node" problem. They automatically ensure every node has exactly one instance of your pod — no more, no less.',
      },
      {
        title: 'How DaemonSets Work',
        content:
          'A DaemonSet watches the node list and ensures every eligible node has one pod running the specified template. ' +
          'When you create a DaemonSet, the controller:\n\n' +
          '1. Lists all nodes in the cluster\n' +
          '2. For each Ready node, checks if a DaemonSet pod exists\n' +
          '3. Creates a pod on nodes that are missing one\n' +
          '4. Removes pods from nodes that should not have one\n\n' +
          'Unlike Deployments, there is no replica count. The "desired count" is always equal to the number of ' +
          'eligible nodes. If you have 5 nodes, you get 5 pods. Add a 6th node and a pod automatically appears on it. ' +
          'Remove a node and its pod is cleaned up.\n\n' +
          'The DaemonSet controller bypasses the normal scheduler — it directly sets spec.nodeName on each pod ' +
          'to assign it to a specific node. This ensures one-to-one mapping between nodes and pods.',
        diagram:
          '  DaemonSet: log-collector\n' +
          '  ─────────────────────────\n' +
          '  node-1  →  log-collector-xxxxx  (Running)\n' +
          '  node-2  →  log-collector-yyyyy  (Running)\n' +
          '  node-3  →  log-collector-zzzzz  (Running)\n' +
          '  \n' +
          '  New node-4 joins:\n' +
          '  node-4  →  log-collector-wwwww  (auto-created)',
        keyTakeaway:
          'DaemonSets watch nodes, not replica counts. One pod per eligible node, automatically adapting as nodes are added or removed from the cluster.',
      },
      {
        title: 'Node Affinity and Tolerations',
        content:
          'Not every DaemonSet should run on every node. You might want your GPU monitoring agent only on ' +
          'nodes with GPUs, or your storage daemon only on nodes with SSDs.\n\n' +
          'Node affinity rules let you target specific nodes using labels. If you label GPU nodes with ' +
          'hardware=gpu, your GPU monitor DaemonSet can use nodeAffinity to select only those nodes.\n\n' +
          'Tolerations handle the opposite case. Kubernetes uses taints to mark nodes as "special" — for example, ' +
          'master nodes are tainted to prevent workloads from running on them. But system DaemonSets (like networking ' +
          'plugins) NEED to run on master nodes. Tolerations allow DaemonSet pods to "tolerate" these taints.\n\n' +
          'Together, affinity and tolerations give you precise control: run on these specific nodes, and ignore ' +
          'these specific restrictions.',
        keyTakeaway:
          'Use node affinity to target DaemonSet pods to specific node types. Use tolerations to allow DaemonSet pods on tainted nodes (like control plane nodes) where normal pods cannot run.',
      },
      {
        title: 'DaemonSet Updates',
        content:
          'Like Deployments, DaemonSets support rolling updates. When you change the pod template (e.g., update ' +
          'the image version), the DaemonSet controller updates pods one node at a time.\n\n' +
          'The update strategy defaults to RollingUpdate with maxUnavailable=1. This means: delete the old pod ' +
          'on one node, wait for the new pod to be Running, then move to the next node. At most one node is ' +
          'without the DaemonSet pod during the update.\n\n' +
          'There is also an OnDelete strategy: pods are only updated when they are manually deleted. This gives ' +
          'you full control over the rollout — useful for critical system components where you want to update ' +
          'nodes one at a time during a maintenance window.\n\n' +
          'Because DaemonSets run infrastructure-level software, their update strategy is often more conservative ' +
          'than application Deployments. A bad log collector update should not take down logging on all nodes simultaneously.',
        keyTakeaway:
          'DaemonSet rolling updates proceed node by node. The default maxUnavailable=1 ensures at most one node is without the daemon during an update. Use OnDelete for manual, controlled rollouts.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Your cluster has 3 nodes running a log-collector DaemonSet. You add a 4th node to handle increased traffic. What happens to the DaemonSet?',
      choices: [
        'Nothing — the DaemonSet was configured for 3 nodes and you need to update its replica count to 4',
        'You need to restart the DaemonSet controller to detect the new node',
        'The DaemonSet controller detects the new node and automatically creates a log-collector pod on it without any manual action',
        'The DaemonSet moves one of the existing pods to the new node to rebalance, leaving one original node without a pod',
      ],
      correctIndex: 2,
      explanation:
        'DaemonSets continuously watch the node list. When a new eligible node appears, the DaemonSet controller automatically creates a pod on it. There is no replica count to update — the DaemonSet\'s desired state is always "one pod per eligible node." ' +
        'This is the key difference from a Deployment: you never need to adjust for cluster size changes. Similarly, if a node is removed, the orphaned pod is cleaned up automatically.',
    },
    {
      question:
        'Your Kubernetes control plane node has the taint node-role.kubernetes.io/control-plane:NoSchedule. You need to run a critical monitoring DaemonSet on ALL nodes, including the control plane. How do you achieve this?',
      choices: [
        'DaemonSets automatically ignore taints, so the pod will be scheduled on the control plane node without any changes',
        'You must remove the taint from the control plane node — there is no other way to schedule pods there',
        'Add a toleration for the control-plane taint in the DaemonSet pod template, allowing the pod to be scheduled on the tainted node',
        'Use nodeAffinity to force the pod onto the control plane node, which overrides taints',
      ],
      correctIndex: 2,
      explanation:
        'Taints prevent pods from being scheduled on a node unless the pod has a matching toleration. DaemonSets do not automatically bypass taints (a common misconception). ' +
        'To run a DaemonSet pod on a tainted control plane node, you must add the appropriate toleration to the pod spec: tolerations: [{key: "node-role.kubernetes.io/control-plane", effect: "NoSchedule"}]. ' +
        'This is standard practice for system-level DaemonSets like CNI plugins, kube-proxy, and monitoring agents that must run on every node including the control plane.',
    },
    {
      question:
        'A DaemonSet is performing a rolling update on a 5-node cluster with the default strategy (RollingUpdate, maxUnavailable=1). How many nodes are without the DaemonSet pod at any given moment during the update?',
      choices: [
        'All 5 nodes temporarily lose their pods while the update replaces them simultaneously',
        'At most 2 nodes — Kubernetes always updates in pairs for efficiency',
        'Zero nodes — Kubernetes creates the new pod first and only then terminates the old one on each node (surge strategy)',
        'At most 1 node — the update terminates the old pod on one node, waits for the new pod to be Running, then moves to the next node',
      ],
      correctIndex: 3,
      explanation:
        'With maxUnavailable=1 (the default), the DaemonSet controller updates one node at a time: it deletes the old pod on one node, waits for the new version to reach Running state on that node, then proceeds to the next. ' +
        'At most 1 node is without the DaemonSet pod at any point during the rollout. This is critical for infrastructure DaemonSets — you never want all your logging or monitoring agents down simultaneously. ' +
        'You can increase maxUnavailable to speed up updates at the cost of having more nodes temporarily uncovered.',
    },
    {
      question:
        'You want your GPU monitoring DaemonSet to run only on nodes that have GPUs (labeled with hardware=gpu), not on every node in the cluster. How do you configure this?',
      choices: [
        'Set a replica count equal to the number of GPU nodes in the DaemonSet spec',
        'Use node affinity (nodeSelector or affinity rules) in the DaemonSet pod template to target only nodes labeled hardware=gpu',
        'Create the DaemonSet in a namespace that is limited to GPU nodes',
        'Taint the non-GPU nodes and the DaemonSet will automatically skip them since it has no tolerations',
      ],
      correctIndex: 1,
      explanation:
        'DaemonSets do not have a replica count — they run on every eligible node. To limit which nodes are eligible, use node affinity. The simplest approach is spec.template.spec.nodeSelector: {hardware: gpu}. ' +
        'This ensures pods are only created on nodes with the hardware=gpu label. While option D (tainting non-GPU nodes) could technically work, it is the wrong approach — taints should reflect node constraints, not be used as a workaround for targeting. ' +
        'Node affinity is the correct, explicit way to say "run only on these specific nodes."',
    },
  ],
  initialState: () => {
    const nodeNames = ['node-1', 'node-2', 'node-3'];
    const nodes = nodeNames.map((name) => ({
      kind: 'Node' as const,
      metadata: {
        name,
        uid: generateUID(),
        labels: { 'kubernetes.io/hostname': name },
        creationTimestamp: Date.now() - 300000,
      },
      spec: { capacity: { pods: 4 } },
      status: {
        conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
        allocatedPods: 0,
      },
    }));

    return {
      pods: [],
      replicaSets: [],
      deployments: [],
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
  goalCheck: (state) => {
    if (state.daemonSets.length < 1) return false;

    const ds = state.daemonSets.find((d) => d.metadata.name === 'log-collector');
    if (!ds) return false;

    const readyNodes = state.nodes.filter(
      (n) => n.status.conditions[0].status === 'True'
    );

    const runningDsPods = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'log-collector' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );

    // One running pod per ready node
    const coveredNodes = new Set(runningDsPods.map((p) => p.spec.nodeName));
    return readyNodes.every((n) => coveredNodes.has(n.metadata.name));
  },
};
