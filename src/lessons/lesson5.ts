import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson5: Lesson = {
  id: 5,
  title: 'Services and Networking',
  description:
    'Services provide a stable address for ephemeral pods, routing traffic only to healthy endpoints.',
  goalDescription:
    'Create a Service, observe its endpoints, then scale to 5 and verify endpoints update.',
  successMessage:
    'Services dynamically track endpoints. When you scale up, new Running pods automatically become endpoints. ' +
    'Pending pods are excluded — only Running pods matching the selector serve traffic.',
  hints: [
    'Create a service: kubectl create service web-svc --selector=app=web-app --port=80',
    'Use: kubectl get endpoints to see the endpoint list.',
    'Scale: kubectl scale deployment web-app --replicas=5',
    'After Reconcile, check endpoints again — they should increase to 5.',
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Pods Are Ephemeral',
        content:
          'You already know that Kubernetes restarts failed pods and creates replacements during scaling. ' +
          'But here is a detail that matters for networking: every time a pod is created, it gets a new IP address. ' +
          'When a pod crashes and is replaced, the replacement has a different IP than the original.\n\n' +
          'Imagine you have 3 pods serving your API. A client is configured to talk to pod A at 10.0.0.5. ' +
          'Pod A crashes, and the ReplicaSet controller creates a replacement — but the new pod gets IP 10.0.0.9. ' +
          'The client is still trying to reach 10.0.0.5, which no longer exists.\n\n' +
          'This problem gets worse with scaling. When you scale from 3 to 5 replicas, the 2 new pods get brand-new IPs. ' +
          'Any client that hardcodes pod IPs would need to be reconfigured every time a pod is added, removed, or restarted. ' +
          'You need a stable abstraction that sits in front of these ephemeral pods and routes traffic to whichever pods are currently alive.',
        keyTakeaway:
          'Pod IPs are temporary. Every restart, every scale event, every rolling update changes them. You cannot rely on pod IPs for communication.',
      },
      {
        title: 'Services: Stable Endpoints',
        content:
          'A Service is the Kubernetes answer to this problem. It provides a stable name and virtual IP address ' +
          'that never changes, regardless of what happens to the pods behind it. Clients connect to the Service, and ' +
          'Kubernetes routes their traffic to one of the healthy pods.\n\n' +
          'How does a Service know which pods to route to? It uses a label selector — the same label-matching mechanism ' +
          'that ReplicaSets use to find their pods. You define a Service with a selector like app=api, and it automatically ' +
          'discovers all pods with that label.\n\n' +
          'The Service maintains an endpoint list: the set of pod IPs that are currently eligible to receive traffic. ' +
          'Only pods that are Running and match the selector are included. Pods that are Pending, Failed, or Terminating ' +
          'are excluded — they are not ready to serve requests.\n\n' +
          'This means clients only need to know the Service name. They never need to know individual pod IPs, ' +
          'and they never need to be reconfigured when pods come and go.',
        diagram:
          '  Service (api-svc)          Label Selector: app=api\n' +
          '  ─────────────────\n' +
          '       │\n' +
          '       ├──→ Pod A (app=api) ✓ Running  → endpoint\n' +
          '       ├──→ Pod B (app=api) ✓ Running  → endpoint\n' +
          '       └──→ Pod C (app=api) ✗ Pending  → NOT endpoint',
        keyTakeaway:
          'A Service gives pods a stable identity. Clients talk to the Service name, which never changes. Only Running pods matching the selector become endpoints — unhealthy pods are automatically excluded.',
      },
      {
        title: 'How Endpoints Work',
        content:
          'Behind every Service is an endpoints controller that continuously reconciles the endpoint list. ' +
          'On every reconciliation cycle, it performs a simple process: find all pods in the cluster whose labels match ' +
          'the Service selector, filter to only those in Running phase, and update the endpoint list with their IPs.\n\n' +
          'Pods in Pending phase are excluded because they are not yet ready to handle requests — their containers ' +
          'may still be starting up. Pods in Failed or Terminating phase are also excluded because they can no longer serve traffic.\n\n' +
          'This design means the endpoint list is always up to date without any manual intervention. ' +
          'When you scale a Deployment from 3 to 5, the 2 new pods start as Pending (not endpoints), ' +
          'then transition to Running (automatically become endpoints). When you scale down, terminated pods ' +
          'are automatically removed from the endpoint list.\n\n' +
          'During a rolling update, the same logic applies: old pods that are still Running remain endpoints, ' +
          'while new pods become endpoints as soon as they are Running. This ensures continuous traffic serving throughout the update.',
        keyTakeaway:
          'Endpoints update automatically through the same reconciliation loop that powers everything else in Kubernetes. You never manually register or deregister pods — the system handles it.',
      },
      {
        title: 'Service Types',
        content:
          'Kubernetes offers several Service types that control how the Service is exposed:\n\n' +
          'ClusterIP (default): The Service gets an internal cluster IP address. Only accessible from within the cluster. ' +
          'Use this for communication between microservices (e.g., your web frontend talking to your API backend).\n\n' +
          'NodePort: The Service is exposed on a static port on every node in the cluster. ' +
          'External traffic can reach the Service by connecting to any node IP on that port. The port range is 30000-32767.\n\n' +
          'LoadBalancer: Provisions an external load balancer from your cloud provider (AWS, GCP, Azure). ' +
          'This gives you a single external IP or DNS name that distributes traffic across your nodes.\n\n' +
          'Regardless of the type, the core mechanics are identical: the Service uses a label selector to find pods, ' +
          'maintains an endpoint list of Running matches, and routes traffic to those endpoints.',
        keyTakeaway:
          'Service types control WHERE the service is accessible (cluster-internal, node port, or cloud load balancer), but the HOW is always the same: selectors find pods, only Running pods become endpoints.',
      },
    ],
  },
  quiz: [
    {
      question: 'Why do Kubernetes applications need Services?',
      choices: [
        'Pods can\'t communicate without them',
        'Pod IPs change when pods restart, so you need a stable address',
        'Services make pods run faster',
        'Services are required to create pods',
      ],
      correctIndex: 1,
      explanation:
        'Pods are ephemeral — when they restart, they get new IPs. A Service provides a stable DNS name ' +
        'and IP, routing to whatever pods currently match its selector.',
    },
    {
      question:
        'A Service has selector app=web. There are 3 Running and 2 Pending pods with label app=web. How many endpoints?',
      choices: ['5', '3', '2', '0'],
      correctIndex: 1,
      explanation:
        'Only Running pods become endpoints. The 2 Pending pods are excluded because they are not yet serving traffic.',
    },
    {
      question:
        'You scale a Deployment from 3 to 5 replicas. What happens to the Service endpoints?',
      choices: [
        'Endpoints stay at 3 until manually updated',
        'Endpoints automatically increase to 5 once new pods are Running',
        'The Service must be recreated',
        'Endpoints decrease during scaling',
      ],
      correctIndex: 1,
      explanation:
        'The endpoints controller continuously reconciles. As new pods reach Running status, ' +
        'they automatically become endpoints.',
    },
    {
      question: 'What happens to Service endpoints during a rolling update?',
      choices: [
        'All endpoints are removed during the update',
        'Old pod endpoints are replaced by new pod endpoints as the rollout progresses',
        'Endpoints double during the update',
        'The Service stops working',
      ],
      correctIndex: 1,
      explanation:
        'During a rolling update, old Running pods are still endpoints until they terminate. ' +
        'New pods become endpoints when they reach Running. Traffic is served throughout.',
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
  goalCheck: (state) => {
    const dep = state.deployments.find((d) => d.metadata.name === 'web-app');
    if (!dep || dep.spec.replicas !== 5) return false;

    const svc = state.services.find((s) => s.spec.selector['app'] === 'web-app');
    if (!svc) return false;

    // Need 5 endpoints (all Running pods matching selector)
    return svc.status.endpoints.length === 5;
  },
};
