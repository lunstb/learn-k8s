import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonReplicaSets: Lesson = {
  id: 3,
  title: 'ReplicaSets and Scaling',
  description:
    'Learn how ReplicaSets maintain a desired pod count and how scaling works declaratively.',
  mode: 'full',
  goalDescription:
    'Scale the "my-app" Deployment to 5 replicas, then back down to 2 replicas.',
  successMessage:
    'Scaling is declarative — the controller creates or removes only the diff. ' +
    'From 2\u21925 it created 3. From 5\u21922 it removed 3.',
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
          'When a selector has multiple labels (e.g., app=web AND version=v2), ALL labels must match — ' +
          'this is AND logic. A pod with app=web but version=v1 does not match. Extra labels on the pod are ignored; ' +
          'only the selector keys matter.\n\n' +
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
      question:
        'A ReplicaSet has selector app=web and replicas=3, with 3 Running pods. You manually create a new pod with label app=web. What happens?',
      choices: [
        'The RS adopts the pod and updates its desired replica count to 4 to match the actual state',
        'The manually created pod is rejected by the scheduler because the label is already claimed by the RS',
        'The RS now sees 4 pods matching its selector but only wants 3, so it terminates one pod to reconcile',
        'The RS ignores the pod because it lacks the correct ownerReference pointing to the RS',
      ],
      correctIndex: 2,
      explanation:
        'ReplicaSets use label selectors, not ownership records, to count pods. Any pod matching the selector is counted regardless of who created it. ' +
        'With 4 matching pods and a desired count of 3, the RS sees an excess and deletes one. It might even delete your manually created pod — or one of the originals. ' +
        'This is why manually creating pods with labels matching a controller\'s selector is dangerous and unpredictable.',
    },
    {
      question:
        'You scale a Deployment from 5 to 2 replicas. Which pods does Kubernetes terminate?',
      choices: [
        'The 3 newest pods, preserving the oldest long-running pods that have proven stable',
        'The 3 oldest pods, preserving the newest ones that are most likely running updated code',
        'A random selection of 3 pods chosen by the scheduler\'s load-balancing algorithm',
        'All pods on the least-utilized node are terminated first to free up node resources',
      ],
      correctIndex: 0,
      explanation:
        'Kubernetes terminates the most recently created pods first when scaling down. The reasoning is that older pods have been running longer and are proven stable, ' +
        'while newer pods have had less time to demonstrate reliability. This also minimizes disruption — the newest pods have likely received the least traffic and built up the least in-memory state. ' +
        'Note: this is the default behavior; pod disruption budgets and other factors can influence the exact selection.',
    },
    {
      question:
        'You have a bare ReplicaSet (no Deployment) running 3 pods with image nginx:1.0. You update the RS template to nginx:2.0. What happens to the existing pods?',
      choices: [
        'All 3 pods are immediately updated to nginx:2.0 via an in-place container image swap',
        'The RS performs a rolling update, replacing pods one at a time with the new image',
        'The RS deletes all 3 pods simultaneously and recreates them with the nginx:2.0 template',
        'Nothing — existing pods keep running nginx:1.0; only newly created pods will use nginx:2.0',
      ],
      correctIndex: 3,
      explanation:
        'This is exactly why Deployments exist. A ReplicaSet only cares about pod count, not pod content. Changing the template affects future pods, ' +
        'but existing pods are immutable and remain unchanged. To actually roll out a new image, you need a Deployment, which creates a new ReplicaSet ' +
        'with the updated template and orchestrates a gradual transition. With a bare RS, you\'d have to manually delete old pods to trigger replacements with the new template.',
    },
    {
      question:
        'A ReplicaSet has selector app=api, version=v2. A pod has labels app=api, version=v1. Does the RS manage this pod?',
      choices: [
        'Yes — the app=api label matches, and partial label overlap is enough for the selector to claim the pod',
        'No — the selector requires ALL specified labels to match, and version=v1 does not equal version=v2',
        'No — but only because the pod was created before the ReplicaSet existed in the namespace',
        'Yes — Kubernetes uses OR logic for multi-label selectors, so matching either label is sufficient',
      ],
      correctIndex: 1,
      explanation:
        'Label selectors require ALL key-value pairs to match. The selector {app=api, version=v2} matches only pods that have both app=api AND version=v2. ' +
        'A pod with version=v1 does not satisfy the selector, even though app=api matches. This AND logic is how Deployments use the pod-template-hash label ' +
        'to ensure each ReplicaSet only counts pods from its own template, even when multiple ReplicaSets share the same app label.',
    },
  ],
  practices: [
    {
      title: 'Scale Up and Down',
      goalDescription:
        'Scale the "my-app" Deployment to 5 replicas, then back down to 2 replicas.',
      successMessage:
        'Scaling is declarative — the controller creates or removes only the diff. From 2\u21925 it created 3. From 5\u21922 it removed 3.',
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
      goals: [
        {
          description: 'Use "kubectl scale" to change replica count',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('scale'),
        },
        {
          description: 'Scale "my-app" up to 5 replicas',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'my-app');
            return !!dep && dep.spec.replicas >= 5;
          },
        },
        {
          description: 'Scale "my-app" back down to 2 replicas',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'my-app');
            if (!dep || dep.spec.replicas !== 2) return false;
            const rs = s.replicaSets.find(r => r.metadata.ownerReference?.uid === dep.metadata.uid && !r.metadata.deletionTimestamp);
            if (!rs) return false;
            return s.pods.filter(p => p.metadata.ownerReference?.uid === rs.metadata.uid && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length === 2;
          },
        },
      ],
      hints: [
        { text: 'Use kubectl scale to change the replica count of a deployment.' },
        { text: 'kubectl scale deployment my-app --replicas=5', exact: true },
        { text: 'After seeing 5 pods Running, scale back down.' },
        { text: 'kubectl scale deployment my-app --replicas=2', exact: true },
      ],
    },
    {
      title: 'Label Selector Adoption',
      goalDescription:
        'Create a standalone pod and label it to match the Deployment\'s selector. Watch the ReplicaSet adopt it and then reconcile the excess. Final state: 2 Running pods.',
      successMessage:
        'The RS adopted the labeled pod — and then terminated an excess pod to maintain the desired count of 2. Label selectors are loose coupling: any pod with matching labels counts.',
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        const pods = Array.from({ length: 2 }, () => ({
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
                replicas: 2,
                selector: { app: 'web-app' },
                template: {
                  labels: { app: 'web-app' },
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
                replicas: 2,
                selector: { app: 'web-app', 'pod-template-hash': hash },
                template: {
                  labels: { app: 'web-app', 'pod-template-hash': hash },
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
      goals: [
        {
          description: 'Use "kubectl get pods" to see the current pods',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-pods'),
        },
        {
          description: 'Create an extra pod with "kubectl create pod"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('create-pod'),
        },
        {
          description: 'Create a standalone pod named "extra"',
          check: (s: ClusterState) => s.pods.some(p => p.metadata.name === 'extra') || s.events.some(e => e.objectKind === 'Pod' && e.objectName === 'extra'),
        },
        {
          description: 'Label the pod with "kubectl label pod extra app=web-app"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('label'),
        },
        {
          description: 'Reconcile — RS sees excess and trims back to 2 Running pods',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'web-app');
            if (!dep) return false;
            const running = s.pods.filter(p => p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
            return running.length === 2 && s.tick > 0;
          },
        },
      ],
      hints: [
        { text: 'Start by running "kubectl get pods" to see the 2 existing pods.' },
        { text: 'Create a standalone pod: kubectl create pod extra --image=nginx:1.0', exact: true },
        { text: 'Label it to match the RS selector: kubectl label pod extra app=web-app', exact: true },
        { text: 'Reconcile to see the RS adopt the pod and trim excess.' },
      ],
      steps: [{
        id: 'intro-labels',
        trigger: 'onLoad' as const,
        instruction: 'The Deployment "web-app" has 2 replicas. Create a standalone pod "extra", then label it with app=web-app. Reconcile and watch what happens when the RS sees 3 pods but only wants 2.',
      }],
    },
  ],
};
