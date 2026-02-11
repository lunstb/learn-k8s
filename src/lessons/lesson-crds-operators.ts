import type { Lesson } from './types';

export const lessonCRDsOperators: Lesson = {
  id: 26,
  title: 'CRDs & Operators',
  description:
    'Learn how Custom Resource Definitions extend the Kubernetes API and how the operator pattern encodes operational knowledge into controllers.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand Custom Resource Definitions and the operator pattern.',
  lecture: {
    sections: [
      {
        title: 'What CRDs Add: New API Resource Types',
        content:
          'Kubernetes ships with built-in resource types: Pods, Deployments, Services, ConfigMaps, etc. ' +
          'But what if you need a resource type that does not exist — like a "Database", "Certificate", or "KafkaTopic"?\n\n' +
          'A Custom Resource Definition (CRD) registers a new resource type with the API Server. ' +
          'Once applied, you can create, read, update, and delete instances of that type using kubectl, ' +
          'just like built-in resources.\n\n' +
          'Example CRD: defining a "Certificate" resource type:\n' +
          '  apiVersion: apiextensions.k8s.io/v1\n' +
          '  kind: CustomResourceDefinition\n' +
          '  metadata:\n' +
          '    name: certificates.cert-manager.io\n' +
          '  spec:\n' +
          '    group: cert-manager.io\n' +
          '    names:\n' +
          '      kind: Certificate\n' +
          '      plural: certificates\n' +
          '    scope: Namespaced\n\n' +
          'After applying this CRD, you can run `kubectl get certificates` or `kubectl apply -f my-cert.yaml` ' +
          'with `kind: Certificate`. The API Server stores and serves these objects just like native resources.\n\n' +
          'CRDs do NOT add behavior — they only add data. The resource is just a YAML object stored in etcd. ' +
          'To make it do something, you need a controller.',
        keyTakeaway:
          'CRDs extend the Kubernetes API with new resource types. After applying a CRD, kubectl works with the new type just like built-in resources. But CRDs are just data — a controller is needed for behavior.',
      },
      {
        title: 'The Operator Pattern: CRD + Controller = Operational Knowledge',
        content:
          'An operator is a CRD paired with a custom controller that watches for instances of that CRD ' +
          'and takes action to reconcile desired state with actual state.\n\n' +
          'The pattern encodes human operational knowledge into code. Instead of a runbook that says ' +
          '"when the database needs a backup, run these 5 commands", the operator watches for a ' +
          '"DatabaseBackup" custom resource and automates the entire process.\n\n' +
          'The operator follows the same watch-reconcile loop as built-in controllers:\n' +
          '1. Watch: the controller watches the API Server for changes to its CRDs\n' +
          '2. Reconcile: when a change is detected, compute the diff between desired and actual state\n' +
          '3. Act: create, update, or delete Kubernetes resources to close the gap\n\n' +
          'For example, a PostgreSQL operator might:\n' +
          '- Watch for "PostgresCluster" CRDs\n' +
          '- Create StatefulSets for primary and replica instances\n' +
          '- Configure PVCs for data storage\n' +
          '- Set up Services for read/write and read-only endpoints\n' +
          '- Handle failover, backups, and version upgrades automatically\n\n' +
          'The user just writes `kind: PostgresCluster` with their desired configuration, ' +
          'and the operator handles the rest.',
        diagram:
          'Operator Pattern:\n' +
          '\n' +
          '  ┌──────────┐   watch    ┌────────────┐\n' +
          '  │ Custom   │ ◀───────── │ Controller │\n' +
          '  │ Resource │            │ (operator) │\n' +
          '  └──────────┘            └─────┬──────┘\n' +
          '       │ user creates/updates   │ reconcile\n' +
          '       ▼                        ▼\n' +
          '  Desired state            Creates/updates\n' +
          '  in etcd                  real resources',
        keyTakeaway:
          'Operators combine CRDs (data) with controllers (behavior) to automate complex operational tasks. The pattern encodes domain expertise into software that follows the Kubernetes reconciliation model.',
      },
      {
        title: 'Real-World Operators',
        content:
          'Operators are everywhere in production Kubernetes:\n\n' +
          'cert-manager: Manages TLS certificates. You create a `Certificate` CR specifying the domain, ' +
          'and cert-manager automatically provisions certificates from Let\'s Encrypt (or other issuers), ' +
          'stores them as Secrets, and renews them before expiry.\n\n' +
          'Karpenter: A node autoscaler. You create `NodePool` CRs defining instance types and constraints. ' +
          'Karpenter watches for unschedulable pods and provisions right-sized nodes in seconds, ' +
          'then consolidates underutilized nodes to save cost.\n\n' +
          'Prometheus Operator: You create `ServiceMonitor` CRs to define which services to scrape. ' +
          'The operator configures Prometheus to collect metrics from those services automatically.\n\n' +
          'ArgoCD: Implements GitOps. You create `Application` CRs pointing to a Git repository, ' +
          'and ArgoCD continuously reconciles the cluster state with the desired state in Git.\n\n' +
          'These operators are typically installed via Helm charts, which deploy both the CRDs ' +
          'and the controller pods that watch them.',
        keyTakeaway:
          'cert-manager, Karpenter, Prometheus Operator, and ArgoCD are examples of operators that automate complex tasks. Operators are typically installed via Helm and bring both CRDs and controller workloads.',
      },
      {
        title: 'CRD Lifecycle and Ecosystem Implications',
        content:
          'Managing CRDs comes with important considerations:\n\n' +
          'CRD versions: CRDs can have multiple versions (v1alpha1, v1beta1, v1) with conversion webhooks ' +
          'between them. This allows API evolution without breaking existing users.\n\n' +
          'Deletion danger: Deleting a CRD deletes ALL instances of that type in the cluster. ' +
          'If you remove the cert-manager CRD, every Certificate object is gone. ' +
          'Always ensure CRDs are protected or backed up.\n\n' +
          'Validation: CRDs support OpenAPI v3 schema validation. The API Server rejects invalid custom resources ' +
          'at creation time, just like it validates built-in resources.\n\n' +
          'RBAC integration: CRDs automatically integrate with Kubernetes RBAC. You can create Roles that grant ' +
          '`get`, `list`, `create`, `delete` on your custom resources just like built-in ones.\n\n' +
          'Discovery: `kubectl api-resources` lists all CRDs alongside built-in types. ' +
          'Teams can discover what custom resources are available in their cluster.\n\n' +
          'Operator maturity model: Level 1 (basic install) → Level 2 (seamless upgrades) → Level 3 (full lifecycle: ' +
          'backup/restore) → Level 4 (deep insights: metrics/alerts) → Level 5 (auto-pilot: auto-tuning).',
        keyTakeaway:
          'CRDs support versioning, validation, and RBAC. Deleting a CRD deletes all instances. The operator maturity model ranges from basic install automation to fully autonomous operation.',
      },
    ],
  },
  quiz: [
    {
      question:
        'You apply a CRD that defines a new "KafkaTopic" resource type. What can you do immediately BEFORE installing any operator?',
      choices: [
        'Nothing — the API Server rejects KafkaTopic objects until an operator is installed and registered to handle them',
        'Create KafkaTopic objects that automatically provision real Kafka topics because the CRD embeds the creation logic',
        'Create KafkaTopic objects with kubectl that are stored in etcd, but no actual Kafka topics are created on the broker',
        'Only view the CRD definition itself — you cannot create resource instances until a matching controller is running',
      ],
      correctIndex: 2,
      explanation:
        'A CRD registers a new resource type with the API Server. You can immediately create, read, update, and delete ' +
        'KafkaTopic objects — they are stored in etcd just like any other Kubernetes resource. But without a controller ' +
        '(operator) watching for these objects, nothing happens. The objects are just data. An operator is needed to ' +
        'react to these objects and create actual Kafka topics.',
    },
    {
      question:
        'A team accidentally runs `kubectl delete crd certificates.cert-manager.io` in production. What happens?',
      choices: [
        'Only the CRD definition is removed — existing Certificate objects are preserved in etcd as orphaned resources',
        'ALL Certificate custom resource instances across all namespaces are immediately deleted along with the CRD',
        'The command fails because CRDs with existing instances cannot be deleted without using the --force flag',
        'The Certificate objects remain in the cluster but become read-only until the CRD is re-applied by an admin',
      ],
      correctIndex: 1,
      explanation:
        'Deleting a CRD is a cascading deletion — all instances of that custom resource across all namespaces are ' +
        'immediately removed from etcd. This is one of the most dangerous operations in Kubernetes. ' +
        'In the cert-manager case, all Certificate objects are deleted, which may cause the operator (if still running) ' +
        'to clean up the associated Secrets (TLS certificates), potentially breaking TLS for all services.',
    },
    {
      question:
        'How does an operator differ from a Helm chart?',
      choices: [
        'They are interchangeable — both Helm charts and operators are packaging formats for Kubernetes applications',
        'Helm charts are designed for third-party software installation while operators handle first-party apps only',
        'Operators only template YAML like Helm but add version tracking, while Helm adds the actual controller logic',
        'Helm deploys static manifests at install time; operators run continuously and reconcile state over the full lifecycle',
      ],
      correctIndex: 3,
      explanation:
        'Helm is a package manager that templates and deploys static YAML manifests at install/upgrade time. ' +
        'An operator is a running controller that continuously watches for changes and reconciles state over the entire ' +
        'lifecycle of an application (install, upgrade, backup, failover, scaling). Ironically, operators themselves ' +
        'are often installed via Helm charts — Helm deploys the operator, then the operator manages the application.',
    },
    {
      question:
        'Which statement best describes the relationship between CRDs and the Kubernetes API?',
      choices: [
        'CRDs extend the API Server with new endpoints that support CRUD, RBAC, watch, and validation like built-in types',
        'CRDs bypass the API Server entirely and store custom resource data in a separate dedicated database',
        'CRDs are a temporary workaround for missing built-in types and should be avoided in production clusters',
        'CRDs can only be accessed programmatically through client libraries — kubectl does not support custom types',
      ],
      correctIndex: 0,
      explanation:
        'CRDs are a first-class extension mechanism. They add new REST endpoints to the API Server that support ' +
        'all standard Kubernetes operations: create, read, update, delete, list, watch, RBAC, validation, versioning, ' +
        'and kubectl integration. They are the recommended way to extend Kubernetes and are used extensively in production ' +
        'by projects like Istio, Knative, ArgoCD, and hundreds of operators.',
    },
  ],
};
