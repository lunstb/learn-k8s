import type { ClusterState, Pod, Job, ControllerAction, SimEvent } from '../types';
import { generateUID, generatePodName } from '../utils';

interface ReconcileResult {
  pods: Pod[];
  jobs: Job[];
  actions: ControllerAction[];
  events: SimEvent[];
}

export function reconcileJobs(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  let pods = [...state.pods];
  const jobs = state.jobs.map((j) => ({ ...j }));
  const currentTick = state.tick;

  for (const job of jobs) {
    // Skip completed or failed jobs
    if (job.status.completionTime) {
      continue;
    }

    // Find owned pods (not terminating)
    const ownedPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === job.metadata.uid &&
        !p.metadata.deletionTimestamp
    );

    const succeededPods = ownedPods.filter((p) => p.status.phase === 'Succeeded');
    const failedPods = ownedPods.filter((p) => p.status.phase === 'Failed');
    const activePods = ownedPods.filter(
      (p) => p.status.phase !== 'Succeeded' && p.status.phase !== 'Failed'
    );

    const succeeded = succeededPods.length;
    const failed = failedPods.length;
    const active = activePods.length;
    const completions = job.spec.completions;
    const parallelism = job.spec.parallelism;

    // Set startTime on first reconcile
    if (!job.status.startTime) {
      job.status.startTime = currentTick;
    }

    // Check if job has exceeded backoff limit
    if (failed > job.spec.backoffLimit) {
      job.status = {
        ...job.status,
        succeeded,
        failed,
        active: 0,
      };
      // Terminate active pods
      for (const pod of activePods) {
        pod.metadata.deletionTimestamp = Date.now();
        pod.status = { ...pod.status, phase: 'Terminating' };
      }
      actions.push({
        controller: 'JobController',
        action: 'failed',
        details: `Job ${job.metadata.name} has exceeded backoff limit (${failed} failures)`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Warning',
        reason: 'BackoffLimitExceeded',
        objectKind: 'Job',
        objectName: job.metadata.name,
        message: `Job has reached the specified backoff limit (${job.spec.backoffLimit})`,
      });
      continue;
    }

    // Check if job is complete
    if (succeeded >= completions) {
      job.status = {
        ...job.status,
        succeeded,
        failed,
        active: 0,
        completionTime: currentTick,
      };
      actions.push({
        controller: 'JobController',
        action: 'complete',
        details: `Job ${job.metadata.name} completed successfully (${succeeded}/${completions})`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'Completed',
        objectKind: 'Job',
        objectName: job.metadata.name,
        message: `Job completed: ${succeeded}/${completions} succeeded`,
      });
      continue;
    }

    // Create pods up to parallelism if more completions are needed
    const remainingCompletions = completions - succeeded;
    const desiredActive = Math.min(parallelism, remainingCompletions);
    const toCreate = desiredActive - active;

    for (let i = 0; i < toCreate; i++) {
      const podName = generatePodName(job.metadata.name);
      const newPod: Pod = {
        kind: 'Pod',
        metadata: {
          name: podName,
          uid: generateUID(),
          labels: { ...job.spec.template.labels },
          ownerReference: {
            kind: 'Job',
            name: job.metadata.name,
            uid: job.metadata.uid,
          },
          creationTimestamp: Date.now(),
        },
        spec: {
          ...job.spec.template.spec,
          completionTicks: 2,
          restartPolicy: 'Never',
        },
        status: { phase: 'Pending', tickCreated: currentTick },
      };
      pods.push(newPod);
      actions.push({
        controller: 'JobController',
        action: 'create-pod',
        details: `Created Pod ${podName} for Job ${job.metadata.name} (active: ${active + i + 1}, succeeded: ${succeeded}/${completions})`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'Created',
        objectKind: 'Job',
        objectName: job.metadata.name,
        message: `Created pod: ${podName}`,
      });
    }

    // Update job status
    const updatedOwnedPods = pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === job.metadata.uid &&
        !p.metadata.deletionTimestamp
    );
    const updatedActive = updatedOwnedPods.filter(
      (p) => p.status.phase !== 'Succeeded' && p.status.phase !== 'Failed'
    );
    job.status = {
      ...job.status,
      succeeded,
      failed,
      active: updatedActive.length,
    };
  }

  return { pods, jobs, actions, events };
}
