import type { ClusterState, ControllerAction, SimEvent } from '../types';
import { labelsMatch } from '../utils';

interface EndpointsResult {
  actions: ControllerAction[];
  events: SimEvent[];
}

export function reconcileEndpoints(cluster: ClusterState): EndpointsResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  const currentTick = cluster.tick;

  for (const svc of cluster.services) {
    // Find pods matching selector that are Running
    const matchingPods = cluster.pods.filter(
      (p) =>
        !p.metadata.deletionTimestamp &&
        p.status.phase === 'Running' &&
        labelsMatch(svc.spec.selector, p.metadata.labels)
    );

    const newEndpoints = matchingPods.map((p) => p.metadata.name).sort();
    const oldEndpoints = [...svc.status.endpoints].sort();

    // Check if endpoints changed
    const changed =
      newEndpoints.length !== oldEndpoints.length ||
      newEndpoints.some((ep, i) => ep !== oldEndpoints[i]);

    if (changed) {
      const added = newEndpoints.filter((ep) => !oldEndpoints.includes(ep));
      const removed = oldEndpoints.filter((ep) => !newEndpoints.includes(ep));

      svc.status.endpoints = newEndpoints;

      actions.push({
        controller: 'EndpointsController',
        action: 'update',
        details: `Updated endpoints for Service ${svc.metadata.name}: ${newEndpoints.length} endpoint(s)`,
      });

      if (added.length > 0) {
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'EndpointsAdded',
          objectKind: 'Service',
          objectName: svc.metadata.name,
          message: `Added endpoints: ${added.join(', ')}`,
        });
      }
      if (removed.length > 0) {
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Warning',
          reason: 'EndpointsRemoved',
          objectKind: 'Service',
          objectName: svc.metadata.name,
          message: `Removed endpoints: ${removed.join(', ')}`,
        });
      }
    }
  }

  return { actions, events };
}
