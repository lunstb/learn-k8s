import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonDebugging: Lesson = {
  id: 7,
  title: 'Debugging Failures',
  description:
    'Learn to diagnose and fix the two most common pod failures: ImagePullError and CrashLoopBackOff.',
  mode: 'full',
  goalDescription:
    'Trigger an ImagePullError by deploying a typo\'d image name ("nignx:2.0"), then use events and describe to diagnose and fix it. Final state: all 3 pods Running nginx:2.0.',
  successMessage:
    'You diagnosed and fixed an ImagePullError using events and describe. ' +
    'ImagePullError = bad image name or missing tag. Always check the image string first when pods won\'t start.',
  hints: [
    { text: 'Try setting a deliberately bad image name to see what happens.' },
    { text: 'kubectl set image deployment/web-app web-app=nignx:2.0', exact: true },
    { text: 'Use kubectl get events to see the error. Fix the typo in the image name.' },
    { text: 'kubectl set image deployment/web-app web-app=nginx:2.0', exact: true },
  ],
  goals: [
    {
      description: 'Trigger an ImagePullError (deploy image "nignx:2.0" — note the typo)',
      check: (s: ClusterState) => s.pods.some(p => p.status.reason === 'ImagePullError') || s.events.some(e => e.reason === 'Failed' && e.message.includes('ImagePullError')),
    },
    {
      description: 'Fix the ImagePullError and get pods Running',
      check: (s: ClusterState) => {
        const dep = s.deployments.find(d => d.metadata.name === 'web-app');
        return !!dep && dep.spec.template.spec.image === 'nginx:2.0' && !s.pods.some(p => p.status.reason === 'ImagePullError' && !p.metadata.deletionTimestamp);
      },
    },
    {
      description: 'All 3 pods Running with image nginx:2.0',
      check: (s: ClusterState) => {
        const dep = s.deployments.find(d => d.metadata.name === 'web-app');
        if (!dep || dep.spec.template.spec.image !== 'nginx:2.0') return false;
        const activePods = s.pods.filter(p => !p.metadata.deletionTimestamp && p.status.phase === 'Running' && p.spec.image === 'nginx:2.0' && s.replicaSets.some(rs => rs.metadata.ownerReference?.uid === dep.metadata.uid && rs.metadata.uid === p.metadata.ownerReference?.uid));
        return activePods.length === 3;
      },
    },
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
      question:
        'A pod shows status "Running" but you notice restartCount is 47 and climbing. What is most likely happening?',
      choices: [
        'The node is unstable and keeps rebooting, which causes all pods on that node to restart',
        'A liveness probe is misconfigured and periodically killing an otherwise healthy container',
        'The restartCount is a cumulative counter from previous ReplicaSets and does not indicate a problem',
        'The container is in a CrashLoopBackOff cycle -- it starts, crashes, and gets restarted repeatedly',
      ],
      correctIndex: 3,
      explanation:
        'A pod can briefly show "Running" between crashes during CrashLoopBackOff. The status alternates between Running and CrashLoopBackOff as Kubernetes restarts the container with exponential backoff delays (10s, 20s, 40s, up to 5min). A restartCount of 47 means the container has crashed 47 times. Option D is plausible but would typically show in events as "Unhealthy" warnings -- the high restartCount with no liveness probe events points to the app itself crashing.',
    },
    {
      question:
        'You run "kubectl set image deployment/api nginx:2.1" but the rollout stalls. Events show ImagePullError on the new pods. What is happening to production traffic right now?',
      choices: [
        'Traffic is being dropped because the Deployment enters a failed state during a stalled rollout',
        'Traffic is being routed to the new broken pods, causing 500 errors for end users',
        'Traffic continues flowing to the old pods -- they are still running and serving requests normally',
        'The Service automatically removes all endpoints and pauses routing until the rollout completes',
      ],
      correctIndex: 2,
      explanation:
        'This is the key safety property of rolling updates: old pods are NOT removed until new pods are Ready. Since the new pods have ImagePullError, they never become Ready, so the old ReplicaSet keeps its pods and the Service continues routing to them. Your users experience zero downtime from a bad image push. The rollout simply stalls until you fix the image name.',
    },
    {
      question:
        'A pod has been in ImagePullBackOff for 20 minutes. You fix the image tag with "kubectl set image". What do you expect to happen next?',
      choices: [
        'Nothing -- you need to delete the stuck pods manually before the Deployment will create new ones',
        'The Deployment controller detects the spec change, creates a new ReplicaSet with the corrected image, and resumes the rollout',
        'You must run "kubectl rollout restart" to force the Deployment to retry the image pull on existing pods',
        'The existing pods automatically re-pull the corrected image and restart their containers in-place',
      ],
      correctIndex: 1,
      explanation:
        'When you change the pod template spec (including the image), the Deployment controller creates a new ReplicaSet. The old stuck pods belong to the previous ReplicaSet. The new ReplicaSet creates fresh pods with the correct image. You do not need to manually delete pods or force a rollout -- the declarative model handles it. The rolling update resumes automatically with the corrected configuration.',
    },
    {
      question:
        'You see this event: "Back-off restarting failed container." The pod shows CrashLoopBackOff. You run "kubectl logs" and see a Python traceback with "ModuleNotFoundError". What is the root cause?',
      choices: [
        'The application code has a missing dependency in the container image -- this is a build issue, not a Kubernetes problem',
        'The image was pulled from the wrong registry and contains a different Python version than expected',
        'Kubernetes failed to mount the required ConfigMap that should contain the Python module path',
        'The pod needs a higher memory limit to install Python dependencies during container startup',
      ],
      correctIndex: 0,
      explanation:
        'CrashLoopBackOff means the image pulled successfully but the process exits on startup. A "ModuleNotFoundError" is a Python import error -- the application code references a library not installed in the container image. This is an application/build issue, not a Kubernetes infrastructure problem. The fix is to rebuild the image with the missing dependency. This distinction matters: ImagePullError = Kubernetes cannot fetch the image; CrashLoopBackOff = the image runs but the process crashes.',
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
