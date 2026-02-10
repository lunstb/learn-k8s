import type { ClusterState, ControllerAction, SimEvent } from '../types';

interface SchedulerResult {
  actions: ControllerAction[];
  events: SimEvent[];
}

export function runScheduler(cluster: ClusterState): SchedulerResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  const currentTick = cluster.tick;

  // If no nodes exist, skip scheduling (backwards compat with lessons that don't use nodes)
  if (cluster.nodes.length === 0) {
    return { actions, events };
  }

  // Find Pending pods without a nodeName
  const unscheduledPods = cluster.pods.filter(
    (p) =>
      p.status.phase === 'Pending' &&
      !p.spec.nodeName &&
      !p.metadata.deletionTimestamp &&
      !p.status.reason // Don't schedule pods that are already failing
  );

  for (const pod of unscheduledPods) {
    // Find a Ready node with capacity
    const readyNodes = cluster.nodes.filter(
      (n) => n.status.conditions[0].status === 'True'
    );

    // Calculate allocated pods per node
    const nodeAllocations = new Map<string, number>();
    for (const n of cluster.nodes) {
      const count = cluster.pods.filter(
        (p) =>
          p.spec.nodeName === n.metadata.name &&
          !p.metadata.deletionTimestamp &&
          p.status.phase !== 'Failed'
      ).length;
      nodeAllocations.set(n.metadata.name, count);
    }

    // Find a node with capacity (least loaded first)
    const availableNode = readyNodes
      .filter((n) => {
        const allocated = nodeAllocations.get(n.metadata.name) || 0;
        return allocated < n.spec.capacity.pods;
      })
      .sort((a, b) => {
        const aAlloc = nodeAllocations.get(a.metadata.name) || 0;
        const bAlloc = nodeAllocations.get(b.metadata.name) || 0;
        return aAlloc - bAlloc;
      })[0];

    if (availableNode) {
      pod.spec.nodeName = availableNode.metadata.name;
      actions.push({
        controller: 'Scheduler',
        action: 'bind',
        details: `Assigned Pod ${pod.metadata.name} to Node ${availableNode.metadata.name}`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'Scheduled',
        objectKind: 'Pod',
        objectName: pod.metadata.name,
        message: `Successfully assigned ${pod.metadata.name} to ${availableNode.metadata.name}`,
      });
    } else {
      // No capacity -- mark as unschedulable
      pod.status.reason = 'Unschedulable';
      pod.status.message = 'No nodes have sufficient capacity';
      actions.push({
        controller: 'Scheduler',
        action: 'fail',
        details: `Pod ${pod.metadata.name} is unschedulable (no node capacity)`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Warning',
        reason: 'FailedScheduling',
        objectKind: 'Pod',
        objectName: pod.metadata.name,
        message: `0/${cluster.nodes.length} nodes are available: no nodes have sufficient capacity`,
      });
    }
  }

  // Update node allocatedPods counts
  for (const node of cluster.nodes) {
    node.status.allocatedPods = cluster.pods.filter(
      (p) =>
        p.spec.nodeName === node.metadata.name &&
        !p.metadata.deletionTimestamp &&
        p.status.phase !== 'Failed'
    ).length;
  }

  return { actions, events };
}
