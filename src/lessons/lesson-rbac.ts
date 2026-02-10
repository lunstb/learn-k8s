import type { Lesson } from './types';

export const lessonRBAC: Lesson = {
  id: 22,
  title: 'RBAC: Role-Based Access Control',
  description:
    'Understand how Kubernetes controls who can do what through authentication, authorization, Roles, RoleBindings, and ServiceAccounts.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand Role-Based Access Control in Kubernetes.',
  lecture: {
    sections: [
      {
        title: 'Authentication vs Authorization',
        content:
          'Security in Kubernetes has two layers:\n\n' +
          'Authentication (authn): "Who are you?" Every request to the Kubernetes API must prove its identity. ' +
          'This can be a user certificate, a bearer token, or an OpenID Connect token from an identity provider. ' +
          'Kubernetes does not have a built-in user database — it delegates authentication to external systems.\n\n' +
          'Authorization (authz): "What are you allowed to do?" Once Kubernetes knows who you are, it checks ' +
          'whether you have permission to perform the requested action. RBAC (Role-Based Access Control) is the ' +
          'standard authorization mechanism.\n\n' +
          'The flow for every API request:\n' +
          '1. Authentication: validate the identity (reject if invalid)\n' +
          '2. Authorization: check RBAC rules (reject if not permitted)\n' +
          '3. Admission control: validate/mutate the request (optional webhooks)\n' +
          '4. Persist the change to etcd\n\n' +
          'If any step fails, the request is denied. RBAC is the critical middle layer that determines ' +
          'who can create, read, update, or delete which resources.',
        keyTakeaway:
          'Authentication verifies identity ("who are you"). Authorization checks permissions ("what can you do"). RBAC is the authorization layer that maps users to permissions.',
      },
      {
        title: 'Roles and ClusterRoles',
        content:
          'RBAC permissions are defined as Roles (namespaced) or ClusterRoles (cluster-wide).\n\n' +
          'A Role grants permissions within a specific namespace. Example:\n' +
          '  Role: "pod-reader" in namespace "production"\n' +
          '  Rules:\n' +
          '    - resources: [pods]\n' +
          '      verbs: [get, list, watch]\n\n' +
          'This Role allows reading pods, but ONLY in the "production" namespace. It cannot read pods ' +
          'in other namespaces, and it cannot create or delete pods even in production.\n\n' +
          'A ClusterRole grants permissions across all namespaces or for cluster-scoped resources (nodes, ' +
          'namespaces themselves, PersistentVolumes). Example:\n' +
          '  ClusterRole: "node-reader"\n' +
          '  Rules:\n' +
          '    - resources: [nodes]\n' +
          '      verbs: [get, list, watch]\n\n' +
          'Key verbs: get (read one), list (read all), watch (stream changes), create, update, patch, delete.\n\n' +
          'Roles define WHAT actions are allowed on WHICH resources. But they do not specify WHO gets the permissions — ' +
          'that is done by RoleBindings.',
        diagram:
          '  Role (namespaced)         ClusterRole (cluster-wide)\n' +
          '  ─────────────────         ─────────────────────────\n' +
          '  namespace: production     (no namespace)\n' +
          '  resources: [pods]         resources: [nodes]\n' +
          '  verbs: [get, list]        verbs: [get, list, watch]\n' +
          '  \n' +
          '  Scope: one namespace      Scope: entire cluster',
        keyTakeaway:
          'Roles define permissions within a namespace. ClusterRoles define permissions cluster-wide. Both specify which resources and which verbs (actions) are allowed.',
      },
      {
        title: 'RoleBindings and ClusterRoleBindings',
        content:
          'Roles define permissions. RoleBindings connect those permissions to users, groups, or ServiceAccounts.\n\n' +
          'A RoleBinding grants a Role to a subject within a namespace:\n' +
          '  RoleBinding: "read-pods-production"\n' +
          '  roleRef: Role/pod-reader\n' +
          '  subjects:\n' +
          '    - kind: User, name: alice\n' +
          '    - kind: Group, name: developers\n\n' +
          'This gives alice and the developers group permission to read pods in the production namespace.\n\n' +
          'A ClusterRoleBinding grants a ClusterRole cluster-wide:\n' +
          '  ClusterRoleBinding: "global-node-readers"\n' +
          '  roleRef: ClusterRole/node-reader\n' +
          '  subjects:\n' +
          '    - kind: Group, name: ops-team\n\n' +
          'This gives the ops-team group permission to read nodes across the entire cluster.\n\n' +
          'An important pattern: you can use a RoleBinding to bind a ClusterRole to a specific namespace. ' +
          'This lets you define permissions once (as a ClusterRole) and grant them per-namespace via RoleBindings. ' +
          'This avoids duplicating Role definitions across namespaces.',
        keyTakeaway:
          'RoleBindings connect Roles to users/groups in a namespace. ClusterRoleBindings do the same cluster-wide. The pattern is: Role defines permissions, Binding grants them to subjects.',
      },
      {
        title: 'ServiceAccounts: Identity for Pods',
        content:
          'Human users authenticate with certificates or tokens. But what about pods? Applications running ' +
          'in pods often need to access the Kubernetes API — a CI/CD pipeline creating deployments, ' +
          'a monitoring tool reading pod metrics, or a custom controller managing resources.\n\n' +
          'ServiceAccounts provide identity for pods. Every namespace has a "default" ServiceAccount, and you can ' +
          'create additional ones for specific purposes:\n' +
          '  ServiceAccount: "ci-deployer" in namespace "ci"\n\n' +
          'When a pod specifies serviceAccountName: ci-deployer, Kubernetes mounts a token that the pod can use ' +
          'to authenticate with the API server. You then bind Roles to this ServiceAccount:\n' +
          '  RoleBinding: grant ClusterRole/edit to ServiceAccount/ci-deployer in namespace "production"\n\n' +
          'This gives the CI/CD pod permission to create and update resources in production, but nothing else. ' +
          'No access to secrets in other namespaces, no node management, no cluster-admin powers.\n\n' +
          'Best practice: create dedicated ServiceAccounts for each application, bind only the permissions it needs, ' +
          'and never use the default ServiceAccount for production workloads.',
        keyTakeaway:
          'ServiceAccounts give pods an API identity. Bind Roles to ServiceAccounts to grant specific permissions. Always use dedicated ServiceAccounts with minimal permissions for production workloads.',
      },
      {
        title: 'The Principle of Least Privilege',
        content:
          'The golden rule of RBAC: grant the minimum permissions needed for each user, group, or ServiceAccount ' +
          'to do their job. Nothing more.\n\n' +
          'Common patterns:\n\n' +
          'Developers: read-only access to production (get, list, watch pods, logs, events). ' +
          'Full access to their own development namespace (create, update, delete).\n\n' +
          'CI/CD pipelines: create/update Deployments and Services in specific namespaces. ' +
          'No access to Secrets (use sealed-secrets or external secret management).\n\n' +
          'Monitoring: read-only access to all namespaces (get, list, watch across the cluster). ' +
          'No write access to anything.\n\n' +
          'Cluster admins: full access via cluster-admin ClusterRole. Limit to very few people.\n\n' +
          'Anti-patterns to avoid:\n' +
          '- Giving cluster-admin to all developers\n' +
          '- Using the default ServiceAccount for workloads\n' +
          '- Creating ClusterRoleBindings when namespace-scoped RoleBindings suffice\n' +
          '- Granting wildcard (*) verbs or resources',
        keyTakeaway:
          'Least privilege: grant only what is needed, nothing more. Namespace-scoped Roles over ClusterRoles. Dedicated ServiceAccounts over defaults. Specific verbs over wildcards.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A pod in the "orders" namespace needs to list pods in its own namespace. What is the MINIMUM RBAC configuration?',
      choices: [
        'A ClusterRole with pods list permission and a ClusterRoleBinding to the pod\'s ServiceAccount',
        'A ClusterRole with pods list permission and a RoleBinding in "orders" namespace to the pod\'s ServiceAccount',
        'A Role in "orders" with pods list permission and a RoleBinding in "orders" to the pod\'s ServiceAccount',
        'No RBAC needed — pods can always list other pods in their own namespace by default',
      ],
      correctIndex: 2,
      explanation:
        'The minimum setup is a namespace-scoped Role (with get/list on pods) and a RoleBinding in the same namespace. ' +
        'Option B (ClusterRole + RoleBinding) also works and is a common pattern for reuse, but it is not the minimum — ' +
        'a ClusterRole has broader scope than necessary. Option A (ClusterRoleBinding) would grant the permission cluster-wide, ' +
        'violating least privilege. And by default, ServiceAccounts have no permissions to list pods.',
    },
    {
      question:
        'Can a RoleBinding reference a ClusterRole? If so, what happens?',
      choices: [
        'No — a RoleBinding can only reference a Role, and a ClusterRoleBinding can only reference a ClusterRole',
        'Yes — the ClusterRole permissions are granted, but scoped only to the RoleBinding\'s namespace',
        'Yes — the ClusterRole permissions are granted cluster-wide regardless of the RoleBinding\'s namespace',
        'Only if the ClusterRole has the "namespace-bindable" annotation set to true',
      ],
      correctIndex: 1,
      explanation:
        'A RoleBinding CAN reference a ClusterRole. When it does, the ClusterRole\'s permissions are granted only within ' +
        'the RoleBinding\'s namespace — not cluster-wide. This is a powerful and common pattern: define permissions once ' +
        'as a ClusterRole (e.g., "pod-reader"), then use RoleBindings in each namespace to grant those permissions to ' +
        'different users per namespace. This avoids duplicating identical Role definitions across namespaces.',
    },
    {
      question:
        'A new developer creates a Deployment but does not specify a serviceAccountName. The pod runs with the ' +
        '"default" ServiceAccount. In a cluster with no custom RBAC policies, what API permissions does this pod have?',
      choices: [
        'Full admin access to the namespace — the default ServiceAccount has all namespace-scoped permissions',
        'Read-only access to all resources in the cluster for convenience',
        'It depends on the cluster setup, but the default ServiceAccount often has no explicitly granted permissions beyond basic API discovery',
        'Zero permissions — the default ServiceAccount cannot make any API calls at all',
      ],
      correctIndex: 2,
      explanation:
        'The default ServiceAccount\'s permissions vary by cluster configuration. In a fresh cluster with RBAC enabled, ' +
        'it typically has no meaningful permissions beyond API discovery. However, some clusters (especially older ones or ' +
        'those with permissive defaults) may auto-bind broader roles. The key risk is unpredictability — best practice ' +
        'is to always create dedicated ServiceAccounts with explicit, minimal permissions rather than relying on ' +
        'whatever the default happens to allow.',
    },
    {
      question:
        'Your company has 5 namespaces (dev, staging, prod, monitoring, ci). You want to give the "oncall" group read access ' +
        'to pods in all 5 namespaces. What is the most maintainable approach?',
      choices: [
        'Create one ClusterRole "pod-reader" and one ClusterRoleBinding granting it to the "oncall" group',
        'Create 5 identical Roles (one per namespace) and 5 RoleBindings',
        'Create one ClusterRole "pod-reader" and 5 RoleBindings (one per namespace) referencing that ClusterRole',
        'Give the "oncall" group cluster-admin access since they need broad visibility anyway',
      ],
      correctIndex: 0,
      explanation:
        'Since the "oncall" group needs the same pod-read access in ALL namespaces, a single ClusterRoleBinding with a ' +
        'ClusterRole is the most maintainable solution. When a new namespace is added, it is automatically covered. ' +
        'Option C (ClusterRole + per-namespace RoleBindings) is correct but more work to maintain and only preferred when ' +
        'you need different access levels per namespace. Option B duplicates Role definitions. Option D violates least ' +
        'privilege catastrophically.',
    },
  ],
};
