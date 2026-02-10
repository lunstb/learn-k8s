import type { ClusterState, Job, CronJob, ControllerAction, SimEvent } from '../types';
import { generateUID } from '../utils';

interface ReconcileResult {
  jobs: Job[];
  cronJobs: CronJob[];
  actions: ControllerAction[];
  events: SimEvent[];
}

function parseScheduleInterval(schedule: string): number {
  // Legacy format: "every-N-ticks"
  const legacyMatch = schedule.match(/^every-(\d+)-ticks?$/);
  if (legacyMatch) {
    return parseInt(legacyMatch[1], 10);
  }

  // Real cron syntax: parse the minute field
  // Supports: */N (every N ticks), N (at tick N), * (every tick)
  const parts = schedule.trim().split(/\s+/);
  if (parts.length >= 1) {
    const minuteField = parts[0];
    if (minuteField === '*') return 1;
    const cronMatch = minuteField.match(/^\*\/(\d+)$/);
    if (cronMatch) {
      return parseInt(cronMatch[1], 10);
    }
    // Single number — treat as interval
    if (/^\d+$/.test(minuteField)) {
      return parseInt(minuteField, 10) || 5;
    }
  }

  // Default fallback: every 5 ticks
  return 5;
}

export function reconcileCronJobs(state: ClusterState): ReconcileResult {
  const actions: ControllerAction[] = [];
  const events: SimEvent[] = [];
  let jobs = [...state.jobs];
  const cronJobs = state.cronJobs.map((cj) => ({ ...cj }));
  const currentTick = state.tick;

  for (const cronJob of cronJobs) {
    const interval = parseScheduleInterval(cronJob.spec.schedule);

    // Check if it's time to create a new Job
    if (currentTick > 0 && currentTick % interval === 0) {
      const jobName = `${cronJob.metadata.name}-${currentTick}`;
      const newJob: Job = {
        kind: 'Job',
        metadata: {
          name: jobName,
          uid: generateUID(),
          labels: { ...cronJob.spec.jobTemplate.spec.template.labels },
          ownerReference: {
            kind: 'CronJob',
            name: cronJob.metadata.name,
            uid: cronJob.metadata.uid,
          },
          creationTimestamp: Date.now(),
        },
        spec: {
          ...cronJob.spec.jobTemplate.spec,
        },
        status: {
          succeeded: 0,
          failed: 0,
          active: 0,
        },
      };
      jobs.push(newJob);
      cronJob.status.lastScheduleTime = currentTick;

      actions.push({
        controller: 'CronJobController',
        action: 'create-job',
        details: `Created Job ${jobName} for CronJob ${cronJob.metadata.name} (tick ${currentTick}, schedule: ${cronJob.spec.schedule})`,
      });
      events.push({
        timestamp: Date.now(),
        tick: currentTick,
        type: 'Normal',
        reason: 'SuccessfulCreate',
        objectKind: 'CronJob',
        objectName: cronJob.metadata.name,
        message: `Created job: ${jobName}`,
      });
    }

    // Update active count: count owned jobs that are not yet completed
    const ownedJobs = jobs.filter(
      (j) => j.metadata.ownerReference?.uid === cronJob.metadata.uid
    );
    const activeJobs = ownedJobs.filter(
      (j) => !j.status.completionTime
    );
    cronJob.status.active = activeJobs.length;
  }

  return { jobs, cronJobs, actions, events };
}
