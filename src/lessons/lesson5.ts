import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson5: Lesson = {
  id: 5,
  title: 'Services and Networking',
  description:
    'Services provide a stable address for ephemeral pods, routing traffic only to healthy endpoints.',
  mode: 'full',
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
      question:
        'Your pods have label app=api but the Service selector is app=API (capital letters). How many endpoints does the Service have?',
      choices: [
        'All the Running pods — Kubernetes label matching is case-insensitive',
        'Zero — Kubernetes labels are case-sensitive, so app=API does not match app=api',
        'It depends on the Service type (ClusterIP vs NodePort)',
        'The Service creation fails because "API" is not a valid label value',
      ],
      correctIndex: 1,
      explanation:
        'Kubernetes labels are strictly case-sensitive. "api" and "API" are different values. The Service selector app=API will not match pods with app=api, ' +
        'resulting in zero endpoints. This is a common and frustrating debugging scenario — the Service exists and looks correct, but no traffic reaches your pods. ' +
        'Always check exact label values with "kubectl get pods --show-labels" when a Service has no endpoints.',
    },
    {
      question:
        'You have 5 pods with label app=web. Three are Running, one is Pending, and one is Terminating. A Service selects app=web. During this moment, how many endpoints does the Service have?',
      choices: [
        '5 — all pods matching the selector are endpoints',
        '3 — only Running pods become endpoints; Pending and Terminating pods are excluded',
        '4 — only the Terminating pod is excluded',
        '1 — Kubernetes picks only the healthiest pod',
      ],
      correctIndex: 1,
      explanation:
        'The endpoints controller filters on two criteria: the pod must match the Service selector AND the pod must be in the Running phase. ' +
        'Pending pods are not ready to accept traffic (containers may still be starting). Terminating pods are shutting down and will soon be gone. ' +
        'Only the 3 Running pods are registered as endpoints. This automatic filtering is what prevents traffic from being sent to pods that cannot handle it.',
    },
    {
      question:
        'A NodePort Service is exposed on port 31000. You have 3 nodes and 2 pods running on node-1. A client sends a request to node-2:31000. What happens?',
      choices: [
        'The request fails because no pods are running on node-2',
        'The request is queued until a pod is scheduled on node-2',
        'NodePort only works on nodes that are running matching pods',
        'The request is routed to one of the pods on node-1 — NodePort forwards traffic from any node to any matching endpoint in the cluster',
      ],
      correctIndex: 3,
      explanation:
        'NodePort exposes the Service on the same port across ALL nodes, regardless of where the pods actually run. ' +
        'kube-proxy on each node handles the forwarding. When node-2 receives the request on port 31000, it routes it to one of the Running endpoints — ' +
        'which happen to be on node-1. This is why NodePort uses the range 30000-32767: these ports are reserved on every node for Service traffic. ' +
        'The client can connect to any node and reach the Service.',
    },
    {
      question:
        'You create a ClusterIP Service for your frontend pods, but external users on the internet cannot reach it. Why?',
      choices: [
        'ClusterIP Services are only accessible from within the cluster — use NodePort or LoadBalancer for external access',
        'ClusterIP requires a DNS entry to be manually created first',
        'Frontend pods cannot be exposed through Services',
        'ClusterIP is deprecated; you should use Ingress instead',
      ],
      correctIndex: 0,
      explanation:
        'ClusterIP is the default Service type and only assigns an internal virtual IP. It is intended for pod-to-pod communication within the cluster ' +
        '(e.g., your frontend talking to your backend API). For external traffic, you need NodePort (exposes on every node\'s IP at a static port) ' +
        'or LoadBalancer (provisions a cloud load balancer with an external IP). Ingress is a separate resource that routes HTTP traffic but typically still ' +
        'requires a LoadBalancer or NodePort Service behind it.',
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
