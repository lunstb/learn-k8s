import type { ClusterState, ControllerAction, SimEvent } from '../types';

interface NodeLifecycleResult {
  actions: ControllerAction[];
  events: SimEvent[];
}

export function runNodeLifecycle(cluster: ClusterState): NodeLifecycleResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  const currentTick = cluster.tick;

  // If no nodes exist, skip
  if (cluster.nodes.length === 0) {
    return { actions, events };
  }

  // Find NotReady nodes
  const notReadyNodes = cluster.nodes.filter(
    (n) => n.status.conditions[0].status === 'False' && !n.metadata.deletionTimestamp
  );

  for (const node of notReadyNodes) {
    // Evict pods on NotReady nodes
    const podsOnNode = cluster.pods.filter(
      (p) =>
        p.spec.nodeName === node.metadata.name &&
        !p.metadata.deletionTimestamp &&
        p.status.phase !== 'Failed'
    );

    for (const pod of podsOnNode) {
      pod.status = {
        ...pod.status,
        phase: 'Failed',
        reason: 'NodeNotReady',
        message: `Node ${node.metadata.name} is not ready`,
      };
      pod.spec.nodeName = undefined;
      actions.push({
        controller: 'NodeLifecycleController',
        action: 'evict',
        details: `Evicted Pod ${pod.metadata.name} from NotReady Node ${node.metadata.name}`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Warning',
        reason: 'NodeNotReady',
        objectKind: 'Pod',
        objectName: pod.metadata.name,
        message: `Pod evicted from node ${node.metadata.name} (node is not ready)`,
      });
    }
  }

  return { actions, events };
}
