import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson3: Lesson = {
  id: 3,
  title: 'ReplicaSets and Scaling',
  description:
    'Learn how ReplicaSets maintain a desired pod count and how scaling works declaratively.',
  goalDescription:
    'Scale the Deployment to 5 replicas, then back to 2.',
  successMessage:
    'Scaling is declarative — the controller creates or removes only the diff. ' +
    'From 2\u21925 it created 3. From 5\u21922 it removed 3.',
  hints: [
    'Use: kubectl scale deployment my-app --replicas=5',
    'Then Reconcile to see 3 new pods created.',
    'Then: kubectl scale deployment my-app --replicas=2',
    'Reconcile to see 3 pods terminated.',
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: What If a Pod Crashes and Nobody Replaces It?',
        content:
          'You learned that standalone pods vanish when deleted. But even managed pods need something ' +
          'watching them. Imagine you want 3 copies of your API server running at all times. One crashes. ' +
          'Who notices? Who creates the replacement?\n\n' +
          'You could write a script that checks every 30 seconds and creates pods when the count drops. ' +
          'But that script itself can fail. And you\'d need a different script for each application. ' +
          'And what about scaling? What about rolling updates?\n\n' +
          'This is the problem a ReplicaSet solves. A ReplicaSet is a controller that maintains a desired ' +
          'number of identical pods. It runs as part of Kubernetes itself — always on, always watching. ' +
          'If a pod crashes, the ReplicaSet notices within seconds and creates a replacement. If you ' +
          'change the desired count, it computes the diff and creates or deletes only what\'s needed.',
        keyTakeaway:
          'A ReplicaSet exists because pods need a babysitter. It\'s a persistent loop that counts pods and corrects any deviation from the desired number.',
      },
      {
        title: 'Label Selectors: How Controllers Find Their Pods',
        content:
          'Here\'s a design question: how should a ReplicaSet know which pods belong to it? ' +
          'It could track pod names, but names change when pods are recreated. It could track IPs, ' +
          'but IPs change too. It needs something stable that survives pod replacement.\n\n' +
          'The answer is labels — key-value pairs attached to every resource. A ReplicaSet with ' +
          'selector `app=web` watches all pods carrying that label. This is deliberate loose coupling: ' +
          'the RS doesn\'t care about pod names, creation order, or IPs. It only checks labels.\n\n' +
          'This design has a surprising consequence: if you manually create a pod with matching labels, ' +
          'the RS counts it as one of its own. If that makes the count exceed the desired number, ' +
          'the RS deletes the extra. The selector is the contract between a controller and its pods.',
        keyTakeaway:
          'Labels are the glue connecting controllers to pods. A selector like app=web is a contract: any pod with that label is "mine." This loose coupling is what makes Kubernetes flexible.',
      },
      {
        title: 'How Scaling Works',
        content:
          'When you change replicas from 2 to 5, the RS doesn\'t delete everything and start over. ' +
          'It computes the diff: 5 desired - 2 existing = 3 new pods needed. When you scale back ' +
          'from 5 to 2, it terminates 3 pods (newest first). This is efficient and non-disruptive — ' +
          'existing pods are never restarted unnecessarily.\n\n' +
          'This diff-based approach is fundamental to Kubernetes. The system always does the minimum ' +
          'work to reconcile actual state with desired state. It never tears things down unnecessarily.',
        diagram:
          '  Scale Up: 2 \u2192 5\n' +
          '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n' +
          '  \u2502 Current: \u25cf \u25cf                \u2502\n' +
          '  \u2502 Desired: \u25cf \u25cf \u25cf \u25cf \u25cf         \u2502\n' +
          '  \u2502 Action:  create 3 new pods  \u2502\n' +
          '  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n' +
          '\n' +
          '  Scale Down: 5 \u2192 2\n' +
          '  \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n' +
          '  \u2502 Current: \u25cf \u25cf \u25cf \u25cf \u25cf         \u2502\n' +
          '  \u2502 Desired: \u25cf \u25cf                \u2502\n' +
          '  \u2502 Action:  terminate 3 pods   \u2502\n' +
          '  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
        keyTakeaway:
          'Scaling is diff-based. Kubernetes only creates or removes the difference, never destroys and rebuilds everything. This keeps your existing pods stable.',
      },
      {
        title: 'Why Not Create ReplicaSets Directly?',
        content:
          'If ReplicaSets handle pod count, why not use them directly? Because pod count is only half the problem. ' +
          'What happens when you need to update your application — change the container image, add an environment variable, ' +
          'update resource limits?\n\n' +
          'A ReplicaSet\'s template is tied to a specific pod configuration. If you change the template, existing pods ' +
          'are NOT updated — pods are immutable. You\'d have to delete the old RS and create a new one, ' +
          'which kills all pods simultaneously. That\'s downtime.\n\n' +
          'Deployments solve this. When you change a Deployment\'s template, it creates a NEW ReplicaSet ' +
          'and orchestrates a rolling transition — scaling up the new RS while scaling down the old one. ' +
          'No downtime, with automatic rollback if something goes wrong.\n\n' +
          'Think of it this way: ReplicaSets handle pod count. Deployments handle change.',
        keyTakeaway:
          'ReplicaSets handle "keep N pods running." Deployments handle "update pods safely." Use Deployments — they manage ReplicaSets for you and add rolling updates and rollback.',
      },
    ],
  },
  quiz: [
    {
      question: 'How does a ReplicaSet know which pods it manages?',
      choices: [
        'By pod name prefix',
        'By label selectors matching pod labels',
        'By tracking pod creation order',
        'By IP address',
      ],
      correctIndex: 1,
      explanation:
        'ReplicaSets use label selectors to match pods. Any pod with matching labels is counted, regardless of how it was created.',
    },
    {
      question: 'You have 2 pods running and scale to 5. How many new pods does the RS create?',
      choices: [
        '5 (replaces all)',
        '3 (the difference)',
        '7 (adds 5 to existing 2)',
        '1 (scales incrementally)',
      ],
      correctIndex: 1,
      explanation:
        'The controller computes the diff: 5 desired - 2 existing = 3 new pods. It never destroys and recreates everything.',
    },
    {
      question: 'When scaling down, which pods are terminated first?',
      choices: [
        'The oldest pods',
        'The newest pods',
        'Random selection',
        'Pods on the busiest node',
      ],
      correctIndex: 1,
      explanation:
        'Kubernetes terminates the most recently created pods first when scaling down. This preserves long-running, established pods.',
    },
    {
      question: 'Why are Deployments preferred over bare ReplicaSets?',
      choices: [
        'Deployments are faster',
        'Deployments add rolling update and rollback capabilities',
        'ReplicaSets can\'t scale',
        'Deployments use fewer resources',
      ],
      correctIndex: 1,
      explanation:
        'Deployments manage ReplicaSets and add rolling updates, revision history, and rollback capability. A bare RS can only maintain pod count.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    const pods = Array.from({ length: 2 }, () => ({
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
            replicas: 2,
            selector: { app: 'my-app' },
            template: {
              labels: { app: 'my-app' },
              spec: { image },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 2,
            updatedReplicas: 2,
            readyReplicas: 2,
            availableReplicas: 2,
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
            replicas: 2,
            selector: { app: 'my-app', 'pod-template-hash': hash },
            template: {
              labels: { app: 'my-app', 'pod-template-hash': hash },
              spec: { image },
            },
          },
          status: { replicas: 2, readyReplicas: 2 },
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
    if (dep.spec.replicas !== 2) return false;
    const rs = state.replicaSets.find(
      (r) => r.metadata.ownerReference?.uid === dep.metadata.uid && !r.metadata.deletionTimestamp
    );
    if (!rs) return false;
    const pods = state.pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === rs.metadata.uid &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );
    // Must have scaled up to 5 at some point (tick > 0) and back down to 2
    return pods.length === 2 && state.tick > 0;
  },
};
