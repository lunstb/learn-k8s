import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonConfigMaps: Lesson = {
  id: 10,
  title: 'ConfigMaps',
  description:
    'ConfigMaps decouple configuration from container images, letting you change app behavior without rebuilding.',
  mode: 'full',
  goalDescription:
    'The "web" Deployment pods are stuck in CreateContainerConfigError because they reference a missing ConfigMap. Create a ConfigMap named "app-config" with the key LOG_LEVEL=info to fix them.',
  successMessage:
    'You created the ConfigMap and the pods recovered! Pods that reference missing ConfigMaps enter CreateContainerConfigError. ' +
    'Always create ConfigMaps before deploying pods that depend on them.',
  lecture: {
    sections: [
      {
        title: 'The Problem: Hardcoded Configuration',
        content:
          'Your application needs configuration: database URLs, feature flags, log levels, API keys. ' +
          'The naive approach is to bake these values into the container image. But this creates problems:\n\n' +
          'Different environments need different config. Your staging database URL is not the same as production. ' +
          'If config is in the image, you need a separate image per environment — defeating the point of containers.\n\n' +
          'Config changes require redeployment. Changing a log level from "info" to "debug" should not require ' +
          'rebuilding and redeploying your entire application.\n\n' +
          'Secrets leak into images. If you put database passwords in your Dockerfile, anyone with access to the ' +
          'image registry can read them.\n\n' +
          'The solution is to separate configuration from the application. The container image contains the code; ' +
          'configuration is injected at runtime from an external source.',
        keyTakeaway:
          'Never bake configuration into container images. Externalizing config means one image works across all environments, and config changes do not require rebuilds.',
      },
      {
        title: 'What Is a ConfigMap?',
        content:
          'A ConfigMap is a Kubernetes object that stores non-sensitive configuration data as key-value pairs. ' +
          'Think of it as a dictionary that lives in the cluster and can be referenced by pods.\n\n' +
          'ConfigMaps can hold simple values like:\n\n' +
          '  ENV=production\n' +
          '  LOG_LEVEL=info\n' +
          '  MAX_CONNECTIONS=100\n\n' +
          'They can also hold entire configuration files. You can store an nginx.conf or application.yaml ' +
          'as a single key whose value is the full file content.\n\n' +
          'ConfigMaps are namespace-scoped. A ConfigMap in the "dev" namespace is not visible from the "prod" namespace. ' +
          'This is another reason namespaces are useful — you can have the same ConfigMap name with different values in each environment.',
        keyTakeaway:
          'A ConfigMap is a key-value store for non-sensitive configuration data. It lives in the cluster, is namespace-scoped, and can hold simple strings or entire config files.',
      },
      {
        title: 'Creating ConfigMaps',
        content:
          'There are several ways to create a ConfigMap:\n\n' +
          'From literals (inline key-value pairs):\n' +
          '`kubectl create configmap app-config --from-literal=ENV=production --from-literal=LOG_LEVEL=info`\n\n' +
          'From a file:\n' +
          '`kubectl create configmap nginx-config --from-file=nginx.conf`\n\n' +
          'The file name becomes the key and the file content becomes the value.\n\n' +
          'From a YAML manifest (declarative):\n' +
          '```\n' +
          'apiVersion: v1\n' +
          'kind: ConfigMap\n' +
          'metadata:\n' +
          '  name: app-config\n' +
          'data:\n' +
          '  ENV: production\n' +
          '  LOG_LEVEL: info\n' +
          '```\n\n' +
          'The declarative approach is preferred for production because it can be version-controlled in Git.',
        keyTakeaway:
          'Create ConfigMaps with --from-literal for quick key-value pairs, --from-file for config files, or YAML manifests for version-controlled declarations.',
      },
      {
        title: 'Consuming ConfigMaps in Pods',
        content:
          'Pods consume ConfigMap data in two ways:\n\n' +
          'As environment variables: Each key becomes an environment variable in the container. ' +
          'Use envFrom to load all keys, or env with valueFrom to pick specific ones:\n\n' +
          '  envFrom:\n' +
          '    - configMapRef:\n' +
          '        name: app-config\n\n' +
          'This makes ENV=production and LOG_LEVEL=info available as environment variables inside the container.\n\n' +
          'As mounted files: The ConfigMap is mounted as a volume. Each key becomes a file, ' +
          'with the value as the file content. This is ideal for config files like nginx.conf.\n\n' +
          '  volumes:\n' +
          '    - name: config-volume\n' +
          '      configMap:\n' +
          '        name: nginx-config\n\n' +
          'Important: If a pod references a ConfigMap that does not exist, the pod will not start. ' +
          'Make sure ConfigMaps are created before the pods that need them.',
        diagram:
          'ConfigMap "app-config"\n' +
          '┌──────────────────┐\n' +
          '│ LOG_LEVEL=debug   │\n' +
          '│ DB_HOST=postgres  │\n' +
          '└────────┬─────────┘\n' +
          '         │\n' +
          '    ┌────┴────┐\n' +
          '    │         │\n' +
          '  env vars  volume mount\n' +
          '    │         │\n' +
          '    ▼         ▼\n' +
          '  $LOG_LEVEL  /config/LOG_LEVEL\n' +
          '  (immutable) (auto-updates)',
        keyTakeaway:
          'ConfigMaps can be consumed as environment variables (envFrom or valueFrom) or as mounted files (volume mount). Always create the ConfigMap before creating pods that reference it.',
      },
      {
        title: 'Updating Configuration',
        content:
          'What happens when you update a ConfigMap? It depends on how the pod consumes it:\n\n' +
          'Environment variables: NOT updated automatically. Environment variables are set when the container starts ' +
          'and do not change during the pod\'s lifetime. You need to restart the pod (e.g., by doing a rollout restart) ' +
          'to pick up new values.\n\n' +
          'Mounted volumes: Updated automatically (with a delay). Kubernetes syncs mounted ConfigMap files periodically, ' +
          'typically within a minute. But the application must be written to detect and reload the file.\n\n' +
          'The safest approach for config changes is to create a new ConfigMap with a different name (e.g., app-config-v2), ' +
          'update the pod spec to reference the new name, and let the rolling update mechanism deploy the change. ' +
          'This gives you the full rollout safety — gradual replacement, automatic rollback on failure.',
        keyTakeaway:
          'Environment variable ConfigMaps require pod restarts to pick up changes. Volume-mounted ConfigMaps auto-update but the app must detect changes. For production, use rolling updates with new ConfigMap versions.',
      },
    ],
  },
  quiz: [
    {
      question:
        'You update a ConfigMap that pods consume via environment variables. Pods are still running. Do the pods see the new values?',
      choices: [
        'No -- env vars are set at container start and never change; you must restart pods to pick up new values',
        'Yes -- Kubernetes injects updated environment variables into running containers within seconds',
        'Yes -- but only after the kubelet syncs the change, typically within about 60 seconds',
        'No -- you must delete and recreate the ConfigMap, then restart the pods for either method',
      ],
      correctIndex: 0,
      explanation:
        'Environment variables are injected into the container process at startup and are immutable for the lifetime of that container. Updating the ConfigMap has no effect on already-running pods that consume it via env vars. You need a pod restart (e.g., "kubectl rollout restart deployment/myapp") to pick up changes. This is one of the most common operational surprises in Kubernetes. Contrast this with volume-mounted ConfigMaps, which DO auto-update.',
    },
    {
      question:
        'You update a ConfigMap that pods consume via a volume mount (not env vars). Do the running pods eventually see the new values?',
      choices: [
        'No -- volume-mounted ConfigMaps are read-only snapshots taken at pod creation time and never refresh',
        'No -- volume mounts behave identically to env vars; both require full pod restarts to pick up changes',
        'Yes -- the kubelet automatically restarts the container to pick up the new mounted file contents',
        'Yes -- the kubelet periodically syncs the mounted files (within about a minute), but the app must detect and reload',
      ],
      correctIndex: 3,
      explanation:
        'Volume-mounted ConfigMaps are updated automatically by the kubelet, with a sync period that defaults to roughly 60 seconds. The files in the mount point are replaced with the new content. However, the application inside the container must be designed to re-read the files -- many applications only read config at startup. This is a critical difference from env var consumption: volumes auto-update, env vars do not. For applications that cannot hot-reload, the safest approach is to create a new ConfigMap name (e.g., app-config-v2) and do a rolling update.',
    },
    {
      question:
        'A pod spec references a ConfigMap named "db-config" using envFrom. You deploy the pod, but it stays in "CreateContainerConfigError" status. What is the most likely cause?',
      choices: [
        'The ConfigMap "db-config" has keys with characters invalid for environment variable names (dots or dashes)',
        'The ConfigMap "db-config" does not exist yet -- pods referencing missing ConfigMaps fail to start',
        'The ConfigMap is in a different namespace than the pod, so the kubelet cannot resolve the reference',
        'The pod\'s ServiceAccount lacks RBAC permission to read ConfigMaps in this namespace',
      ],
      correctIndex: 1,
      explanation:
        'If a pod references a ConfigMap (or Secret) that does not exist, the container cannot be created and the pod enters "CreateContainerConfigError" status. This is a hard dependency -- the kubelet will not start the container without the referenced ConfigMap. Invalid env var name characters (keys with dots or dashes) are a real issue, but that produces a different error. Missing RBAC permissions for ConfigMap access is also valid in theory, but ConfigMaps are namespace-scoped and the most common cause is simply a missing ConfigMap. The key lesson: always create ConfigMaps before deploying pods that depend on them.',
    },
    {
      question:
        'Your team wants to change the LOG_LEVEL from "info" to "debug" in production without any pod restarts or downtime. The app reads its config from a file at /etc/config/settings.yaml and watches it for changes. How should you deliver this config?',
      choices: [
        'Store LOG_LEVEL in an env var from the ConfigMap and run "kubectl rollout restart" to apply the change',
        'Use "kubectl exec" to edit the settings file directly inside each running container instance',
        'Mount the ConfigMap as a volume at /etc/config -- updating the ConfigMap auto-syncs the file for the app',
        'Create a new Deployment revision with the updated LOG_LEVEL baked into the container image',
      ],
      correctIndex: 2,
      explanation:
        'Since the application already watches for file changes, mounting the ConfigMap as a volume is the ideal approach. When you update the ConfigMap, the kubelet syncs the mounted files (with a brief delay), and the app detects and applies the change -- no restart needed. Storing the value as an env var and doing a rollout restart would require a restart since env vars are immutable. Using "kubectl exec" to edit files directly and baking config into a new container image are both manual, error-prone, and would be lost when pods are rescheduled. This is the main advantage of volume-mounted ConfigMaps when your app supports hot-reloading.',
    },
  ],
  practices: [
    {
      title: 'Fix a Missing ConfigMap',
      goalDescription:
        'The "web" Deployment pods are stuck in CreateContainerConfigError because they reference a missing ConfigMap. Create a ConfigMap named "app-config" with the key LOG_LEVEL=info to fix them.',
      successMessage:
        'You created the ConfigMap and the pods recovered! Pods that reference missing ConfigMaps enter CreateContainerConfigError. ' +
        'Always create ConfigMaps before deploying pods that depend on them.',
      hints: [
        { text: 'Run "kubectl get pods" to see the error status, then "kubectl describe pod <name>" to see exactly which ConfigMap is missing.' },
        { text: 'The syntax is: kubectl create configmap <name> --from-literal=<key>=<value>' },
        { text: 'kubectl create configmap app-config --from-literal=LOG_LEVEL=info', exact: true },
      ],
      goals: [
        {
          description: 'Create the missing ConfigMap',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('create-configmap'),
        },
        {
          description: 'ConfigMap "app-config" has key LOG_LEVEL=info',
          check: (s: ClusterState) => {
            const cm = s.configMaps.find(c => c.metadata.name === 'app-config');
            return !!cm && cm.data['LOG_LEVEL'] !== undefined;
          },
        },
        {
          description: 'All "web" pods Running (no longer stuck)',
          check: (s: ClusterState) => {
            return s.pods.filter(p => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length >= 2;
          },
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        const pods = Array.from({ length: 2 }, () => ({
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
          spec: { image, envFrom: [{ configMapRef: 'app-config' }] },
          status: { phase: 'Pending' as const, reason: 'CreateContainerConfigError', message: 'configmap "app-config" not found' },
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
                replicas: 2,
                selector: { app: 'web' },
                template: {
                  labels: { app: 'web' },
                  spec: { image, envFrom: [{ configMapRef: 'app-config' }] },
                },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: {
                replicas: 2,
                updatedReplicas: 0,
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
                replicas: 2,
                selector: { app: 'web', 'pod-template-hash': hash },
                template: {
                  labels: { app: 'web', 'pod-template-hash': hash },
                  spec: { image, envFrom: [{ configMapRef: 'app-config' }] },
                },
              },
              status: { replicas: 2, readyReplicas: 0 },
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
                allocatedPods: 1,
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
          services: [],
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
      goalCheck: (state) => {
        // ConfigMap must exist with correct key
        const cm = state.configMaps.find((c) => c.metadata.name === 'app-config');
        if (!cm) return false;
        if (Object.keys(cm.data).length < 1) return false;

        // Web pods must be Running
        const webPods = state.pods.filter(
          (p) => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
        );
        return webPods.length >= 2;
      },
    },
    {
      title: 'Update a ConfigMap and Restart Pods',
      goalDescription:
        'The "app-settings" ConfigMap has LOG_LEVEL=warning. Update it to LOG_LEVEL=debug and FEATURE_FLAG=true, then restart the deployment so pods pick up the new values.',
      successMessage:
        'ConfigMap updated and pods restarted. Remember: environment variable changes from ConfigMaps require a pod restart. Volume-mounted ConfigMaps update automatically, but env vars are set at container start.',
      hints: [
        { text: 'To update a ConfigMap, delete and recreate it, or use kubectl apply with YAML.' },
        { text: 'kubectl delete configmap app-settings && kubectl create configmap app-settings --from-literal=LOG_LEVEL=debug --from-literal=FEATURE_FLAG=true', exact: true },
        { text: 'Environment variables from ConfigMaps are set at container start. You need to restart pods.' },
        { text: 'kubectl rollout restart deployment/web', exact: true },
      ],
      goals: [
        {
          description: 'Update ConfigMap LOG_LEVEL to "debug"',
          check: (s: ClusterState) => {
            const cm = s.configMaps.find(c => c.metadata.name === 'app-settings');
            return !!cm && cm.data['LOG_LEVEL'] === 'debug';
          },
        },
        {
          description: 'Update ConfigMap FEATURE_FLAG to "true"',
          check: (s: ClusterState) => {
            const cm = s.configMaps.find(c => c.metadata.name === 'app-settings');
            return !!cm && cm.data['FEATURE_FLAG'] === 'true';
          },
        },
        {
          description: 'Restart the deployment with "kubectl rollout restart"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('rollout-restart'),
        },
        {
          description: 'All "web" pods Running',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'web');
            return !!dep && (dep.status.readyReplicas || 0) >= 2;
          },
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        const pods = Array.from({ length: 2 }, () => ({
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
          spec: { image, envFrom: [{ configMapRef: 'app-settings' }] },
          status: { phase: 'Running' as const },
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
                replicas: 2,
                selector: { app: 'web' },
                template: {
                  labels: { app: 'web' },
                  spec: { image, envFrom: [{ configMapRef: 'app-settings' }] },
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
                replicas: 2,
                selector: { app: 'web', 'pod-template-hash': hash },
                template: {
                  labels: { app: 'web', 'pod-template-hash': hash },
                  spec: { image, envFrom: [{ configMapRef: 'app-settings' }] },
                },
              },
              status: { replicas: 2, readyReplicas: 2 },
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
                allocatedPods: 1,
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
          services: [],
          events: [],
          namespaces: [],
          configMaps: [
            {
              kind: 'ConfigMap' as const,
              metadata: {
                name: 'app-settings',
                uid: generateUID(),
                labels: {},
                creationTimestamp: Date.now() - 180000,
              },
              data: { LOG_LEVEL: 'warning', FEATURE_FLAG: 'false' },
            },
          ],
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
      goalCheck: (state) => {
        const cm = state.configMaps.find((c) => c.metadata.name === 'app-settings');
        if (!cm) return false;
        if (cm.data['LOG_LEVEL'] !== 'debug' || cm.data['FEATURE_FLAG'] !== 'true') return false;

        const dep = state.deployments.find((d) => d.metadata.name === 'web');
        if (!dep) return false;
        return (dep.status.readyReplicas || 0) >= 2;
      },
    },
  ],
};
