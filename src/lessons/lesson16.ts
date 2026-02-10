import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lesson16: Lesson = {
  id: 16,
  title: 'StatefulSets',
  description:
    'Learn how StatefulSets manage stateful applications with stable network identities, ordered deployment, and persistent storage.',
  mode: 'full',
  goalDescription:
    'Create a StatefulSet named "mysql" with image mysql:8.0 and 3 replicas. Reconcile until all 3 pods (mysql-0, mysql-1, mysql-2) are Running.',
  successMessage:
    'All 3 StatefulSet pods are running with stable ordinal names. Unlike Deployments, StatefulSets give each pod ' +
    'a predictable identity that survives restarts — essential for databases and clustered applications.',
  hints: [
    { text: 'The syntax is: kubectl create statefulset <name> --image=<image> --replicas=<count>. Pods are created one at a time, so reconcile multiple times.' },
    { text: 'kubectl create statefulset mysql --image=mysql:8.0 --replicas=3', exact: true },
    { text: 'Reconcile multiple times — StatefulSet creates pods sequentially, not all at once.' },
  ],
  goals: [
    {
      description: 'Create a StatefulSet named "mysql" with 3 replicas',
      check: (s: ClusterState) => !!s.statefulSets.find(sts => sts.metadata.name === 'mysql'),
    },
    {
      description: 'All 3 pods Running (mysql-0, mysql-1, mysql-2)',
      check: (s: ClusterState) => {
        const running = s.pods.filter(p => p.metadata.name.startsWith('mysql-') && p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
        return running.length >= 3;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Stateful Applications Need Identity',
        content:
          'Deployments treat every pod as interchangeable. Pod names are random hashes, pods can be ' +
          'created and deleted in any order, and no pod is "special." This works perfectly for stateless ' +
          'web servers — any replica can handle any request.\n\n' +
          'But what about a MySQL cluster? The primary node (mysql-0) has a different role than replicas ' +
          '(mysql-1, mysql-2). Each node needs to know its own identity so it can configure replication correctly. ' +
          'If mysql-0 restarts, it needs to come back as mysql-0 — not get a random new name.\n\n' +
          'Or consider Elasticsearch: each node has an index shard assigned to it. If a node restarts with a ' +
          'different identity, the cluster loses track of which shards live where. The node needs the same ' +
          'network identity and the same storage volume across restarts.\n\n' +
          'StatefulSets solve this by giving each pod a stable, predictable identity that persists across ' +
          'rescheduling and restarts.',
        keyTakeaway:
          'Deployments are for stateless apps where pods are interchangeable. StatefulSets are for stateful apps where each pod needs a stable, unique identity.',
      },
      {
        title: 'Stable Network Identity and Ordinal Naming',
        content:
          'A StatefulSet names its pods using a predictable pattern: <statefulset-name>-<ordinal>. ' +
          'If you create a StatefulSet called "mysql" with 3 replicas, you always get mysql-0, mysql-1, mysql-2.\n\n' +
          'This is fundamentally different from Deployment pods, which get random hash suffixes like ' +
          'mysql-7f8c9d-x4k2p. With StatefulSets, the names are deterministic.\n\n' +
          'Each pod also gets a stable DNS entry through a headless Service. If the headless Service is ' +
          'called "mysql-headless", then mysql-0 is reachable at mysql-0.mysql-headless.<namespace>.svc.cluster.local. ' +
          'This DNS name never changes, even if the pod is rescheduled to a different node.\n\n' +
          'Applications can rely on these stable names for peer discovery. mysql-1 can always find the primary ' +
          'at mysql-0.mysql-headless — no service discovery framework needed.',
        diagram:
          '  StatefulSet: mysql (replicas=3)\n' +
          '  ──────────────────────────────\n' +
          '  mysql-0  →  mysql-0.mysql-headless.default.svc\n' +
          '  mysql-1  →  mysql-1.mysql-headless.default.svc\n' +
          '  mysql-2  →  mysql-2.mysql-headless.default.svc\n' +
          '  \n' +
          '  vs. Deployment pods:\n' +
          '  mysql-7f8c9d-x4k2p  (random, changes on restart)\n' +
          '  mysql-7f8c9d-m9n1q  (random, changes on restart)',
        keyTakeaway:
          'StatefulSet pods get ordinal names (mysql-0, mysql-1, mysql-2) and stable DNS entries. These identities survive pod restarts and rescheduling.',
      },
      {
        title: 'Ordered Creation and Deletion',
        content:
          'StatefulSets create and delete pods in a strict order. Pods are created sequentially: ' +
          'mysql-0 must be Running before mysql-1 is created, mysql-1 before mysql-2, and so on.\n\n' +
          'Why? Because many stateful applications require ordered startup. In a MySQL cluster, the primary ' +
          '(mysql-0) must be running before replicas can connect to it for replication. In ZooKeeper, ' +
          'nodes need to form a quorum in a specific order.\n\n' +
          'Deletion happens in reverse order: mysql-2 is terminated first, then mysql-1, then mysql-0. ' +
          'This ensures graceful shutdown — replicas disconnect before the primary goes down.\n\n' +
          'During scaling, the same ordering applies. Scale up from 3 to 5: mysql-3 is created, then mysql-4. ' +
          'Scale down from 5 to 3: mysql-4 is deleted, then mysql-3. The ordinals are always contiguous.',
        keyTakeaway:
          'StatefulSets enforce ordered operations: pods are created 0, 1, 2... and deleted in reverse. This guarantees stateful applications start and stop in the correct sequence.',
      },
      {
        title: 'Persistent Storage with Volume Claims',
        content:
          'Each StatefulSet pod can have its own persistent volume via volumeClaimTemplates. When mysql-0 ' +
          'is created, it gets a PersistentVolumeClaim called data-mysql-0. mysql-1 gets data-mysql-1, and so on.\n\n' +
          'The critical property: these volume claims are NOT deleted when pods are deleted. If mysql-1 crashes ' +
          'and the StatefulSet controller recreates it, the new mysql-1 pod reattaches to the same data-mysql-1 volume. ' +
          'The data survives pod restarts.\n\n' +
          'This is essential for databases. If you restart a MySQL replica, it needs its existing data files — ' +
          'not a fresh empty volume. The combination of stable identity + persistent storage means a restarted ' +
          'pod is truly the "same" pod from the application\'s perspective.\n\n' +
          'Even when you scale down (removing mysql-2), the volume data-mysql-2 is retained. If you scale ' +
          'back up, the new mysql-2 gets its old data back.',
        keyTakeaway:
          'StatefulSet volumes persist across pod restarts and rescheduling. Each pod gets its own volume that follows it throughout its lifecycle — essential for any application that stores data on disk.',
      },
      {
        title: 'Headless Services: DNS Without Load Balancing',
        content:
          'StatefulSets require a headless Service — a Service with clusterIP: None. Unlike normal Services ' +
          'that provide a single virtual IP and load-balance across pods, a headless Service creates individual ' +
          'DNS records for each pod.\n\n' +
          'A normal Service "mysql-svc" resolves to one IP that load-balances. A headless Service "mysql-headless" ' +
          'resolves to the individual pod IPs, and each pod gets its own DNS A record.\n\n' +
          'This is important because stateful applications often need to address specific pods. A read query ' +
          'might go to any replica, but a write must go to the primary (mysql-0). With a headless Service, ' +
          'the application can address mysql-0.mysql-headless directly.\n\n' +
          'The headless Service is specified in the StatefulSet\'s spec.serviceName field. This is a required ' +
          'field — every StatefulSet must have an associated headless Service for pod DNS.',
        keyTakeaway:
          'Headless Services (clusterIP: None) give each StatefulSet pod its own DNS record. This allows clients to address specific pods by name rather than relying on load-balanced traffic.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A StatefulSet "mysql" has 3 replicas (mysql-0, mysql-1, mysql-2). The pod mysql-1 crashes due to an OOM error and is terminated. What name does the replacement pod get?',
      choices: [
        'mysql-3, because Kubernetes always increments the ordinal for new pods',
        'mysql-1 — the StatefulSet recreates the pod with the exact same ordinal name and reattaches its persistent volume',
        'A random name like mysql-7f8c9d-x4k2p, similar to Deployment pods',
        'The StatefulSet waits for manual intervention before creating a replacement since data integrity is at risk',
      ],
      correctIndex: 1,
      explanation:
        'This is the core value proposition of StatefulSets: stable identity. When mysql-1 crashes, the StatefulSet controller creates a new pod named mysql-1 (same name, same ordinal). ' +
        'It also reattaches the same PersistentVolumeClaim (data-mysql-1), so the pod comes back with its data intact. From the application\'s perspective, it is the same node rejoining the cluster. ' +
        'This is fundamentally different from Deployments, where a replacement gets a completely new random name.',
    },
    {
      question:
        'You scale a StatefulSet "mysql" from 5 replicas down to 3. Pods mysql-4 and mysql-3 are terminated. What happens to the PersistentVolumeClaims data-mysql-3 and data-mysql-4?',
      choices: [
        'They are automatically deleted along with the pods to free up storage resources',
        'They are migrated to the remaining pods (mysql-0, mysql-1, mysql-2) as additional storage',
        'They are marked for garbage collection and deleted after 24 hours if the StatefulSet is not scaled back up',
        'They are retained — Kubernetes does not delete PVCs from StatefulSets on scale-down, preserving the data in case you scale back up',
      ],
      correctIndex: 3,
      explanation:
        'StatefulSet PersistentVolumeClaims are deliberately retained on scale-down. This is a safety feature — deleting volumes means losing data, and Kubernetes errs on the side of caution. ' +
        'If you later scale back to 5 replicas, mysql-3 and mysql-4 will be recreated and automatically reattach to their original PVCs with all data intact. ' +
        'If you truly want to reclaim the storage, you must manually delete the PVCs. This behavior surprises many operators who expect cleanup to be automatic.',
    },
    {
      question:
        'A MySQL cluster uses a StatefulSet. The primary (mysql-0) must be running before replicas (mysql-1, mysql-2) can start replication. Why does StatefulSet ordered creation matter here, and what would happen if pods started simultaneously like a Deployment?',
      choices: [
        'If replicas start before the primary exists, they fail to connect for replication setup, enter error loops, and may corrupt their initial state — ordered creation ensures the primary is ready first',
        'Simultaneous startup would work fine but would be slower because all pods compete for resources',
        'It does not actually matter — MySQL replicas can find the primary through DNS discovery regardless of startup order',
        'Kubernetes would detect the conflict and automatically delay replica creation even without StatefulSet ordering',
      ],
      correctIndex: 0,
      explanation:
        'Ordered creation is not just a convenience — it prevents real failures. MySQL replicas need to connect to the primary during initialization to set up replication. If mysql-1 starts before mysql-0 exists, ' +
        'it cannot reach mysql-0.mysql-headless for replication setup, causing connection errors and potential initialization failures. The same applies to ZooKeeper (quorum formation), Elasticsearch (master election), ' +
        'and Cassandra (seed nodes). StatefulSet ordering guarantees that lower ordinals are Running and Ready before higher ordinals are created.',
    },
    {
      question:
        'You need to run a stateless web application where any pod can handle any request and pods do not need persistent storage. A team member suggests using a StatefulSet because "it is more reliable." Why is a Deployment the better choice?',
      choices: [
        'StatefulSets cannot scale beyond 10 replicas, while Deployments have no limit',
        'StatefulSets do not support rolling updates, so you cannot deploy new versions without downtime',
        'StatefulSets create pods sequentially and give each a sticky identity — this adds unnecessary startup latency and operational complexity for an application that does not need stable identity or ordered deployment',
        'StatefulSets require a headless Service which means you cannot use a load balancer with them',
      ],
      correctIndex: 2,
      explanation:
        'StatefulSets are purpose-built for stateful workloads. For a stateless web app, their features become drawbacks: sequential pod creation means scaling from 0 to 10 takes 10x longer than a Deployment ' +
        '(which creates all pods in parallel). Sticky identity means failed pods must be recreated with specific names on specific volumes, making rescheduling less flexible. ' +
        'Deployments treat pods as interchangeable, enabling faster scaling, simpler rollbacks, and more efficient scheduling. Use the simplest controller that meets your requirements.',
    },
  ],
  initialState: () => {
    const nodeNames = ['node-1', 'node-2', 'node-3'];
    const nodes = nodeNames.map((name) => ({
      kind: 'Node' as const,
      metadata: {
        name,
        uid: generateUID(),
        labels: { 'kubernetes.io/hostname': name },
        creationTimestamp: Date.now() - 300000,
      },
      spec: { capacity: { pods: 4 } },
      status: {
        conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
        allocatedPods: 0,
      },
    }));

    return {
      pods: [],
      replicaSets: [],
      deployments: [],
      nodes,
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
    if (state.statefulSets.length < 1) return false;

    const ss = state.statefulSets.find((s) => s.metadata.name === 'mysql');
    if (!ss) return false;

    const runningMysqlPods = state.pods.filter(
      (p) =>
        p.metadata.name.startsWith('mysql-') &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );

    return runningMysqlPods.length >= 3;
  },
};
