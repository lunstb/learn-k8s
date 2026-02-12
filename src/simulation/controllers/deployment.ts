import type {
  ClusterState,
  Deployment,
  ReplicaSet,
  Pod,
  ControllerAction,
  SimEvent,
} from '../types';
import { generateUID, generateReplicaSetName, templateHash } from '../utils';

interface ReconcileResult {
  deployments: Deployment[];
  replicaSets: ReplicaSet[];
  pods: Pod[];
  actions: ControllerAction[];
  events: SimEvent[];
}

function getTemplateHash(dep: Deployment): string {
  return templateHash(dep.spec.template.spec);
}

function findActiveRS(
  dep: Deployment,
  replicaSets: ReplicaSet[]
): ReplicaSet | undefined {
  const hash = getTemplateHash(dep);
  return replicaSets.find(
    (rs) =>
      rs.metadata.ownerReference?.uid === dep.metadata.uid &&
      rs.metadata.labels['pod-template-hash'] === hash &&
      !rs.metadata.deletionTimestamp
  );
}

function findOwnedReplicaSets(
  dep: Deployment,
  replicaSets: ReplicaSet[]
): ReplicaSet[] {
  return replicaSets.filter(
    (rs) =>
      rs.metadata.ownerReference?.uid === dep.metadata.uid &&
      !rs.metadata.deletionTimestamp
  );
}

export function reconcileDeployments(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  const deployments = state.deployments.map((d) => ({ ...d }));
  let replicaSets = state.replicaSets.map((rs) => ({ ...rs }));
  let pods = [...state.pods];
  const currentTick = state.tick;

  for (const dep of deployments) {
    // Handle deletion
    if (dep.metadata.deletionTimestamp) {
      const ownedRS = findOwnedReplicaSets(dep, replicaSets);
      for (const rs of ownedRS) {
        if (!rs.metadata.deletionTimestamp) {
          rs.metadata.deletionTimestamp = Date.now();
          actions.push({
            controller: 'DeploymentController',
            action: 'delete-rs',
            details: `Marked ReplicaSet ${rs.metadata.name} for deletion (Deployment ${dep.metadata.name} is being deleted)`,
          });
        }
      }
      continue;
    }

    const currentHash = getTemplateHash(dep);
    let activeRS = findActiveRS(dep, replicaSets);

    // If no active RS for current template, create one
    if (!activeRS) {
      const rsName = generateReplicaSetName(dep.metadata.name);
      const newRS: ReplicaSet = {
        kind: 'ReplicaSet',
        metadata: {
          name: rsName,
          uid: generateUID(),
          labels: {
            ...dep.spec.selector,
            'pod-template-hash': currentHash,
          },
          ownerReference: {
            kind: 'Deployment',
            name: dep.metadata.name,
            uid: dep.metadata.uid,
          },
          creationTimestamp: Date.now(),
        },
        spec: {
          replicas: 0, // Start at 0, will be scaled up
          selector: {
            ...dep.spec.selector,
            'pod-template-hash': currentHash,
          },
          template: {
            labels: {
              ...dep.spec.template.labels,
              'pod-template-hash': currentHash,
            },
            spec: { ...dep.spec.template.spec },
          },
        },
        status: { replicas: 0, readyReplicas: 0 },
      };
      replicaSets.push(newRS);
      activeRS = newRS;
      actions.push({
        controller: 'DeploymentController',
        action: 'create-rs',
        details: `Created ReplicaSet ${rsName} for Deployment ${dep.metadata.name} (template: ${dep.spec.template.spec.image})`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'ScalingReplicaSet',
        objectKind: 'Deployment',
        objectName: dep.metadata.name,
        message: `Created new replica set "${rsName}"`,
      });
    }

    // Get all owned RS (including old ones)
    const ownedRS = findOwnedReplicaSets(dep, replicaSets);
    const oldReplicaSets = ownedRS.filter(
      (rs) => rs.metadata.uid !== activeRS!.metadata.uid
    );

    // Calculate total pods across all RS
    const oldPodCount = oldReplicaSets.reduce((sum, rs) => {
      return (
        sum +
        pods.filter(
          (p) =>
            p.metadata.ownerReference?.uid === rs.metadata.uid &&
            !p.metadata.deletionTimestamp
        ).length
      );
    }, 0);

    // Count only Running new pods for availability-gated scale-down
    const newRunningPodCount = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === activeRS!.metadata.uid &&
        !p.metadata.deletionTimestamp &&
        p.status.phase === 'Running'
    ).length;

    const desiredReplicas = dep.spec.replicas;
    const maxSurge = dep.spec.strategy.maxSurge;
    const maxUnavailable = dep.spec.strategy.maxUnavailable;

    if (oldReplicaSets.length > 0 && dep.spec.strategy.type === 'Recreate') {
      // Recreate strategy: scale old RS to 0 first, then scale new RS up
      const totalOldPods = oldReplicaSets.reduce((sum, rs) => {
        return sum + pods.filter(
          (p) =>
            p.metadata.ownerReference?.uid === rs.metadata.uid &&
            !p.metadata.deletionTimestamp
        ).length;
      }, 0);

      if (totalOldPods > 0) {
        // Phase 1: Scale down all old RS to 0
        for (const oldRS of oldReplicaSets) {
          if (oldRS.spec.replicas !== 0) {
            oldRS.spec.replicas = 0;
            actions.push({
              controller: 'DeploymentController',
              action: 'scale-down',
              details: `Scaled down old ReplicaSet ${oldRS.metadata.name} to 0 replicas (Recreate strategy)`,
            });
            events.push({
              timestamp: Date.now(),
              tick: currentTick,
              type: 'Normal',
              reason: 'ScalingReplicaSet',
              objectKind: 'Deployment',
              objectName: dep.metadata.name,
              message: `Scaled down replica set "${oldRS.metadata.name}" to 0 (Recreate)`,
            });
          }
        }
      } else {
        // Phase 2: All old pods gone, scale up new RS
        if (activeRS.spec.replicas !== desiredReplicas) {
          activeRS.spec.replicas = desiredReplicas;
          actions.push({
            controller: 'DeploymentController',
            action: 'scale-up',
            details: `Scaled up new ReplicaSet ${activeRS.metadata.name} to ${desiredReplicas} replicas (Recreate strategy)`,
          });
          events.push({
            timestamp: Date.now(),
            tick: currentTick,
            type: 'Normal',
            reason: 'ScalingReplicaSet',
            objectKind: 'Deployment',
            objectName: dep.metadata.name,
            message: `Scaled up replica set "${activeRS.metadata.name}" to ${desiredReplicas} (Recreate)`,
          });
        }
        // Clean up old RS — keep the most recent one for rollback history
        const emptyOldRS = oldReplicaSets
          .filter((rs) => {
            const oldPods = pods.filter(
              (p) =>
                p.metadata.ownerReference?.uid === rs.metadata.uid &&
                !p.metadata.deletionTimestamp
            ).length;
            return oldPods === 0;
          })
          .sort((a, b) => (b.metadata.creationTimestamp ?? 0) - (a.metadata.creationTimestamp ?? 0));
        // Keep the most recent empty old RS, delete older ones
        for (const oldRS of emptyOldRS.slice(1)) {
          oldRS.metadata.deletionTimestamp = Date.now();
          actions.push({
            controller: 'DeploymentController',
            action: 'cleanup',
            details: `Cleaning up old ReplicaSet ${oldRS.metadata.name} (0 replicas)`,
          });
        }
      }
    } else if (oldReplicaSets.length > 0) {
      // Rolling update in progress
      // Scale up new RS (if it hasn't reached desired count yet)
      if (activeRS.spec.replicas < desiredReplicas) {
        const newDesired = Math.min(activeRS.spec.replicas + maxSurge, desiredReplicas);
        if (newDesired !== activeRS.spec.replicas) {
          activeRS.spec.replicas = newDesired;
          actions.push({
            controller: 'DeploymentController',
            action: 'scale-up',
            details: `Scaled up new ReplicaSet ${activeRS.metadata.name} to ${newDesired} replicas`,
          });
          events.push({
            timestamp: Date.now(),
            tick: currentTick,
            type: 'Normal',
            reason: 'ScalingReplicaSet',
            objectKind: 'Deployment',
            objectName: dep.metadata.name,
            message: `Scaled up replica set "${activeRS.metadata.name}" to ${newDesired}`,
          });
        }
      }

      // Scale down old RS only if new pods are Running (availability gate)
      if (newRunningPodCount > 0) {
        for (const oldRS of oldReplicaSets) {
          const currentOldPods = pods.filter(
            (p) =>
              p.metadata.ownerReference?.uid === oldRS.metadata.uid &&
              !p.metadata.deletionTimestamp
          ).length;

          if (currentOldPods > 0) {
            const scaleDownBy = Math.min(currentOldPods, maxUnavailable);
            const newOldDesired = Math.max(0, currentOldPods - scaleDownBy);
            if (newOldDesired !== oldRS.spec.replicas) {
              oldRS.spec.replicas = newOldDesired;
              actions.push({
                controller: 'DeploymentController',
                action: 'scale-down',
                details: `Scaled down old ReplicaSet ${oldRS.metadata.name} to ${newOldDesired} replicas`,
              });
              events.push({
                timestamp: Date.now(),
                tick: currentTick,
                type: 'Normal',
                reason: 'ScalingReplicaSet',
                objectKind: 'Deployment',
                objectName: dep.metadata.name,
                message: `Scaled down replica set "${oldRS.metadata.name}" to ${newOldDesired}`,
              });
            }
          }

        }
        // Clean up old RS with 0 replicas and 0 pods — keep the most recent one for rollback
        const emptyOldRolling = oldReplicaSets
          .filter((rs) => {
            const oP = pods.filter(
              (p) =>
                p.metadata.ownerReference?.uid === rs.metadata.uid &&
                !p.metadata.deletionTimestamp
            ).length;
            return rs.spec.replicas === 0 && oP === 0;
          })
          .sort((a, b) => (b.metadata.creationTimestamp ?? 0) - (a.metadata.creationTimestamp ?? 0));
        for (const oldRS of emptyOldRolling.slice(1)) {
          oldRS.metadata.deletionTimestamp = Date.now();
          actions.push({
            controller: 'DeploymentController',
            action: 'cleanup',
            details: `Cleaning up old ReplicaSet ${oldRS.metadata.name} (0 replicas)`,
          });
        }
      } else if (activeRS.spec.replicas > 0) {
        // Stall detection: new RS has pods but none are Running
        const newTotalPods = pods.filter(
          (p) =>
            p.metadata.ownerReference?.uid === activeRS.metadata.uid &&
            !p.metadata.deletionTimestamp
        ).length;
        if (newTotalPods > 0 && newRunningPodCount === 0) {
          events.push({
            timestamp: Date.now(),
            tick: currentTick,
            type: 'Warning',
            reason: 'RolloutStalled',
            objectKind: 'Deployment',
            objectName: dep.metadata.name,
            message: `Rollout stalled - new pods are not becoming ready`,
          });
        }
      }
    } else {
      // No rolling update -- just ensure active RS has correct replicas
      if (activeRS.spec.replicas !== desiredReplicas) {
        actions.push({
          controller: 'DeploymentController',
          action: 'scale',
          details: `Scaled ReplicaSet ${activeRS.metadata.name} to ${desiredReplicas} replicas`,
        });
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'ScalingReplicaSet',
          objectKind: 'Deployment',
          objectName: dep.metadata.name,
          message: `Scaled replica set "${activeRS.metadata.name}" to ${desiredReplicas}`,
        });
        activeRS.spec.replicas = desiredReplicas;
      }
    }

    // Update deployment status
    const allOwnedPods = pods.filter(
      (p) =>
        ownedRS.some((rs) => rs.metadata.uid === p.metadata.ownerReference?.uid) &&
        !p.metadata.deletionTimestamp
    );
    const updatedPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === activeRS!.metadata.uid &&
        !p.metadata.deletionTimestamp
    );

    const readyCount = allOwnedPods.filter((p) => p.status.phase === 'Running').length;
    const isComplete = updatedPods.length === desiredReplicas && oldPodCount === 0 && readyCount === desiredReplicas;

    dep.status = {
      replicas: allOwnedPods.length,
      updatedReplicas: updatedPods.length,
      readyReplicas: readyCount,
      availableReplicas: readyCount,
      conditions: isComplete
        ? [{ type: 'Available', status: 'True', reason: 'MinimumReplicasAvailable' }]
        : [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
    };

    if (isComplete && oldPodCount === 0 && updatedPods.length === desiredReplicas) {
      // Check if we just completed (no previous Available condition)
      const prevDep = state.deployments.find((d) => d.metadata.uid === dep.metadata.uid);
      const wasComplete = prevDep?.status.conditions.some(
        (c) => c.type === 'Available' && c.status === 'True'
      );
      if (!wasComplete) {
        events.push({
          timestamp: Date.now(),
          tick: currentTick,
          type: 'Normal',
          reason: 'RolloutComplete',
          objectKind: 'Deployment',
          objectName: dep.metadata.name,
          message: `Deployment "${dep.metadata.name}" successfully rolled out`,
        });
      }
    }
  }

  return { deployments, replicaSets, pods, actions, events };
}
