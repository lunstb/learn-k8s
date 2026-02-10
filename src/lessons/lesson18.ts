import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lesson18: Lesson = {
  id: 18,
  title: 'Jobs & CronJobs',
  description:
    'Jobs run tasks to completion rather than indefinitely. CronJobs schedule Jobs on a recurring basis.',
  mode: 'full',
  goalDescription:
    'Create a Job named "data-migration" with image migrate:1.0 and 3 completions. One pod will fail during execution — the Job controller retries automatically. Verify all 3 completions succeed.',
  successMessage:
    'The Job completed all 3 tasks successfully despite a pod failure. The Job controller automatically retried the failed pod — ' +
    'this is how Jobs handle transient failures with backoffLimit retries.',
  hints: [
    { text: 'The syntax is: kubectl create job <name> --image=<image> --completions=<count>. Use "kubectl get jobs" to track progress.' },
    { text: 'kubectl create job data-migration --image=migrate:1.0 --completions=3', exact: true },
    { text: 'One pod will fail around tick 2 — this is expected. The Job controller retries automatically.' },
    { text: 'Keep reconciling until kubectl get jobs shows 3/3 completions.' },
  ],
  goals: [
    {
      description: 'Create a Job named "data-migration" with 3 completions',
      check: (s: ClusterState) => !!s.jobs.find(j => j.metadata.name === 'data-migration'),
    },
    {
      description: 'Job reaches 3/3 successful completions',
      check: (s: ClusterState) => {
        const job = s.jobs.find(j => j.metadata.name === 'data-migration');
        return !!job && (job.status.succeeded || 0) >= 3;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Not Everything Runs Forever',
        content:
          'Deployments, StatefulSets, and DaemonSets all manage long-running processes. They keep pods alive ' +
          'indefinitely and restart them when they crash. But some tasks are meant to finish:\n\n' +
          'Database migrations: run a schema update script, then exit.\n' +
          'Data processing: transform a batch of records, then exit.\n' +
          'Report generation: compute monthly analytics, write the report, then exit.\n' +
          'Backups: snapshot the database, upload to S3, then exit.\n\n' +
          'If you run a migration script in a Deployment, Kubernetes will keep restarting it after it completes — ' +
          'because the Deployment thinks the pod "crashed." You need a controller that understands the concept ' +
          'of completion: run the task, verify it succeeded, and stop.\n\n' +
          'Jobs are that controller. A Job creates one or more pods, runs them to completion, and tracks ' +
          'how many have succeeded. When the required number of completions is reached, the Job is done.',
        keyTakeaway:
          'Jobs are for tasks that should run to completion and then stop. Unlike Deployments that keep pods running forever, Jobs track success and terminate when the work is done.',
      },
      {
        title: 'Completions and Parallelism',
        content:
          'Jobs have two key settings that control their execution:\n\n' +
          'completions: how many times the task must succeed. If completions=3, the Job needs 3 pods to reach ' +
          '"Succeeded" phase. Think of it as "run this task 3 times successfully."\n\n' +
          'parallelism: how many pods can run simultaneously. If parallelism=1 (default), pods run one at a time: ' +
          'pod 1 completes, then pod 2 starts, then pod 3. If parallelism=3, all 3 pods start at once.\n\n' +
          'Examples:\n' +
          '- completions=1, parallelism=1: simple one-shot task (default)\n' +
          '- completions=10, parallelism=1: sequential queue of 10 tasks\n' +
          '- completions=10, parallelism=3: process 10 tasks, 3 at a time\n' +
          '- completions=10, parallelism=10: process all 10 tasks simultaneously\n\n' +
          'The Job controller watches for Succeeded pods and creates new ones until the completions target is met.',
        diagram:
          '  Job: data-migration (completions=3, parallelism=1)\n' +
          '  ───────────────────────────────────────────────────\n' +
          '  Tick 1:  pod-1 Running\n' +
          '  Tick 2:  pod-1 Succeeded, pod-2 Running\n' +
          '  Tick 3:  pod-2 Succeeded, pod-3 Running\n' +
          '  Tick 4:  pod-3 Succeeded → Job Complete (3/3)',
        keyTakeaway:
          'Completions = how many total successful runs. Parallelism = how many run at once. Together they control whether your batch work is sequential, parallel, or somewhere in between.',
      },
      {
        title: 'CronJobs: Scheduled Recurring Work',
        content:
          'A CronJob is a Job on a schedule. It creates a new Job at specified intervals using a cron expression.\n\n' +
          'Examples:\n' +
          '- "0 2 * * *" — run daily at 2 AM (nightly backups)\n' +
          '- "*/15 * * * *" — run every 15 minutes (health checks)\n' +
          '- "0 0 1 * *" — run on the 1st of each month (monthly reports)\n\n' +
          'Each time the schedule fires, the CronJob creates a new Job object, which in turn creates pods. ' +
          'The CronJob manages Job lifecycle: it can retain a history of completed Jobs (successfulJobsHistoryLimit) ' +
          'and limit how many Jobs can run concurrently (concurrencyPolicy).\n\n' +
          'The concurrencyPolicy has three options:\n' +
          '- Allow: multiple Jobs can run simultaneously (default)\n' +
          '- Forbid: skip the new Job if the previous one is still running\n' +
          '- Replace: cancel the running Job and start a new one',
        keyTakeaway:
          'CronJobs create Jobs on a schedule using cron expressions. Use concurrencyPolicy to control what happens when a previous Job is still running when the next one is due.',
      },
      {
        title: 'Failure Handling and Backoff Limits',
        content:
          'What happens when a Job pod fails? The Job controller has a backoffLimit (default: 6) that determines ' +
          'how many times to retry. Each failed pod counts against this limit. Once the limit is reached, ' +
          'the Job is marked as Failed and no more pods are created.\n\n' +
          'The retry delay uses exponential backoff: 10s, 20s, 40s, up to 6 minutes. This prevents ' +
          'a broken task from consuming cluster resources by retrying too rapidly.\n\n' +
          'For the pod itself, the restartPolicy matters:\n' +
          '- restartPolicy=Never: a failed container creates a new pod (the old pod stays for debugging)\n' +
          '- restartPolicy=OnFailure: the same pod\'s container is restarted in place\n\n' +
          'Job cleanup is also important. By default, completed Jobs and their pods remain in the cluster ' +
          'for inspection. Use ttlSecondsAfterFinished to auto-delete completed Jobs after a specified time. ' +
          'CronJobs handle this via successfulJobsHistoryLimit and failedJobsHistoryLimit.',
        keyTakeaway:
          'Jobs retry failed pods up to backoffLimit times with exponential backoff. Set restartPolicy to Never (new pods per attempt) or OnFailure (restart in place). Clean up old Jobs with TTL or history limits.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A Job has completions=5 and parallelism=2. The 3rd pod (counting toward the 3rd completion) fails with an exit code 1. What happens next?',
      choices: [
        'The Job immediately fails and is marked as Failed since a pod could not complete successfully',
        'The failed pod counts as one of the 5 completions — the Job continues and needs only 2 more successful pods',
        'The Job controller creates a replacement pod (counting the failure against backoffLimit), and still needs 3 more successful completions to reach 5 total',
        'The Job pauses all running pods and waits for manual intervention before retrying',
      ],
      correctIndex: 2,
      explanation:
        'Failed pods do not count toward completions — only Succeeded pods do. The Job controller retries the failed work by creating a new pod (with exponential backoff delay). ' +
        'Each failure counts against the backoffLimit (default: 6). At this point, 2 pods have succeeded and the failure is retry #1. The Job still needs 3 more successes. ' +
        'If failures keep accumulating and hit the backoffLimit, THEN the entire Job is marked as Failed. This is why setting an appropriate backoffLimit is important for jobs that might experience transient failures.',
    },
    {
      question:
        'A CronJob is scheduled for "0 2 * * *" (daily at 2:00 AM) with concurrencyPolicy=Forbid. The 2:00 AM Job starts but takes 90 minutes to complete. When the next day\'s 2:00 AM trigger fires, the previous Job is still running. What happens?',
      choices: [
        'The 2:00 AM scheduled run is skipped entirely — the CronJob records a missed schedule and tries again at 2:00 AM the following day',
        'The new Job is created and runs alongside the still-running Job from yesterday',
        'The still-running Job is terminated and replaced by the new Job',
        'The new Job is queued and starts automatically as soon as the running Job completes',
      ],
      correctIndex: 0,
      explanation:
        'With concurrencyPolicy=Forbid, if the previous Job is still running when the next scheduled time arrives, the new run is simply skipped. There is no queueing mechanism — the trigger fires, sees a running Job, and does nothing. ' +
        'This is important for tasks like database migrations or report generation where running two instances simultaneously could cause data corruption. ' +
        'If you need to ensure every scheduled run eventually executes, consider Allow (concurrent runs) or investigate why your Job takes longer than the schedule interval. ' +
        'The third option, Replace, would cancel the running Job and start a new one.',
    },
    {
      question:
        'Your team needs to run a data processing task that reads from a queue, processes items, and exits when the queue is empty. The task should run continuously, restarting if it crashes, and always have exactly 2 workers. Should you use a Job or a Deployment?',
      choices: [
        'A Job with completions=2 and parallelism=2, since it runs exactly 2 pods for the processing work',
        'A Deployment with replicas=2, because the workers should run continuously and restart on failure — Jobs are for tasks that finish and stop',
        'A Job with no completions limit, since it allows pods to run indefinitely like a Deployment',
        'Either works identically — Jobs and Deployments are interchangeable for queue workers',
      ],
      correctIndex: 1,
      explanation:
        'This is a long-running worker process, not a batch task. The key phrase is "runs continuously" — the workers should always be running, processing items as they arrive. A Deployment with replicas=2 ensures exactly 2 worker pods are always alive and automatically restarts them on failure. ' +
        'A Job with completions=2 would create 2 pods, wait for them to exit successfully, and then consider the work done — it would not restart them. ' +
        'Jobs are for finite tasks (run a migration, generate a report, process a fixed batch). Deployments are for processes that should run indefinitely. Even though the workers "process" data, their lifecycle is continuous.',
    },
    {
      question:
        'You have a Job with completions=10, parallelism=3, and backoffLimit=4. After 7 pods succeed, the 8th, 9th, 10th, and 11th pods all fail consecutively. What is the final state of the Job?',
      choices: [
        'The Job succeeds with 7 out of 10 completions, since over 50% succeeded',
        'The Job continues retrying indefinitely because 7 completions are already done and it only needs 3 more',
        'The Job succeeds because the total number of pods created (11) exceeds the completions count of 10',
        'The Job is marked as Failed — the 4 consecutive failures exhaust the backoffLimit of 4, even though 7 pods already succeeded',
      ],
      correctIndex: 3,
      explanation:
        'The backoffLimit counts total failures across the entire Job lifecycle, not consecutive failures. After 4 pod failures (the 8th through 11th pods), the backoffLimit of 4 is reached and Kubernetes marks the Job as Failed — even though 7 pods already succeeded. ' +
        'The 7 completed tasks are done, but the Job never reaches its completions target of 10. This means partial completion is possible and your application must handle it. ' +
        'For critical batch work, consider setting a higher backoffLimit, implementing idempotent tasks (so retries are safe), and building monitoring to detect partial Job failures.',
    },
  ],
  initialState: () => {
    const nodeNames = ['node-1', 'node-2'];
    const nodes = nodeNames.map((name) => ({
      kind: 'Node' as const,
      metadata: {
        name,
        uid: generateUID(),
        labels: { 'kubernetes.io/hostname': name },
        creationTimestamp: Date.now() - 300000,
      },
      spec: { capacity: { pods: 5 } },
      status: {
        conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
        allocatedPods: 0,
      },
    }));

    return {
      pods: [],
      replicaSets: [],
      deployments: [],
      nodes,
      services: [],
      events: [],
      namespaces: [],
      configMaps: [],
      secrets: [],
      ingresses: [],
      statefulSets: [],
      daemonSets: [],
      jobs: [],
      cronJobs: [],
      hpas: [],
      helmReleases: [],
    };
  },
  afterTick: (tick, state) => {
    // At tick 2, fail one running job pod to demonstrate failure handling
    if (tick === 2) {
      const jobPods = state.pods.filter(
        (p) =>
          p.metadata.labels['job-name'] === 'data-migration' &&
          p.status.phase === 'Running' &&
          !p.metadata.deletionTimestamp
      );
      if (jobPods.length > 0) {
        const victim = jobPods[0];
        victim.status.phase = 'Failed';
        if (!victim.spec.logs) victim.spec.logs = [];
        victim.spec.logs.push('[error] Connection reset by peer');
        victim.spec.logs.push('[fatal] Process exited with code 1');
      }
    }
    return state;
  },
  goalCheck: (state) => {
    if (state.jobs.length < 1) return false;

    const job = state.jobs.find((j) => j.metadata.name === 'data-migration');
    if (!job) return false;

    return job.status.succeeded >= 3;
  },
};
