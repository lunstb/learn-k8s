import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonSecrets: Lesson = {
  id: 11,
  title: 'Secrets',
  description:
    'Secrets store sensitive data like passwords and API keys separately from application code and ConfigMaps.',
  mode: 'full',
  goalDescription:
    'The "db-app" Deployment pods are stuck in CreateContainerConfigError because they reference a missing Secret named "db-credentials". Create the Secret with at least one key-value pair to fix them.',
  successMessage:
    'You created the Secret and the pods recovered! Just like ConfigMaps, pods that reference missing Secrets enter CreateContainerConfigError. ' +
    'Remember: Secrets are base64-encoded, not encrypted — use external solutions for true encryption at rest.',
  lecture: {
    sections: [
      {
        title: 'The Problem: Sensitive Data Needs Special Handling',
        content:
          'In the previous lesson, you learned to externalize configuration with ConfigMaps. But what about ' +
          'passwords, API tokens, TLS certificates, and SSH keys? These cannot be treated the same as a log level or ' +
          'environment name.\n\n' +
          'ConfigMaps are stored in plain text and are visible to anyone with read access to the namespace. ' +
          'Putting a database password in a ConfigMap is like writing it on a whiteboard — technically accessible ' +
          'to anyone who walks by.\n\n' +
          'Kubernetes provides Secrets as a separate resource type specifically for sensitive data. Secrets have ' +
          'a few key differences from ConfigMaps: they are base64-encoded (not encrypted by default, but obscured), ' +
          'they can be restricted with RBAC so only specific pods and users can read them, and they are stored in ' +
          'memory on nodes (tmpfs) rather than being written to disk when mounted as volumes.',
        diagram:
          'ConfigMap                    Secret\n' +
          '┌────────────────┐          ┌────────────────┐\n' +
          '│ Plain text     │          │ Base64 encoded  │\n' +
          '│ No RBAC needed │          │ RBAC restricted │\n' +
          '│ Stored on disk │          │ tmpfs in memory │\n' +
          '│                │          │ Size limit: 1MB │\n' +
          '└────────────────┘          └────────────────┘\n' +
          '  Use for: config,            Use for: passwords,\n' +
          '  feature flags               tokens, TLS certs',
        keyTakeaway:
          'Secrets exist because sensitive data needs different handling than regular config. They provide obscuring, RBAC integration, and in-memory storage that ConfigMaps do not.',
      },
      {
        title: 'Base64 Encoding: Not Encryption',
        content:
          'A critical misconception: base64 encoding is NOT encryption. It is a reversible encoding scheme — ' +
          'anyone can decode it with a single command:\n\n' +
          '`echo "cGFzc3dvcmQ=" | base64 -d`  →  password\n\n' +
          'Kubernetes stores Secret values as base64 because the YAML format needs to safely represent binary data ' +
          '(like TLS certificates) as text. It is not a security measure.\n\n' +
          'For actual encryption at rest, you need to configure envelope encryption in the API server or use ' +
          'an external secrets manager like HashiCorp Vault, AWS Secrets Manager, or Azure Key Vault. ' +
          'Many teams use the External Secrets Operator to sync secrets from these external providers into Kubernetes.\n\n' +
          'The takeaway: treat Kubernetes Secrets as "slightly better than ConfigMaps" for sensitive data, ' +
          'not as a complete security solution. They are a starting point, not the finish line.',
        keyTakeaway:
          'Base64 is encoding, not encryption. Anyone can decode it. For real security, combine Kubernetes Secrets with envelope encryption or an external secrets manager.',
      },
      {
        title: 'Secret Types',
        content:
          'Kubernetes supports several built-in Secret types:\n\n' +
          'Opaque (default): Generic key-value pairs. This is what you get with ' +
          '`kubectl create secret generic`. Use it for passwords, tokens, and arbitrary data.\n\n' +
          'kubernetes.io/dockerconfigjson: Stores Docker registry credentials. Used when your pods need to pull ' +
          'images from private registries. Created with `kubectl create secret docker-registry`.\n\n' +
          'kubernetes.io/tls: Stores a TLS certificate and private key pair. Created with ' +
          '`kubectl create secret tls --cert=cert.pem --key=key.pem`. Used by Ingress controllers for HTTPS.\n\n' +
          'kubernetes.io/service-account-token: Automatically created by Kubernetes for ServiceAccounts. ' +
          'Contains the token that pods use to authenticate with the API server.\n\n' +
          'The type field helps Kubernetes validate the expected data format and is also useful for humans ' +
          'to understand what a Secret contains at a glance.',
        keyTakeaway:
          'Secret types include Opaque (generic), dockerconfigjson (registry creds), tls (cert + key), and service-account-token (auto-created). The type helps with validation and clarity.',
      },
      {
        title: 'Consuming Secrets in Pods',
        content:
          'Secrets are consumed in pods the same way as ConfigMaps — as environment variables or mounted volumes:\n\n' +
          'As environment variables:\n' +
          '  env:\n' +
          '    - name: DB_PASSWORD\n' +
          '      valueFrom:\n' +
          '        secretKeyRef:\n' +
          '          name: db-credentials\n' +
          '          key: password\n\n' +
          'As mounted files:\n' +
          '  volumes:\n' +
          '    - name: secret-volume\n' +
          '      secret:\n' +
          '        secretName: db-credentials\n\n' +
          'When mounted as a volume, each key becomes a file. The files are stored in tmpfs (memory-backed filesystem) ' +
          'so they never touch disk on the node. This is a real security improvement over ConfigMaps.\n\n' +
          'Like ConfigMaps, if a pod references a Secret that does not exist, the pod will not start.',
        keyTakeaway:
          'Secrets are consumed the same way as ConfigMaps: via env vars or volume mounts. Volume-mounted Secrets use tmpfs (in-memory), providing better security than disk storage.',
      },
      {
        title: 'Best Practices for Secret Management',
        content:
          'Follow these practices to handle Secrets responsibly:\n\n' +
          '1. Never commit Secrets to Git. This is the most common mistake. Once a Secret is in version control, ' +
          'it is effectively public — even if you delete it, it lives in Git history.\n\n' +
          '2. Use RBAC to restrict Secret access. Not every service account needs to read every Secret. ' +
          'Grant read access only to the pods that need it.\n\n' +
          '3. Enable encryption at rest. Configure the API server to encrypt Secrets before writing them to etcd. ' +
          'Without this, Secrets are stored as base64 in etcd — readable by anyone with etcd access.\n\n' +
          '4. Rotate Secrets regularly. Change passwords and tokens on a schedule. Use tools like External Secrets ' +
          'Operator to automate rotation from external providers.\n\n' +
          '5. Prefer volume mounts over env vars. Environment variables can leak through process listings, ' +
          'crash dumps, and logs. Mounted files in tmpfs are harder to accidentally expose.',
        keyTakeaway:
          'Never commit Secrets to Git. Use RBAC, enable encryption at rest, rotate regularly, and prefer volume mounts over environment variables for sensitive data.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A team stores their database password in a Kubernetes Secret and feels confident it is secure. They have not configured encryption at rest. Is the password actually encrypted in etcd?',
      choices: [
        'Yes -- Kubernetes encrypts all Secrets with AES-256 before writing them to etcd by default',
        'Yes -- the base64 encoding provides a layer of encryption sufficient for storage at rest',
        'No -- Secrets are only base64-encoded by default, which is trivially reversible by anyone with etcd access',
        'No -- but etcd access requires cluster admin credentials, so base64 is an acceptable security tradeoff',
      ],
      correctIndex: 2,
      explanation:
        'This is the single most critical misconception about Kubernetes Secrets. By default, Secrets are stored as base64-encoded data in etcd, which provides zero cryptographic security. Running "echo cGFzc3dvcmQ= | base64 -d" instantly reveals the original value. To get actual encryption, you must configure envelope encryption at the API server level (EncryptionConfiguration) or use an external secrets manager like HashiCorp Vault. Option D is dangerously wrong -- etcd backups, compromised nodes, or misconfigured access can all expose raw etcd data.',
    },
    {
      question:
        'A developer stores a database password in a ConfigMap instead of a Secret, arguing "it works the same way." What specific security properties are they missing by not using a Secret?',
      choices: [
        'Nothing meaningful -- ConfigMaps and Secrets are stored identically in etcd and have the same access controls',
        'Secrets are automatically encrypted by Kubernetes at rest, while ConfigMaps are stored in plain text',
        'Secrets are automatically rotated by Kubernetes on a configurable schedule, unlike static ConfigMap values',
        'Secrets support separate RBAC policies, use tmpfs for volume mounts (no disk writes), and can be encrypted at rest',
      ],
      correctIndex: 3,
      explanation:
        'Secrets provide three specific security advantages over ConfigMaps: (1) RBAC can restrict Secret access separately, so a service account might read ConfigMaps but not Secrets; (2) when mounted as volumes, Secrets use tmpfs (memory-backed filesystem), so they are never written to the node\'s disk -- ConfigMaps are written to disk; (3) Secrets can be configured for encryption at rest via EncryptionConfiguration. Secrets are NOT automatically encrypted (Option B is wrong) and are NOT automatically rotated (Option C is wrong). They are a better-but-not-perfect solution for sensitive data.',
    },
    {
      question:
        'You need to pull images from a private Docker registry. Which Secret type should you create, and how does Kubernetes use it?',
      choices: [
        'Create an Opaque secret with the registry URL and password, then set it as a container environment variable',
        'Create a kubernetes.io/tls secret with the registry\'s TLS certificate and mount it as a trusted CA volume',
        'Create a kubernetes.io/service-account-token secret and link it to the default ServiceAccount in the namespace',
        'Create a kubernetes.io/dockerconfigjson secret and reference it in imagePullSecrets -- the kubelet uses it to authenticate',
      ],
      correctIndex: 3,
      explanation:
        'Private registry authentication uses the dockerconfigjson Secret type, which stores Docker registry credentials in the standard Docker config format. You reference it via imagePullSecrets in the pod spec (or attach it to a ServiceAccount). The kubelet on each node uses these credentials when pulling images. Using an Opaque secret with env vars would not work because the kubelet, not the application, needs the credentials during image pull -- before the container even starts. This is a common configuration that trips up newcomers.',
    },
    {
      question:
        'A security audit reveals that a pod\'s environment variables are being written to application crash dumps, exposing the DB_PASSWORD environment variable sourced from a Secret. What is the recommended fix?',
      choices: [
        'Switch from env var consumption to volume-mounting the Secret and read the password from the mounted file instead',
        'Enable encryption at rest so the Secret value is encrypted in etcd, preventing exposure in crash dumps',
        'Set the Secret to "immutable: true" so that its value cannot be read after initial creation by the pod',
        'Redeploy the pod with the "secure-env: true" annotation to exclude Secrets from process environment dumps',
      ],
      correctIndex: 0,
      explanation:
        'Environment variables are part of the process environment and can leak through /proc/*/environ, crash dumps, "docker inspect", and application logs that dump env vars. Volume-mounted Secrets avoid this because the data lives in a tmpfs file, not in the process environment. The application reads the file on demand rather than having the value injected into its memory space at startup. Encryption at rest (Option B) protects data in etcd, not in the running container. Making a Secret immutable (Option C) prevents updates but does not affect crash dump behavior.',
    },
    {
      question:
        'Your team rotates the database password stored in a Secret. Pods that mount the Secret as a volume see the updated password, but pods that consume it via environment variables still have the old password. Why?',
      choices: [
        'Both methods should auto-update -- the env-var pods likely have a stale DNS cache preventing the Secret refresh',
        'Volume-mounted Secrets are auto-updated by the kubelet, but env vars are set at startup and never change',
        'Env vars from Secrets require a node reboot to refresh because they are cached in the kubelet\'s memory',
        'The Secret controller only pushes updates to volume-mounted consumers; env-var consumers must poll manually',
      ],
      correctIndex: 1,
      explanation:
        'This is the same behavior as ConfigMaps: volume-mounted Secrets are periodically synced by the kubelet (typically within ~60 seconds). ' +
        'But environment variables are injected into the container process at startup and are immutable for the lifetime of that container. ' +
        'To pick up the new password, pods consuming the Secret via env vars must be restarted (e.g., `kubectl rollout restart deployment`). ' +
        'This is a strong argument for preferring volume mounts over env vars for Secrets that may need rotation.',
    },
  ],
  practices: [
    {
      title: 'Fix a Missing Secret',
      goalDescription:
        'The "db-app" Deployment pods are stuck in CreateContainerConfigError because they reference a missing Secret named "db-credentials". Create the Secret with at least one key-value pair to fix them.',
      successMessage:
        'You created the Secret and the pods recovered! Just like ConfigMaps, pods that reference missing Secrets enter CreateContainerConfigError. ' +
        'Remember: Secrets are base64-encoded, not encrypted — use external solutions for true encryption at rest.',
      hints: [
        { text: 'Run "kubectl get pods" to see the error status, then "kubectl describe pod <name>" to see the detailed error message explaining what\'s missing.' },
        { text: 'The syntax is: kubectl create secret generic <name> --from-literal=<key>=<value>' },
        { text: 'kubectl create secret generic db-credentials --from-literal=password=secret123', exact: true },
      ],
      goals: [
        {
          description: 'Create the missing Secret',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('create-secret'),
        },
        {
          description: 'Secret "db-credentials" has at least one key',
          check: (s: ClusterState) => {
            const secret = s.secrets.find(sec => sec.metadata.name === 'db-credentials');
            return !!secret && Object.keys(secret.data).length >= 1;
          },
        },
        {
          description: 'All "db-app" pods Running',
          check: (s: ClusterState) => {
            return s.pods.filter(p => p.metadata.labels['app'] === 'db-app' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length >= 2;
          },
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'db-app:1.0';
        const hash = templateHash({ image });

        const pods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`db-app-${hash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'db-app', 'pod-template-hash': hash },
            ownerReference: { kind: 'ReplicaSet', name: `db-app-${hash.slice(0, 10)}`, uid: rsUid },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image, envFrom: [{ secretRef: 'db-credentials' }] },
          status: { phase: 'Pending' as const, reason: 'CreateContainerConfigError', message: 'secret "db-credentials" not found' },
        }));

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'db-app', uid: depUid, labels: { app: 'db-app' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 2, selector: { app: 'db-app' },
              template: { labels: { app: 'db-app' }, spec: { image, envFrom: [{ secretRef: 'db-credentials' }] } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 2, updatedReplicas: 0, readyReplicas: 0, availableReplicas: 0, conditions: [] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `db-app-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'db-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'db-app', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 2, selector: { app: 'db-app', 'pod-template-hash': hash },
              template: { labels: { app: 'db-app', 'pod-template-hash': hash }, spec: { image, envFrom: [{ secretRef: 'db-credentials' }] } },
            },
            status: { replicas: 2, readyReplicas: 0 },
          }],
          pods,
          nodes: [
            {
              kind: 'Node' as const,
              metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
              spec: { capacity: { pods: 5 } },
              status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
            },
            {
              kind: 'Node' as const,
              metadata: { name: 'node-2', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-2' }, creationTimestamp: Date.now() - 300000 },
              spec: { capacity: { pods: 5 } },
              status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
            },
          ],
          services: [], events: [], namespaces: [], configMaps: [], secrets: [],
          ingresses: [], statefulSets: [], daemonSets: [], jobs: [], cronJobs: [], hpas: [], helmReleases: [],
        };
      },
      goalCheck: (state) => {
        const secret = state.secrets.find((s) => s.metadata.name === 'db-credentials');
        if (!secret) return false;
        if (Object.keys(secret.data).length < 1) return false;

        // Pods must be Running
        const dbPods = state.pods.filter(
          (p) => p.metadata.labels['app'] === 'db-app' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
        );
        return dbPods.length >= 2;
      },
    },
    {
      title: 'Create a Docker Registry Secret',
      goalDescription:
        'The "private-app" Deployment has ImagePullError. Create a docker-registry Secret named "registry-creds", then fix the image name typo from "registri" to "registry".',
      successMessage:
        'The docker-registry Secret authenticates pods with private registries. In production, imagePullSecrets in the pod spec reference these secrets automatically.',
      podFailureRules: {
        'registri.example.com/app:1.0': 'ImagePullError',
      },
      hints: [
        { text: 'Run "kubectl describe pod" to see why the image pull is failing.' },
        { text: 'Create a docker-registry secret: kubectl create secret docker-registry registry-creds --docker-server=registry.example.com --docker-username=user --docker-password=pass' },
        { text: 'The image has a typo: "registri" should be "registry".' },
        { text: 'kubectl set image deployment/private-app registry.example.com/app:1.0', exact: true },
      ],
      goals: [
        {
          description: 'Create a docker-registry Secret named "registry-creds"',
          check: (s: ClusterState) => s.secrets.some(sec => sec.metadata.name === 'registry-creds' && sec.type === 'kubernetes.io/dockerconfigjson'),
        },
        {
          description: 'Fix the image to "registry.example.com/app:1.0"',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'private-app');
            return !!dep && dep.spec.template.spec.image === 'registry.example.com/app:1.0';
          },
        },
        {
          description: 'All "private-app" pods Running',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'private-app');
            return !!dep && (dep.status.readyReplicas || 0) >= 2;
          },
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'registri.example.com/app:1.0';
        const hash = templateHash({ image });

        const pods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`private-app-${hash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'private-app', 'pod-template-hash': hash },
            ownerReference: { kind: 'ReplicaSet', name: `private-app-${hash.slice(0, 10)}`, uid: rsUid },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image },
          status: { phase: 'Pending' as const, reason: 'ImagePullError', message: 'Failed to pull image "registri.example.com/app:1.0": registry not found' },
        }));

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'private-app', uid: depUid, labels: { app: 'private-app' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 2, selector: { app: 'private-app' },
              template: { labels: { app: 'private-app' }, spec: { image } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 2, updatedReplicas: 0, readyReplicas: 0, availableReplicas: 0, conditions: [] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `private-app-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'private-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'private-app', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 2, selector: { app: 'private-app', 'pod-template-hash': hash },
              template: { labels: { app: 'private-app', 'pod-template-hash': hash }, spec: { image } },
            },
            status: { replicas: 2, readyReplicas: 0 },
          }],
          pods,
          nodes: [
            {
              kind: 'Node' as const,
              metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
              spec: { capacity: { pods: 5 } },
              status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
            },
            {
              kind: 'Node' as const,
              metadata: { name: 'node-2', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-2' }, creationTimestamp: Date.now() - 300000 },
              spec: { capacity: { pods: 5 } },
              status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
            },
          ],
          services: [], events: [], namespaces: [], configMaps: [], secrets: [],
          ingresses: [], statefulSets: [], daemonSets: [], jobs: [], cronJobs: [], hpas: [], helmReleases: [],
        };
      },
      goalCheck: (state) => {
        // Secret must exist with correct type
        const secret = state.secrets.find((s) => s.metadata.name === 'registry-creds' && s.type === 'kubernetes.io/dockerconfigjson');
        if (!secret) return false;

        // Deployment image must be fixed
        const dep = state.deployments.find((d) => d.metadata.name === 'private-app');
        if (!dep) return false;
        if (dep.spec.template.spec.image !== 'registry.example.com/app:1.0') return false;

        // Pods must be Running
        return (dep.status.readyReplicas || 0) >= 2;
      },
    },
  ],
};
