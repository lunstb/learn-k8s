import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonCapstoneMultiservice: Lesson = {
  id: 23,
  title: 'Capstone: Multi-Service Architecture',
  description:
    'Diagnose and fix a complex multi-service application with a missing ConfigMap, crashing workers, a misconfigured service, and an under-scaled frontend.',
  mode: 'full',
  goalDescription:
    'Fix all issues: create the missing "api-config" ConfigMap so API pods can start, fix the worker image ("workerr:1.0" should be "worker:1.0"), patch the cache-svc selector (app=redis-cache should be app=cache), and scale frontend to 3 replicas.',
  successMessage:
    'Congratulations! You diagnosed and fixed: missing ConfigMap dependency, CrashLoopBackOff from bad image, ' +
    'wrong selector on cache-svc, and under-scaled frontend. These are the real-world failure modes you\'ll encounter in production.',
  lecture: {
    sections: [
      {
        title: 'Microservice Architecture in Kubernetes',
        content:
          'Modern applications are composed of multiple services that communicate with each other. ' +
          'A typical web application might have:\n\n' +
          '- Frontend: serves the UI (nginx, React build)\n' +
          '- Backend API: handles business logic (Node.js, Go, Python)\n' +
          '- Worker: background processing (job queues, async tasks)\n' +
          '- Cache: in-memory data store (Redis)\n' +
          '- Database: persistent data store (MySQL, PostgreSQL)\n\n' +
          'Each service runs as its own Deployment (or StatefulSet for stateful components), with a Service ' +
          'providing internal DNS for communication. The frontend talks to the API via api-svc, ' +
          'the API talks to the cache via cache-svc, and so on.\n\n' +
          'This decomposition means each service can be scaled, updated, and debugged independently. ' +
          'But it also means there are more things that can go wrong — and the failure of one service ' +
          'can cascade to others.',
        keyTakeaway:
          'Microservices in Kubernetes communicate via Services. Each component is independently scalable and updatable, but failures can cascade across service boundaries.',
      },
      {
        title: 'Configuration Dependencies',
        content:
          'In a multi-service architecture, services depend not just on each other but on configuration. ' +
          'A backend API needs database connection strings, API keys, and feature flags — typically stored ' +
          'in ConfigMaps and Secrets.\n\n' +
          'When a pod references a ConfigMap or Secret via `envFrom` and that ConfigMap doesn\'t exist, ' +
          'the pod gets stuck in CreateContainerConfigError. It cannot start at all — not even to crash. ' +
          'This is different from CrashLoopBackOff where the container starts but then exits.\n\n' +
          'The distinction matters for debugging:\n' +
          '- CreateContainerConfigError → missing ConfigMap/Secret (fix: create the missing resource)\n' +
          '- CrashLoopBackOff → container starts but crashes (fix: check logs, fix the application or its config)\n' +
          '- ImagePullError → wrong image name or missing registry (fix: correct the image reference)\n\n' +
          'Each failure mode has a different root cause and a different fix. Learning to recognize ' +
          'the status and immediately know what to look for is the core skill of Kubernetes debugging.',
        keyTakeaway:
          'ConfigMap/Secret dependencies cause CreateContainerConfigError — the pod cannot start at all. This is distinct from CrashLoopBackOff (starts then crashes) and ImagePullError (wrong image). Each status maps to a specific root cause.',
      },
      {
        title: 'Debugging Multi-Service Issues',
        content:
          'When a multi-service application breaks, the symptom often appears far from the root cause. ' +
          'Users see a 500 error on the frontend, but the actual problem is a missing ConfigMap ' +
          'three hops away.\n\n' +
          'Systematic approach for multi-service debugging:\n\n' +
          '1. kubectl get pods — any non-Running pods? Start with the obviously broken ones.\n' +
          '2. kubectl get events — Warning events point to root causes.\n' +
          '3. kubectl get services — any services with 0 endpoints? Traffic cannot reach them.\n' +
          '4. kubectl describe <broken-pod> — read the status reason and message.\n' +
          '5. Trace the dependency chain: frontend depends on API, API depends on config and cache. ' +
          '   Fix infrastructure dependencies first (ConfigMaps, Secrets), then services.\n\n' +
          'Common multi-service failure patterns:\n' +
          '- Missing ConfigMap/Secret blocks pod startup entirely\n' +
          '- Bad image on one service causes CrashLoopBackOff with escalating restart delays\n' +
          '- Service selector mismatch means traffic never reaches healthy pods\n' +
          '- Under-scaled deployment handles normal load but fails under peak traffic',
        diagram:
          '  User Request\n' +
          '       │\n' +
          '       ▼\n' +
          '  [frontend-svc] ──→ frontend pods (1 Running, need 3)\n' +
          '       │\n' +
          '       ▼\n' +
          '  [api-svc]      ──→ api pods (CreateContainerConfigError!)\n' +
          '       │                 └── Fix: create missing ConfigMap\n' +
          '       ▼\n' +
          '  [cache-svc]    ──→ 0 endpoints (selector mismatch!)\n' +
          '                       └── Fix: patch selector',
        keyTakeaway:
          'In multi-service architectures, trace failures through the dependency chain. Fix configuration dependencies first (ConfigMaps/Secrets), then fix application issues (images, selectors), then scale.',
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
        'A pod shows status "CreateContainerConfigError" while another pod in a different deployment shows "CrashLoopBackOff." ' +
        'A junior engineer says both have the same root cause. Is this correct?',
      choices: [
        'Yes — both indicate the container cannot run, so the fix is the same: delete and recreate the pod',
        'No — CreateContainerConfigError means a referenced ConfigMap/Secret is missing; CrashLoopBackOff means the container starts but crashes',
        'Yes — both are caused by incorrect image configurations and require image fixes',
        'No — CreateContainerConfigError is a node-level issue while CrashLoopBackOff is a container-level issue',
      ],
      correctIndex: 1,
      explanation:
        'These are fundamentally different failures. CreateContainerConfigError happens BEFORE the container starts — ' +
        'Kubernetes cannot even create the container because a required ConfigMap or Secret does not exist. The fix is to create ' +
        'the missing resource. CrashLoopBackOff happens AFTER the container starts — it runs briefly, then exits with an error. ' +
        'The fix requires checking logs to understand why the application crashes. Recognizing the status immediately tells you ' +
        'whether to look for missing configuration resources or application-level bugs.',
    },
    {
      question:
        'Users report the frontend returns "504 Gateway Timeout." You check: API pods show status Running, the API Service ' +
        'has endpoints, and network policies allow traffic. What is the MOST LIKELY cause?',
      choices: [
        'The API Service is using the wrong port number and connections are being refused by the container',
        'The frontend is misconfigured and sending requests to a Service name that does not match the API',
        'The 504 is caused by the frontend pod itself timing out on internal processing, unrelated to the API',
        'The API pods are Running but the application is overloaded or deadlocked — Running does not mean responsive',
      ],
      correctIndex: 3,
      explanation:
        'This is a critical distinction: a pod in "Running" status means the container process is alive, NOT that the ' +
        'application is healthy or responding. A deadlocked, overloaded, or stuck application will still show as Running. ' +
        'The 504 timeout occurs because the API accepts the TCP connection (endpoints exist) but never sends a response. ' +
        'Check readiness probes (which should have caught this), application logs, and resource usage. This is why readiness ' +
        'probes exist — they distinguish "process alive" from "ready to serve traffic."',
    },
    {
      question:
        'Your architecture has: frontend -> API -> cache -> database. The cache service has 0 endpoints despite cache pods running. ' +
        'What user-facing symptom do you expect?',
      choices: [
        'No impact — the API will bypass the cache and query the database directly as a fallback',
        'The frontend loads but API responses are slow or timeout because the API cannot reach the cache',
        'Only cached data is affected — fresh database queries still work normally through the API',
        'The entire frontend is down because Kubernetes stops routing to the API when any downstream dependency fails',
      ],
      correctIndex: 1,
      explanation:
        'When the cache service has 0 endpoints, the API\'s requests to cache-svc have no backend to route to. ' +
        'Depending on the application, this causes timeouts or connection errors in the API, which cascade to the frontend as ' +
        'slow responses or 5xx errors. The API won\'t automatically fall back to the database — that would require explicit ' +
        'circuit breaker logic in the application code. Kubernetes routes traffic based on selectors and endpoints; it does not ' +
        'understand application-level fallback patterns. This is why service selector mismatches can cause cascading failures ' +
        'even when all pods are healthy.',
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
  practices: [
    {
      title: 'Fix a Multi-Service Application',
      goalDescription:
        'Fix all issues: create the missing "api-config" ConfigMap so API pods can start, fix the worker image ("workerr:1.0" should be "worker:1.0"), patch the cache-svc selector (app=redis-cache should be app=cache), and scale frontend to 3 replicas.',
      successMessage:
        'Congratulations! You diagnosed and fixed: missing ConfigMap dependency, CrashLoopBackOff from bad image, ' +
        'wrong selector on cache-svc, and under-scaled frontend. These are the real-world failure modes you\'ll encounter in production.',
      hints: [
        { text: 'Start with kubectl get pods to see which pods are failing and why.' },
        { text: 'API pods show CreateContainerConfigError — they need a ConfigMap called "api-config".' },
        { text: 'kubectl create configmap api-config --from-literal=DB_HOST=database', exact: true },
        { text: 'Worker pods are in CrashLoopBackOff — check the image name with kubectl describe.' },
        { text: 'kubectl set image deployment/worker worker=worker:1.0', exact: true },
        { text: 'The cache-svc has 0 endpoints — its selector doesn\'t match the cache pod labels.' },
        { text: 'kubectl patch service cache-svc --selector=app=cache', exact: true },
      ],
      goals: [
        {
          description: 'Diagnose failures with "kubectl describe" or "kubectl logs"',
          check: (s: ClusterState) => {
            const cmds = s._commandsUsed ?? [];
            return cmds.some(c => c.startsWith('describe-') || c === 'logs');
          },
        },
        {
          description: 'Create the missing ConfigMap',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('create-configmap'),
        },
        {
          description: 'Fix the worker image with "kubectl set image"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('set-image'),
        },
        {
          description: 'Patch the cache-svc selector',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('patch'),
        },
        {
          description: 'Scale the frontend deployment',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('scale'),
        },
        {
          description: 'Create the missing "api-config" ConfigMap so API pods can start',
          check: (s: ClusterState) => {
            return s.configMaps.some(cm => cm.metadata.name === 'api-config');
          },
        },
        {
          description: 'Fix the worker image typo ("workerr:1.0" → "worker:1.0")',
          check: (s: ClusterState) => {
            const worker = s.deployments.find(d => d.metadata.name === 'worker');
            return !!worker && worker.spec.template.spec.image === 'worker:1.0';
          },
        },
        {
          description: 'Fix cache-svc selector to match cache pods (app=cache)',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.metadata.name === 'cache-svc');
            return !!svc && svc.spec.selector['app'] === 'cache' && svc.status.endpoints.length > 0;
          },
        },
        {
          description: 'Scale frontend to 3 replicas',
          check: (s: ClusterState) => {
            const frontend = s.deployments.find(d => d.metadata.name === 'frontend');
            const frontendPods = s.pods.filter(
              p => p.metadata.labels['app'] === 'frontend' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
            );
            return !!frontend && frontend.spec.replicas >= 3 && frontendPods.length >= 3;
          },
        },
        {
          description: 'All services have endpoints',
          check: (s: ClusterState) => {
            return s.services.every(svc => svc.status.endpoints.length > 0);
          },
        },
      ],
      podFailureRules: {
        'workerr:1.0': 'CrashLoopBackOff',
      },
      initialState: () => {
        // --- Frontend Deployment (1 replica running, needs scaling to 3) ---
        const frontendImage = 'nginx:1.21';
        const frontendHash = templateHash({ image: frontendImage });
        const frontendDepUid = generateUID();
        const frontendRsUid = generateUID();

        const frontendPods = Array.from({ length: 1 }, () => ({
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
          spec: { image: frontendImage, nodeName: 'node-1' },
          status: { phase: 'Running' as const, tickCreated: 0 },
        }));

        // --- API Deployment (2 replicas, stuck on missing ConfigMap) ---
        const apiImage = 'api:2.0';
        const apiHash = templateHash({ image: apiImage });
        const apiDepUid = generateUID();
        const apiRsUid = generateUID();

        const apiPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`api-${apiHash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'api', 'pod-template-hash': apiHash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `api-${apiHash.slice(0, 10)}`,
              uid: apiRsUid,
            },
            creationTimestamp: Date.now() - 30000,
          },
          spec: {
            image: apiImage,
            nodeName: 'node-1',
            envFrom: [{ configMapRef: 'api-config' }],
          },
          status: {
            phase: 'Pending' as const,
            reason: 'CreateContainerConfigError',
            message: 'configmap "api-config" not found',
          },
        }));

        // --- Worker Deployment (2 replicas, bad image causing CrashLoopBackOff) ---
        const workerBadImage = 'workerr:1.0'; // typo!
        const workerHash = templateHash({ image: workerBadImage });
        const workerDepUid = generateUID();
        const workerRsUid = generateUID();

        const workerPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`worker-${workerHash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'worker', 'pod-template-hash': workerHash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `worker-${workerHash.slice(0, 10)}`,
              uid: workerRsUid,
            },
            creationTimestamp: Date.now() - 30000,
          },
          spec: {
            image: workerBadImage,
            nodeName: 'node-2',
            failureMode: 'CrashLoopBackOff' as const,
            logs: ['[fatal] Module "workerr" not found — did you mean "worker"? Check image name.', 'Process exited with code 1'],
          },
          status: {
            phase: 'CrashLoopBackOff' as const,
            reason: 'CrashLoopBackOff',
            message: 'Back-off restarting failed container',
            restartCount: 3,
          },
        }));

        // --- Cache pod (running, but service has wrong selector) ---
        const cacheImage = 'redis:7.0';
        const cachePod = {
          kind: 'Pod' as const,
          metadata: {
            name: 'cache-0',
            uid: generateUID(),
            labels: { app: 'cache' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: { image: cacheImage, nodeName: 'node-2' },
          status: { phase: 'Running' as const, tickCreated: 0 },
        };

        // --- Nodes (all healthy, no cordoned nodes) ---
        const nodeNames = ['node-1', 'node-2', 'node-3'];
        const nodes = nodeNames.map((name) => ({
          kind: 'Node' as const,
          metadata: {
            name,
            uid: generateUID(),
            labels: { 'kubernetes.io/hostname': name },
            creationTimestamp: Date.now() - 300000,
          },
          spec: { capacity: { pods: 6 } },
          status: {
            conditions: [{
              type: 'Ready' as const,
              status: 'True' as 'True' | 'False',
            }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: name === 'node-1' ? 3 : name === 'node-2' ? 3 : 0,
          },
        }));

        return {
          pods: [...frontendPods, ...apiPods, ...workerPods, cachePod],
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
                replicas: 1,
                selector: { app: 'frontend', 'pod-template-hash': frontendHash },
                template: {
                  labels: { app: 'frontend', 'pod-template-hash': frontendHash },
                  spec: { image: frontendImage },
                },
              },
              status: { replicas: 1, readyReplicas: 1 },
            },
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `api-${apiHash.slice(0, 10)}`,
                uid: apiRsUid,
                labels: { app: 'api', 'pod-template-hash': apiHash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'api',
                  uid: apiDepUid,
                },
                creationTimestamp: Date.now() - 60000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'api', 'pod-template-hash': apiHash },
                template: {
                  labels: { app: 'api', 'pod-template-hash': apiHash },
                  spec: { image: apiImage },
                },
              },
              status: { replicas: 2, readyReplicas: 0 },
            },
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `worker-${workerHash.slice(0, 10)}`,
                uid: workerRsUid,
                labels: { app: 'worker', 'pod-template-hash': workerHash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'worker',
                  uid: workerDepUid,
                },
                creationTimestamp: Date.now() - 60000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'worker', 'pod-template-hash': workerHash },
                template: {
                  labels: { app: 'worker', 'pod-template-hash': workerHash },
                  spec: { image: workerBadImage },
                },
              },
              status: { replicas: 2, readyReplicas: 0 },
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
                replicas: 1,
                selector: { app: 'frontend' },
                template: {
                  labels: { app: 'frontend' },
                  spec: { image: frontendImage },
                },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: {
                replicas: 1,
                updatedReplicas: 1,
                readyReplicas: 1,
                availableReplicas: 1,
                conditions: [{ type: 'Available', status: 'True' }],
              },
            },
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'api',
                uid: apiDepUid,
                labels: { app: 'api' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'api' },
                template: {
                  labels: { app: 'api' },
                  spec: { image: apiImage },
                },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: {
                replicas: 2,
                updatedReplicas: 2,
                readyReplicas: 0,
                availableReplicas: 0,
                conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
              },
            },
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'worker',
                uid: workerDepUid,
                labels: { app: 'worker' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'worker' },
                template: {
                  labels: { app: 'worker' },
                  spec: { image: workerBadImage },
                },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: {
                replicas: 2,
                updatedReplicas: 2,
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
                name: 'api-svc',
                uid: generateUID(),
                labels: {},
                creationTimestamp: Date.now() - 120000,
              },
              spec: { selector: { app: 'api' }, port: 8080 },
              status: { endpoints: [] },
            },
            {
              kind: 'Service' as const,
              metadata: {
                name: 'cache-svc',
                uid: generateUID(),
                labels: {},
                creationTimestamp: Date.now() - 120000,
              },
              // Wrong selector! Pods have app=cache but service selects app=redis-cache
              spec: { selector: { app: 'redis-cache' }, port: 6379 },
              status: { endpoints: [] },
            },
          ],
          events: [
            {
              timestamp: Date.now() - 30000,
              tick: 0,
              type: 'Warning' as const,
              reason: 'Failed',
              objectKind: 'Pod',
              objectName: apiPods[0]?.metadata.name || 'api-pod',
              message: 'CreateContainerConfigError: configmap "api-config" not found',
            },
            {
              timestamp: Date.now() - 25000,
              tick: 0,
              type: 'Warning' as const,
              reason: 'BackOff',
              objectKind: 'Pod',
              objectName: workerPods[0]?.metadata.name || 'worker-pod',
              message: 'Back-off restarting failed container (restart count: 3)',
            },
          ],
          namespaces: [],
          configMaps: [],
          secrets: [],
          ingresses: [],
          statefulSets: [],
          daemonSets: [],
          jobs: [],
          cronJobs: [],
          hpas: [],
          helmReleases: [],
          storageClasses: [],
          persistentVolumes: [],
          persistentVolumeClaims: [],
          podDisruptionBudgets: [],
        };
      },
      goalCheck: (state) => {
        // ConfigMap must exist
        if (!state.configMaps.some(cm => cm.metadata.name === 'api-config')) return false;

        // All deployments healthy: readyReplicas >= spec.replicas
        const deploymentsHealthy = state.deployments.every(
          (d) => (d.status.readyReplicas || 0) >= d.spec.replicas
        );
        if (!deploymentsHealthy) return false;

        // Frontend must have 3+ replicas
        const frontend = state.deployments.find(d => d.metadata.name === 'frontend');
        if (!frontend || frontend.spec.replicas < 3) return false;

        // All services have endpoints
        const servicesHealthy = state.services.every(
          (s) => s.status.endpoints.length > 0
        );
        if (!servicesHealthy) return false;

        return true;
      },
    },
  ],
};
