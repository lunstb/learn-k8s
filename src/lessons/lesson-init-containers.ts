import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lessonInitContainers: Lesson = {
  id: 31,
  title: 'Init Containers',
  description:
    'Init containers run before the main application container starts — used for dependency checks, database migrations, and configuration setup.',
  mode: 'full',
  goalDescription:
    'Apply a Pod with an init container and observe the init → main container lifecycle. Then see what happens when an init container fails.',
  successMessage:
    'You observed init containers running sequentially before the main container. Failed init containers block the pod from starting — a critical pattern for enforcing startup dependencies.',
  yamlTemplate: `apiVersion: v1
kind: Pod
metadata:
  name: app-with-init
  labels:
    app: myapp
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:check-db
  containers:
  - name: app
    image: myapp:1.0`,
  hints: [
    { text: 'Apply the YAML in the editor to create a pod with an init container.' },
    { text: 'Watch the pod status — the init container runs first, then the main container starts.' },
    { text: 'Run `kubectl describe pod app-with-init` to see init container statuses.' },
    { text: 'Now create a pod with a failing init container to see what happens.' },
  ],
  goals: [
    {
      description: 'Pod "app-with-init" exists with an init container',
      check: (s: ClusterState) => {
        return s.pods.some(
          (p) => p.metadata.name === 'app-with-init' && p.spec.initContainers && p.spec.initContainers.length > 0
        );
      },
    },
    {
      description: 'Init container completed successfully',
      check: (s: ClusterState) => {
        const pod = s.pods.find((p) => p.metadata.name === 'app-with-init');
        if (!pod || !pod.status.initContainerStatuses) return false;
        return pod.status.initContainerStatuses.every((ic) => ic.state === 'completed');
      },
    },
    {
      description: 'Main container is Running',
      check: (s: ClusterState) => {
        const pod = s.pods.find((p) => p.metadata.name === 'app-with-init');
        return !!pod && pod.status.phase === 'Running' && !pod.metadata.deletionTimestamp;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'Init Containers: Run Before Main',
        content:
          'Init containers are specialized containers that run before the main application containers start. ' +
          'They run to completion — each init container must finish successfully before the next one starts, ' +
          'and all init containers must succeed before any main container begins.\n\n' +
          '  spec:\n' +
          '    initContainers:\n' +
          '    - name: wait-for-db\n' +
          '      image: busybox\n' +
          '      command: ["sh", "-c", "until nslookup db.default; do sleep 2; done"]\n' +
          '    - name: run-migrations\n' +
          '      image: myapp:migrate\n' +
          '      command: ["./migrate", "--up"]\n' +
          '    containers:\n' +
          '    - name: app\n' +
          '      image: myapp:1.0\n\n' +
          'In this example:\n' +
          '1. wait-for-db polls until the database Service is resolvable via DNS\n' +
          '2. run-migrations applies database schema changes\n' +
          '3. Only after both succeed does the main app container start\n\n' +
          'This ensures the app never starts with an uninitialized database or missing dependencies.',
        keyTakeaway:
          'Init containers run sequentially before main containers. Each must complete successfully. They enforce startup ordering and dependency readiness.',
      },
      {
        title: 'Sequential Execution and Failure',
        content:
          'Init containers execute one at a time, in order. If an init container fails:\n\n' +
          '- If restartPolicy is Always (default for Deployments): Kubernetes restarts the init container. ' +
          'The pod stays in "Init:0/2" status, cycling through restart backoff.\n\n' +
          '- If restartPolicy is Never (common for Jobs): The pod goes to Failed state. ' +
          'No further init containers or main containers run.\n\n' +
          'The pod status shows init progress:\n' +
          '  Init:0/2 → Init:1/2 → PodInitializing → Running\n\n' +
          'If the pod is restarted (e.g., node reboot), ALL init containers run again — they are not idempotent by default. ' +
          'Your init container logic should handle being run multiple times safely.\n\n' +
          'Resource considerations: init containers can request more resources than the main containers. ' +
          'Kubernetes uses the maximum of (init container requests) and (sum of main container requests) for scheduling. ' +
          'This means a CPU-intensive migration init container will not affect the pod\'s steady-state resource allocation.',
        diagram:
          'Pod startup sequence:\\n' +
          '\\n' +
          '  Init Container 1    Init Container 2    Main Container\\n' +
          '  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐\\n' +
          '  │  wait-for-db │───▶│  migrations │───▶│    app      │\\n' +
          '  │  (must pass) │    │  (must pass) │    │  (starts)   │\\n' +
          '  └─────────────┘    └─────────────┘    └─────────────┘\\n' +
          '       ▲ fails?           ▲ fails?\\n' +
          '       │ restart           │ restart\\n' +
          '       └───────┘           └───────┘',
        keyTakeaway:
          'Init containers run sequentially. Failure blocks the pod. Pod restarts re-run all init containers. Design init containers to be idempotent (safe to re-run).',
      },
      {
        title: 'Multi-Container Patterns',
        content:
          'While init containers run before the main container, sidecars run alongside it. ' +
          'Kubernetes defines several multi-container patterns:\n\n' +
          'Sidecar: A helper container that runs alongside the main container. Examples:\n' +
          '- Envoy proxy for service mesh traffic management\n' +
          '- Log collector that ships logs to a central system\n' +
          '- Config reloader that watches for ConfigMap changes\n\n' +
          'Ambassador: A proxy that simplifies access to external services. The main container connects ' +
          'to localhost, and the ambassador forwards to the actual service (e.g., a Redis proxy).\n\n' +
          'Adapter: Transforms the main container\'s output. Example: converting application metrics ' +
          'to Prometheus format.\n\n' +
          'These patterns use shared volumes and the pod\'s shared network namespace. Containers in a pod ' +
          'share localhost — they can communicate via 127.0.0.1 without a Service.\n\n' +
          'Kubernetes 1.28+ introduced native sidecar containers (restartPolicy: Always in initContainers), ' +
          'which start before the main container but keep running alongside it.',
        keyTakeaway:
          'Sidecar (helper alongside main), Ambassador (proxy to external), Adapter (output transformer). All share the pod network and volumes. Native sidecar support was added in K8s 1.28.',
      },
      {
        title: 'Shared Volumes: Data Passing Between Containers',
        content:
          'Init containers commonly use shared volumes to pass data to main containers:\n\n' +
          '  spec:\n' +
          '    initContainers:\n' +
          '    - name: fetch-config\n' +
          '      image: busybox\n' +
          '      command: ["wget", "-O", "/config/app.json", "https://config-server/app.json"]\n' +
          '      volumeMounts:\n' +
          '      - name: config\n' +
          '        mountPath: /config\n' +
          '    containers:\n' +
          '    - name: app\n' +
          '      image: myapp:1.0\n' +
          '      volumeMounts:\n' +
          '      - name: config\n' +
          '        mountPath: /config\n' +
          '    volumes:\n' +
          '    - name: config\n' +
          '      emptyDir: {}\n\n' +
          'The init container fetches configuration and writes it to a shared emptyDir volume. ' +
          'The main container reads the configuration from the same volume.\n\n' +
          'Common patterns:\n' +
          '- Fetch secrets from Vault and write to a shared volume\n' +
          '- Clone a git repository with application configuration\n' +
          '- Generate TLS certificates and write to a volume\n' +
          '- Pre-populate a cache or warm up data files',
        keyTakeaway:
          'Init containers pass data to main containers via shared volumes (emptyDir). Common uses: fetch secrets, clone configs, generate certificates, populate caches.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A pod has 2 init containers: "check-db" and "run-migrations". The "check-db" container fails. What happens to "run-migrations"?',
      choices: [
        'It never runs -- init containers execute sequentially and a failure blocks all subsequent containers',
        'It runs anyway because init containers are independent and do not depend on each other',
        'It runs in parallel with the restart attempt of "check-db" to save startup time',
        'It is skipped, and Kubernetes proceeds directly to starting the main application container',
      ],
      correctIndex: 0,
      explanation:
        'Init containers execute strictly in order. If "check-db" fails, Kubernetes restarts it (assuming restartPolicy: Always). ' +
        '"run-migrations" will not start until "check-db" completes successfully. Only after ALL init containers succeed ' +
        'do the main application containers start. This sequential guarantee is the core value of init containers.',
    },
    {
      question:
        'Your pod is restarted due to a node reboot. The pod has an init container that runs database migrations. What happens?',
      choices: [
        'The init container is skipped because it already completed successfully before the restart',
        'Kubernetes checks whether the init container previously succeeded and only reruns it if it failed',
        'Only the main containers restart -- init containers are a one-time operation at initial pod creation',
        'All init containers re-execute from the beginning -- Kubernetes does not track prior completions',
      ],
      correctIndex: 3,
      explanation:
        'On any pod restart, ALL init containers run again from the beginning. Kubernetes does not track previous ' +
        'init container completions across restarts. This is why init container logic must be idempotent — ' +
        'running migrations twice should not corrupt data. Use techniques like "CREATE TABLE IF NOT EXISTS" ' +
        'or migration tracking tables to handle re-runs safely.',
    },
    {
      question:
        'When should you use an init container instead of adding startup logic to the main container?',
      choices: [
        'Always -- init containers are the recommended Kubernetes pattern for any startup logic',
        'Only when the startup task takes more than 60 seconds and would delay container readiness',
        'When the task needs different tools/images, must block the app from starting, or needs elevated permissions',
        'Init containers are deprecated in favor of startup probes, which handle all pre-start scenarios',
      ],
      correctIndex: 2,
      explanation:
        'Init containers are ideal when: (1) the startup task requires tools not in the main image ' +
        '(e.g., wget, git, migration CLI), (2) the main app must not start until a dependency is confirmed ready, ' +
        'or (3) the init task needs different security contexts (e.g., running as root to set permissions). ' +
        'Simple startup checks (like waiting for a port) can be handled by startup probes instead.',
    },
    {
      question:
        'How do containers within the same pod communicate with each other?',
      choices: [
        'Through localhost (127.0.0.1) -- containers in a pod share the same network namespace',
        'Through a Kubernetes Service that load-balances traffic between pod containers',
        'Via shared environment variables that Kubernetes automatically injects into each container',
        'Through the pod\'s internal DNS name, which resolves each container to a unique IP address',
      ],
      correctIndex: 0,
      explanation:
        'Containers in a pod share the same network namespace, meaning they can reach each other via localhost. ' +
        'If the main container listens on port 8080, a sidecar can reach it at 127.0.0.1:8080. ' +
        'They also share volumes (via volumeMounts) and can share data through the filesystem. ' +
        'This shared environment is what makes multi-container patterns (sidecar, ambassador, adapter) work.',
    },
    {
      question:
        'A pod has an init container requesting 2Gi memory (for database migrations) and a main container requesting 256Mi. How much memory does the scheduler reserve for this pod?',
      choices: [
        '2.25Gi -- the scheduler sums all container requests (init + main) for total pod resource needs',
        '2Gi -- Kubernetes uses max(init container requests, sum of main container requests) for scheduling',
        '256Mi -- only main containers count for scheduling because init containers are temporary',
        '2Gi -- init container requests permanently override the main container\'s resource settings',
      ],
      correctIndex: 1,
      explanation:
        'Kubernetes calculates effective pod resources as: max(max of all init containers, sum of all main containers) for each resource type. ' +
        'Init containers run sequentially (not simultaneously), so only the largest init container matters. Main containers run simultaneously, so they are summed. ' +
        'Here: max(2Gi, 256Mi) = 2Gi. This is clever design: the CPU-intensive migration init container gets its resources during init, ' +
        'but the pod\'s steady-state allocation is based on the main container. The scheduler reserves the higher value to ensure both phases can run.',
    },
    {
      question:
        'An init container fetches a configuration file from a remote server and writes it to /config/app.json. The main container needs to read this file. How do they share data?',
      choices: [
        'Kubernetes automatically shares the entire filesystem between all containers in a pod',
        'The init container writes to stdout and the main container reads it from stdin via a pipe',
        'The main container accesses the init container\'s filesystem layer through a Kubernetes volume driver',
        'Both containers mount the same emptyDir volume -- the init writes to it and the main reads from it',
      ],
      correctIndex: 3,
      explanation:
        'Containers in a pod have isolated filesystems by default. To share data, they must mount the same volume — typically an emptyDir volume. ' +
        'The init container mounts /config backed by the emptyDir, writes app.json to it, then exits. ' +
        'The main container mounts the same emptyDir at /config and reads the file. This pattern is used for: ' +
        'fetching secrets from Vault, cloning git repos, generating TLS certificates, and pre-populating caches.',
    },
  ],
  initialState: () => {
    return {
      pods: [],
      replicaSets: [],
      deployments: [],
      nodes: [
        {
          kind: 'Node' as const,
          metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 10 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 0 },
        },
      ],
      services: [],
      events: [],
    };
  },
  goalCheck: (state: ClusterState) => {
    const pod = state.pods.find((p) => p.metadata.name === 'app-with-init');
    if (!pod) return false;
    if (!pod.status.initContainerStatuses) return false;
    const allInitDone = pod.status.initContainerStatuses.every((ic) => ic.state === 'completed');
    return allInitDone && pod.status.phase === 'Running' && !pod.metadata.deletionTimestamp;
  },
};
