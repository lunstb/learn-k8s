import type { ClusterState, Pod, StatefulSet, ControllerAction, SimEvent } from '../types';
import { generateUID } from '../utils';

interface ReconcileResult {
  pods: Pod[];
  statefulSets: StatefulSet[];
  actions: ControllerAction[];
  events: SimEvent[];
}

export function reconcileStatefulSets(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  let pods = [...state.pods];
  const statefulSets = state.statefulSets.map((sts) => ({ ...sts }));
  const currentTick = state.tick;

  for (const sts of statefulSets) {
    // Find owned pods (not terminating)
    const ownedPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === sts.metadata.uid &&
        !p.metadata.deletionTimestamp
    );
    const currentCount = ownedPods.length;
    const desiredCount = sts.spec.replicas;

    if (currentCount < desiredCount) {
      // Determine which ordinals already exist
      const existingOrdinals = new Set(
        ownedPods.map((p) => {
          const parts = p.metadata.name.split('-');
          return parseInt(parts[parts.length - 1], 10);
        })
      );

      // Find the lowest missing ordinal
      let nextOrdinal = -1;
      for (let i = 0; i < desiredCount; i++) {
        if (!existingOrdinals.has(i)) {
          nextOrdinal = i;
          break;
        }
      }

      if (nextOrdinal === -1) {
        continue;
      }

      // Create ONE pod per tick (ordered creation)
      const podName = `${sts.metadata.name}-${nextOrdinal}`;
      const newPod: Pod = {
        kind: 'Pod',
        metadata: {
          name: podName,
          uid: generateUID(),
          labels: { ...sts.spec.template.labels },
          ownerReference: {
            kind: 'StatefulSet',
            name: sts.metadata.name,
            uid: sts.metadata.uid,
          },
          creationTimestamp: Date.now(),
        },
        spec: { ...sts.spec.template.spec },
        status: { phase: 'Pending', tickCreated: currentTick },
      };
      pods.push(newPod);
      actions.push({
        controller: 'StatefulSetController',
        action: 'create-pod',
        details: `Created Pod ${podName} for StatefulSet ${sts.metadata.name} (${currentCount + 1}/${desiredCount})`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'Created',
        objectKind: 'StatefulSet',
        objectName: sts.metadata.name,
        message: `Created pod: ${podName}`,
      });
    } else if (currentCount > desiredCount) {
      // Delete excess pods in reverse ordinal order
      const sorted = [...ownedPods].sort((a, b) => {
        const ordinalA = parseInt(a.metadata.name.split('-').pop()!, 10);
        const ordinalB = parseInt(b.metadata.name.split('-').pop()!, 10);
        return ordinalB - ordinalA;
      });

      const toDelete = currentCount - desiredCount;
      for (let i = 0; i < toDelete; i++) {
        const pod = sorted[i];
        pod.metadata.deletionTimestamp = Date.now();
        pod.status = { ...pod.status, phase: 'Terminating' };
        actions.push({
          controller: 'StatefulSetController',
          action: 'delete-pod',
          details: `Deleting Pod ${pod.metadata.name} from StatefulSet ${sts.metadata.name} (scaling down to ${desiredCount})`,
        });
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'Killing',
          objectKind: 'Pod',
          objectName: pod.metadata.name,
          message: `Deleting pod ${pod.metadata.name}`,
        });
      }
    }

    // Update status
    const nonTerminatingPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === sts.metadata.uid &&
        !p.metadata.deletionTimestamp
    );
    const readyPods = nonTerminatingPods.filter(
      (p) => p.status.phase === 'Running'
    );
    sts.status = {
      replicas: nonTerminatingPods.length,
      readyReplicas: readyPods.length,
      currentReplicas: nonTerminatingPods.length,
    };
  }

  return { pods, statefulSets, actions, events };
}
