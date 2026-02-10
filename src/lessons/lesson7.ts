import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson7: Lesson = {
  id: 7,
  title: 'Debugging Failures',
  description:
    'Learn to diagnose and fix the two most common pod failures: ImagePullError and CrashLoopBackOff.',
  goalDescription:
    'Trigger an ImagePullError by deploying a typo image, diagnose and fix it, then trigger CrashLoopBackOff and fix that too.',
  successMessage:
    'ImagePullError = bad image name. CrashLoopBackOff = app crashes on start. ' +
    'Events and describe are your debugging tools.',
  hints: [
    'First: kubectl set image deployment/web-app nignx:2.0 (note the typo!)',
    'Check events: kubectl get events',
    'Fix: kubectl set image deployment/web-app nginx:2.0',
    'Then try: kubectl set image deployment/web-app crash-app:1.0',
    'Check events and restart counts.',
    'Fix: kubectl set image deployment/web-app nginx:2.0',
  ],
  lecture: {
    sections: [
      {
        title: 'The Two Failures You\'ll See Constantly',
        content:
          'You deploy an update. Pods don\'t start. What went wrong? In Kubernetes, the answer is almost always ' +
          'one of two things:\n\n' +
          'ImagePullError: the container image can\'t be downloaded. You typoed the image name ' +
          '("nignx" instead of "nginx"), the tag doesn\'t exist, or the registry requires credentials you haven\'t configured. ' +
          'The pod stays Pending forever — it can\'t start because it can\'t get its container image.\n\n' +
          'CrashLoopBackOff: the image downloads fine, the container starts — then immediately crashes. ' +
          'Kubernetes restarts it, it crashes again, restarts again... each time waiting longer between attempts ' +
          '(10s, 20s, 40s, up to 5 minutes). The pod cycles between Running and CrashLoopBackOff while the restart count climbs.\n\n' +
          'These two failures account for the vast majority of "my pod won\'t work" issues. Once you can ' +
          'recognize and fix them quickly, you\'ve eliminated most Kubernetes debugging pain.',
        diagram:
          '  ImagePullError:\n' +
          '  Pending ──→ Pending (stuck, image not found)\n' +
          '  \n' +
          '  CrashLoopBackOff:\n' +
          '  Pending → Running → Crash → BackOff → Running → Crash → ...\n' +
          '                    (restart count increases)',
        keyTakeaway:
          'ImagePullError = the image can\'t be found (check the name). CrashLoopBackOff = the app starts but crashes (check the logs). These two failures cover 90% of pod issues.',
      },
      {
        title: 'Events: Your Diagnostic Trail',
        content:
          'When something goes wrong, how do you figure out what happened? Kubernetes records every significant ' +
          'action as an event: pod creation, scheduling, image pull, container start, failures.\n\n' +
          'Imagine you deploy an update and pods are stuck Pending. You run `kubectl get events` and see:\n\n' +
          '"Warning: Failed to pull image nignx:2.0 — image not found"\n\n' +
          'That\'s your answer in one line. Events have two types: Normal (routine — pod created, image pulled) ' +
          'and Warning (problems). Warning events are almost always what you\'re looking for.\n\n' +
          'Key Warning reasons to watch for:\n\n' +
          'Failed: Image pull issues. Check for typos, missing tags, or private registries.\n\n' +
          'BackOff: Crash loops. The container starts but exits immediately. Check application logs.\n\n' +
          'FailedScheduling: No node capacity. Check node status with `kubectl get nodes`.',
        keyTakeaway:
          'When something goes wrong, `kubectl get events` is your first command. Warning events tell you exactly what failed and why.',
      },
      {
        title: 'The Debugging Workflow',
        content:
          'Don\'t guess. Follow this systematic workflow:\n\n' +
          'Step 1: `kubectl get pods` — which pods are unhealthy? Look for anything that\'s not Running: ' +
          'Pending, CrashLoopBackOff, Failed, ImagePullError.\n\n' +
          'Step 2: `kubectl describe pod <name>` — drill into the specific pod. The Events section at the ' +
          'bottom shows exactly what happened. The Status section shows conditions.\n\n' +
          'Step 3: `kubectl get events` — see the full cluster timeline. Sometimes the pod\'s own events ' +
          'aren\'t enough and you need the broader picture.\n\n' +
          'Step 4: Fix the root cause. If it\'s an image typo, update the image. If it\'s a crash, fix the application. ' +
          'If it\'s scheduling, check nodes.\n\n' +
          'Step 5: Reconcile and verify. Watch pods transition back to Running.',
        keyTakeaway:
          'Debugging workflow: get pods (find the sick one) → describe pod (read its story) → get events (see the timeline) → fix → verify. Always observe before acting.',
      },
      {
        title: 'Rollout Stalls: When Updates Go Wrong',
        content:
          'During a rolling update, if new pods fail (ImagePullError, CrashLoopBackOff), the rollout stalls. ' +
          'But here\'s the key insight: old pods keep running. Your application stays up.\n\n' +
          'This is a safety feature, not a bug. The rolling update design ensures that failures in new pods ' +
          'never take down your existing service. The old ReplicaSet maintains its pods while the ' +
          'new ReplicaSet struggles to bring up replacements.\n\n' +
          'The fix is simple: correct the image or configuration. Once you do, the rollout automatically resumes. ' +
          'Kubernetes detects that new pods can now start successfully and continues the gradual replacement.\n\n' +
          'This is why rolling updates are the default strategy — they make deployments safe. Even bad deployments ' +
          'don\'t cause outages. They just stall until fixed.',
        keyTakeaway:
          'A stalled rollout is safe — old pods keep serving traffic. Fix the issue (image, config) and the rollout resumes automatically. Rolling updates are designed to fail safely.',
      },
    ],
  },
  quiz: [
    {
      question: 'A pod is stuck in Pending with reason ImagePullError. What\'s the most likely cause?',
      choices: [
        'The node ran out of memory',
        'The image name has a typo or the image doesn\'t exist',
        'The pod has too many containers',
        'The cluster is full',
      ],
      correctIndex: 1,
      explanation:
        'ImagePullError means the container runtime couldn\'t download the image. ' +
        'Check for typos in the image name, missing tags, or missing registry credentials.',
    },
    {
      question: 'What does CrashLoopBackOff mean?',
      choices: [
        'The pod is waiting for a dependency',
        'The container starts but crashes repeatedly, with increasing restart delays',
        'The pod can\'t be scheduled',
        'The network is down',
      ],
      correctIndex: 1,
      explanation:
        'CrashLoopBackOff means the container starts, crashes, restarts, crashes again. ' +
        'Kubernetes increases the delay between restarts (exponential backoff). ' +
        'Check application logs for the crash cause.',
    },
    {
      question: 'What\'s the first command you should run when debugging pod issues?',
      choices: [
        'kubectl delete pod',
        'kubectl get pods (to see status of all pods)',
        'kubectl restart cluster',
        'kubectl scale deployment --replicas=0',
      ],
      correctIndex: 1,
      explanation:
        'Start with kubectl get pods to see which pods are in unhealthy states ' +
        '(Pending, CrashLoopBackOff, Failed). Then drill into specific pods with describe.',
    },
    {
      question: 'During a rolling update, new pods fail with ImagePullError. What happens to the old pods?',
      choices: [
        'They\'re immediately deleted',
        'They keep running -- the rollout stalls but the app stays up',
        'They restart',
        'They switch to the new image',
      ],
      correctIndex: 1,
      explanation:
        'Rolling updates are designed to be safe. If new pods fail, old pods continue serving traffic. ' +
        'The rollout pauses until the issue is fixed.',
    },
  ],
  podFailureRules: {
    'nignx:2.0': 'ImagePullError',
    'crash-app:1.0': 'CrashLoopBackOff',
  },
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    const pods = Array.from({ length: 3 }, () => ({
      kind: 'Pod' as const,
      metadata: {
        name: generatePodName(`web-app-${hash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'web-app', 'pod-template-hash': hash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `web-app-${hash.slice(0, 10)}`,
          uid: rsUid,
        },
        creationTimestamp: Date.now() - 60000,
      },
      spec: { image },
      status: { phase: 'Running' as const },
    }));

    return {
      deployments: [
        {
          kind: 'Deployment' as const,
          metadata: {
            name: 'web-app',
            uid: depUid,
            labels: { app: 'web-app' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'web-app' },
            template: {
              labels: { app: 'web-app' },
              spec: { image },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 3,
            updatedReplicas: 3,
            readyReplicas: 3,
            availableReplicas: 3,
            conditions: [{ type: 'Available', status: 'True' }],
          },
        },
      ],
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `web-app-${hash.slice(0, 10)}`,
            uid: rsUid,
            labels: { app: 'web-app', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'Deployment',
              name: 'web-app',
              uid: depUid,
            },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'web-app', 'pod-template-hash': hash },
            template: {
              labels: { app: 'web-app', 'pod-template-hash': hash },
              spec: { image },
            },
          },
          status: { replicas: 3, readyReplicas: 3 },
        },
      ],
      pods,
      nodes: [],
      services: [],
      events: [],
    };
  },
  steps: [
    {
      id: 'intro-break',
      trigger: 'onLoad',
      instruction:
        'Your app is healthy. Try updating to a typo image: "kubectl set image deployment/web-app nignx:2.0" (note: nignx, not nginx). Then Reconcile.',
    },
  ],
  goalCheck: (state) => {
    const dep = state.deployments.find((d) => d.metadata.name === 'web-app');
    if (!dep) return false;
    if (dep.spec.template.spec.image !== 'nginx:2.0') return false;

    const activePods = state.pods.filter(
      (p) =>
        !p.metadata.deletionTimestamp &&
        p.status.phase === 'Running' &&
        p.spec.image === 'nginx:2.0' &&
        state.replicaSets.some(
          (rs) =>
            rs.metadata.ownerReference?.uid === dep.metadata.uid &&
            rs.metadata.uid === p.metadata.ownerReference?.uid
        )
    );
    return activePods.length === 3;
  },
};
