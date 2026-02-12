import type { ClusterState, Pod, ReplicaSet, ControllerAction, SimEvent } from '../types';
import { generateUID, generatePodName, labelsMatch } from '../utils';

interface ReconcileResult {
  replicaSets: ReplicaSet[];
  pods: Pod[];
  actions: ControllerAction[];
  events: SimEvent[];
}

export function reconcileReplicaSets(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  let pods = [...state.pods];
  const replicaSets = state.replicaSets.map((rs) => ({ ...rs }));
  const currentTick = state.tick;

  for (const rs of replicaSets) {
    // Skip RS marked for deletion -- scale down pods
    if (rs.metadata.deletionTimestamp) {
      const ownedPods = pods.filter(
        (p) =>
          p.metadata.ownerReference?.uid === rs.metadata.uid &&
          !p.metadata.deletionTimestamp
      );
      for (const pod of ownedPods) {
        pod.metadata.deletionTimestamp = Date.now();
        pod.status = { ...pod.status, phase: 'Terminating' };
        actions.push({
          controller: 'ReplicaSetController',
          action: 'delete-pod',
          details: `Deleting Pod ${pod.metadata.name} (ReplicaSet ${rs.metadata.name} is being deleted)`,
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
      continue;
    }

    // Adopt orphan pods that match the RS label selector but have no owner
    const orphans = pods.filter(
      (p) =>
        !p.metadata.ownerReference &&
        !p.metadata.deletionTimestamp &&
        labelsMatch(rs.spec.selector, p.metadata.labels)
    );
    for (const orphan of orphans) {
      orphan.metadata.ownerReference = {
        kind: 'ReplicaSet',
        name: rs.metadata.name,
        uid: rs.metadata.uid,
      };
      actions.push({
        controller: 'ReplicaSetController',
        action: 'adopt-pod',
        details: `Adopted orphan Pod ${orphan.metadata.name} into ReplicaSet ${rs.metadata.name} (labels match selector)`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'Adopted',
        objectKind: 'ReplicaSet',
        objectName: rs.metadata.name,
        message: `Adopted pod "${orphan.metadata.name}" with matching labels`,
      });
    }

    // Find owned pods (not terminating)
    const ownedPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === rs.metadata.uid &&
        !p.metadata.deletionTimestamp
    );
    const currentCount = ownedPods.length;
    const desiredCount = rs.spec.replicas;

    if (currentCount < desiredCount) {
      // Need to create pods
      const toCreate = desiredCount - currentCount;
      for (let i = 0; i < toCreate; i++) {
        const podName = generatePodName(rs.metadata.name);
        const newPod: Pod = {
          kind: 'Pod',
          metadata: {
            name: podName,
            uid: generateUID(),
            labels: { ...rs.spec.template.labels },
            ownerReference: {
              kind: 'ReplicaSet',
              name: rs.metadata.name,
              uid: rs.metadata.uid,
            },
            creationTimestamp: Date.now(),
          },
          spec: { ...rs.spec.template.spec },
          status: { phase: 'Pending', tickCreated: currentTick },
        };
        pods.push(newPod);
        actions.push({
          controller: 'ReplicaSetController',
          action: 'create-pod',
          details: `Created Pod ${podName} for ReplicaSet ${rs.metadata.name} (${currentCount + i + 1}/${desiredCount})`,
        });
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'Created',
          objectKind: 'ReplicaSet',
          objectName: rs.metadata.name,
          message: `Created pod: ${podName}`,
        });
      }
    } else if (currentCount > desiredCount) {
      // Need to delete pods (LIFO -- newest first)
      const toDelete = currentCount - desiredCount;
      const sorted = [...ownedPods].sort(
        (a, b) => b.metadata.creationTimestamp - a.metadata.creationTimestamp
      );
      for (let i = 0; i < toDelete; i++) {
        const pod = sorted[i];
        pod.metadata.deletionTimestamp = Date.now();
        pod.status = { ...pod.status, phase: 'Terminating' };
        actions.push({
          controller: 'ReplicaSetController',
          action: 'delete-pod',
          details: `Deleting Pod ${pod.metadata.name} from ReplicaSet ${rs.metadata.name} (scaling down to ${desiredCount})`,
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

    // Update RS status: replicas = all non-terminating, readyReplicas = only Running
    const nonTerminatingPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === rs.metadata.uid &&
        !p.metadata.deletionTimestamp
    );
    const runningPods = nonTerminatingPods.filter(
      (p) => p.status.phase === 'Running' && p.status.ready !== false
    );
    rs.status = {
      replicas: nonTerminatingPods.length,
      readyReplicas: runningPods.length,
    };
  }

  return { replicaSets, pods, actions, events };
}
