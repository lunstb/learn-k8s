import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson4: Lesson = {
  id: 4,
  title: 'Deployments and Updates',
  description:
    'See how Deployments orchestrate rolling updates by creating new ReplicaSets and gradually replacing pods.',
  goalDescription:
    'Update the image to nginx:2.0 and Reconcile until all pods run the new version.',
  successMessage:
    'Rolling update complete! Two ReplicaSets coexisted during transition. ' +
    'The old RS scaled down as the new one scaled up.',
  hints: [
    'Use: kubectl set image deployment/my-app nginx:2.0',
    'Click "Reconcile" multiple times to step through the rolling update.',
    'Watch the old ReplicaSet shrink and the new one grow.',
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: How Do You Update Without Downtime?',
        content:
          'You have 3 pods running nginx:1.0, serving real traffic. You need to deploy nginx:2.0. ' +
          'How do you do it without taking the application down?\n\n' +
          'Naive approach: delete all old pods, create new ones. This causes downtime — between ' +
          'deleting the old and starting the new, nothing is serving traffic.\n\n' +
          'Better approach: create new pods first, then delete old ones. But who orchestrates this? ' +
          'Who decides when the new pods are ready? Who handles rollback if the new version is broken?\n\n' +
          'This is the problem Deployments solve. A Deployment manages ReplicaSets, which manage Pods. ' +
          'This three-level hierarchy exists specifically to handle updates: the Deployment creates ' +
          'a new RS for the new template while keeping the old RS around, then gradually shifts pods ' +
          'from old to new.',
        diagram:
          '  Deployment (my-app)\n' +
          '       \u2502 owns\n' +
          '       \u25bc\n' +
          '  ReplicaSet (my-app-7f8c9d)\n' +
          '       \u2502 owns\n' +
          '       \u25bc\n' +
          '  Pod (my-app-7f8c9d-x4k2p)\n' +
          '  Pod (my-app-7f8c9d-m9n1q)\n' +
          '  Pod (my-app-7f8c9d-j5r7w)',
        keyTakeaway:
          'The Deployment \u2192 ReplicaSet \u2192 Pod hierarchy exists to solve the update problem. Each layer has one job: Deployments manage change, ReplicaSets manage count, Pods run containers.',
      },
      {
        title: 'Rolling Updates: The Safe Way to Deploy',
        content:
          'When you change the Deployment\'s template (e.g., update the image), it doesn\'t update ' +
          'pods in-place. Pods are immutable — you can\'t change a running pod. Instead, the Deployment:\n\n' +
          '1. Creates a NEW ReplicaSet with the new template\n' +
          '2. Gradually scales up the new RS while scaling down the old RS\n' +
          '3. Old pods terminate as new pods become ready\n\n' +
          'At every step, some pods are always running. The application stays available throughout ' +
          'the update. If the new pods fail to start (bad image, crash), the old pods keep running — ' +
          'your users never see an outage.\n\n' +
          'This is why there are two ReplicaSets during an update: the old one holds the working pods ' +
          'as a safety net while the new one gradually proves itself.',
        keyTakeaway:
          'Rolling updates ensure zero-downtime deployments. Old pods keep serving while new pods spin up. If new pods fail, old pods remain — your app stays up.',
      },
      {
        title: 'maxSurge and maxUnavailable: Speed vs Safety',
        content:
          'You can tune how aggressive the rollout is with two parameters:\n\n' +
          'maxSurge: how many extra pods can exist above the desired count during an update. ' +
          'If replicas=3 and maxSurge=1, you can have up to 4 pods total during the rollout. ' +
          'Higher maxSurge = faster rollout (more new pods created at once) but more resource usage.\n\n' +
          'maxUnavailable: how many pods can be unavailable during the update. If replicas=3 and ' +
          'maxUnavailable=1, at least 2 pods must be Running at all times. ' +
          'Higher maxUnavailable = faster rollout but less capacity during the transition.\n\n' +
          'The defaults (maxSurge=25%, maxUnavailable=25%) give a balanced rollout. ' +
          'For critical services, you might use maxSurge=1, maxUnavailable=0 — never reduce capacity, ' +
          'always have spare pods proving themselves before old ones are removed.',
        keyTakeaway:
          'maxSurge and maxUnavailable are the speed-vs-safety knobs. Increase them for faster rollouts, decrease them for safer ones. The right values depend on how much risk you can tolerate during deploys.',
      },
      {
        title: 'Deployment Strategies: RollingUpdate vs Recreate',
        content:
          'RollingUpdate (default): gradual replacement. Zero downtime but briefly runs both ' +
          'versions of your application simultaneously. This is the right choice for most workloads.\n\n' +
          'But what if you can\'t run two versions at once? Imagine a database migration where ' +
          'the new code expects a column that doesn\'t exist yet. Running old and new code side-by-side ' +
          'would cause errors.\n\n' +
          'Recreate strategy: kills all old pods first, then creates new ones. This causes downtime but ' +
          'guarantees only one version runs at a time. Use it when version mixing is worse than a brief outage.',
        keyTakeaway:
          'Use RollingUpdate (default) for zero-downtime deploys. Use Recreate only when you cannot run two versions simultaneously (e.g., database migrations with schema changes).',
      },
    ],
  },
  quiz: [
    {
      question: 'What happens when you change a Deployment\'s image?',
      choices: [
        'Existing pods are updated in-place',
        'A new ReplicaSet is created for the new template',
        'The old ReplicaSet\'s template is updated',
        'All pods restart simultaneously',
      ],
      correctIndex: 1,
      explanation:
        'Pods are immutable. The Deployment creates a new RS with the new template hash and orchestrates a rolling transition from old RS to new RS.',
    },
    {
      question: 'During a rolling update, how many ReplicaSets exist?',
      choices: [
        'Only 1 — the old one is deleted immediately',
        'At least 2 — old and new coexist during the transition',
        '3 — old, transitional, and new',
        'It depends on the number of pods',
      ],
      correctIndex: 1,
      explanation:
        'Both the old and new ReplicaSets exist during a rolling update. The old RS scales down as the new RS scales up.',
    },
    {
      question: 'What does maxSurge=1 mean during a rolling update?',
      choices: [
        'At most 1 pod can be unavailable',
        'At most 1 extra pod above desired count can exist',
        'Only 1 pod is updated at a time',
        'The update takes 1 tick',
      ],
      correctIndex: 1,
      explanation:
        'maxSurge=1 means total pods can temporarily be desired+1. If replicas=3 and maxSurge=1, you can have up to 4 pods during the update.',
    },
    {
      question: 'When would you use the Recreate strategy instead of RollingUpdate?',
      choices: [
        'When you want faster updates',
        'When your app can\'t handle two versions running at the same time',
        'When you have more than 10 replicas',
        'Recreate is always preferred',
      ],
      correctIndex: 1,
      explanation:
        'Recreate kills all old pods before creating new ones. This causes downtime but ensures only one version runs at a time — important for database migrations or apps with incompatible versions.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    const pods = Array.from({ length: 3 }, () => ({
      kind: 'Pod' as const,
      metadata: {
        name: generatePodName(`my-app-${hash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'my-app', 'pod-template-hash': hash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `my-app-${hash.slice(0, 10)}`,
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
            name: 'my-app',
            uid: depUid,
            labels: { app: 'my-app' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'my-app' },
            template: {
              labels: { app: 'my-app' },
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
            name: `my-app-${hash.slice(0, 10)}`,
            uid: rsUid,
            labels: { app: 'my-app', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'Deployment',
              name: 'my-app',
              uid: depUid,
            },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'my-app', 'pod-template-hash': hash },
            template: {
              labels: { app: 'my-app', 'pod-template-hash': hash },
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
  goalCheck: (state) => {
    const dep = state.deployments.find((d) => d.metadata.name === 'my-app');
    if (!dep) return false;
    if (dep.spec.template.spec.image !== 'nginx:2.0') return false;

    const activePods = state.pods.filter(
      (p) =>
        !p.metadata.deletionTimestamp &&
        p.status.phase === 'Running' &&
        state.replicaSets.some(
          (rs) =>
            rs.metadata.ownerReference?.uid === dep.metadata.uid &&
            rs.metadata.uid === p.metadata.ownerReference?.uid
        )
    );

    const allNewVersion = activePods.every((p) => p.spec.image === 'nginx:2.0');
    return activePods.length === 3 && allNewVersion;
  },
};
