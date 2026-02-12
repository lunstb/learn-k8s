import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonProbes: Lesson = {
  id: 13,
  title: 'Liveness & Readiness Probes',
  description:
    'Probes let Kubernetes automatically detect unhealthy containers and control traffic routing to ensure only ready pods serve requests.',
  mode: 'full',
  goalDescription:
    'The "web" pods are Running but the "web-svc" Service has 0 endpoints because pods lack readiness probes. Delete the deployment, then recreate it with a readinessProbe using kubectl apply with a YAML manifest. The service needs at least 3 ready endpoints.',
  successMessage:
    'All pods passed their readiness probes and the service is routing traffic to all healthy endpoints. ' +
    'Without readiness probes, Running pods may be added to Service endpoints before they are truly ready to serve.',
  lecture: {
    sections: [
      {
        title: 'The Problem: Running Does Not Mean Healthy',
        content:
          'A pod can be in Running status but still not functioning properly. Consider these scenarios:\n\n' +
          'Your web server starts but enters a deadlock — the process is alive, the container is Running, ' +
          'but it cannot serve any requests. Without intervention, traffic keeps going to a broken pod.\n\n' +
          'Your application needs 30 seconds to load a large cache into memory before it can handle requests. ' +
          'During those 30 seconds, the container is Running but not ready. If traffic arrives during startup, ' +
          'users get errors.\n\n' +
          'A database connection is lost. The app is alive but cannot do useful work until reconnected.\n\n' +
          'The "Running" phase tells you the container process started. It says nothing about whether the ' +
          'application inside is actually working. Kubernetes needs a way to ask the application "are you healthy?" ' +
          'and "are you ready to serve traffic?" — those are probes.',
        keyTakeaway:
          'A Running container is not necessarily healthy or ready. Probes let Kubernetes check application-level health, not just process-level existence.',
      },
      {
        title: 'Liveness Probes: Should This Container Be Restarted?',
        content:
          'A liveness probe answers the question: "Is this container still functioning?"\n\n' +
          'Kubernetes periodically executes the liveness probe. If the probe fails a configurable number of times ' +
          '(failureThreshold, default 3), Kubernetes kills the container and restarts it. This is the mechanism ' +
          'behind Kubernetes self-healing for application-level issues.\n\n' +
          'Without a liveness probe, Kubernetes only knows if the process is running. With a liveness probe, ' +
          'it can detect deadlocks, infinite loops, and other states where the process is alive but broken.\n\n' +
          'Important warning: do not make liveness probes depend on external services. If your liveness probe checks ' +
          'database connectivity, and the database goes down, Kubernetes will restart all your pods — making things worse. ' +
          'Liveness probes should check "is this specific container functional?" not "are my dependencies available?"',
        keyTakeaway:
          'Liveness probes detect broken containers and trigger restarts. They should check internal health only — never depend on external services like databases.',
      },
      {
        title: 'Readiness Probes: Should This Container Receive Traffic?',
        content:
          'A readiness probe answers the question: "Is this container ready to serve requests?"\n\n' +
          'When a readiness probe fails, the pod is removed from Service endpoints. Traffic stops flowing to it. ' +
          'The container is NOT restarted — it stays running, and Kubernetes keeps probing. Once the probe passes again, ' +
          'the pod is added back to Service endpoints.\n\n' +
          'This is perfect for two scenarios:\n\n' +
          'Startup: The application needs time to initialize (load caches, warm up connections). ' +
          'The readiness probe fails during startup, keeping the pod out of the Service until it is truly ready.\n\n' +
          'Temporary issues: The application temporarily cannot serve requests (e.g., waiting for a configuration reload). ' +
          'The readiness probe removes it from traffic until it recovers.\n\n' +
          'The key difference from liveness: a failed readiness probe removes traffic but does not restart the container. ' +
          'A failed liveness probe restarts the container.',
        diagram:
          '  Liveness Probe Failure:\n' +
          '  Container broken → probe fails → container RESTARTED\n' +
          '  \n' +
          '  Readiness Probe Failure:\n' +
          '  Container not ready → probe fails → removed from Service endpoints\n' +
          '  Container recovers  → probe passes → added back to endpoints',
        keyTakeaway:
          'Readiness probes control traffic routing. Failed = removed from Service endpoints. Passed = added back. Unlike liveness, readiness does not trigger restarts.',
      },
      {
        title: 'Probe Types: HTTP, TCP, and Exec',
        content:
          'Kubernetes supports three types of probes:\n\n' +
          'HTTP GET: Kubernetes sends an HTTP GET request to a specified path and port. ' +
          'A 2xx or 3xx response means success. Any other response or no response means failure.\n\n' +
          '  livenessProbe:\n' +
          '    httpGet:\n' +
          '      path: /healthz\n' +
          '      port: 8080\n\n' +
          'This is the most common type. Most web applications expose a /healthz or /health endpoint.\n\n' +
          'TCP Socket: Kubernetes tries to open a TCP connection to a specified port. ' +
          'If the connection succeeds, the probe passes. Used for non-HTTP services like databases.\n\n' +
          '  readinessProbe:\n' +
          '    tcpSocket:\n' +
          '      port: 3306\n\n' +
          'Exec: Kubernetes runs a command inside the container. If the command exits with code 0, the probe passes. ' +
          'Used when you need custom health checks.\n\n' +
          '  livenessProbe:\n' +
          '    exec:\n' +
          '      command: ["pg_isready", "-U", "postgres"]',
        keyTakeaway:
          'Choose HTTP probes for web apps, TCP probes for non-HTTP services, and exec probes for custom health checks. HTTP is the most common in practice.',
      },
      {
        title: 'Configuration Parameters',
        content:
          'Each probe has tunable parameters:\n\n' +
          'initialDelaySeconds: How long to wait before the first probe after the container starts. ' +
          'Set this to accommodate your application\'s startup time. Too short = premature failure. ' +
          'Too long = slow detection of startup issues.\n\n' +
          'periodSeconds: How often to run the probe (default 10s). Lower values detect issues faster ' +
          'but add more overhead.\n\n' +
          'failureThreshold: How many consecutive failures before taking action (default 3). ' +
          'Higher values tolerate transient issues but delay detection of real problems.\n\n' +
          'successThreshold: How many consecutive successes to be considered healthy (default 1). ' +
          'Only relevant for readiness probes — useful to ensure the application is truly stable before routing traffic.\n\n' +
          'timeoutSeconds: How long to wait for a probe response (default 1s). If your health endpoint is slow, ' +
          'increase this.\n\n' +
          'A common production configuration: initialDelay=15s, period=10s, failure=3, timeout=3s. ' +
          'This gives the app 15 seconds to start, then checks every 10 seconds and tolerates two brief failures.',
        keyTakeaway:
          'Tune probe parameters to match your application: initialDelaySeconds for startup time, periodSeconds for check frequency, failureThreshold for tolerance. Bad settings cause false positives or slow detection.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Your team configures a liveness probe that checks database connectivity. The database goes down for 2 minutes due to maintenance. What happens to your application pods?',
      choices: [
        'The pods are removed from Service endpoints until the database recovers, then automatically re-added',
        'The pods remain Running and wait for the database to recover, since liveness only checks process existence',
        'Kubernetes detects the external dependency failure and suspends liveness probe checks until it returns',
        'Kubernetes restarts all pods whose liveness probes fail, causing a cascading restart loop during the outage',
      ],
      correctIndex: 3,
      explanation:
        'This is a classic anti-pattern. Because the liveness probe depends on an external service, a database outage causes ALL pods to fail their liveness checks and get restarted simultaneously. ' +
        'The restarted pods immediately fail again (database is still down), creating a restart loop. Liveness probes should only check internal container health — never external dependencies.',
    },
    {
      question:
        'A pod is in Running status, but its readiness probe has been failing for the last 60 seconds. A junior engineer asks if the container will be restarted soon. What is the correct answer?',
      choices: [
        'No -- a failing readiness probe removes the pod from Service endpoints but never triggers a restart',
        'Yes -- after the failureThreshold is exceeded, the kubelet will restart the container automatically',
        'Yes -- but only after the readiness probe has failed for longer than the initialDelaySeconds window',
        'No -- readiness probes are only evaluated during pod startup and have no effect on running containers',
      ],
      correctIndex: 0,
      explanation:
        'This is one of the most common Kubernetes misconceptions. Readiness probes control traffic routing only — a failing readiness probe removes the pod from Service endpoints so it stops receiving traffic, ' +
        'but the container keeps running undisturbed. Only liveness probe failures trigger container restarts. The pod stays Running and can recover on its own.',
    },
    {
      question:
        'You deploy a Java application that takes 45 seconds to initialize its Spring context. The liveness probe is configured with initialDelaySeconds=0, periodSeconds=10, and failureThreshold=3. What happens?',
      choices: [
        'The liveness probe waits for the first successful check before it begins counting failures',
        'The failureThreshold of 3 gives the container 30 seconds (3 x 10s), which is close but the probe adds a grace period',
        'The probe starts immediately, fails 3 times in 30 seconds, and Kubernetes kills the container before startup completes',
        'Kubernetes detects the application is still initializing and automatically extends the initial delay to match',
      ],
      correctIndex: 2,
      explanation:
        'With initialDelaySeconds=0, the liveness probe starts checking immediately. The app needs 45 seconds to start, but the probe fails at ~10s, ~20s, and ~30s — hitting failureThreshold=3. ' +
        'Kubernetes kills the container at ~30s, well before the app is ready. The container restarts and the cycle repeats forever. The fix is to set initialDelaySeconds >= 45 or use a startup probe.',
    },
    {
      question:
        'You have a web service with both liveness and readiness probes. The readiness probe checks the /ready endpoint (which verifies cache warmup), and the liveness probe checks /healthz (which verifies the event loop is responsive). During a deployment, new pods start but take 20 seconds to warm their cache. What behavior do you observe?',
      choices: [
        'New pods receive traffic immediately since they are Running, causing errors for 20 seconds during cache warmup',
        'New pods stay Running but are excluded from Service endpoints during warmup -- users see no errors until readiness passes',
        'New pods are killed and restarted after 20 seconds because both probes fail during cache warmup',
        'The deployment is blocked entirely until all new pods pass both the liveness and readiness probes simultaneously',
      ],
      correctIndex: 1,
      explanation:
        'This is exactly how readiness probes are designed to work during deployments. The new pods start and enter Running state, but since their readiness probe (/ready) fails during cache warmup, ' +
        'they are not added to Service endpoints. The liveness probe (/healthz) passes because the event loop is fine — just the cache is not ready. Users continue hitting old pods until new pods pass readiness. ' +
        'This is why separating liveness from readiness logic is critical for zero-downtime deployments.',
    },
    {
      question:
        'A pod is Running but has readiness probe failures. A Service selects it. Does the pod receive traffic?',
      choices: [
        'Yes — Running pods always receive traffic through Services',
        'No — the pod is removed from the Service endpoints because it is not Ready, so no traffic is routed to it',
        'Yes — readiness probes only affect startup, not ongoing traffic routing',
        'It depends on the Service type (ClusterIP vs NodePort)',
      ],
      correctIndex: 1,
      explanation:
        'A pod must be both Running AND Ready to be included in Service endpoints. Readiness probes continuously check if a pod can handle traffic. ' +
        'When a readiness probe fails, the endpoints controller removes the pod from the Service endpoint list — even though the pod is still Running. ' +
        'This is critical: Running means "the container process exists," while Ready means "the application can serve requests." They are different conditions. ' +
        'This is how Kubernetes achieves zero-downtime deployments — new pods only receive traffic after their readiness probes pass.',
    },
  ],
  practices: [
    {
      title: 'Add Readiness Probes to Fix Endpoints',
      goalDescription:
        'The "web" pods are Running but the "web-svc" Service has 0 endpoints because pods lack readiness probes. Delete the deployment, then recreate it with a readinessProbe using kubectl apply with a YAML manifest. The service needs at least 3 ready endpoints.',
      successMessage:
        'All pods passed their readiness probes and the service is routing traffic to all healthy endpoints. ' +
        'Without readiness probes, Running pods may be added to Service endpoints before they are truly ready to serve.',
      yamlTemplate: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.21
        readinessProbe:
          httpGet:
            path: ???
            port: ???
          initialDelaySeconds: ???
          periodSeconds: ???`,
      hints: [
        { text: 'First delete the existing deployment: kubectl delete deployment web. Then switch to the YAML Editor tab.' },
        { text: 'In the YAML Editor, fill in the readinessProbe: path should be "/", port 80, initialDelaySeconds 1, periodSeconds 5.' },
        { text: 'kubectl delete deployment web', exact: true },
        { text: 'Click Apply in the YAML Editor (or Ctrl+Enter) to create the new deployment with probes.' },
      ],
      goals: [
        {
          description: 'Use "kubectl delete deployment" to remove the old deployment',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('delete-deployment'),
        },
        {
          description: 'Use "kubectl apply" to create the new deployment with probes',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('apply'),
        },
        {
          description: 'Deploy "web" pods with readiness probes configured',
          check: (s: ClusterState) => s.pods.some(p => p.metadata.labels['app'] === 'web' && p.spec.readinessProbe && !p.metadata.deletionTimestamp),
        },
        {
          description: 'At least 3 web pods Running and ready',
          check: (s: ClusterState) => {
            return s.pods.filter(p => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && p.status.ready === true && !p.metadata.deletionTimestamp).length >= 3;
          },
        },
        {
          description: 'Service "web-svc" has at least 3 endpoints',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.metadata.name === 'web-svc');
            return !!svc && svc.status.endpoints.length >= 3;
          },
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        // Pods are Running but NOT ready — no readiness probe configured
        const pods = Array.from({ length: 3 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`web-${hash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'web', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `web-${hash.slice(0, 10)}`,
              uid: rsUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image },
          status: { phase: 'Running' as const, ready: false },
        }));

        return {
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'web',
                uid: depUid,
                labels: { app: 'web' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 3,
                selector: { app: 'web' },
                template: {
                  labels: { app: 'web' },
                  spec: { image },
                },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: {
                replicas: 3,
                updatedReplicas: 3,
                readyReplicas: 0,
                availableReplicas: 0,
                conditions: [],
              },
            },
          ],
          replicaSets: [
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `web-${hash.slice(0, 10)}`,
                uid: rsUid,
                labels: { app: 'web', 'pod-template-hash': hash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'web',
                  uid: depUid,
                },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 3,
                selector: { app: 'web', 'pod-template-hash': hash },
                template: {
                  labels: { app: 'web', 'pod-template-hash': hash },
                  spec: { image },
                },
              },
              status: { replicas: 3, readyReplicas: 0 },
            },
          ],
          pods,
          nodes: [
            {
              kind: 'Node' as const,
              metadata: {
                name: 'node-1',
                uid: generateUID(),
                labels: { 'kubernetes.io/hostname': 'node-1' },
                creationTimestamp: Date.now() - 300000,
              },
              spec: { capacity: { pods: 5 } },
              status: {
                conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
                allocatedPods: 2,
              },
            },
            {
              kind: 'Node' as const,
              metadata: {
                name: 'node-2',
                uid: generateUID(),
                labels: { 'kubernetes.io/hostname': 'node-2' },
                creationTimestamp: Date.now() - 300000,
              },
              spec: { capacity: { pods: 5 } },
              status: {
                conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
                allocatedPods: 1,
              },
            },
          ],
          services: [
            {
              kind: 'Service' as const,
              metadata: {
                name: 'web-svc',
                uid: generateUID(),
                labels: {},
                creationTimestamp: Date.now() - 120000,
              },
              spec: { selector: { app: 'web' }, port: 80 },
              status: { endpoints: [] as string[] },
            },
          ],
          events: [],
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
        };
      },
      afterTick: (_tick: number, state: ClusterState) => {
        // If web pods have a readinessProbe configured and are Running, mark them ready
        const webPods = state.pods.filter(
          (p) =>
            p.metadata.labels['app'] === 'web' &&
            p.status.phase === 'Running' &&
            !p.metadata.deletionTimestamp
        );
        for (const pod of webPods) {
          if (pod.spec.readinessProbe && !pod.status.ready) {
            pod.status.ready = true;
          }
        }
        return state;
      },
      goalCheck: (state: ClusterState) => {
        // All pods must be Running and ready with readiness probes
        const webPods = state.pods.filter(
          (p) =>
            p.metadata.labels['app'] === 'web' &&
            p.status.phase === 'Running' &&
            p.status.ready === true &&
            !p.metadata.deletionTimestamp
        );
        if (webPods.length < 3) return false;

        // Service must have at least 3 endpoints
        const svc = state.services.find((s) => s.metadata.name === 'web-svc');
        if (!svc) return false;

        return svc.status.endpoints.length >= 3;
      },
    },
  ],
};
