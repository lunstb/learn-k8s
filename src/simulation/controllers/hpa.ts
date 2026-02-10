import type { ClusterState, Deployment, HorizontalPodAutoscaler, ControllerAction, SimEvent } from '../types';


interface ReconcileResult {
  deployments: Deployment[];
  hpas: HorizontalPodAutoscaler[];
  actions: ControllerAction[];
  events: SimEvent[];
}

export function reconcileHPAs(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  const deployments = state.deployments.map((d) => ({ ...d }));
  const hpas = state.hpas.map((h) => ({ ...h }));
  const currentTick = state.tick;

  for (const hpa of hpas) {
    const { scaleTargetRef, minReplicas, maxReplicas, targetCPUUtilizationPercentage } = hpa.spec;

    // Find target deployment
    const targetDeployment = deployments.find(
      (d) =>
        d.metadata.name === scaleTargetRef.name &&
        scaleTargetRef.kind === 'Deployment'
    );

    if (!targetDeployment) {
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Warning',
        reason: 'FailedGetScale',
        objectKind: 'HorizontalPodAutoscaler',
        objectName: hpa.metadata.name,
        message: `Unable to find target Deployment "${scaleTargetRef.name}"`,
      });
      continue;
    }

    // Find pods belonging to the target deployment via its ReplicaSets
    const ownedReplicaSets = state.replicaSets.filter(
      (rs) =>
        rs.metadata.ownerReference?.uid === targetDeployment.metadata.uid &&
        !rs.metadata.deletionTimestamp
    );

    const deploymentPods = state.pods.filter(
      (p) =>
        ownedReplicaSets.some((rs) => rs.metadata.uid === p.metadata.ownerReference?.uid) &&
        !p.metadata.deletionTimestamp &&
        p.status.phase === 'Running'
    );

    const currentReplicas = targetDeployment.spec.replicas;

    // Calculate average CPU usage
    let averageCPU: number | undefined;
    if (deploymentPods.length > 0) {
      const podsWithCPU = deploymentPods.filter((p) => p.status.cpuUsage !== undefined);
      if (podsWithCPU.length > 0) {
        const totalCPU = podsWithCPU.reduce((sum, p) => sum + (p.status.cpuUsage ?? 0), 0);
        averageCPU = totalCPU / podsWithCPU.length;
      }
    }

    // Compute desired replicas
    let desiredReplicas = currentReplicas;
    if (averageCPU !== undefined && targetCPUUtilizationPercentage > 0) {
      desiredReplicas = Math.ceil(
        currentReplicas * (averageCPU / targetCPUUtilizationPercentage)
      );
    }

    // Clamp between min and max
    desiredReplicas = Math.max(minReplicas, Math.min(maxReplicas, desiredReplicas));

    // Update HPA status
    hpa.status = {
      currentReplicas,
      desiredReplicas,
      currentCPUUtilizationPercentage: averageCPU,
    };

    // HPA cooldown: don't scale again within 3 ticks of last scale action (simulates real K8s stabilization window)
    const lastScaleTick = (hpa as any)._lastScaleTick ?? -Infinity;
    const cooldownTicks = 3;

    // Scale the deployment if needed (and cooldown has passed)
    if (desiredReplicas !== currentReplicas && (currentTick - lastScaleTick) >= cooldownTicks) {
      targetDeployment.spec = {
        ...targetDeployment.spec,
        replicas: desiredReplicas,
      };

      const scaleDirection = desiredReplicas > currentReplicas ? 'up' : 'down';
      actions.push({
        controller: 'HPAController',
        action: `scale-${scaleDirection}`,
        details: `Scaled Deployment ${targetDeployment.metadata.name} from ${currentReplicas} to ${desiredReplicas} replicas (CPU: ${averageCPU?.toFixed(0) ?? 'N/A'}% / target: ${targetCPUUtilizationPercentage}%)`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: desiredReplicas > currentReplicas ? 'SuccessfulRescale' : 'SuccessfulRescale',
        objectKind: 'HorizontalPodAutoscaler',
        objectName: hpa.metadata.name,
        message: `New size: ${desiredReplicas}; reason: CPU utilization ${averageCPU?.toFixed(0) ?? 'unknown'}% > target ${targetCPUUtilizationPercentage}%`,
      });

      // Track last scale tick for cooldown
      (hpa as any)._lastScaleTick = currentTick;
    }
  }

  return { deployments, hpas, actions, events };
}
