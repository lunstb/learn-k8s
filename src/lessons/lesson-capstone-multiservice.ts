import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonCapstoneMultiservice: Lesson = {
  id: 23,
  title: 'Capstone: Multi-Service Architecture',
  description:
    'Diagnose and fix a complex multi-service application with broken deployments, misconfigured services, a failing StatefulSet, and a downed node.',
  mode: 'full',
  goalDescription:
    'Fix all issues: the backend has an image typo ("backnd:1.0" should be "backend:1.0"), the backend-svc has the wrong selector (app=back-end should be app=backend), and node-3 is cordoned. All deployments healthy, all services with endpoints, all nodes Ready.',
  successMessage:
    'Congratulations! You diagnosed and fixed a complex multi-service architecture: image typo on backend, ' +
    'wrong selector on backend-svc, and a NotReady node. These are the exact issues you will encounter in production.',
  hints: [
    { text: 'Start with kubectl get pods to identify which pods are failing.' },
    { text: 'Use kubectl get events to check for ImagePullError messages.' },
    { text: 'The backend image has a typo: "backnd:1.0" instead of "backend:1.0".' },
    { text: 'kubectl set image deployment/backend backend:1.0', exact: true },
    { text: 'The backend-svc selector doesn\'t match — compare with actual pod labels.' },
    { text: 'kubectl patch service backend-svc --selector=app=backend', exact: true },
    { text: 'kubectl uncordon node-3', exact: true },
  ],
  goals: [
    {
      description: 'Fix the backend image typo ("backnd:1.0" \u2192 "backend:1.0")',
      check: (s: ClusterState) => {
        const backend = s.deployments.find(d => d.metadata.name === 'backend');
        return !!backend && backend.spec.template.spec.image === 'backend:1.0';
      },
    },
    {
      description: 'Fix backend-svc selector (app=back-end \u2192 app=backend)',
      check: (s: ClusterState) => {
        const svc = s.services.find(svc => svc.spec.selector['app'] === 'backend');
        return !!svc && svc.status.endpoints.length > 0;
      },
    },
    {
      description: 'Uncordon node-3',
      check: (s: ClusterState) => s.nodes.every(n => n.status.conditions[0].status === 'True'),
    },
    {
      description: 'All deployments healthy with Running pods',
      check: (s: ClusterState) => {
        return s.deployments.every(d => (d.status.readyReplicas || 0) >= d.spec.replicas);
      },
    },
    {
      description: 'All services have endpoints',
      check: (s: ClusterState) => {
        return s.services.every(svc => svc.status.endpoints.length > 0);
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'Microservice Architecture in Kubernetes',
        content:
          'Modern applications are composed of multiple services that communicate with each other. ' +
          'A typical web application might have:\n\n' +
          '- Frontend: serves the UI (nginx, React build)\n' +
          '- Backend API: handles business logic (Node.js, Go, Python)\n' +
          '- Database: persistent data store (MySQL, PostgreSQL)\n' +
          '- Cache: in-memory data store (Redis)\n' +
          '- Message queue: async communication (RabbitMQ, Kafka)\n\n' +
          'Each service runs as its own Deployment (or StatefulSet for stateful components), with a Service ' +
          'providing internal DNS for communication. The frontend talks to the backend via backend-svc, ' +
          'the backend talks to the database via db-svc, and so on.\n\n' +
          'This decomposition means each service can be scaled, updated, and debugged independently. ' +
          'But it also means there are more things that can go wrong — and the failure of one service ' +
          'can cascade to others.',
        keyTakeaway:
          'Microservices in Kubernetes communicate via Services. Each component is independently scalable and updatable, but failures can cascade across service boundaries.',
      },
      {
        title: 'Service Mesh Concepts',
        content:
          'As the number of services grows, managing communication becomes complex. A service mesh adds ' +
          'a dedicated infrastructure layer for service-to-service communication.\n\n' +
          'A service mesh (like Istio, Linkerd, or Cilium) provides:\n\n' +
          '- Mutual TLS: automatic encryption between services, no code changes needed\n' +
          '- Traffic management: canary deployments, traffic splitting, retries, circuit breakers\n' +
          '- Observability: distributed tracing, metrics, access logs for every request between services\n' +
          '- Access control: fine-grained policies for which services can talk to which\n\n' +
          'The mesh works by injecting a sidecar proxy (like Envoy) into every pod. All traffic flows through ' +
          'the proxy, which enforces policies and collects telemetry. The application code is unaware of the mesh.\n\n' +
          'You do not need a service mesh for simple architectures. But once you have 10+ services in production, ' +
          'the operational benefits — automatic TLS, distributed tracing, traffic control — become essential.',
        keyTakeaway:
          'Service meshes manage service-to-service communication at scale. They provide encryption, traffic control, and observability without changing application code. Consider one when complexity grows.',
      },
      {
        title: 'Debugging Multi-Service Issues',
        content:
          'When a multi-service application breaks, the symptom often appears far from the root cause. ' +
          'Users see a 500 error on the frontend, but the actual problem is a database connection failure ' +
          'three hops away.\n\n' +
          'Systematic approach for multi-service debugging:\n\n' +
          '1. kubectl get pods — any non-Running pods? Start with the obviously broken ones.\n' +
          '2. kubectl get events — Warning events point to root causes.\n' +
          '3. kubectl get services — any services with 0 endpoints? Traffic cannot reach them.\n' +
          '4. kubectl get nodes — any NotReady? Pods may have been evicted.\n' +
          '5. Trace the dependency chain: frontend depends on backend, backend depends on database. ' +
          '   Fix upstream services first (database), then downstream (backend, then frontend).\n\n' +
          'Common multi-service failure patterns:\n' +
          '- Image typo on one service cascades to dependent services timing out\n' +
          '- Service selector mismatch means traffic never reaches healthy pods\n' +
          '- Node failure reduces capacity, making multiple deployments under-replicated\n' +
          '- ConfigMap/Secret changes not picked up by pods (need restart)',
        diagram:
          '  User Request\n' +
          '       │\n' +
          '       ▼\n' +
          '  [frontend-svc] ──→ frontend pods (Running? ✓)\n' +
          '       │\n' +
          '       ▼\n' +
          '  [backend-svc]  ──→ backend pods  (ImagePullError! ✗)\n' +
          '       │                 └── Fix: correct image name\n' +
          '       ▼\n' +
          '  [database-svc] ──→ database pods (Running? ✓)',
        keyTakeaway:
          'In multi-service architectures, trace failures through the dependency chain. Fix infrastructure issues first (nodes), then upstream services (database), then downstream (backend, frontend).',
      },
      {
        title: 'Observability: Logs, Metrics, and Traces',
        content:
          'Debugging is only possible if you can see what is happening. The three pillars of observability:\n\n' +
          'Logs: textual records of what each service is doing. In Kubernetes, every container writes to ' +
          'stdout/stderr, and `kubectl logs <pod>` retrieves them. For centralized logging, use a DaemonSet ' +
          '(Fluentd, Filebeat) to ship logs to Elasticsearch, Loki, or CloudWatch.\n\n' +
          'Metrics: numerical measurements over time. Prometheus scrapes metrics from pods (CPU, memory, ' +
          'request rate, error rate, latency). Grafana dashboards visualize them. HPA uses metrics for autoscaling.\n\n' +
          'Traces: follow a single request as it flows through multiple services. Distributed tracing ' +
          '(Jaeger, Zipkin, OpenTelemetry) shows the complete journey of a request — which services it hit, ' +
          'how long each hop took, and where errors occurred.\n\n' +
          'Together, these three give you a complete picture. Metrics tell you SOMETHING is wrong. ' +
          'Logs tell you WHAT happened. Traces tell you WHERE in the service chain it happened.',
        keyTakeaway:
          'Observability comes from three signals: metrics (what is happening), logs (what happened), and traces (where it happened). All three are needed to effectively debug multi-service systems.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Users report the frontend returns "504 Gateway Timeout." You check: backend pods show status Running, the backend Service ' +
        'has endpoints, and network policies allow traffic. What is the MOST LIKELY cause?',
      choices: [
        'The backend Service is using the wrong port number and connections are being refused by the container',
        'The frontend is misconfigured and sending requests to a Service name that does not match the backend',
        'The 504 is caused by the frontend pod itself timing out on internal processing, unrelated to the backend',
        'The backend pods are Running but the application is overloaded or deadlocked — Running does not mean responsive',
      ],
      correctIndex: 3,
      explanation:
        'This is a critical distinction: a pod in "Running" status means the container process is alive, NOT that the ' +
        'application is healthy or responding. A deadlocked, overloaded, or stuck application will still show as Running. ' +
        'The 504 timeout occurs because the backend accepts the TCP connection (endpoints exist) but never sends a response. ' +
        'Check readiness probes (which should have caught this), application logs, and resource usage. This is why readiness ' +
        'probes exist — they distinguish "process alive" from "ready to serve traffic."',
    },
    {
      question:
        'You are debugging a multi-service outage. `kubectl get pods` shows all pods Running. `kubectl get svc` shows all services have endpoints. ' +
        'Users still see errors. What should you check FIRST?',
      choices: [
        'Node disk pressure and memory utilization — the underlying infrastructure may be degraded beneath the pods',
        'kubectl get events — Warning events reveal OOMKills, failed probes, and resource pressure hidden from pod status',
        'Delete all pods to force a fresh restart since a clean recreation often resolves transient state issues',
        'Check if the cluster DNS (CoreDNS) pods are running since all inter-service discovery relies on DNS resolution',
      ],
      correctIndex: 1,
      explanation:
        'Events are the first place to look because they surface problems that pod status hides: recent OOMKills (pod restarted ' +
        'and is Running again but lost state), failed liveness/readiness probes, resource quota violations, or node pressure. ' +
        'A pod can be "Running" right now but have been OOMKilled 30 seconds ago and restarted with empty caches. ' +
        'Option D (CoreDNS) is worth checking but is less common. Option C (deleting pods) destroys diagnostic evidence. ' +
        'Always gather information before taking destructive action.',
    },
    {
      question:
        'Your architecture has: frontend -> API gateway -> backend -> database. The database runs out of connections. ' +
        'Which failure pattern do you expect to see?',
      choices: [
        'Each service times out waiting on the next — backend on database, gateway on backend, frontend on gateway — a cascading failure',
        'Only the database pod crashes; the frontend, API gateway, and backend continue operating using locally cached responses',
        'The API gateway circuit breaker detects the database failure and immediately returns errors, preventing any cascade',
        'Kubernetes detects the connection exhaustion and automatically restarts the database pod with increased connection limits',
      ],
      correctIndex: 0,
      explanation:
        'Without circuit breakers or timeout budgets, failures cascade through the dependency chain. The database cannot ' +
        'serve queries, so backend requests queue up and eventually time out. Those timeouts propagate to the API gateway, ' +
        'then to the frontend. Each layer adds its own timeout duration, so users experience the sum of all timeouts. ' +
        'Option C describes the ideal behavior WITH a service mesh/circuit breaker pattern, but it requires explicit ' +
        'configuration — it does not happen by default. This cascading pattern is the primary motivation for service meshes ' +
        'with retry budgets, circuit breakers, and timeout propagation.',
    },
    {
      question:
        'After an incident, your team wants to understand why a specific user request failed across 6 microservices. ' +
        'Which combination of observability tools gives you the most complete picture?',
      choices: [
        'Metrics dashboards alone, since they show error rates and latency percentiles broken down for each individual service',
        'Centralized logs alone, since each service logs request details and you can correlate entries by searching timestamps',
        'Distributed traces to find which service failed and how long each hop took, plus logs from that service for root cause',
        'kubectl describe on each pod, since Kubernetes events capture all application-level request failures and error details',
      ],
      correctIndex: 2,
      explanation:
        'Each observability signal answers a different question. Distributed traces show the request\'s path across all 6 services ' +
        'and pinpoint where the failure or latency occurred (the "where"). Logs from the identified service explain the root cause ' +
        '(the "what" — e.g., a null pointer exception, a database timeout). Metrics are valuable for detecting issues and trending ' +
        'but lack per-request granularity. Kubernetes events are infrastructure-level, not application-request-level. ' +
        'The combination of traces + logs is the standard approach for post-incident request-level debugging.',
    },
  ],
  podFailureRules: {
    'backnd:1.0': 'ImagePullError',
  },
  initialState: () => {
    // --- Frontend Deployment (2 replicas, running) ---
    const frontendImage = 'nginx:1.21';
    const frontendHash = templateHash({ image: frontendImage });
    const frontendDepUid = generateUID();
    const frontendRsUid = generateUID();

    const frontendPods = Array.from({ length: 2 }, (_, i) => ({
      kind: 'Pod' as const,
      metadata: {
        name: generatePodName(`frontend-${frontendHash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'frontend', 'pod-template-hash': frontendHash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `frontend-${frontendHash.slice(0, 10)}`,
          uid: frontendRsUid,
        },
        creationTimestamp: Date.now() - 60000,
      },
      spec: { image: frontendImage, nodeName: `node-${i + 1}` },
      status: { phase: 'Running' as const, tickCreated: 0 },
    }));

    // --- Backend Deployment (3 replicas, image typo = ImagePullError) ---
    const backendBadImage = 'backnd:1.0'; // typo!
    const backendHash = templateHash({ image: backendBadImage });
    const backendDepUid = generateUID();
    const backendRsUid = generateUID();

    const backendPods = Array.from({ length: 3 }, (_, i) => ({
      kind: 'Pod' as const,
      metadata: {
        name: generatePodName(`backend-${backendHash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'backend', 'pod-template-hash': backendHash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `backend-${backendHash.slice(0, 10)}`,
          uid: backendRsUid,
        },
        creationTimestamp: Date.now() - 30000,
      },
      spec: { image: backendBadImage, nodeName: `node-${(i % 2) + 1}`, failureMode: 'ImagePullError' as const },
      status: { phase: 'Pending' as const, reason: 'ImagePullError', message: `Failed to pull image "${backendBadImage}"`, tickCreated: 0 },
    }));

    // --- Database StatefulSet (1 replica, running) ---
    const dbUid = generateUID();
    const dbPod = {
      kind: 'Pod' as const,
      metadata: {
        name: 'database-0',
        uid: generateUID(),
        labels: { app: 'database' },
        ownerReference: {
          kind: 'StatefulSet',
          name: 'database',
          uid: dbUid,
        },
        creationTimestamp: Date.now() - 120000,
      },
      spec: { image: 'mysql:8.0', nodeName: 'node-1' },
      status: { phase: 'Running' as const, tickCreated: 0 },
    };

    // --- Nodes (node-3 is NotReady) ---
    const nodeNames = ['node-1', 'node-2', 'node-3'];
    const nodes = nodeNames.map((name, i) => ({
      kind: 'Node' as const,
      metadata: {
        name,
        uid: generateUID(),
        labels: { 'kubernetes.io/hostname': name },
        creationTimestamp: Date.now() - 300000,
      },
      spec: { capacity: { pods: 5 } },
      status: {
        conditions: [{
          type: 'Ready' as const,
          status: (i === 2 ? 'False' : 'True') as 'True' | 'False',
        }] as [{ type: 'Ready'; status: 'True' | 'False' }],
        allocatedPods: i === 0 ? 3 : i === 1 ? 2 : 0,
      },
    }));

    return {
      pods: [...frontendPods, ...backendPods, dbPod],
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `frontend-${frontendHash.slice(0, 10)}`,
            uid: frontendRsUid,
            labels: { app: 'frontend', 'pod-template-hash': frontendHash },
            ownerReference: {
              kind: 'Deployment',
              name: 'frontend',
              uid: frontendDepUid,
            },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 2,
            selector: { app: 'frontend', 'pod-template-hash': frontendHash },
            template: {
              labels: { app: 'frontend', 'pod-template-hash': frontendHash },
              spec: { image: frontendImage },
            },
          },
          status: { replicas: 2, readyReplicas: 2 },
        },
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `backend-${backendHash.slice(0, 10)}`,
            uid: backendRsUid,
            labels: { app: 'backend', 'pod-template-hash': backendHash },
            ownerReference: {
              kind: 'Deployment',
              name: 'backend',
              uid: backendDepUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'backend', 'pod-template-hash': backendHash },
            template: {
              labels: { app: 'backend', 'pod-template-hash': backendHash },
              spec: { image: backendBadImage },
            },
          },
          status: { replicas: 3, readyReplicas: 0 },
        },
      ],
      deployments: [
        {
          kind: 'Deployment' as const,
          metadata: {
            name: 'frontend',
            uid: frontendDepUid,
            labels: { app: 'frontend' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 2,
            selector: { app: 'frontend' },
            template: {
              labels: { app: 'frontend' },
              spec: { image: frontendImage },
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
        {
          kind: 'Deployment' as const,
          metadata: {
            name: 'backend',
            uid: backendDepUid,
            labels: { app: 'backend' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'backend' },
            template: {
              labels: { app: 'backend' },
              spec: { image: backendBadImage },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 3,
            updatedReplicas: 3,
            readyReplicas: 0,
            availableReplicas: 0,
            conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
          },
        },
      ],
      nodes,
      services: [
        {
          kind: 'Service' as const,
          metadata: {
            name: 'frontend-svc',
            uid: generateUID(),
            labels: {},
            creationTimestamp: Date.now() - 120000,
          },
          spec: { selector: { app: 'frontend' }, port: 80 },
          status: { endpoints: frontendPods.map((p) => p.metadata.name) },
        },
        {
          kind: 'Service' as const,
          metadata: {
            name: 'backend-svc',
            uid: generateUID(),
            labels: {},
            creationTimestamp: Date.now() - 120000,
          },
          // Wrong selector! Should be app=backend but says app=back-end
          spec: { selector: { app: 'back-end' }, port: 8080 },
          status: { endpoints: [] },
        },
      ],
      events: [
        {
          timestamp: Date.now() - 30000,
          tick: 0,
          type: 'Warning' as const,
          reason: 'ImagePullError',
          objectKind: 'Pod',
          objectName: backendPods[0]?.metadata.name || 'backend-pod',
          message: `Failed to pull image "${backendBadImage}": image not found`,
        },
        {
          timestamp: Date.now() - 25000,
          tick: 0,
          type: 'Warning' as const,
          reason: 'NodeNotReady',
          objectKind: 'Node',
          objectName: 'node-3',
          message: 'Node node-3 status is NotReady',
        },
      ],
      namespaces: [],
      configMaps: [],
      secrets: [],
      ingresses: [],
      statefulSets: [
        {
          kind: 'StatefulSet' as const,
          metadata: {
            name: 'database',
            uid: dbUid,
            labels: { app: 'database' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 1,
            selector: { app: 'database' },
            serviceName: 'database-headless',
            template: {
              labels: { app: 'database' },
              spec: { image: 'mysql:8.0' },
            },
          },
          status: { replicas: 1, readyReplicas: 1, currentReplicas: 1 },
        },
      ],
      daemonSets: [],
      jobs: [],
      cronJobs: [],
      hpas: [],
      helmReleases: [],
    };
  },
  goalCheck: (state) => {
    // All deployments healthy: readyReplicas >= spec.replicas
    const deploymentsHealthy = state.deployments.every(
      (d) => d.status.readyReplicas >= d.spec.replicas
    );
    if (!deploymentsHealthy) return false;

    // All services have endpoints
    const servicesHealthy = state.services.every(
      (s) => s.status.endpoints.length > 0
    );
    if (!servicesHealthy) return false;

    // All nodes Ready
    const allNodesReady = state.nodes.every(
      (n) => n.status.conditions[0].status === 'True'
    );

    return allNodesReady;
  },
};
