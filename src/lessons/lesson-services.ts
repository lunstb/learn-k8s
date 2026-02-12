import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonServices: Lesson = {
  id: 5,
  title: 'Services and Networking',
  description:
    'Services provide a stable address for ephemeral pods, routing traffic only to healthy endpoints.',
  mode: 'full',
  goalDescription:
    'Create a Service named "web-svc" with selector app=web-app on the correct port (hint: check the pod logs to discover it), scale the "web-app" Deployment to 5 replicas, and verify all 5 endpoints are active.',
  successMessage:
    'You discovered the port from the pod logs and wired the Service correctly. ' +
    'In real clusters, always check what port your containers actually listen on — never assume. ' +
    'Services dynamically track endpoints: when you scale up, new Running pods automatically become endpoints.',
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
          'discovers all pods with that label. Labels are case-sensitive: app=api and app=API are different values and will not match.\n\n' +
          'The Service maintains an endpoint list: the set of pod IPs that are currently eligible to receive traffic. ' +
          'A pod must meet ALL of these criteria to become an endpoint:\n' +
          '- It matches the Service selector\n' +
          '- It is in the Running phase (not Pending, Failed, or Terminating)\n' +
          '- It is Ready — meaning its readiness probe is passing (if one is configured)\n\n' +
          'That last point is critical. A pod can be Running (its container process is alive) but not Ready ' +
          '(the application has not finished initializing, or it is temporarily overloaded). Kubernetes distinguishes between ' +
          '"the process is alive" and "the application can serve traffic." Only Ready pods receive traffic through a Service. ' +
          'You will learn more about readiness probes in the Probes lesson.\n\n' +
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
          'A Service gives pods a stable identity. Clients talk to the Service name, which never changes. Only Running AND Ready pods matching the selector become endpoints — unhealthy or unready pods are automatically excluded.',
      },
      {
        title: 'How Services Route Traffic',
        content:
          'When you create a Service, it gets a virtual IP address called a ClusterIP. This IP does not belong to any ' +
          'single pod — it is a stable address that Kubernetes manages for you. A component called kube-proxy, running ' +
          'on every node, watches for Services and their endpoints, then sets up networking rules so that traffic sent ' +
          'to the ClusterIP is forwarded to one of the matching pods.\n\n' +
          'A Service definition has two important port fields:\n' +
          '- port: the port the Service listens on — this is what clients connect to\n' +
          '- targetPort: the port on the actual pod containers where traffic is delivered\n\n' +
          'These can be different. For example, port: 80 with targetPort: 3000 lets clients connect on the standard ' +
          'HTTP port (80) while the application listens on 3000. If targetPort is omitted, it defaults to the same value as port.\n\n' +
          'The endpoint list updates automatically. When you scale a Deployment from 3 to 5, the new pods become ' +
          'endpoints as soon as they are Running and Ready. When you scale down or a pod is replaced, terminated pods are ' +
          'removed from the list. During rolling updates, old pods keep serving while new pods join the endpoint ' +
          'list as they become ready — ensuring zero downtime.\n\n' +
          'By default, kube-proxy distributes traffic roughly evenly across endpoints. If you need a client to ' +
          'stick to the same pod across requests, you can enable session affinity on the Service.',
        keyTakeaway:
          'kube-proxy routes traffic from the Service virtual IP to healthy pods. Endpoints update automatically as pods come and go — you never manage them manually.',
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
          'Service types control WHERE the service is accessible (cluster-internal, node port, or cloud load balancer), but the HOW is always the same: selectors find pods, only Running and Ready pods become endpoints.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Your pods have label app=api but the Service selector is app=API (capital letters). How many endpoints does the Service have?',
      choices: [
        'Zero — Kubernetes labels are case-sensitive, so app=API does not match app=api and no pods are selected',
        'All the Running pods — Kubernetes normalizes label values to lowercase before matching selectors',
        'It depends on the namespace — labels are case-sensitive across namespaces but case-insensitive within one',
        'The Service is created but enters a degraded state because the selector format is considered invalid',
      ],
      correctIndex: 0,
      explanation:
        'Kubernetes labels are strictly case-sensitive. "api" and "API" are different values. The Service selector app=API will not match pods with app=api, ' +
        'resulting in zero endpoints. This is a common and frustrating debugging scenario — the Service exists and looks correct, but no traffic reaches your pods. ' +
        'Always check exact label values with "kubectl get pods --show-labels" when a Service has no endpoints.',
    },
    {
      question:
        'You have 5 pods with label app=web. Three are Running, one is Pending, and one is Terminating. A Service selects app=web. During this moment, how many endpoints does the Service have?',
      choices: [
        '5 — all pods matching the selector are registered as endpoints regardless of their phase',
        '4 — only the Terminating pod is excluded since it has begun its graceful shutdown process',
        '3 — only Running pods become endpoints; Pending and Terminating pods are excluded from the list',
        '1 — Kubernetes selects only the pod with the lowest resource usage to avoid overloading endpoints',
      ],
      correctIndex: 2,
      explanation:
        'The endpoints controller filters on two criteria: the pod must match the Service selector AND the pod must be in the Running phase. ' +
        'Pending pods are not ready to accept traffic (containers may still be starting). Terminating pods are shutting down and will soon be gone. ' +
        'Only the 3 Running pods are registered as endpoints. This automatic filtering is what prevents traffic from being sent to pods that cannot handle it.',
    },
    {
      question:
        'A NodePort Service is exposed on port 31000. You have 3 nodes and 2 pods running on node-1. A client sends a request to node-2:31000. What happens?',
      choices: [
        'The request fails because no matching pods are currently running on node-2 to handle it',
        'The request is routed to one of the pods on node-1 — NodePort forwards from any node to any endpoint',
        'The request is queued by kube-proxy on node-2 until a matching pod is scheduled on that node',
        'NodePort routing only works on nodes where matching pods exist, so node-2 drops the connection',
      ],
      correctIndex: 1,
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
        'ClusterIP requires a DNS provider integration to be configured before external access is possible',
        'The Service needs a publicIP annotation added to its spec before it can accept external traffic',
        'ClusterIP Services require an Ingress controller to be installed to translate external requests',
        'ClusterIP Services are only accessible from within the cluster — use NodePort or LoadBalancer instead',
      ],
      correctIndex: 3,
      explanation:
        'ClusterIP is the default Service type and only assigns an internal virtual IP. It is intended for pod-to-pod communication within the cluster ' +
        '(e.g., your frontend talking to your backend API). For external traffic, you need NodePort (exposes on every node\'s IP at a static port) ' +
        'or LoadBalancer (provisions a cloud load balancer with an external IP). Ingress is a separate resource that routes HTTP traffic but typically still ' +
        'requires a LoadBalancer or NodePort Service behind it.',
    },
    {
      question:
        'A Service is defined with port: 80 and targetPort: 3000. A client inside the cluster sends a request to the Service on port 80. Where does the request go?',
      choices: [
        'The request fails because the Service port and the container port must be identical to work',
        'The request is routed to port 80 on the pod, and the pod internally redirects it to 3000',
        'The request is routed to port 3000 on a matching pod — "port" is the Service listener, "targetPort" is the container port',
        'The request is duplicated to both port 80 and port 3000 on the pod for redundancy purposes',
      ],
      correctIndex: 2,
      explanation:
        'The "port" field is what the Service listens on — it\'s the port clients use to reach the Service. ' +
        'The "targetPort" field is the port on the actual pod containers. The Service translates between them: incoming traffic on port 80 ' +
        'is forwarded to port 3000 on the pods. This lets you expose a standard port (80 for HTTP) even if your application listens on a different port (3000). ' +
        'If targetPort is omitted, it defaults to the same value as port.',
    },
    {
      question:
        'During a rolling update, some pods are Running but their readiness probes have not yet passed. A Service selects these pods. Do they receive traffic?',
      choices: [
        'Yes — all Running pods matching the selector become endpoints regardless of readiness status',
        'No — only pods that are both Running AND passing readiness probes are included in endpoints',
        'Yes — readiness probes are only evaluated during initial pod startup, not during rolling updates',
        'It depends on whether the rolling update uses maxSurge or maxUnavailable for its strategy',
      ],
      correctIndex: 1,
      explanation:
        'The endpoints controller checks two conditions: the pod must match the Service selector AND the pod must be Ready. ' +
        'During a rolling update, new pods start Running but their readiness probes may not pass immediately (the application needs time to initialize). ' +
        'Until readiness passes, these pods are NOT in the Service endpoints and receive no traffic. Old pods continue serving until the new ones are ready. ' +
        'This is the mechanism behind zero-downtime rolling updates — traffic only shifts to new pods after they prove they can handle it.',
    },
  ],
  practices: [
    {
      title: 'Wire a Service to Pods',
      goalDescription:
        'Create a Service named "web-svc" with selector app=web-app on the correct port (hint: check the pod logs to discover it), scale the "web-app" Deployment to 5 replicas, and verify all 5 endpoints are active.',
      successMessage:
        'You discovered the port from the pod logs and wired the Service correctly. ' +
        'In real clusters, always check what port your containers actually listen on — never assume. ' +
        'Services dynamically track endpoints: when you scale up, new Running pods automatically become endpoints.',
      yamlTemplate: `apiVersion: v1
kind: Service
metadata:
  name: ???
spec:
  selector:
    app: ???
  ports:
  - port: ???
    targetPort: ???`,
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
            ownerReference: { kind: 'ReplicaSet', name: `web-app-${hash.slice(0, 10)}`, uid: rsUid },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image },
          status: { phase: 'Running' as const },
        }));

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'web-app', uid: depUid, labels: { app: 'web-app' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 3, selector: { app: 'web-app' },
              template: { labels: { app: 'web-app' }, spec: { image } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 3, updatedReplicas: 3, readyReplicas: 3, availableReplicas: 3, conditions: [{ type: 'Available', status: 'True' }] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `web-app-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'web-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'web-app', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 3, selector: { app: 'web-app', 'pod-template-hash': hash },
              template: { labels: { app: 'web-app', 'pod-template-hash': hash }, spec: { image } },
            },
            status: { replicas: 3, readyReplicas: 3 },
          }],
          pods,
          nodes: [],
          services: [],
          events: [],
        };
      },
      goals: [
        {
          description: 'Use "kubectl scale" to scale the deployment to 5 replicas',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('scale'),
        },
        {
          description: 'Create a Service named "web-svc" targeting app=web-app on the correct port',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.metadata.name === 'web-svc');
            return !!svc && svc.spec.selector['app'] === 'web-app' && svc.spec.port === 8080;
          },
        },
        {
          description: 'Scale the "web-app" Deployment to 5 replicas',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'web-app');
            return !!dep && dep.spec.replicas === 5;
          },
        },
        {
          description: 'Verify the service has 5 endpoints',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.spec.selector['app'] === 'web-app');
            return !!svc && svc.status.endpoints.length === 5;
          },
        },
      ],
      hints: [
        { text: 'First, figure out what port the application listens on. Try: kubectl logs <pod-name> — look for the port number in the startup output.' },
        { text: 'The logs show "Listening on port 8080" — that is the port your Service needs to target.' },
        { text: 'Switch to the YAML Editor tab — fill in the ??? fields: name should be "web-svc", selector app should match "web-app", and use the port you discovered.' },
        { text: 'Or use the terminal: kubectl create service web-svc --selector=app=web-app --port=8080', exact: false },
        { text: 'After the service exists, scale the deployment: kubectl scale deployment web-app --replicas=5' },
        { text: 'Use kubectl get endpoints to verify all 5 pods are registered.' },
      ],
    },
    {
      title: 'Debug a Misconfigured Service',
      goalDescription:
        'The "api-svc" Service has the wrong selector and shows 0 endpoints. Use describe and get endpoints to diagnose, then fix the selector.',
      successMessage:
        'You diagnosed a Service with 0 endpoints by checking the selector mismatch. Mismatched selectors are one of the most common networking issues in Kubernetes.',
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'api:1.0';
        const hash = templateHash({ image });

        const pods = Array.from({ length: 3 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`api-server-${hash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'api-server', 'pod-template-hash': hash },
            ownerReference: { kind: 'ReplicaSet', name: `api-server-${hash.slice(0, 10)}`, uid: rsUid },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image },
          status: { phase: 'Running' as const },
        }));

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'api-server', uid: depUid, labels: { app: 'api-server' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 3, selector: { app: 'api-server' },
              template: { labels: { app: 'api-server' }, spec: { image } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 3, updatedReplicas: 3, readyReplicas: 3, availableReplicas: 3, conditions: [{ type: 'Available', status: 'True' }] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `api-server-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'api-server', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'api-server', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 3, selector: { app: 'api-server', 'pod-template-hash': hash },
              template: { labels: { app: 'api-server', 'pod-template-hash': hash }, spec: { image } },
            },
            status: { replicas: 3, readyReplicas: 3 },
          }],
          pods,
          nodes: [],
          services: [{
            kind: 'Service' as const,
            metadata: { name: 'api-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 },
            spec: { selector: { app: 'api' }, port: 8080 },
            status: { endpoints: [] },
          }],
          events: [],
        };
      },
      goals: [
        {
          description: 'Use "kubectl describe service api-svc" to inspect the service',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('describe-service'),
        },
        {
          description: 'Use "kubectl get endpoints" to verify 0 endpoints',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-endpoints'),
        },
        {
          description: 'Use "kubectl patch" to fix the service selector',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('patch'),
        },
        {
          description: 'Fix the selector to app=api-server',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.metadata.name === 'api-svc');
            return !!svc && svc.spec.selector['app'] === 'api-server';
          },
        },
        {
          description: 'Verify 3 endpoints on the service',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.metadata.name === 'api-svc');
            return !!svc && svc.status.endpoints.length === 3;
          },
        },
      ],
      hints: [
        { text: 'Run "kubectl describe service api-svc" to see the selector and endpoint count.' },
        { text: 'Run "kubectl get endpoints" to confirm the service has 0 endpoints.' },
        { text: 'Compare the service selector (app=api) with the pod labels (app=api-server). They don\'t match!' },
        { text: 'kubectl patch service api-svc --selector=app=api-server', exact: true },
      ],
    },
  ],
};
