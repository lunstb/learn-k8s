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
    // Find pods matching selector that are Running and ready
    const matchingPods = cluster.pods.filter(
      (p) =>
        !p.metadata.deletionTimestamp &&
        p.status.phase === 'Running' &&
        p.status.ready !== false &&
        labelsMatch(svc.spec.selector, p.metadata.labels)
    );

    // Use simulated pod IPs (like real K8s endpoints) instead of pod names
    const newEndpoints = matchingPods.map((p) => {
      // Generate a deterministic IP from the pod UID
      const hash = p.metadata.uid.replace(/[^0-9]/g, '').slice(0, 6);
      const octet3 = parseInt(hash.slice(0, 3), 10) % 256;
      const octet4 = parseInt(hash.slice(3, 6), 10) % 256 || 1;
      return `10.244.${octet3}.${octet4}`;
    }).sort();
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
