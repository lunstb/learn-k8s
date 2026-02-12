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

  // Find Pending pods without a nodeName (retry Unschedulable pods each tick)
  const unscheduledPods = cluster.pods.filter(
    (p) =>
      p.status.phase === 'Pending' &&
      !p.spec.nodeName &&
      !p.metadata.deletionTimestamp &&
      (!p.status.reason || p.status.reason === 'Unschedulable')
  );

  for (const pod of unscheduledPods) {
    // Find a Ready node with capacity (also check unschedulable flag and taints)
    const readyNodes = cluster.nodes.filter(
      (n) => n.status.conditions[0].status === 'True' && !n.spec.unschedulable
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

    // Filter out nodes with NoSchedule/NoExecute taints the pod doesn't tolerate
    // PreferNoSchedule is handled in the scoring phase, not the filtering phase
    const toleratedNodes = readyNodes.filter((n) => {
      const taints = n.spec.taints || [];
      for (const taint of taints) {
        if (taint.effect === 'NoSchedule' || taint.effect === 'NoExecute') {
          const tolerations = pod.spec.tolerations || [];
          const tolerated = tolerations.some((t) => {
            if (t.operator === 'Exists' && t.key === taint.key) return true;
            if (t.key === taint.key && t.value === taint.value && (!t.effect || t.effect === taint.effect)) return true;
            return false;
          });
          if (!tolerated) return false;
        }
      }
      return true;
    });

    // Find a node with capacity (least loaded first, penalize unmatched PreferNoSchedule taints)
    const availableNode = toleratedNodes
      .filter((n) => {
        const allocated = nodeAllocations.get(n.metadata.name) || 0;
        return allocated < n.spec.capacity.pods;
      })
      .sort((a, b) => {
        const aAlloc = nodeAllocations.get(a.metadata.name) || 0;
        const bAlloc = nodeAllocations.get(b.metadata.name) || 0;

        // Count unmatched PreferNoSchedule taints as a penalty
        const tolerations = pod.spec.tolerations || [];
        const aPenalty = (a.spec.taints || []).filter((taint) => {
          if (taint.effect !== 'PreferNoSchedule') return false;
          return !tolerations.some((t) => {
            if (t.operator === 'Exists' && t.key === taint.key) return true;
            if (t.key === taint.key && t.value === taint.value && (!t.effect || t.effect === taint.effect)) return true;
            return false;
          });
        }).length;
        const bPenalty = (b.spec.taints || []).filter((taint) => {
          if (taint.effect !== 'PreferNoSchedule') return false;
          return !tolerations.some((t) => {
            if (t.operator === 'Exists' && t.key === taint.key) return true;
            if (t.key === taint.key && t.value === taint.value && (!t.effect || t.effect === taint.effect)) return true;
            return false;
          });
        }).length;

        // Sort by penalty first, then by allocation (least loaded)
        if (aPenalty !== bPenalty) return aPenalty - bPenalty;
        return aAlloc - bAlloc;
      })[0];

    if (availableNode) {
      pod.spec.nodeName = availableNode.metadata.name;
      pod.status.reason = undefined;
      pod.status.message = undefined;
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
      // Build a descriptive failure message
      const taintRejected = readyNodes.length > toleratedNodes.length;
      const taintCount = readyNodes.length - toleratedNodes.length;
      const capacityFull = toleratedNodes.length > 0 && toleratedNodes.every((n) => {
        const allocated = nodeAllocations.get(n.metadata.name) || 0;
        return allocated >= n.spec.capacity.pods;
      });
      const parts: string[] = [];
      if (taintRejected) parts.push(`${taintCount} node(s) had taints that the pod didn't tolerate`);
      if (capacityFull) parts.push(`${toleratedNodes.length} node(s) had insufficient capacity`);
      const unready = cluster.nodes.length - readyNodes.length;
      if (unready > 0) parts.push(`${unready} node(s) were not ready or unschedulable`);
      if (parts.length === 0) parts.push('no nodes have sufficient capacity');
      const failMessage = `0/${cluster.nodes.length} nodes are available: ${parts.join(', ')}`;

      pod.status.reason = 'Unschedulable';
      pod.status.message = failMessage;
      actions.push({
        controller: 'Scheduler',
        action: 'fail',
        details: `Pod ${pod.metadata.name} is unschedulable (${parts.join(', ')})`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Warning',
        reason: 'FailedScheduling',
        objectKind: 'Pod',
        objectName: pod.metadata.name,
        message: failMessage,
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
