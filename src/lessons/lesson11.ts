import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson11: Lesson = {
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
  hints: [
    { text: 'Run "kubectl get pods" to see the error status, then "kubectl describe pod <name>" to see the detailed error message explaining what\'s missing.' },
    { text: 'The syntax is: kubectl create secret generic <name> --from-literal=<key>=<value>' },
    { text: 'kubectl create secret generic db-credentials --from-literal=password=secret123', exact: true },
  ],
  goals: [
    {
      description: 'Create Secret "db-credentials" with at least one key',
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
        'Yes -- Kubernetes Secrets are always encrypted before being written to etcd',
        'Yes -- the base64 encoding provides sufficient encryption for storage',
        'No -- Secrets are only base64-encoded by default, which is trivially reversible. Anyone with etcd access can read them.',
        'No -- but it does not matter because etcd is inaccessible from outside the cluster',
      ],
      correctIndex: 2,
      explanation:
        'This is the single most critical misconception about Kubernetes Secrets. By default, Secrets are stored as base64-encoded data in etcd, which provides zero cryptographic security. Running "echo cGFzc3dvcmQ= | base64 -d" instantly reveals the original value. To get actual encryption, you must configure envelope encryption at the API server level (EncryptionConfiguration) or use an external secrets manager like HashiCorp Vault. Option D is dangerously wrong -- etcd backups, compromised nodes, or misconfigured access can all expose raw etcd data.',
    },
    {
      question:
        'A developer stores a database password in a ConfigMap instead of a Secret, arguing "it works the same way." What specific security properties are they missing by not using a Secret?',
      choices: [
        'Secrets can have separate RBAC policies, are stored in tmpfs when volume-mounted (never written to disk on nodes), and can be configured for encryption at rest',
        'Nothing meaningful -- ConfigMaps and Secrets are stored identically and have the same access controls',
        'Secrets are encrypted by Kubernetes, while ConfigMaps are not',
        'Secrets are automatically rotated by Kubernetes, while ConfigMap values are static',
      ],
      correctIndex: 0,
      explanation:
        'Secrets provide three specific security advantages over ConfigMaps: (1) RBAC can restrict Secret access separately, so a service account might read ConfigMaps but not Secrets; (2) when mounted as volumes, Secrets use tmpfs (memory-backed filesystem), so they are never written to the node\'s disk -- ConfigMaps are written to disk; (3) Secrets can be configured for encryption at rest via EncryptionConfiguration. Secrets are NOT automatically encrypted (Option B is wrong) and are NOT automatically rotated (Option D is wrong). They are a better-but-not-perfect solution for sensitive data.',
    },
    {
      question:
        'You need to pull images from a private Docker registry. Which Secret type should you create, and how does Kubernetes use it?',
      choices: [
        'Create a kubernetes.io/service-account-token secret and attach it to the default service account in the namespace',
        'Create a kubernetes.io/dockerconfigjson secret and reference it in the pod spec\'s imagePullSecrets field -- the kubelet uses it to authenticate with the registry',
        'Create an Opaque secret with the registry URL and password, then reference it in the pod spec as an environment variable',
        'Create a kubernetes.io/tls secret with the registry certificate and mount it as a volume',
      ],
      correctIndex: 1,
      explanation:
        'Private registry authentication uses the dockerconfigjson Secret type, which stores Docker registry credentials in the standard Docker config format. You reference it via imagePullSecrets in the pod spec (or attach it to a ServiceAccount). The kubelet on each node uses these credentials when pulling images. Using an Opaque secret with env vars would not work because the kubelet, not the application, needs the credentials during image pull -- before the container even starts. This is a common configuration that trips up newcomers.',
    },
    {
      question:
        'A security audit reveals that a pod\'s environment variables are being written to application crash dumps, exposing the DB_PASSWORD environment variable sourced from a Secret. What is the recommended fix?',
      choices: [
        'Enable encryption at rest so the Secret is encrypted in etcd -- this prevents exposure in crash dumps',
        'Switch from environment variable consumption to volume-mounting the Secret, and update the app to read from the mounted file instead',
        'Set the Secret to "immutable: true" to prevent it from appearing in crash dumps',
        'Use a ConfigMap instead, since ConfigMap values are not included in crash dump output',
      ],
      correctIndex: 1,
      explanation:
        'Environment variables are part of the process environment and can leak through /proc/*/environ, crash dumps, "docker inspect", and application logs that dump env vars. Volume-mounted Secrets avoid this because the data lives in a tmpfs file, not in the process environment. The application reads the file on demand rather than having the value injected into its memory space at startup. Encryption at rest (Option A) protects data in etcd, not in the running container. Making a Secret immutable (Option C) prevents updates but does not affect crash dump behavior.',
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
};
