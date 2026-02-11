import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonStartupShutdown: Lesson = {
  id: 32,
  title: 'Startup Probes & Graceful Shutdown',
  description:
    'Startup probes solve the slow-start problem — preventing liveness probes from killing containers that need time to initialize. Learn the full shutdown sequence too.',
  mode: 'full',
  goalDescription:
    'First observe a slow-starting app get killed by its liveness probe. Then add a startup probe to fix it. The pod should start successfully.',
  successMessage:
    'The startup probe protected the slow-starting container from premature liveness kills. The pod started successfully and became ready.',
  yamlTemplate: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: slow-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: slow-app
  template:
    metadata:
      labels:
        app: slow-app
    spec:
      containers:
      - name: slow-app
        image: slow-start:1.0
        startupProbe:
          httpGet:
            path: /healthz
            port: 8080
          failureThreshold: 10
          periodSeconds: 2
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          periodSeconds: 5
          failureThreshold: 3`,
  hints: [
    { text: 'First observe the problem: run `kubectl get pods` and watch the slow-app-broken pod get killed.' },
    { text: 'The broken deployment has a liveness probe but no startup probe — the app needs 6+ ticks to start.' },
    { text: 'Delete the broken deployment: `kubectl delete deployment slow-app-broken`' },
    { text: 'Apply the YAML from the editor — it has a startup probe with failureThreshold=10 and periodSeconds=2.' },
  ],
  goals: [
    {
      description: 'Observe broken pod get killed by liveness probe',
      check: (s: ClusterState) => {
        // The broken pod has been restarted at least once
        return s.pods.some(
          (p) => p.metadata.labels['app'] === 'slow-app-broken' && (p.status.restartCount || 0) >= 1
        );
      },
    },
    {
      description: 'Deploy slow-app with startup probe',
      check: (s: ClusterState) => {
        return s.deployments.some((d) => d.metadata.name === 'slow-app');
      },
    },
    {
      description: 'slow-app pod starts successfully (Running and ready)',
      check: (s: ClusterState) => {
        return s.pods.some(
          (p) =>
            p.metadata.labels['app'] === 'slow-app' &&
            p.status.phase === 'Running' &&
            p.status.ready === true &&
            !p.metadata.deletionTimestamp
        );
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Slow-Start Problem',
        content:
          'Many applications need significant time to start:\n' +
          '- Java/Spring Boot apps: 30-90 seconds for context initialization\n' +
          '- Machine learning models: minutes to load weights into memory\n' +
          '- Legacy monoliths: warm up caches, establish connection pools\n\n' +
          'If you configure a liveness probe with initialDelaySeconds=10 and failureThreshold=3, ' +
          'Kubernetes starts checking at 10 seconds. If the app needs 60 seconds to start, the liveness ' +
          'probe fails 3 times by ~40 seconds and Kubernetes kills the container. The container restarts, ' +
          'starts its 60-second initialization again, and gets killed again. This creates a permanent crash loop.\n\n' +
          'The naive fix is to set a very large initialDelaySeconds (e.g., 120s). But this means Kubernetes ' +
          'cannot detect a real deadlock for 120 seconds after startup. If the app starts in 5 seconds ' +
          'and then deadlocks at second 30, it takes until second 120 for the liveness probe to start checking.\n\n' +
          'Startup probes solve this: they run INSTEAD of liveness probes during startup, with their own ' +
          '(longer) failure threshold. Once the startup probe passes, liveness takes over with aggressive checking.',
        keyTakeaway:
          'Slow-starting apps get killed by liveness probes. Large initialDelaySeconds delays deadlock detection. Startup probes provide a separate, generous startup window without compromising runtime health checking.',
      },
      {
        title: 'Startup Probes: How They Work',
        content:
          'A startup probe runs during container startup. While it is active:\n' +
          '- The liveness probe is SUSPENDED (not running)\n' +
          '- The readiness probe is SUSPENDED (pod stays not-ready)\n\n' +
          'The startup probe keeps checking until:\n' +
          '- It succeeds → startup probe is disabled, liveness and readiness probes activate\n' +
          '- It fails `failureThreshold` times → the container is killed and restarted\n\n' +
          '  startupProbe:\n' +
          '    httpGet:\n' +
          '      path: /healthz\n' +
          '      port: 8080\n' +
          '    failureThreshold: 30\n' +
          '    periodSeconds: 2\n\n' +
          'This gives the app up to 30 × 2 = 60 seconds to start. The probe checks every 2 seconds. ' +
          'As soon as /healthz returns 200, the startup probe passes and liveness takes over.\n\n' +
          'If the app starts in 10 seconds, liveness begins at second 10 — not second 60. ' +
          'This is the key advantage over large initialDelaySeconds: the transition is immediate ' +
          'once the app is ready.\n\n' +
          'Common startup probe: same endpoint as liveness but with a higher failureThreshold.',
        keyTakeaway:
          'Startup probes suspend liveness/readiness until they pass. Use failureThreshold × periodSeconds to define the maximum startup window. Once passed, liveness activates immediately.',
      },
      {
        title: 'The Shutdown Sequence',
        content:
          'When Kubernetes decides to terminate a pod (scaling down, rolling update, drain), it follows a precise sequence:\n\n' +
          '1. Pod is marked for deletion (status.deletionTimestamp is set)\n' +
          '2. Pod is removed from Service endpoints IMMEDIATELY (no more traffic)\n' +
          '3. preStop hook runs (if configured) — a command or HTTP call\n' +
          '4. SIGTERM is sent to the main process (PID 1 in the container)\n' +
          '5. The app has terminationGracePeriodSeconds (default 30s) to shut down gracefully\n' +
          '6. If still running after the grace period, SIGKILL is sent (force kill)\n\n' +
          'Steps 2 and 3-4 happen IN PARALLEL. This is critical: the endpoint removal (step 2) propagates ' +
          'through kube-proxy/iptables asynchronously. There is a brief window where the pod is terminating ' +
          'but still receiving traffic from stale endpoint rules.\n\n' +
          'This is why preStop hooks with a small sleep are common:\n' +
          '  lifecycle:\n' +
          '    preStop:\n' +
          '      exec:\n' +
          '        command: ["sleep", "5"]\n\n' +
          'The 5-second sleep gives kube-proxy time to remove the endpoint before the app starts shutting down.',
        diagram:
          'Pod shutdown sequence:\n' +
          '\n' +
          '  1. Pod marked for deletion\n' +
          '     │\n' +
          '  2. Removed from Service endpoints (parallel)\n' +
          '     │\n' +
          '  3. preStop hook runs (if defined)\n' +
          '     │\n' +
          '  4. SIGTERM sent to container\n' +
          '     │\n' +
          '  5. Grace period countdown (default 30s)\n' +
          '     │\n' +
          '  6. SIGKILL if still running',
        keyTakeaway:
          'Shutdown: endpoints removed + SIGTERM sent in parallel. preStop hooks delay SIGTERM to allow endpoint propagation. terminationGracePeriodSeconds defines the maximum shutdown window.',
      },
      {
        title: 'When to Use Which Probe',
        content:
          'Choosing the right probe combination:\n\n' +
          'Startup probe: Use when your app takes more than a few seconds to start. ' +
          'Set failureThreshold × periodSeconds ≥ maximum startup time.\n\n' +
          'Liveness probe: Use for long-running services that can deadlock or enter unrecoverable states. ' +
          'Do NOT use for apps that crash-exit on failure (let restartPolicy handle that). ' +
          'Do NOT check external dependencies (databases, APIs).\n\n' +
          'Readiness probe: Use when your app can temporarily be unable to serve traffic ' +
          '(warmup, overloaded, dependent service down). Traffic is removed but the container keeps running.\n\n' +
          'Common combinations:\n' +
          '- Web API: startup + readiness + liveness (all three)\n' +
          '- Worker/consumer: startup + liveness (no readiness — not serving HTTP)\n' +
          '- Simple microservice (fast start): readiness + liveness (no startup needed)\n' +
          '- Batch job: none (let it run to completion or crash)\n\n' +
          'terminationGracePeriodSeconds: Increase for apps that need time to drain connections ' +
          'or finish in-flight work. Default 30s is often too short for database connections.',
        keyTakeaway:
          'Startup: slow-starting apps. Liveness: deadlock/hang detection (internal only). Readiness: traffic control. Most production services use all three. Increase grace period for graceful shutdown.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Your app takes 45 seconds to start. You configure: startupProbe (failureThreshold=30, periodSeconds=2) and livenessProbe (periodSeconds=5, failureThreshold=3). The app starts successfully at second 44. When does the liveness probe first run?',
      choices: [
        'Around second 44-46 — once the startup probe succeeds, liveness activates on the next check interval',
        'At second 60, because the full 30 x 2 = 60 second startup window must elapse before liveness begins',
        'At second 0, since liveness runs in parallel with the startup probe from container creation onward',
        'At second 45 plus the initialDelaySeconds value configured on the liveness probe definition',
      ],
      correctIndex: 0,
      explanation:
        'The startup probe checks every 2 seconds. When it succeeds at ~second 44, it is immediately disabled ' +
        'and the liveness probe activates. The liveness probe starts its first check within the next periodSeconds (5s) ' +
        'interval. The full 60-second startup window is a maximum, not a wait time — early success means early transition.',
    },
    {
      question:
        'During a rolling update, a pod receives SIGTERM. What is the correct order of events?',
      choices: [
        'SIGTERM is sent first, the app shuts down, then the pod is removed from Service endpoints afterward',
        'Endpoint removal AND preStop/SIGTERM happen in parallel, then the grace period runs, then SIGKILL if still alive',
        'All traffic is drained from the pod first, then preStop runs, then SIGTERM is sent, then endpoints are removed',
        'Liveness probe is disabled, then readiness probe is disabled, then SIGTERM is sent, then endpoints are removed',
      ],
      correctIndex: 1,
      explanation:
        'The endpoint removal and the preStop/SIGTERM sequence happen in parallel, not sequentially. ' +
        'This is why a preStop sleep is important — it gives time for endpoint removal to propagate through ' +
        'kube-proxy on all nodes before the app actually starts shutting down. Without this, the app may receive ' +
        'traffic for a few seconds after it has started its shutdown sequence.',
    },
    {
      question:
        'A Java Spring Boot app takes 90 seconds to start. Which probe configuration is correct?',
      choices: [
        'livenessProbe with initialDelaySeconds=120 to give the app enough time to fully initialize before checks begin',
        'readinessProbe with initialDelaySeconds=90 to prevent traffic from arriving until the Spring context loads',
        'startupProbe (failureThreshold=50, periodSeconds=2) plus livenessProbe (periodSeconds=10, failureThreshold=3)',
        'livenessProbe and readinessProbe both with a 90-second initialDelaySeconds to match the known startup time',
      ],
      correctIndex: 2,
      explanation:
        'The startup probe gives 50 × 2 = 100 seconds for startup (safely above 90). Once the app is ready, ' +
        'the startup probe passes and liveness begins checking every 10 seconds. Option A delays deadlock detection ' +
        'by 120 seconds for every pod restart. Option C only controls traffic, not restart-on-hang. ' +
        'The startup + liveness combination gives generous startup time with aggressive runtime health checking.',
    },
    {
      question:
        'Your service handles long-running requests that take up to 60 seconds. The default terminationGracePeriodSeconds is 30. What happens during a rolling update?',
      choices: [
        'Kubernetes waits for all in-flight requests to finish regardless of the configured grace period setting',
        'The pod enters a draining state that pauses the grace period countdown until active connections are closed',
        'The ingress controller holds pending requests and transparently replays them against the replacement pod',
        'After 30 seconds, SIGKILL terminates the process and any in-flight requests exceeding 30 seconds are dropped',
      ],
      correctIndex: 3,
      explanation:
        'terminationGracePeriodSeconds is a hard deadline. After 30 seconds, SIGKILL forcefully kills the process. ' +
        'Any in-flight requests longer than 30 seconds are terminated. The fix: increase terminationGracePeriodSeconds ' +
        'to at least 60-90 seconds, and ensure your app handles SIGTERM by stopping new request acceptance ' +
        'while finishing in-flight work (graceful shutdown).',
    },
    {
      question:
        'A pod is being terminated. Kubernetes sends SIGTERM to the container. The container has a graceful shutdown handler that takes 45 seconds to drain connections. The default terminationGracePeriodSeconds is 30. What happens?',
      choices: [
        'Kubernetes waits the full 45 seconds because graceful shutdown handlers always run to completion',
        'After 30 seconds, Kubernetes sends SIGKILL to forcefully stop the container — the remaining 15 seconds of cleanup are lost',
        'The container is immediately killed with SIGKILL since no explicit grace period override was configured',
        'Kubernetes detects the active connections and extends the grace period until the drain completes',
      ],
      correctIndex: 1,
      explanation:
        'When a pod is terminated, Kubernetes sends SIGTERM and starts a countdown based on terminationGracePeriodSeconds (default: 30s). ' +
        'If the container is still running after 30 seconds, Kubernetes sends SIGKILL — an immediate, non-catchable kill signal. ' +
        'The remaining 15 seconds of the 45-second drain are lost. To fix this, increase terminationGracePeriodSeconds in the pod spec to at least 45. ' +
        'This is a common production issue: applications with slow shutdown (draining connections, flushing buffers) need a longer grace period.',
    },
  ],
  initialState: () => {
    // Pre-populate with a "broken" deployment that has no startup probe
    // The slow-starting image will get killed by liveness before it finishes starting
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'slow-start:1.0';
    const hash = templateHash({ image });

    const podName = generatePodName(`slow-app-broken-${hash.slice(0, 10)}`);
    const pods = [
      {
        kind: 'Pod' as const,
        metadata: {
          name: podName,
          uid: generateUID(),
          labels: { app: 'slow-app-broken', 'pod-template-hash': hash },
          ownerReference: { kind: 'ReplicaSet', name: `slow-app-broken-${hash.slice(0, 10)}`, uid: rsUid },
          creationTimestamp: Date.now() - 60000,
        },
        spec: {
          image,
          nodeName: 'node-1',
          livenessProbe: {
            type: 'httpGet' as const,
            path: '/healthz',
            port: 8080,
            periodSeconds: 2,
            failureThreshold: 3,
          },
        },
        // Start as Running but will be killed by afterTick liveness simulation
        status: { phase: 'Running' as const, ready: false, tickCreated: -1 },
      },
    ];

    return {
      pods,
      deployments: [
        {
          kind: 'Deployment' as const,
          metadata: { name: 'slow-app-broken', uid: depUid, labels: { app: 'slow-app-broken' }, creationTimestamp: Date.now() - 120000 },
          spec: {
            replicas: 1,
            selector: { app: 'slow-app-broken' },
            template: {
              labels: { app: 'slow-app-broken', 'pod-template-hash': hash },
              spec: {
                image,
                livenessProbe: {
                  type: 'httpGet' as const,
                  path: '/healthz',
                  port: 8080,
                  periodSeconds: 2,
                  failureThreshold: 3,
                },
              },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: { replicas: 1, updatedReplicas: 1, readyReplicas: 0, availableReplicas: 0, conditions: [] },
        },
      ],
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `slow-app-broken-${hash.slice(0, 10)}`, uid: rsUid,
            labels: { app: 'slow-app-broken', 'pod-template-hash': hash },
            ownerReference: { kind: 'Deployment', name: 'slow-app-broken', uid: depUid },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 1, selector: { app: 'slow-app-broken', 'pod-template-hash': hash },
            template: {
              labels: { app: 'slow-app-broken', 'pod-template-hash': hash },
              spec: {
                image,
                livenessProbe: {
                  type: 'httpGet' as const,
                  path: '/healthz',
                  port: 8080,
                  periodSeconds: 2,
                  failureThreshold: 3,
                },
              },
            },
          },
          status: { replicas: 1, readyReplicas: 0 },
        },
      ],
      nodes: [
        {
          kind: 'Node' as const,
          metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
        },
      ],
      services: [],
      events: [],
    };
  },
  afterTick: (tick, state) => {
    // Simulate liveness probe killing slow-starting pods (no startup probe)
    for (const pod of state.pods) {
      if (pod.metadata.labels['app'] === 'slow-app-broken' && pod.status.phase === 'Running' && !pod.metadata.deletionTimestamp) {
        // The "slow start" app needs 8+ ticks to become ready
        // With liveness periodSeconds=2 and failureThreshold=3, it gets killed at tick ~6
        const age = tick - (pod.status.tickCreated || 0);
        if (age >= 6 && !pod.status.ready) {
          // Liveness probe kills the container
          pod.status.phase = 'CrashLoopBackOff';
          pod.status.reason = 'CrashLoopBackOff';
          pod.status.message = 'Liveness probe failed: container killed before startup completed';
          pod.status.restartCount = (pod.status.restartCount || 0) + 1;
          if (!pod.spec.logs) pod.spec.logs = [];
          pod.spec.logs.push(`[liveness] Probe failed — container killed (app was still starting)`);
          state.events.push({
            timestamp: Date.now(), tick, type: 'Warning', reason: 'Unhealthy',
            objectKind: 'Pod', objectName: pod.metadata.name,
            message: `Liveness probe failed: container killed before startup completed (restart #${pod.status.restartCount})`,
          });
        }
      }

      // Slow-app with startup probe: becomes ready after startup probe threshold
      if (pod.metadata.labels['app'] === 'slow-app' && pod.status.phase === 'Running' && !pod.metadata.deletionTimestamp) {
        const age = tick - (pod.status.tickCreated || 0);
        // Simulate slow start: the app becomes ready after 8 ticks
        if (age >= 8 && !pod.status.ready) {
          pod.status.startupProbeCompleted = true;
          pod.status.ready = true;
          if (!pod.spec.logs) pod.spec.logs = [];
          pod.spec.logs.push(`[app] Application initialization complete — ready to serve`);
        }
      }
    }
    return state;
  },
  goalCheck: (state: ClusterState) => {
    // Goal 1: broken pod has been restarted
    const brokenRestarted = state.pods.some(
      (p) => p.metadata.labels['app'] === 'slow-app-broken' && (p.status.restartCount || 0) >= 1
    );

    // Goal 2: slow-app deployment exists
    const hasSlowApp = state.deployments.some((d) => d.metadata.name === 'slow-app');

    // Goal 3: slow-app pod is running and ready
    const slowAppReady = state.pods.some(
      (p) =>
        p.metadata.labels['app'] === 'slow-app' &&
        p.status.phase === 'Running' &&
        p.status.ready === true &&
        !p.metadata.deletionTimestamp
    );

    return brokenRestarted && hasSlowApp && slowAppReady;
  },
};
