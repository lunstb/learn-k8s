import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lessonLabelsAnnotations: Lesson = {
  id: 27,
  title: 'Labels, Selectors & Annotations',
  description:
    'Labels are the glue that connects Services to Pods, Deployments to ReplicaSets, and more. Learn to manipulate labels to control which pods receive traffic.',
  mode: 'full',
  goalDescription:
    'Manipulate pod labels so that the "web-svc" Service routes traffic to all 3 pods. Start by adding the missing label, then fix the extra pod.',
  successMessage:
    'All 3 pods now have matching labels and the Service is routing traffic to all of them. Labels are the fundamental grouping mechanism in Kubernetes.',
  yamlTemplate: `# Labels are key-value pairs on objects.
# Services use label selectors to find pods.
#
# Use kubectl to manipulate labels:
#   kubectl label pod <name> key=value    (add/update)
#   kubectl label pod <name> key-         (remove)
#
# Check which pods a service selects:
#   kubectl get pods --show-labels
#   kubectl describe service web-svc`,
  hints: [
    { text: 'Run `kubectl get pods --show-labels` to see which pods have which labels.' },
    { text: 'The Service selects pods with `app=web` and `tier=frontend`. Check which pods are missing a label.' },
    { text: 'Use kubectl label to add the tier=frontend label to web-1.' },
    { text: 'Pod web-3 has `tier=backend` — change it to `tier=frontend`.' },
    { text: 'Use kubectl label with --overwrite to change web-3\'s tier from backend to frontend.' },
  ],
  goals: [
    {
      description: 'Pod "web-1" has both labels: app=web and tier=frontend',
      check: (s: ClusterState) => {
        const pod = s.pods.find((p) => p.metadata.name === 'web-1');
        return !!pod && pod.metadata.labels['app'] === 'web' && pod.metadata.labels['tier'] === 'frontend';
      },
    },
    {
      description: 'Pod "web-3" has tier=frontend (not tier=backend)',
      check: (s: ClusterState) => {
        const pod = s.pods.find((p) => p.metadata.name === 'web-3');
        return !!pod && pod.metadata.labels['tier'] === 'frontend';
      },
    },
    {
      description: 'Service "web-svc" has 3 endpoints',
      check: (s: ClusterState) => {
        const svc = s.services.find((svc) => svc.metadata.name === 'web-svc');
        return !!svc && svc.status.endpoints.length >= 3;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'Labels: The Grouping Mechanism',
        content:
          'Labels are key-value pairs attached to Kubernetes objects. They have no semantic meaning to the system itself — ' +
          'their power comes from selectors that query them.\n\n' +
          'Common label conventions:\n' +
          '  app: web\n' +
          '  tier: frontend\n' +
          '  environment: production\n' +
          '  version: v2.1.0\n' +
          '  team: payments\n\n' +
          'Labels can be added at creation time (in metadata.labels) or dynamically with `kubectl label`. ' +
          'Unlike most Kubernetes fields, labels on running pods can be changed without recreating the pod.\n\n' +
          'You can filter kubectl output by label using `-l` (or `--selector`): ' +
          '`kubectl get pods -l app=web` shows only pods with that label. Combine with `-A` (or `--all-namespaces`) ' +
          'to search across all namespaces: `kubectl get pods -l environment=production -A`.\n\n' +
          'This mutability is what makes labels powerful for operations: you can add a pod to a Service, ' +
          'remove it from a Service, or change its grouping on the fly.',
        keyTakeaway:
          'Labels are mutable key-value pairs that group objects. They can be changed on running pods. Services, Deployments, and other controllers use label selectors to find their targets.',
      },
      {
        title: 'Selectors: Equality and Set-Based',
        content:
          'Selectors query labels to find matching objects. There are two types:\n\n' +
          'Equality-based selectors: Match exact key-value pairs.\n' +
          '  selector:\n' +
          '    matchLabels:\n' +
          '      app: web\n' +
          '      tier: frontend\n\n' +
          'This matches pods that have BOTH app=web AND tier=frontend. A pod with only app=web does not match.\n\n' +
          'Set-based selectors: More expressive queries using operators.\n' +
          '  selector:\n' +
          '    matchExpressions:\n' +
          '    - key: environment\n' +
          '      operator: In\n' +
          '      values: [production, staging]\n' +
          '    - key: tier\n' +
          '      operator: NotIn\n' +
          '      values: [test]\n\n' +
          'Operators: In, NotIn, Exists, DoesNotExist.\n\n' +
          'Services use equality-based selectors (spec.selector). Deployments use matchLabels ' +
          '(also equality-based under the hood). Set-based expressions are used in node affinity ' +
          'and some advanced scheduling rules.',
        diagram:
          'Service selector: {app: web, tier: frontend}\n' +
          '\n' +
          '  pod-1: {app: web}                    → NO MATCH  (missing tier)\n' +
          '  pod-2: {app: web, tier: frontend}    → MATCH ✓\n' +
          '  pod-3: {app: web, tier: backend}     → NO MATCH  (wrong tier)\n' +
          '  pod-4: {app: api, tier: frontend}    → NO MATCH  (wrong app)',
        keyTakeaway:
          'Equality selectors match exact key=value pairs (AND logic). Set-based selectors use In/NotIn/Exists/DoesNotExist for more expressive queries. Most controllers use equality selectors.',
      },
      {
        title: 'How Controllers Use Selectors',
        content:
          'The entire Kubernetes model is built on loose coupling through labels and selectors:\n\n' +
          'Deployment → ReplicaSet → Pods: The Deployment creates a ReplicaSet with a selector. ' +
          'The ReplicaSet creates Pods with matching labels. If you manually remove a label from a Pod, ' +
          'the ReplicaSet sees one fewer matching pod and creates a replacement.\n\n' +
          'Service → Pods: The Service has a selector that matches pod labels. Any Running pod with matching ' +
          'labels is added to the Service endpoints. Change a label, and the pod is instantly added or removed ' +
          'from the Service — no deployment needed.\n\n' +
          'This is why labels are the #1 debugging target when traffic is not reaching pods: ' +
          'a label mismatch between Service selector and Pod labels means zero endpoints.\n\n' +
          'Practical pattern — blue/green deploys with labels:\n' +
          '  1. Deploy "v2" pods with label version=v2\n' +
          '  2. Service selector: version=v1 (traffic to v1)\n' +
          '  3. Patch Service selector to version=v2 (instant switch)\n' +
          '  4. Old v1 pods still running for rollback if needed',
        keyTakeaway:
          'Controllers use selectors to find their pods — this is loose coupling by design. Changing labels on a running pod can add/remove it from Services or cause ReplicaSet to create replacements.',
      },
      {
        title: 'Annotations: Operational Metadata',
        content:
          'Annotations are also key-value metadata on objects, but unlike labels, they are NOT used for selection. ' +
          'Annotations store supplementary information for tools, operators, and humans.\n\n' +
          'Common annotations:\n' +
          '  kubernetes.io/change-cause: "Deployed v2.1.0 via CI pipeline #1234"\n' +
          '  prometheus.io/scrape: "true"\n' +
          '  prometheus.io/port: "9090"\n' +
          '  nginx.ingress.kubernetes.io/rewrite-target: /\n' +
          '  kubectl.kubernetes.io/last-applied-configuration: {...}\n\n' +
          'Key differences from labels:\n' +
          '- Labels are for grouping and selecting. Annotations are for metadata.\n' +
          '- Labels have strict character limits (63 chars for value). Annotations can hold large data (up to 256KB).\n' +
          '- Labels should be small and queryable. Annotations can store JSON blobs, documentation, or tool config.\n\n' +
          'Many Kubernetes tools read annotations for configuration — Prometheus scrape targets, ' +
          'Ingress controller settings, external-dns records, and Karpenter node configuration are all driven by annotations.',
        keyTakeaway:
          'Annotations store operational metadata — not for selection. They configure tools (Prometheus, Ingress, external-dns), record audit trails, and hold large data that labels cannot.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A Service has selector `app=api, version=v2`. A pod has labels `app=api, version=v1, tier=backend`. Does the pod match the Service selector?',
      choices: [
        'No -- the selector requires BOTH app=api AND version=v2, but the pod has version=v1',
        'Yes -- the pod has the "app=api" label which partially matches one of the selector keys',
        'Yes -- the pod has more labels than the selector requires, so it qualifies as a superset',
        'It depends on whether the Service uses matchLabels or matchExpressions in its spec',
      ],
      correctIndex: 0,
      explanation:
        'Equality-based selectors require ALL specified key-value pairs to match. The pod has app=api (matches) ' +
        'but version=v1 (does not match version=v2). Extra labels on the pod (tier=backend) are ignored — only the ' +
        'selector keys matter. This is AND logic: every selector key must match.',
    },
    {
      question:
        'You remove the "app=web" label from a pod that belongs to a Deployment. What happens?',
      choices: [
        'The pod is immediately terminated because it is no longer associated with the Deployment',
        'The Deployment controller detects the mismatch and automatically re-applies the label to the pod',
        'Nothing happens -- labels are cosmetic metadata and do not affect the Deployment\'s control over pods',
        'The ReplicaSet creates a replacement pod, while the unlabeled pod keeps running as an unmanaged orphan',
      ],
      correctIndex: 3,
      explanation:
        'The ReplicaSet uses a label selector to count its pods. Removing a label makes the pod invisible to the ReplicaSet, ' +
        'which then sees fewer pods than desired and creates a replacement. The original pod keeps running as an "orphan" — ' +
        'it is no longer managed by any controller. This technique is actually useful for debugging: isolate a misbehaving pod ' +
        'for investigation while the ReplicaSet replaces it.',
    },
    {
      question:
        'When should you use an annotation instead of a label?',
      choices: [
        'When you need to query or filter objects by that value using kubectl selectors',
        'When the value needs to be immutable -- annotations are locked after object creation',
        'When the value is large (JSON config, tool metadata) or is not used for grouping and selection',
        'When you want the value to appear in default `kubectl get` output columns automatically',
      ],
      correctIndex: 2,
      explanation:
        'Annotations are for metadata that is not used for selection. They can hold large values (up to 256KB), ' +
        'tool-specific configuration (Prometheus scrape settings, Ingress rules), and audit trails. ' +
        'Labels are for grouping and selection and have strict size limits. If you need to select objects by a value, use a label. ' +
        'If you need to attach metadata for tools or humans, use an annotation.',
    },
    {
      question:
        'You have 10 pods with label `env=production`. You want to find all production pods across all namespaces. Which command works?',
      choices: [
        '`kubectl get pods --annotation env=production`',
        '`kubectl get pods --all-namespaces -l env=production`',
        '`kubectl get pods --selector env:production --all`',
        '`kubectl describe pods | grep env=production`',
      ],
      correctIndex: 1,
      explanation:
        'The `-l` (or `--selector`) flag filters by label selectors. Combined with `--all-namespaces` (or `-A`), ' +
        'it searches across all namespaces. This is the standard way to query objects by labels. ' +
        'Annotations cannot be queried with kubectl selectors — they are not indexed for selection.',
    },
    {
      question:
        'A node affinity rule uses: `matchExpressions: [{key: "environment", operator: "In", values: ["production", "staging"]}]`. Which nodes match?',
      choices: [
        'Only nodes with label environment=production -- the In operator matches only the first listed value',
        'Nodes that have both environment=production AND environment=staging labels set simultaneously',
        'Nodes with environment=production OR environment=staging -- In matches any value in the list',
        'All nodes in the cluster -- the In operator with multiple values is equivalent to "match any node"',
      ],
      correctIndex: 2,
      explanation:
        'The "In" operator matches any object whose label value for the specified key is in the provided list. ' +
        'It\'s an OR within a single expression — the node needs environment=production OR environment=staging. ' +
        'Multiple matchExpressions are ANDed together, but values within a single In expression are ORed. ' +
        'Other set-based operators: NotIn (exclude listed values), Exists (key must exist, any value), DoesNotExist (key must not exist).',
    },
    {
      question:
        'You want to temporarily isolate a misbehaving pod from receiving traffic for debugging, without deleting it. How can labels help?',
      choices: [
        'Add a "debug=true" annotation -- Services automatically exclude pods with debug annotations',
        'Labels cannot be changed on running pods -- you must delete the pod and recreate it for debugging',
        'Set the pod\'s readiness probe to fail by editing the Deployment spec to force endpoint removal',
        'Remove or change the label the Service selects -- the pod leaves endpoints but keeps running for inspection',
      ],
      correctIndex: 3,
      explanation:
        'Since labels are mutable on running pods, you can remove or change a label to decouple the pod from its Service. ' +
        'For example, if the Service selects "app=web", running `kubectl label pod mypod app-` removes the app label. The pod is instantly ' +
        'removed from Service endpoints (no traffic) but keeps running for investigation. Meanwhile, the ReplicaSet detects one fewer matching pod ' +
        'and creates a healthy replacement. This is a powerful operational technique for debugging production issues without losing the misbehaving pod.',
    },
  ],
  initialState: () => {
    // 3 pods with varied labels — Service selects app=web, tier=frontend
    // web-1: has app=web but MISSING tier label
    // web-2: has app=web, tier=frontend (correct)
    // web-3: has app=web, tier=backend (wrong tier value)
    const pods = [
      {
        kind: 'Pod' as const,
        metadata: {
          name: 'web-1',
          uid: generateUID(),
          labels: { app: 'web' } as Record<string, string>,
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image: 'nginx:1.21', nodeName: 'node-1' },
        status: { phase: 'Running' as const, ready: true, tickCreated: -5 },
      },
      {
        kind: 'Pod' as const,
        metadata: {
          name: 'web-2',
          uid: generateUID(),
          labels: { app: 'web', tier: 'frontend' } as Record<string, string>,
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image: 'nginx:1.21', nodeName: 'node-1' },
        status: { phase: 'Running' as const, ready: true, tickCreated: -5 },
      },
      {
        kind: 'Pod' as const,
        metadata: {
          name: 'web-3',
          uid: generateUID(),
          labels: { app: 'web', tier: 'backend' } as Record<string, string>,
          creationTimestamp: Date.now() - 60000,
        },
        spec: { image: 'nginx:1.21', nodeName: 'node-2' },
        status: { phase: 'Running' as const, ready: true, tickCreated: -5 },
      },
    ];

    return {
      pods,
      replicaSets: [],
      deployments: [],
      nodes: [
        {
          kind: 'Node' as const,
          metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 2 },
        },
        {
          kind: 'Node' as const,
          metadata: { name: 'node-2', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-2' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
        },
      ],
      services: [
        {
          kind: 'Service' as const,
          metadata: { name: 'web-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 },
          spec: { selector: { app: 'web', tier: 'frontend' }, port: 80 },
          status: { endpoints: [] as string[] },
        },
      ],
      events: [],
    };
  },
  goalCheck: (state: ClusterState) => {
    const svc = state.services.find((s) => s.metadata.name === 'web-svc');
    if (!svc || svc.status.endpoints.length < 3) return false;
    // All 3 pods must have app=web and tier=frontend
    const matching = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'web' &&
        p.metadata.labels['tier'] === 'frontend' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );
    return matching.length >= 3;
  },
};
