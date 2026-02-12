import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonStorage: Lesson = {
  id: 24,
  title: 'Persistent Storage: PV, PVC & StorageClasses',
  description:
    'Learn how Kubernetes decouples storage from pods using PersistentVolumes, PersistentVolumeClaims, and StorageClasses for dynamic provisioning.',
  mode: 'full',
  goalDescription:
    'A postgres Deployment is stuck Pending because its PVC "postgres-data" cannot bind — no StorageClass exists. Create a StorageClass named "standard" via the YAML Editor so the PVC binds dynamically, and the pod transitions to Running.',
  successMessage:
    'The StorageClass triggered dynamic provisioning, the PVC bound to a new PV, and the postgres pod started successfully. ' +
    'In production, StorageClasses abstract away the underlying storage provider (AWS EBS, GCE PD, NFS, etc.) and let PVCs request storage without knowing implementation details.',
  lecture: {
    sections: [
      {
        title: 'The Problem: Containers Are Ephemeral',
        content:
          'By default, all data inside a container is lost when the container restarts or the pod is rescheduled. ' +
          'This is fine for stateless web servers, but databases, file uploads, and message queues need data that survives pod restarts.\n\n' +
          'Kubernetes solves this with Volumes — but not all volumes are equal. A simple `emptyDir` volume only lasts as long as the pod. ' +
          'For true persistence across pod rescheduling, you need PersistentVolumes.',
        keyTakeaway:
          'Container storage is ephemeral by default. PersistentVolumes provide storage that outlives individual pods.',
      },
      {
        title: 'PersistentVolumes and PersistentVolumeClaims',
        content:
          'Kubernetes separates "the storage that exists" from "the storage a pod wants" using two resources:\n\n' +
          '**PersistentVolume (PV)**: A piece of storage in the cluster, provisioned by an admin or dynamically. Think of it as a "disk" ' +
          'with a certain capacity, access mode, and storage class. PVs are cluster-scoped (not namespaced).\n\n' +
          '**PersistentVolumeClaim (PVC)**: A request for storage by a user/pod. A PVC says "I need 10Gi of ReadWriteOnce storage from ' +
          'the standard storage class." Kubernetes finds a matching PV and binds them together.\n\n' +
          'This abstraction means pods never reference actual storage backends directly. They reference PVCs, which are bound to PVs. ' +
          'The same pod YAML works across different clusters with different storage systems.',
        diagram:
          '┌───────────┐      binds       ┌───────────┐      provisions      ┌──────────────┐\n' +
          '│    PVC    │ ───────────────▶ │    PV     │ ◀────────────────── │ StorageClass │\n' +
          '│ (request) │                  │  (disk)   │                     │ (provisioner)│\n' +
          '└───────────┘                  └───────────┘                     └──────────────┘\n' +
          '      ▲                                                                          \n' +
          '      │ references                                                               \n' +
          '┌───────────┐                                                                    \n' +
          '│    Pod    │                                                                    \n' +
          '│ (volumes) │                                                                    \n' +
          '└───────────┘',
        keyTakeaway:
          'PVs represent actual storage. PVCs are requests for storage. Pods reference PVCs, never PVs directly. This decoupling lets the same pod YAML work with any storage backend.',
      },
      {
        title: 'The Binding Lifecycle',
        content:
          'When a PVC is created, the PV controller looks for a matching PV:\n\n' +
          '1. **PVC Pending**: No matching PV found yet. The PVC waits.\n' +
          '2. **PV Available → Bound**: A PV with matching storageClassName, enough capacity, and compatible access modes is found. ' +
          'Both the PV and PVC transition to "Bound".\n' +
          '3. **PVC deleted**: The bound PV becomes "Released". What happens next depends on the reclaim policy.\n\n' +
          'Any pod that references an unbound PVC will stay in Pending state — Kubernetes will not schedule it until the PVC is satisfied. ' +
          'This is why you might see pods stuck in Pending with the message "persistentvolumeclaim not bound".',
        keyTakeaway:
          'PVCs start as Pending and become Bound when a matching PV is found. Pods referencing unbound PVCs cannot start.',
      },
      {
        title: 'Dynamic Provisioning via StorageClasses',
        content:
          'Manually creating PVs for every PVC does not scale. StorageClasses enable **dynamic provisioning**: when a PVC requests ' +
          'storage from a StorageClass, the provisioner automatically creates a PV.\n\n' +
          'A StorageClass has:\n' +
          '- **provisioner**: The plugin that knows how to create storage (e.g., `kubernetes.io/aws-ebs`, `kubernetes.io/gce-pd`)\n' +
          '- **reclaimPolicy**: What to do when the PVC is deleted: `Delete` (remove the PV and underlying storage) or `Retain` (keep the PV for manual cleanup)\n' +
          '- **parameters**: Provider-specific settings (disk type, IOPS, etc.)\n\n' +
          'With dynamic provisioning, you never manually create PVs. You just create PVCs that reference a StorageClass, and the provisioner handles the rest.\n\n' +
          'Dynamic provisioning can still fail. Common causes: the cloud provider hits a quota or API limit, ' +
          'the requested access mode is unsupported by the backend (e.g., RWX on an EBS provisioner that only supports RWO), ' +
          'or the StorageClass parameters specify an unavailable disk type. Check `kubectl describe pvc` for provisioner error events.\n\n' +
          'StorageClasses also have a **volumeBindingMode**: `Immediate` (provision right away, the default) or ' +
          '`WaitForFirstConsumer` (delay provisioning until a pod references the PVC). The latter is useful for ' +
          'topology-aware provisioning — ensuring the disk is created in the same zone as the node running the pod.\n\n' +
          'Many clusters have a **default StorageClass** so PVCs don\'t even need to specify one.',
        keyTakeaway:
          'StorageClasses automate PV creation. The provisioner creates storage on-demand when a PVC references the StorageClass.',
      },
      {
        title: 'Access Modes and Reclaim Policies',
        content:
          '**Access Modes** define how a volume can be mounted:\n' +
          '- `ReadWriteOnce (RWO)`: One node can mount read-write. Most common for databases.\n' +
          '- `ReadOnlyMany (ROX)`: Many nodes can mount read-only. Good for shared config/assets.\n' +
          '- `ReadWriteMany (RWX)`: Many nodes can mount read-write. Requires special storage (NFS, CephFS).\n\n' +
          '**Reclaim Policies** control what happens to a PV when its PVC is deleted:\n' +
          '- `Delete`: The PV and its underlying storage are automatically deleted. Default for dynamic provisioning. Clean but irreversible.\n' +
          '- `Retain`: The PV is kept with its data. An admin must manually clean up. Safer for important data.\n\n' +
          'Choose wisely: `Delete` is convenient for dev environments, `Retain` is safer for production databases.',
        keyTakeaway:
          'RWO is most common. Use Delete reclaim policy for ephemeral data and Retain for important databases.',
      },
    ],
  },
  quiz: [
    {
      question: 'A pod references a PVC that is still in "Pending" state. What happens to the pod?',
      choices: [
        'The pod starts normally and mounts an empty temporary volume instead',
        'The pod enters CrashLoopBackOff because the volume mount fails inside the container',
        'The pod is scheduled to a node but the container init phase blocks until the PVC binds',
        'The pod stays in Pending state until the PVC becomes bound to a PV',
      ],
      correctIndex: 3,
      explanation:
        'Kubernetes will not schedule a pod until all its PVC references are bound. The pod stays Pending with a message indicating the unbound PVC.',
    },
    {
      question: 'What is the difference between static and dynamic provisioning?',
      choices: [
        'Static provisioning creates PVs at cluster startup time, while dynamic provisioning creates them during pod scheduling',
        'Static provisioning binds PVCs to PVs by name, while dynamic provisioning binds them by matching capacity and access modes only',
        'Dynamic provisioning uses a StorageClass with a provisioner to create PVs automatically when PVCs are created; static provisioning requires an admin to pre-create PVs manually',
        'Dynamic provisioning always uses cloud storage APIs, while static provisioning always uses local node disks',
      ],
      correctIndex: 2,
      explanation:
        'With static provisioning, an admin creates PVs manually. With dynamic provisioning, a StorageClass provisioner automatically creates PVs when PVCs are created.',
    },
    {
      question: 'A PVC requests 10Gi from StorageClass "fast-ssd". The StorageClass exists and its provisioner is running. But the PVC stays Pending. What are possible causes?',
      choices: [
        'The provisioner has hit a cloud provider quota, the requested access mode is unsupported by the backend, or the StorageClass parameters specify an unavailable disk type',
        'The PVC name conflicts with an existing PVC in a different namespace, causing the provisioner to skip it',
        'The StorageClass binding mode is WaitForFirstConsumer, so it defers provisioning until a pod references the PVC',
        'The PVC spec is missing a volumeName field, which is required for dynamic provisioning to identify the target',
      ],
      correctIndex: 0,
      explanation:
        'Dynamic provisioning can fail for several reasons even when the StorageClass exists: cloud provider quotas or API errors, ' +
        'unsupported access modes (e.g., requesting RWX from an EBS provisioner that only supports RWO), invalid parameters in the StorageClass, ' +
        'or the provisioner pod itself is unhealthy. Check `kubectl describe pvc` for events from the provisioner. ' +
        'The WaitForFirstConsumer binding mode is a real feature — it delays provisioning until a pod references the PVC — ' +
        'but the default Immediate mode provisions right away, so this is not the most common cause.',
    },
    {
      question: 'You delete a PVC that was bound to a dynamically provisioned PV with reclaimPolicy: Delete. Later, you realize you needed that data. Can you recover it?',
      choices: [
        'Yes — the PV transitions to Released state and the underlying storage is preserved until an admin manually reclaims it',
        'No — with Delete reclaim policy, both the PV and the underlying storage (cloud disk) are removed automatically and the data is gone unless you have a separate backup',
        'Yes — Kubernetes moves the PV to a recycle queue where the data is retained for a configurable grace period before deletion',
        'No — but the PV itself still exists in Released state, so you can create a new PVC and rebind to recover the data',
      ],
      correctIndex: 1,
      explanation:
        'The Delete reclaim policy is destructive: when the PVC is deleted, the PV and its backing storage (EBS volume, GCE PD, etc.) are also deleted. ' +
        'There is no undo, grace period, or soft-delete. This is why Retain is recommended for production databases — it preserves the PV and data after PVC deletion, ' +
        'allowing manual recovery. For critical data, always use Retain reclaim policy AND maintain external backups (e.g., volume snapshots).',
    },
  ],
  practices: [
    {
      title: 'Fix an Unbound PVC',
      goalDescription:
        'A postgres Deployment is stuck Pending because its PVC "postgres-data" cannot bind — no StorageClass exists. Create a StorageClass named "standard" via the YAML Editor so the PVC binds dynamically, and the pod transitions to Running.',
      successMessage:
        'The StorageClass triggered dynamic provisioning, the PVC bound to a new PV, and the postgres pod started successfully. ' +
        'In production, StorageClasses abstract away the underlying storage provider (AWS EBS, GCE PD, NFS, etc.) and let PVCs request storage without knowing implementation details.',
      yamlTemplate: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ???
provisioner: k8s-simulator/dynamic
reclaimPolicy: ???`,
      hints: [
        { text: 'Run `kubectl get pvc` to see that "postgres-data" is Pending. It needs a StorageClass named "standard".' },
        { text: 'In the YAML Editor, set the StorageClass name to "standard" and reclaimPolicy to "Delete".' },
        { text: 'Click Apply (or Ctrl+Enter) to create the StorageClass. The storage controller will dynamically provision a PV and bind the PVC.' },
        { text: 'After the PVC binds, the pod volume dependency is satisfied and the postgres pod will transition to Running on the next tick.' },
      ],
      goals: [
        {
          description: 'Use "kubectl apply" to create the StorageClass via YAML',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('apply'),
        },
        {
          description: 'StorageClass "standard" exists',
          check: (s: ClusterState) => s.storageClasses.some((sc) => sc.metadata.name === 'standard'),
        },
        {
          description: 'PVC "postgres-data" is Bound',
          check: (s: ClusterState) => {
            const pvc = s.persistentVolumeClaims.find((p) => p.metadata.name === 'postgres-data');
            return !!pvc && pvc.status.phase === 'Bound';
          },
        },
        {
          description: 'Postgres pod is Running',
          check: (s: ClusterState) =>
            s.pods.some((p) => p.metadata.name.startsWith('postgres-') && p.status.phase === 'Running' && !p.metadata.deletionTimestamp),
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsHash = templateHash({ image: 'postgres:15' });
        const rsName = `postgres-${rsHash}`;
        const rsUid = generateUID();
        const podName = generatePodName(rsName);

        return {
          nodes: [
            {
              kind: 'Node' as const,
              metadata: { name: 'node-1', uid: generateUID(), labels: { role: 'worker' }, creationTimestamp: Date.now() },
              spec: { capacity: { pods: 10 } },
              status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }], allocatedPods: 0 },
            },
            {
              kind: 'Node' as const,
              metadata: { name: 'node-2', uid: generateUID(), labels: { role: 'worker' }, creationTimestamp: Date.now() },
              spec: { capacity: { pods: 10 } },
              status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }], allocatedPods: 0 },
            },
          ],
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'postgres',
                uid: depUid,
                labels: { app: 'postgres' },
                creationTimestamp: Date.now(),
              },
              spec: {
                replicas: 1,
                selector: { app: 'postgres' },
                template: {
                  labels: { app: 'postgres' },
                  spec: {
                    image: 'postgres:15',
                    volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'postgres-data' } }],
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
                name: rsName,
                uid: rsUid,
                labels: { app: 'postgres' },
                ownerReference: { kind: 'Deployment', name: 'postgres', uid: depUid },
                creationTimestamp: Date.now(),
              },
              spec: {
                replicas: 1,
                selector: { app: 'postgres' },
                template: {
                  labels: { app: 'postgres' },
                  spec: {
                    image: 'postgres:15',
                    volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'postgres-data' } }],
                  },
                },
              },
              status: { replicas: 1, readyReplicas: 0 },
            },
          ],
          pods: [
            {
              kind: 'Pod' as const,
              metadata: {
                name: podName,
                uid: generateUID(),
                labels: { app: 'postgres' },
                ownerReference: { kind: 'ReplicaSet', name: rsName, uid: rsUid },
                creationTimestamp: Date.now(),
              },
              spec: {
                image: 'postgres:15',
                volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'postgres-data' } }],
              },
              status: {
                phase: 'Pending',
                tickCreated: 0,
                reason: 'Pending',
                message: 'persistentvolumeclaim "postgres-data" not bound',
              },
            },
          ],
          services: [],
          events: [],
          persistentVolumeClaims: [
            {
              kind: 'PersistentVolumeClaim' as const,
              metadata: { name: 'postgres-data', uid: generateUID(), labels: {}, creationTimestamp: Date.now() },
              spec: {
                accessModes: ['ReadWriteOnce'],
                resources: { requests: { storage: '1Gi' } },
                storageClassName: 'standard',
              },
              status: { phase: 'Pending' as const },
            },
          ],
          storageClasses: [],
          persistentVolumes: [],
        };
      },
      goalCheck: (state: ClusterState) => {
        const scExists = state.storageClasses.some((sc) => sc.metadata.name === 'standard');
        const pvcBound = state.persistentVolumeClaims.find((p) => p.metadata.name === 'postgres-data')?.status.phase === 'Bound';
        const podRunning = state.pods.some(
          (p) => p.metadata.name.startsWith('postgres-') && p.status.phase === 'Running' && !p.metadata.deletionTimestamp
        );
        return scExists && pvcBound && podRunning;
      },
    },
  ],
};
