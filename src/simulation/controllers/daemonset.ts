import type { ClusterState, Pod, DaemonSet, ControllerAction, SimEvent } from '../types';
import { generateUID } from '../utils';

interface ReconcileResult {
  pods: Pod[];
  daemonSets: DaemonSet[];
  actions: ControllerAction[];
  events: SimEvent[];
}

export function reconcileDaemonSets(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  let pods = [...state.pods];
  const daemonSets = state.daemonSets.map((ds) => ({ ...ds }));
  const currentTick = state.tick;

  // Find Ready nodes
  const readyNodes = state.nodes.filter(
    (n) => n.status.conditions[0]?.type === 'Ready' && n.status.conditions[0]?.status === 'True'
  );

  for (const ds of daemonSets) {
    // Find owned pods (not terminating)
    const ownedPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === ds.metadata.uid &&
        !p.metadata.deletionTimestamp
    );

    // Determine which nodes already have a pod for this DaemonSet
    const coveredNodeNames = new Set(
      ownedPods.map((p) => p.spec.nodeName).filter(Boolean)
    );

    // Create pods for nodes that don't have one yet (respecting taints)
    for (const node of readyNodes) {
      if (!coveredNodeNames.has(node.metadata.name)) {
        // Check if the node has taints that the DaemonSet template doesn't tolerate
        const taints = node.spec.taints || [];
        const tolerations = ds.spec.template.spec.tolerations || [];
        const hasForbiddenTaint = taints.some((taint) => {
          if (taint.effect !== 'NoSchedule' && taint.effect !== 'NoExecute') return false;
          return !tolerations.some((t) => {
            if (t.operator === 'Exists' && t.key === taint.key) return true;
            if (t.key === taint.key && t.value === taint.value && (!t.effect || t.effect === taint.effect)) return true;
            return false;
          });
        });
        if (hasForbiddenTaint) continue;
        const podName = `${ds.metadata.name}-${node.metadata.name}`;
        const newPod: Pod = {
          kind: 'Pod',
          metadata: {
            name: podName,
            uid: generateUID(),
            labels: { ...ds.spec.template.labels },
            ownerReference: {
              kind: 'DaemonSet',
              name: ds.metadata.name,
              uid: ds.metadata.uid,
            },
            creationTimestamp: Date.now(),
          },
          spec: {
            ...ds.spec.template.spec,
            nodeName: node.metadata.name,
          },
          status: { phase: 'Pending', tickCreated: currentTick },
        };
        pods.push(newPod);
        actions.push({
          controller: 'DaemonSetController',
          action: 'create-pod',
          details: `Created Pod ${podName} on node ${node.metadata.name} for DaemonSet ${ds.metadata.name}`,
        });
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'Created',
          objectKind: 'DaemonSet',
          objectName: ds.metadata.name,
          message: `Created pod: ${podName} on node ${node.metadata.name}`,
        });
      }
    }

    // Remove pods on nodes that are no longer Ready
    const readyNodeNames = new Set(readyNodes.map((n) => n.metadata.name));
    for (const pod of ownedPods) {
      if (pod.spec.nodeName && !readyNodeNames.has(pod.spec.nodeName)) {
        pod.metadata.deletionTimestamp = Date.now();
        pod.status = { ...pod.status, phase: 'Terminating' };
        actions.push({
          controller: 'DaemonSetController',
          action: 'delete-pod',
          details: `Deleting Pod ${pod.metadata.name} (node ${pod.spec.nodeName} is not Ready)`,
        });
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Warning',
          reason: 'NodeNotReady',
          objectKind: 'Pod',
          objectName: pod.metadata.name,
          message: `Deleting pod ${pod.metadata.name} from unready node ${pod.spec.nodeName}`,
        });
      }
    }

    // Update status
    const nonTerminatingPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === ds.metadata.uid &&
        !p.metadata.deletionTimestamp
    );
    const readyPods = nonTerminatingPods.filter(
      (p) => p.status.phase === 'Running'
    );
    // Count only nodes this DS can actually schedule onto (respecting taints)
    const tolerations = ds.spec.template.spec.tolerations || [];
    const eligibleNodeCount = readyNodes.filter((node) => {
      const taints = node.spec.taints || [];
      return !taints.some((taint) => {
        if (taint.effect !== 'NoSchedule' && taint.effect !== 'NoExecute') return false;
        return !tolerations.some((t) => {
          if (t.operator === 'Exists' && t.key === taint.key) return true;
          if (t.key === taint.key && t.value === taint.value && (!t.effect || t.effect === taint.effect)) return true;
          return false;
        });
      });
    }).length;

    ds.status = {
      desiredNumberScheduled: eligibleNodeCount,
      currentNumberScheduled: nonTerminatingPods.length,
      numberReady: readyPods.length,
    };
  }

  return { pods, daemonSets, actions, events };
}
