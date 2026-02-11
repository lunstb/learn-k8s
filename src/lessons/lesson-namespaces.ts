import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export const lessonNamespaces: Lesson = {
  id: 9,
  title: 'Namespaces',
  description:
    'Namespaces partition a single cluster into logical groups, providing scope for names and a foundation for resource isolation.',
  mode: 'full',
  goalDescription:
    'Create a namespace called "dev" and deploy a "web" Deployment with image nginx and 2 Running replicas in the default namespace.',
  successMessage:
    'You now have multiple namespaces and a healthy deployment. Namespaces let teams share a cluster without stepping on each other.',
  hints: [
    { text: 'Use kubectl create namespace to create a new namespace.' },
    { text: 'kubectl create namespace dev', exact: true },
    { text: 'Now create a deployment in the default namespace.' },
    { text: 'kubectl create deployment web --image=nginx --replicas=2', exact: true },
  ],
  goals: [
    {
      description: 'Create a namespace called "dev"',
      check: (s: ClusterState) => s.namespaces.some(ns => ns.metadata.name === 'dev'),
    },
    {
      description: 'Create a "web" Deployment with 2 Running replicas',
      check: (s: ClusterState) => {
        const dep = s.deployments.find(d => d.metadata.name === 'web');
        return !!dep && (dep.status.readyReplicas || 0) >= 2;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: One Cluster, Many Teams',
        content:
          'Imagine a company with three teams: frontend, backend, and data. They all share one Kubernetes cluster. ' +
          'Without any partitioning, every team\'s pods, services, and configmaps live in the same bucket. ' +
          'Name collisions are inevitable — what if two teams both want to call their deployment "api"?\n\n' +
          'Beyond naming, there are operational concerns. You might want to apply different resource quotas ' +
          'to different teams, or restrict who can see what. Running everything in a single flat namespace makes ' +
          'this difficult.\n\n' +
          'Namespaces solve this by creating logical partitions within a cluster. Each namespace is an independent ' +
          'scope for resource names. Two teams can each have a deployment called "api" as long as they live in ' +
          'different namespaces. Think of namespaces as folders on a filesystem — they organize resources and prevent conflicts.',
        diagram:
          'Cluster\\n' +
          '┌─────────────────────────────────────────────┐\\n' +
          '│  Namespace: default    Namespace: production │\\n' +
          '│  ┌─────────────┐      ┌─────────────┐      │\\n' +
          '│  │ pod: api    │      │ pod: api    │      │\\n' +
          '│  │ svc: api    │      │ svc: api    │      │\\n' +
          '│  │ cm: config  │      │ cm: config  │      │\\n' +
          '│  └─────────────┘      └─────────────┘      │\\n' +
          '│        Same names, completely isolated       │\\n' +
          '└─────────────────────────────────────────────┘',
        keyTakeaway:
          'Namespaces partition a cluster into logical groups. They prevent name collisions and provide a boundary for access control and resource quotas.',
      },
      {
        title: 'Default Namespaces',
        content:
          'Every Kubernetes cluster starts with three namespaces:\n\n' +
          'default: Where resources go when you don\'t specify a namespace. When you run ' +
          '`kubectl create deployment web --image=nginx`, it lands in default.\n\n' +
          'kube-system: Reserved for Kubernetes system components — the API server, scheduler, controller manager, ' +
          'CoreDNS, and kube-proxy. You should never deploy your own workloads here.\n\n' +
          'kube-public: A special namespace that is readable by all users, including unauthenticated ones. ' +
          'It is mostly used for cluster discovery information. In practice, you rarely interact with it directly.\n\n' +
          'For most real-world clusters, you\'ll create additional namespaces to organize your workloads — ' +
          'one per team, one per environment (dev, staging, production), or one per application.',
        keyTakeaway:
          'Kubernetes ships with default, kube-system, and kube-public. You create additional namespaces to organize workloads by team, environment, or application.',
      },
      {
        title: 'Creating and Using Namespaces',
        content:
          'Creating a namespace is straightforward:\n\n' +
          '`kubectl create namespace dev`\n\n' +
          'Once created, you can deploy resources into it by adding the -n flag:\n\n' +
          '`kubectl create deployment api --image=nginx -n dev`\n\n' +
          'Without the -n flag, resources always go to default. You can change your default namespace with:\n\n' +
          '`kubectl config set-context --current --namespace=dev`\n\n' +
          'To see resources across all namespaces:\n\n' +
          '`kubectl get pods --all-namespaces` (or `-A` for short)\n\n' +
          'Some resources are namespace-scoped (pods, deployments, services, configmaps), meaning they live inside ' +
          'a specific namespace. Others are cluster-scoped (nodes, namespaces themselves, persistent volumes), ' +
          'meaning they exist outside any namespace.',
        keyTakeaway:
          'Use `kubectl create namespace` to create one, `-n` to target it, and `--all-namespaces` to see everything. Most resources are namespace-scoped; a few (nodes, namespaces) are cluster-scoped.',
      },
      {
        title: 'Resource Isolation and Quotas',
        content:
          'Namespaces alone only provide name scoping — they don\'t prevent resource hogging. ' +
          'To enforce limits, you pair namespaces with ResourceQuotas. A ResourceQuota sets hard limits on ' +
          'how many objects (pods, services, configmaps) or how much compute (CPU, memory) a namespace can consume.\n\n' +
          'For example, you might give the "dev" namespace a quota of 10 pods and 4 CPU cores, while "production" ' +
          'gets 100 pods and 32 cores. If a team in "dev" tries to create an 11th pod, the API server rejects the request.\n\n' +
          'LimitRanges complement quotas by setting defaults and constraints for individual containers. ' +
          'If a developer forgets to set resource requests, a LimitRange can inject default values automatically.\n\n' +
          'Together, namespaces + ResourceQuotas + LimitRanges give cluster administrators fine-grained control ' +
          'over who uses what and how much.',
        keyTakeaway:
          'Namespaces provide the boundary; ResourceQuotas enforce limits within that boundary. This prevents any single team from starving others of cluster resources.',
      },
      {
        title: 'Cross-Namespace Communication',
        content:
          'Namespaces isolate names, not networks. By default, a pod in namespace "frontend" can talk to a service ' +
          'in namespace "backend." Kubernetes DNS makes this possible with fully qualified service names:\n\n' +
          '`<service-name>.<namespace>.svc.cluster.local`\n\n' +
          'So a pod in "frontend" can reach the "api" service in "backend" at:\n\n' +
          '`api.backend.svc.cluster.local`\n\n' +
          'Within the same namespace, you just use the short name: `api`. Across namespaces, you need the full ' +
          'DNS name or at least `api.backend`.\n\n' +
          'If you want to restrict cross-namespace traffic, you need Network Policies (a separate topic). ' +
          'Without them, all namespaces can freely communicate. Namespaces are an organizational tool, ' +
          'not a security boundary by themselves.',
        keyTakeaway:
          'Pods in different namespaces can communicate via DNS: <service>.<namespace>.svc.cluster.local. Namespaces isolate names, not network traffic. Use Network Policies for actual traffic restriction.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A pod in the "frontend" namespace needs to call a service named "api" in the "backend" namespace. A junior engineer says this is impossible because namespaces isolate workloads. Is this correct?',
      choices: [
        'No -- namespaces isolate resource names, not network traffic; the pod can reach the service at api.backend.svc.cluster.local',
        'Yes -- namespaces provide full network isolation by default, so cross-namespace traffic is blocked',
        'No -- but the admin must first create a ServiceExport to allow cross-namespace DNS resolution',
        'Yes -- unless a NetworkPolicy explicitly permits traffic between the two namespaces',
      ],
      correctIndex: 0,
      explanation:
        'This is one of the most common misconceptions about namespaces. Namespaces provide name scoping and a boundary for RBAC and quotas, but they do NOT isolate network traffic. Any pod can reach any service in any namespace using the fully qualified DNS name: <service>.<namespace>.svc.cluster.local. To actually restrict cross-namespace traffic, you need Network Policies, which are a separate resource. Many teams mistakenly believe deploying to separate namespaces gives them network segmentation.',
    },
    {
      question:
        'Which of the following resources is cluster-scoped (NOT namespace-scoped)?',
      choices: [
        'ConfigMap',
        'Node',
        'Service',
        'Deployment',
      ],
      correctIndex: 1,
      explanation:
        'Nodes are cluster-scoped -- they exist outside any namespace because they are physical or virtual machines shared by the entire cluster. Other cluster-scoped resources include Namespaces themselves, PersistentVolumes, ClusterRoles, and ClusterRoleBindings. By contrast, ConfigMaps, Deployments, Services, Pods, and Secrets are all namespace-scoped. Understanding which resources are cluster-scoped vs namespace-scoped matters for RBAC, because granting access to cluster-scoped resources affects the entire cluster.',
    },
    {
      question:
        'Two teams both deploy a service called "api" -- Team A in the "team-a" namespace and Team B in the "team-b" namespace. A pod in "team-a" calls "http://api:8080". Which service does it reach?',
      choices: [
        'The request fails because Kubernetes cannot resolve an ambiguous service name present in multiple namespaces',
        'It reaches whichever "api" service was created first, since creation order determines DNS priority',
        'It reaches the "api" service in "team-a", because short DNS names resolve within the calling pod\'s own namespace',
        'Kubernetes round-robins between both "api" services since they share the same DNS short name',
      ],
      correctIndex: 2,
      explanation:
        'Short service names (without the namespace suffix) resolve within the calling pod\'s own namespace. So a pod in "team-a" calling "api" reaches team-a\'s api service. To reach team-b\'s service, it must use the qualified name "api.team-b" or "api.team-b.svc.cluster.local". This is the core value of namespace name-scoping: two teams can use identical resource names without conflict, and the DNS resolution is predictable based on the caller\'s namespace.',
    },
    {
      question:
        'You set a ResourceQuota on the "dev" namespace limiting it to 10 pods. A developer tries to scale a deployment to 12 replicas. What happens?',
      choices: [
        'The API server rejects the scale command and the deployment remains at its current replica count',
        'The deployment scales to 12 but the excess 2 pods are immediately evicted by the quota controller',
        'The ResourceQuota is soft-enforced, logging a warning but allowing all 12 pods to be created',
        'The deployment spec updates to 12, but only 10 pods are created -- the remaining 2 are rejected with a quota exceeded event',
      ],
      correctIndex: 3,
      explanation:
        'ResourceQuotas are enforced at pod creation time, not at the deployment spec level. The deployment spec successfully updates to 12 replicas, and the ReplicaSet tries to create 12 pods. The first 10 succeed, but pods 11 and 12 are rejected by the admission controller with a quota exceeded error. The deployment shows a mismatch between desired and actual replicas, and events reveal the quota violation. This is important to understand because the deployment itself does not fail -- it just cannot reach its desired state.',
    },
    {
      question:
        'A developer creates a pod in the "dev" namespace. The namespace has no LimitRange, and the developer does not set any resource requests or limits. What QoS class does the pod get?',
      choices: [
        'Guaranteed — Kubernetes assigns generous default requests and limits automatically',
        'BestEffort — no requests or limits means the lowest QoS class, evicted first under node pressure',
        'Burstable — Kubernetes injects a small default memory request but leaves limits unset',
        'The pod creation is rejected because every namespace requires a LimitRange for pod admission',
      ],
      correctIndex: 1,
      explanation:
        'Without a LimitRange in the namespace, Kubernetes does not inject any default resource values. A pod with no requests or limits receives BestEffort QoS — the lowest priority. Under node memory pressure, BestEffort pods are evicted first. This is why LimitRanges are important: they set default resource requests and limits for pods that don\'t specify them, preventing accidental BestEffort workloads. Many production clusters require LimitRanges in every namespace as a safety net.',
    },
    {
      question:
        'A cluster admin wants to ensure that the "payments" team can only view Secrets in their own namespace, not in the "orders" namespace. What Kubernetes mechanism enforces this?',
      choices: [
        'Namespaces enforce this automatically — resources in one namespace are invisible to users in another namespace',
        'Network Policies can be configured to restrict cross-namespace access to Secrets at the API level',
        'ResourceQuotas can be set per namespace to restrict which resource types a team is allowed to access',
        'RBAC — a Role in the "payments" namespace grants Secret read access, bound to the team\'s ServiceAccount; no Role in "orders" means no access',
      ],
      correctIndex: 3,
      explanation:
        'Namespaces provide name scoping but NOT access control by themselves. Without RBAC, any authenticated user could read resources in any namespace. RBAC (Role-Based Access Control) is the mechanism that restricts access: a Role defines permissions within a namespace, and a RoleBinding grants those permissions to a user or ServiceAccount. If the team has a Role allowing Secret reads only in "payments", they cannot read Secrets in "orders". This is why namespaces and RBAC work together — namespaces provide the boundary, RBAC enforces it.',
    },
  ],
  initialState: () => {
    return {
      deployments: [],
      replicaSets: [],
      pods: [],
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
            allocatedPods: 0,
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
            allocatedPods: 0,
          },
        },
      ],
      services: [],
      events: [],
      namespaces: [
        {
          kind: 'Namespace' as const,
          metadata: {
            name: 'default',
            uid: generateUID(),
            labels: { 'kubernetes.io/metadata.name': 'default' },
            creationTimestamp: Date.now() - 600000,
          },
          status: { phase: 'Active' as const },
        },
      ],
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
    // Need at least 2 namespaces (default + dev)
    if (state.namespaces.length < 2) return false;

    // Need a deployment with readyReplicas >= 2
    const dep = state.deployments.find((d) => d.metadata.name === 'web');
    if (!dep) return false;
    if ((dep.status.readyReplicas || 0) < 2) return false;

    return true;
  },
};
