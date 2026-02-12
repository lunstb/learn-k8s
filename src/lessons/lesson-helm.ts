import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonHelm: Lesson = {
  id: 19,
  title: 'Helm Charts',
  description:
    'Helm is the package manager for Kubernetes. Learn how charts bundle multiple resources into installable, versioned releases.',
  mode: 'full',
  goalDescription:
    'Install a Helm release named "my-app" using the "nginx-chart" chart. Verify the created deployment has healthy Running pods.',
  successMessage:
    'Helm release deployed successfully. Helm simplifies complex deployments by packaging multiple Kubernetes resources ' +
    'into a single chart that can be installed, upgraded, and rolled back as a unit.',
  lecture: {
    sections: [
      {
        title: 'The Problem: Managing Multiple Resources',
        content:
          'A real application is never just one Deployment. A typical web app might need:\n\n' +
          '- A Deployment for the web server\n' +
          '- A Service to expose it\n' +
          '- A ConfigMap for configuration\n' +
          '- A Secret for database credentials\n' +
          '- An Ingress for external access\n' +
          '- A HorizontalPodAutoscaler for scaling\n\n' +
          'That is 6 YAML files that must be applied together, configured consistently, and updated as a unit. ' +
          'Apply them in the wrong order or with mismatched labels, and things break.\n\n' +
          'Multiply this by environments (dev, staging, production) where only the configuration values differ ' +
          '(replica count, image tag, resource limits), and you have a maintenance nightmare. ' +
          'You need a packaging system that bundles resources together and parameterizes the differences.',
        keyTakeaway:
          'Real applications consist of many Kubernetes resources that must be managed as a unit. Helm packages them into a single deployable artifact with configurable parameters.',
      },
      {
        title: 'Charts, Releases, and Repositories',
        content:
          'Helm has three core concepts:\n\n' +
          'Chart: a package of Kubernetes resource templates. A chart for "nginx" contains all the YAML files ' +
          'needed to deploy nginx — Deployment, Service, ConfigMap, etc. — with placeholders for configurable values.\n\n' +
          'Release: a specific installation of a chart. When you run `helm install my-app nginx-chart`, ' +
          '"my-app" is the release name. You can install the same chart multiple times with different names: ' +
          'helm install frontend nginx-chart, helm install backend nginx-chart — each gets its own resources.\n\n' +
          'Repository: where charts are stored and shared. Like npm for Node.js or PyPI for Python. ' +
          'Popular repositories include Bitnami, the official Helm stable repo, and private corporate repos.\n\n' +
          'This separation means chart authors write templates once, and users install them with custom values. ' +
          'You do not need to understand the internals of a complex application to deploy it correctly.',
        diagram:
          '  Chart Repository\n' +
          '  ┌─────────────────┐\n' +
          '  │  nginx-chart    │\n' +
          '  │  redis-chart    │\n' +
          '  │  postgres-chart │\n' +
          '  └────────┬────────┘\n' +
          '           │ helm install my-app nginx-chart\n' +
          '           ▼\n' +
          '  Release: "my-app"\n' +
          '  ├── Deployment (my-app-nginx)\n' +
          '  ├── Service (my-app-nginx-svc)\n' +
          '  └── ConfigMap (my-app-nginx-config)',
        keyTakeaway:
          'Charts are packages of templates. Releases are installations of charts. Repositories store and share charts. This separation lets you reuse the same chart across environments and teams.',
      },
      {
        title: 'Helm Install, Upgrade, and Rollback',
        content:
          'The three operations you use most with Helm:\n\n' +
          '`helm install my-app nginx-chart` — creates a new release. Helm renders the chart templates with ' +
          'your values and applies all resources to the cluster. The release is tracked with a revision number (1).\n\n' +
          '`helm upgrade my-app nginx-chart --set image.tag=2.0` — updates an existing release. ' +
          'Helm computes the diff between the current and new templates, applies changes, and increments ' +
          'the revision (2). Kubernetes handles the actual rolling update of pods.\n\n' +
          'Important gotcha: `--set` values from a previous install or upgrade are NOT automatically carried forward. ' +
          'If you installed with `--set replicaCount=5 --set image.tag=1.0`, then upgraded with `--set image.tag=2.0`, ' +
          'replicaCount reverts to the chart default because it was not specified in the upgrade. ' +
          'Use `helm upgrade --reuse-values` to carry forward existing values, or use a values file ' +
          '(`-f values.yaml`) to ensure all settings are explicitly tracked.\n\n' +
          '`helm rollback my-app 1` — reverts to a previous revision. Helm re-applies the templates from ' +
          'revision 1, effectively undoing the upgrade. This creates a new revision (3) that matches revision 1.\n\n' +
          'Every operation is tracked. `helm history my-app` shows all revisions with timestamps, status, ' +
          'and descriptions. You always know what changed and when.',
        keyTakeaway:
          'Install creates, upgrade updates, rollback reverts. Every change is a tracked revision. Helm gives you a complete deployment history with one-command rollback capability.',
      },
      {
        title: 'Values and Chart Structure',
        content:
          'Charts use Go templates with a values.yaml file for configuration. The values file defines defaults:\n\n' +
          'replicaCount: 3\n' +
          'image:\n' +
          '  repository: nginx\n' +
          '  tag: "1.21"\n' +
          'service:\n' +
          '  type: ClusterIP\n' +
          '  port: 80\n\n' +
          'Users override values at install time: `helm install my-app nginx-chart --set replicaCount=5` ' +
          'or with a custom values file: `helm install my-app nginx-chart -f production-values.yaml`.\n\n' +
          'Chart directory structure:\n' +
          '  my-chart/\n' +
          '    Chart.yaml        — chart metadata (name, version)\n' +
          '    values.yaml       — default configuration values\n' +
          '    templates/        — Kubernetes resource templates\n' +
          '      deployment.yaml\n' +
          '      service.yaml\n' +
          '      configmap.yaml\n\n' +
          'This structure means the same chart deploys identically everywhere. Only the values change between ' +
          'dev (1 replica, no ingress) and production (5 replicas, ingress, TLS).',
        keyTakeaway:
          'values.yaml defines configurable parameters with sensible defaults. Users override values per environment using --set or custom values files. Same chart, different configs.',
      },
    ],
  },
  quiz: [
    {
      question:
        'You run `helm install my-app nginx-chart` successfully. A colleague then runs `helm install my-app nginx-chart` on the same cluster. What happens?',
      choices: [
        'A second set of resources is created alongside the first, both tracked under the name "my-app"',
        'The command fails with an error because the release name "my-app" is already in use in the namespace',
        'The existing release is automatically upgraded to the latest available chart version from the repository',
        'The first release is deleted and then replaced by the new installation under the same release name',
      ],
      correctIndex: 1,
      explanation:
        'Helm release names must be unique within a namespace. Running `helm install` with an already-used release name ' +
        'returns an error like "cannot re-use a name that is still in use." To update an existing release, use ' +
        '`helm upgrade` instead. To install a second instance, choose a different release name.',
    },
    {
      question:
        'You install a chart with `helm install my-app nginx-chart --set replicaCount=5`, then later run ' +
        '`helm upgrade my-app nginx-chart --set image.tag=2.0` without specifying replicaCount. What happens to replicaCount?',
      choices: [
        'It reverts to the chart default because --set values from the prior install are not carried forward on upgrade',
        'It stays at 5 because Helm merges all previous --set values with the new upgrade automatically',
        'The upgrade fails with a validation error because replicaCount is a required value that must be specified',
        'Helm detects the missing override and prompts interactively to confirm before applying the upgrade',
      ],
      correctIndex: 0,
      explanation:
        'When using --set, only the values you explicitly pass are applied on each upgrade. Previous --set overrides ' +
        'are NOT automatically merged. If the chart default for replicaCount is 3, it silently reverts to 3. ' +
        'This is a major reason to prefer values files (-f) over --set for production: a values file captures ' +
        'ALL your overrides in one place and is passed on every upgrade, preventing accidental resets.',
    },
    {
      question:
        'You run `helm rollback my-app 1` to revert from revision 2 back to revision 1. What revision number does the release have after the rollback?',
      choices: [
        'Revision 1 — the release pointer moves back to the original revision directly',
        'Revision 2 — rollback modifies the current revision in place with the old config',
        'The revision counter is cleared — rollback removes all history and starts fresh',
        'Revision 3 — rollback creates a new revision that has the same config as revision 1',
      ],
      correctIndex: 3,
      explanation:
        'Helm rollback does NOT rewind the revision counter. It creates a new revision (3) whose configuration ' +
        'matches the target revision (1). This preserves full audit history — you can see that revision 2 was deployed ' +
        'and then rolled back. Running `helm history my-app` shows all three revisions, with revision 3 marked as a rollback.',
    },
    {
      question:
        'Your team manages 12 microservices across dev, staging, and production. Why are values files (-f) preferred over --set for production deployments?',
      choices: [
        '--set is slower than -f for large value sets because each flag is parsed and validated individually',
        '--set cannot handle nested YAML values like image.repository or complex array structures in charts',
        'Values files are version-controlled and self-documenting, ensuring all overrides are applied on every upgrade',
        'Values files are encrypted at rest by Helm while --set values are persisted in plaintext in the release',
      ],
      correctIndex: 2,
      explanation:
        'Values files can be committed to Git, code-reviewed, and diffed between environments. They ensure every ' +
        'upgrade carries the complete set of overrides — unlike --set, where forgetting a flag silently reverts ' +
        'that value to the chart default. For production, this predictability and auditability is critical. ' +
        '--set is fine for quick experiments but dangerous for repeatable deployments.',
    },
  ],
  practices: [
    {
      title: 'Install a Helm Release',
      goalDescription:
        'Install a Helm release named "my-app" using the "nginx-chart" chart. Verify the created deployment has healthy Running pods.',
      successMessage:
        'Helm release deployed successfully. Helm simplifies complex deployments by packaging multiple Kubernetes resources ' +
        'into a single chart that can be installed, upgraded, and rolled back as a unit.',
      hints: [
        { text: 'Helm installs pre-packaged applications (charts) into your cluster.' },
        { text: 'helm install my-app nginx-chart', exact: true },
        { text: 'Reconcile until the deployment\'s pods reach Running status. Check with helm list.' },
      ],
      goals: [
        {
          description: 'Install a Helm release',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('helm-install'),
        },
        {
          description: 'Install Helm release "my-app" from nginx-chart',
          check: (s: ClusterState) => s.helmReleases.some(r => r.name === 'my-app' && r.status === 'deployed'),
        },
        {
          description: 'Deployment created by the release has Running pods',
          check: (s: ClusterState) => {
            const release = s.helmReleases.find(r => r.name === 'my-app');
            if (!release) return false;
            const dep = s.deployments.find(d => d.metadata.name === release.deploymentName);
            return !!dep && (dep.status.readyReplicas || 0) > 0;
          },
        },
      ],
      initialState: () => {
        const nodeNames = ['node-1', 'node-2'];
        const nodes = nodeNames.map((name) => ({
          kind: 'Node' as const,
          metadata: {
            name,
            uid: generateUID(),
            labels: { 'kubernetes.io/hostname': name },
            creationTimestamp: Date.now() - 300000,
          },
          spec: { capacity: { pods: 5 } },
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
        if (state.helmReleases.length < 1) return false;

        const release = state.helmReleases.find((r) => r.name === 'my-app');
        if (!release || release.status !== 'deployed') return false;

        const dep = state.deployments.find((d) => d.metadata.name === release.deploymentName);
        if (!dep) return false;

        return dep.status.readyReplicas > 0;
      },
    },
    {
      title: 'Clean Up a Helm Release',
      goalDescription:
        'A Helm release "legacy-app" is deployed but no longer needed. List Helm releases to verify, then uninstall it and confirm the deployment is removed.',
      successMessage:
        'Helm uninstall removes all resources created by the release. In production, use --keep-history if you might need to rollback later.',
      hints: [
        { text: 'Run "helm list" to see installed releases.' },
        { text: 'helm uninstall legacy-app', exact: true },
        { text: 'After uninstalling, verify with "kubectl get deployments" that legacy-app is gone.' },
      ],
      goals: [
        {
          description: 'List Helm releases with "helm list"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('helm-list'),
        },
        {
          description: 'Uninstall the "legacy-app" release',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('helm-uninstall'),
        },
        {
          description: 'Deployment "legacy-app" is removed',
          check: (s: ClusterState) => !s.deployments.some(d => d.metadata.name === 'legacy-app'),
        },
      ],
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'nginx:1.0';
        const hash = templateHash({ image });

        const nodeNames = ['node-1', 'node-2'];
        const nodes = nodeNames.map((name) => ({
          kind: 'Node' as const,
          metadata: {
            name,
            uid: generateUID(),
            labels: { 'kubernetes.io/hostname': name },
            creationTimestamp: Date.now() - 300000,
          },
          spec: { capacity: { pods: 5 } },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: 1,
          },
        }));

        const pods = Array.from({ length: 2 }, (_, i) => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`legacy-app-${hash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'legacy-app', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `legacy-app-${hash.slice(0, 10)}`,
              uid: rsUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image, nodeName: nodeNames[i] },
          status: { phase: 'Running' as const },
        }));

        return {
          pods,
          replicaSets: [
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `legacy-app-${hash.slice(0, 10)}`,
                uid: rsUid,
                labels: { app: 'legacy-app', 'pod-template-hash': hash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'legacy-app',
                  uid: depUid,
                },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'legacy-app', 'pod-template-hash': hash },
                template: {
                  labels: { app: 'legacy-app', 'pod-template-hash': hash },
                  spec: { image },
                },
              },
              status: { replicas: 2, readyReplicas: 2 },
            },
          ],
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'legacy-app',
                uid: depUid,
                labels: { app: 'legacy-app' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'legacy-app' },
                template: {
                  labels: { app: 'legacy-app' },
                  spec: { image },
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
          helmReleases: [
            { name: 'legacy-app', chart: 'nginx-chart', status: 'deployed', deploymentName: 'legacy-app' },
          ],
        };
      },
      goalCheck: (state) => {
        const hasDeployedRelease = state.helmReleases.some(
          (r) => r.name === 'legacy-app' && r.status === 'deployed'
        );
        const hasDeployment = state.deployments.some(
          (d) => d.metadata.name === 'legacy-app'
        );
        return !hasDeployedRelease && !hasDeployment;
      },
    },
  ],
};
