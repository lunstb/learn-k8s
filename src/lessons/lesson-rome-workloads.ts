import type { Lesson } from './types';

export const lessonRomeWorkloads: Lesson = {
  id: 34,
  title: 'Rome AI Workload Architecture',
  description:
    'See which K8s primitive each Rome AI service uses and why — Deployments for stateless services, StatefulSets for databases, DaemonSets for node agents — plus resource sizing, scaling patterns, and operators.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand how Rome AI maps real services to Kubernetes workload types.',
  lecture: {
    sections: [
      {
        title: 'Mapping K8s Primitives to Real Services',
        content:
          'In the simulator, you learned three workload types: Deployments for stateless apps, StatefulSets for stateful apps ' +
          'with ordered identity, and DaemonSets for per-node agents. Rome AI uses all three.\n\n' +
          'Deployments: applayer, ingest-server, temporal server, temporal-ui, keycloak, material-planners, centrifugo, ' +
          'litellm, otel-collector, aws-load-balancer-controller, karpenter, infisical-operator, kyverno.\n\n' +
          'StatefulSets: datomic transactor (needs stable identity for its DynamoDB backend), ' +
          'clickhouse (needs stable PVs for 120Gi of analytics data).\n\n' +
          'DaemonSet: nginx ingress controller (one per node).\n\n' +
          'The choice of primitive is driven by a single question: does this workload need stable identity, stable storage, ' +
          'or ordered deployment? If yes, StatefulSet. If it must run on every node, DaemonSet. Otherwise, Deployment.',
        keyTakeaway:
          'Most services are Deployments because they are stateless. StatefulSets are reserved for the few services that need stable identity and persistent storage. DaemonSets are for node-level infrastructure.',
      },
      {
        title: 'Resource Sizing in Practice',
        content:
          'In the simulator, you set resource requests and limits like `cpu: 250m, memory: 128Mi`. ' +
          'In production, getting these numbers right is critical.\n\n' +
          'Look at the range across Rome AI services: applayer requests 512m CPU and 1Gi memory (limits 2Gi) — ' +
          'this is a JVM-based Clojure application that needs consistent memory for the heap. ' +
          'The datomic transactor requests 1000m CPU (1 full core) and 4Gi memory (limits 6Gi) — ' +
          'it is the most resource-intensive single pod because it serves as the database write coordinator. ' +
          'Material-planners (the frontend) requests minimal resources because it serves static files via NGINX. ' +
          'The LiteLLM proxy needs variable resources depending on concurrent LLM requests.\n\n' +
          'Getting requests wrong means either (a) pods get OOMKilled when limits are too low, ' +
          '(b) nodes are wasted when requests are too high, or (c) the Scheduler cannot find a node when requests exceed ' +
          'Karpenter\'s instance types. Rome AI\'s Karpenter NodePool allows t3a, m6a, and m7a instance families — ' +
          'all AMD cost-optimized — so resource requests must fit within these instance sizes.',
        keyTakeaway:
          'Resource requests drive scheduling and cost. Set requests too high and you waste money on oversized nodes. Set them too low and you risk OOMKill and CPU throttling. Match requests to actual usage patterns.',
      },
      {
        title: 'StatefulSets in Production: Datomic and ClickHouse',
        content:
          'In the simulator, you learned that StatefulSets provide stable pod names (pod-0, pod-1), ordered startup, ' +
          'and persistent volumes.\n\n' +
          'The datomic transactor runs as a StatefulSet with 1 replica. It needs stable identity because it coordinates writes ' +
          'to DynamoDB — if two transactors ran simultaneously with the same identity, they would corrupt the database. ' +
          'The single replica means there is no high availability for the transactor itself ' +
          '(Datomic\'s architecture handles this differently with peers).\n\n' +
          'ClickHouse runs as a StatefulSet with 2 replicas, each with 120Gi PersistentVolumes for analytical data. ' +
          'ClickHouse also uses S3 tiered storage — hot data lives on PVs for fast queries, cold data is automatically ' +
          'moved to S3 for cost savings. If a ClickHouse pod is rescheduled, its PV follows it to the new node ' +
          '(the PV is backed by an EBS volume that can be reattached). This is exactly the PV behavior you learned in the Storage lesson.',
        diagram:
          '  ClickHouse StatefulSet (2 replicas)\n' +
          '  ┌─────────────────┐  ┌─────────────────┐\n' +
          '  │ clickhouse-0     │  │ clickhouse-1     │\n' +
          '  │ PV: 120Gi EBS   │  │ PV: 120Gi EBS   │\n' +
          '  └────────┬────────┘  └────────┬────────┘\n' +
          '           │  cold data          │  cold data\n' +
          '           ▼                     ▼\n' +
          '        S3 Tiered Storage (shared bucket)',
        keyTakeaway:
          'StatefulSets shine when you need stable identity and persistent storage. Datomic needs exactly 1 transactor. ClickHouse needs stable PVs that survive rescheduling plus S3 tiering for cost efficiency.',
      },
      {
        title: 'Scaling Patterns: Fixed vs. Autoscaled',
        content:
          'In the simulator, you used HPA to autoscale Deployments based on CPU. Rome AI uses two scaling patterns.\n\n' +
          'Fixed replicas: applayer (1), ingest-server (1), datomic (1), temporal (1), temporal-ui (1), otel-collector (1). ' +
          'These are either single-writer services (datomic), low-traffic internal tools (temporal-ui), or services ' +
          'where horizontal scaling does not help (ingest-server processes one stream).\n\n' +
          'Autoscaled replicas (HPA): material-planners (2-5 replicas, scales on CPU because it serves user traffic), ' +
          'litellm (2-5 replicas, scales on concurrent LLM API requests).\n\n' +
          'The choice depends on whether the service benefits from horizontal scaling. A database transactor cannot be ' +
          'horizontally scaled. A stateless frontend or proxy can be.\n\n' +
          'Karpenter provides the underlying node capacity — when HPA adds Pods and the cluster runs out of capacity, ' +
          'Karpenter provisions a new node in seconds using spot instances (t3a, m6a, m7a families). ' +
          'When HPA scales down and nodes become empty, Karpenter\'s consolidation removes the nodes.',
        keyTakeaway:
          'Not every service should autoscale. Stateful single-writer services use fixed replicas. Stateless, horizontally-scalable services use HPA. Karpenter handles node-level scaling underneath.',
      },
      {
        title: 'Operators and CRDs in the Rome AI Cluster',
        content:
          'In the CRDs and Operators lesson, you learned that operators extend Kubernetes with custom resource types and controllers. ' +
          'Rome AI runs four operators:\n\n' +
          '1. aws-load-balancer-controller — watches for Ingress and Service resources and provisions/configures AWS ALBs ' +
          'and NLBs accordingly. Without this operator, the `LoadBalancer` Service type would not work on EKS.\n\n' +
          '2. Karpenter — watches for unschedulable Pods and provisions right-sized EC2 instances. Its CRDs include ' +
          'NodePool and EC2NodeClass.\n\n' +
          '3. infisical-operator — watches for InfisicalSecret CRDs and syncs secrets from the Infisical secrets manager ' +
          'into Kubernetes Secrets. This replaces `kubectl create secret` with a declarative, GitOps-compatible workflow.\n\n' +
          '4. kyverno — a policy engine that watches all resource creation and enforces policies ' +
          '(e.g., "every Pod must have resource limits", "no privileged containers"). It uses ClusterPolicy CRDs to define rules.\n\n' +
          'Each of these operators follows the exact pattern you learned: CRD defines the API, controller reconciles desired state.',
        keyTakeaway:
          'Operators are not exotic — they are standard production infrastructure. Rome AI relies on four operators for load balancing, node autoscaling, secrets management, and policy enforcement.',
      },
    ],
  },
  quiz: [
    {
      question:
        'The datomic transactor runs as a StatefulSet with 1 replica. A developer suggests changing it to a Deployment with 1 replica to simplify the configuration. Why is this a bad idea?',
      choices: [
        'Deployments cannot mount PersistentVolumes, which the transactor needs for its DynamoDB write-ahead logs',
        'During a rolling update, a Deployment briefly runs 2 replicas simultaneously (old and new). Two datomic transactors would corrupt the database by conflicting on DynamoDB writes',
        'StatefulSets are faster to start than Deployments because they skip the ReplicaSet controller step',
        'Deployments cannot be configured with resource limits, which the transactor needs to avoid OOMKill',
      ],
      correctIndex: 1,
      explanation:
        'During a Deployment rolling update with maxSurge=1, the new Pod starts before the old Pod terminates. ' +
        'For datomic, this means two transactors would briefly run concurrently, potentially corrupting the database. ' +
        'A StatefulSet with 1 replica ensures ordered updates — the old Pod is fully terminated before the new Pod starts. ' +
        'Deployments can mount PVs and have resource limits; the issue is specifically about concurrent replicas during updates.',
    },
    {
      question:
        'ClickHouse runs as a StatefulSet with 2 replicas, each using 120Gi PersistentVolumes. If node-1 (hosting clickhouse-0) fails and Karpenter provisions node-3 as a replacement, what happens to clickhouse-0\'s data?',
      choices: [
        'The data is lost because PersistentVolumes are local to the node and cannot be moved',
        'The PV (backed by EBS) is detached from node-1 and reattached to node-3 when the pod is rescheduled, preserving all data',
        'ClickHouse replicates data between replicas, so clickhouse-1 contains a full copy and clickhouse-0 starts fresh',
        'Karpenter copies the EBS volume to a new AZ before provisioning node-3, which adds 5-10 minutes of downtime',
      ],
      correctIndex: 1,
      explanation:
        'EBS volumes are AZ-scoped persistent storage. When a node fails, the PV is detached and reattached to the new node in the same AZ. ' +
        'The StatefulSet controller reschedules clickhouse-0 to node-3, and the PVC ensures the same EBS volume is mounted. ' +
        'All 120Gi of data is preserved. Note: this only works within the same AZ.',
    },
    {
      question:
        'Rome AI uses Karpenter with instance families t3a, m6a, and m7a (all AMD). The litellm proxy HPA scales from 2 to 5 replicas during peak LLM traffic. What sequence of events occurs when the 5th replica cannot be scheduled?',
      choices: [
        'The HPA pauses scaling and waits for a node to become available before creating the 5th Pod',
        'The 5th Pod enters Pending, Karpenter detects it, evaluates its resource requests against t3a/m6a/m7a options, and provisions the cheapest fitting instance (preferring spot)',
        'Kubernetes evicts a lower-priority Pod from an existing node to make room for the litellm Pod',
        'The aws-load-balancer-controller provisions a new ALB target to handle the additional traffic instead of adding a Pod',
      ],
      correctIndex: 1,
      explanation:
        'The HPA creates Pods regardless of node capacity. The 5th Pod enters Pending with reason Unschedulable. ' +
        'Karpenter\'s controller detects this, evaluates the Pod\'s CPU and memory requests against the NodePool\'s ' +
        'allowed instance families, selects the cheapest option (spot first, on-demand fallback), and provisions a new EC2 instance. ' +
        'This typically takes under 60 seconds.',
    },
    {
      question:
        'The infisical-operator syncs secrets from the Infisical secrets manager into Kubernetes Secrets. A developer asks why Rome AI does not just use `kubectl create secret` in the deployment pipeline instead. What is the primary advantage of the operator approach?',
      choices: [
        'The operator encrypts secrets with a stronger algorithm than kubectl, which only uses base64 encoding',
        'The operator continuously reconciles — if a secret is rotated in Infisical, the operator updates the Kubernetes Secret automatically without redeploying',
        'kubectl create secret requires cluster admin permissions, while the operator runs with reduced RBAC',
        'The operator stores secrets in etcd with double encryption, while kubectl create only applies single encryption',
      ],
      correctIndex: 1,
      explanation:
        'The operator follows the reconciliation pattern. It continuously watches Infisical for changes and updates Kubernetes Secrets accordingly. ' +
        'If a database password is rotated in Infisical, the operator detects the change and updates the Secret within seconds. ' +
        'With `kubectl create secret`, you would need to manually re-run the command or add it to a CI/CD pipeline.',
    },
    {
      question:
        'Rome AI\'s kyverno ClusterPolicy requires every Pod to have resource requests and limits. A developer pushes a Deployment without resource specs. What happens?',
      choices: [
        'The Deployment is created but Kyverno adds default resource requests and limits automatically via a mutating policy',
        'The Deployment is created and Pods start, but Kyverno generates a PolicyViolation report for the security team',
        'The API Server rejects the Deployment creation because Kyverno\'s validating webhook blocks resources that violate the policy',
        'The Pods are created but immediately evicted by the kubelet because they lack resource specifications',
      ],
      correctIndex: 2,
      explanation:
        'Kyverno installs validating admission webhooks. When the API Server receives a request to create a Deployment, ' +
        'it sends the request to Kyverno\'s webhook before persisting it. Kyverno evaluates the Pod template against ClusterPolicy rules. ' +
        'If resource limits are missing, the webhook returns a denial and the API Server rejects the create request. ' +
        'The developer sees an error message explaining which policy was violated.',
    },
  ],
};
