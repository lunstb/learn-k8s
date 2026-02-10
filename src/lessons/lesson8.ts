import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson8: Lesson = {
  id: 8,
  title: 'Capstone: Troubleshooting',
  description:
    'Put everything together by diagnosing and fixing a broken cluster with multiple simultaneous issues.',
  goalDescription:
    'Find and fix all issues: deployments healthy, services have endpoints, all nodes Ready.',
  successMessage:
    'Congratulations! You diagnosed and fixed: under-replicated frontend, image typo on backend, ' +
    'wrong selector on backend-svc, and cordoned node.',
  hints: [
    'Start with: kubectl get pods -- look for non-Running pods.',
    'Check events: kubectl get events',
    'The frontend deployment is under-replicated (check replica count vs running pods).',
    'The backend has an image typo -- check the image name.',
    'The backend-svc has the wrong selector -- compare with pod labels.',
    'One node is cordoned -- check: kubectl get nodes.',
  ],
  lecture: {
    sections: [
      {
        title: 'The Mental Model: Everything Is a Control Loop',
        content:
          'Here\'s the single idea that ties everything together: Kubernetes is a collection of independent control loops, ' +
          'each watching one type of resource and reconciling it toward desired state.\n\n' +
          'The Deployment controller watches Deployments and manages ReplicaSets. ' +
          'The ReplicaSet controller watches ReplicaSets and manages Pods. ' +
          'The scheduler watches unassigned Pods and assigns them to Nodes. ' +
          'The endpoints controller watches Services and updates endpoint lists. ' +
          'The node lifecycle controller watches Nodes and handles failures.\n\n' +
          'Each controller is simple on its own. But together, they create a system that self-heals, ' +
          'scales, updates, and routes traffic \u2014 all automatically. When something breaks, you can trace ' +
          'the problem through these layers because each controller has a single, well-defined responsibility.',
        keyTakeaway:
          'Kubernetes is not one big system \u2014 it\'s many small loops, each doing one job. This modularity is why you can debug it: trace the problem to the controller responsible.',
      },
      {
        title: 'The Debugging Checklist',
        content:
          'When facing a broken cluster, follow this systematic approach:\n\n' +
          '1. `kubectl get pods` \u2014 any non-Running pods? Pending, Failed, CrashLoopBackOff, ' +
          'ImagePullError \u2014 each status tells a specific story.\n\n' +
          '2. `kubectl get events` \u2014 any Warning events? These point directly to root causes.\n\n' +
          '3. `kubectl get deployments` \u2014 replica mismatch? Compare DESIRED vs READY columns.\n\n' +
          '4. `kubectl get services` \u2014 endpoint count = 0? The selector doesn\'t match any Running pods.\n\n' +
          '5. `kubectl get nodes` \u2014 any NotReady or cordoned? Nodes that can\'t accept pods explain scheduling failures.\n\n' +
          '6. `kubectl describe <resource>` \u2014 drill into any specific resource for conditions, events, and config.\n\n' +
          '7. Fix and Reconcile \u2014 always verify your fix worked.',
        keyTakeaway:
          'Systematic debugging beats guessing. Start broad (get pods, events), narrow down (describe), fix, verify. This checklist works for any Kubernetes issue.',
      },
      {
        title: 'Common Issues: Pattern Recognition',
        content:
          'After enough debugging, you\'ll recognize patterns instantly:\n\n' +
          'Under-replicated Deployment: fewer Running pods than desired. Check if pods are failing ' +
          '(ImagePullError, CrashLoopBackOff) or if nodes lack capacity.\n\n' +
          'ImagePullError: wrong image name or missing registry credentials. Fix with `kubectl set image`.\n\n' +
          'CrashLoopBackOff: application crashes on start. Fix the code or configuration causing the crash.\n\n' +
          'Service with 0 endpoints: selector doesn\'t match pod labels. Compare the Service selector with ' +
          'actual pod labels \u2014 even a small difference (app=back-end vs app=backend) means zero matches.\n\n' +
          'Pods stuck Unschedulable: no nodes with capacity. Uncordon a node, add capacity, or reduce pod count.',
        diagram:
          '  Symptom               \u2192 Check            \u2192 Fix\n' +
          '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
          '  Pods not Running      \u2192 describe pod     \u2192 Fix image/config\n' +
          '  Too few pods          \u2192 get deployments  \u2192 Scale or fix failures\n' +
          '  Service 0 endpoints   \u2192 compare selector \u2192 Fix selector labels\n' +
          '  Pods Unschedulable    \u2192 get nodes        \u2192 Uncordon or add capacity',
        keyTakeaway:
          'Most Kubernetes problems fall into a handful of patterns. Learn to recognize the symptom, and the fix becomes obvious. You don\'t need to memorize \u2014 you need to understand why each failure happens.',
      },
      {
        title: 'What Comes Next',
        content:
          'You now understand the complete architecture for stateless workloads:\n\n' +
          'Declare desired state \u2192 controllers reconcile \u2192 pods are scheduled to nodes \u2192 ' +
          'services route traffic \u2192 failures are detected and healed.\n\n' +
          'This is the foundation for everything else in Kubernetes. StatefulSets manage databases and ' +
          'stateful apps. DaemonSets run one pod per node (monitoring agents, log collectors). Jobs run ' +
          'tasks to completion. CronJobs schedule periodic work.\n\n' +
          'All of them follow the same pattern: declare desired state, let controllers reconcile, ' +
          'use labels and selectors for discovery. The debugging skills you\'ve learned \u2014 reading events, ' +
          'checking pod status, comparing selectors, verifying node health \u2014 apply to every Kubernetes ' +
          'workload type.\n\n' +
          'You have the mental model. Everything else is just new resource types built on the same principles.',
        keyTakeaway:
          'Every advanced Kubernetes resource follows the same pattern you already know: declare state, controllers reconcile, labels connect things. You don\'t need to start over \u2014 you need to apply what you\'ve learned to new resource types.',
      },
    ],
  },
  quiz: [
    {
      question: 'A Deployment wants 3 replicas but only 1 pod is Running. What could be wrong?',
      choices: [
        'The Deployment is paused',
        'Pods may be failing (check events for ImagePullError or CrashLoopBackOff) or nodes may lack capacity',
        'The ReplicaSet was deleted',
        'Services are blocking pod creation',
      ],
      correctIndex: 1,
      explanation:
        'Under-replication usually means pods are being created but failing. Check events for ImagePullError ' +
        'or CrashLoopBackOff. Also check if nodes have capacity for scheduling.',
    },
    {
      question: 'A Service shows 0 endpoints but 3 pods are Running. What\'s the issue?',
      choices: [
        'Pods need to be restarted',
        'The Service\'s label selector doesn\'t match the pod labels',
        'Services don\'t work with Deployments',
        'The port number is wrong',
      ],
      correctIndex: 1,
      explanation:
        'Endpoints are based on label selectors. If the Service selector (e.g., app=back-end) doesn\'t match ' +
        'the pod labels (e.g., app=backend), there are 0 endpoints despite Running pods.',
    },
    {
      question: 'You see "FailedScheduling: no nodes available" in events. What should you check?',
      choices: [
        'Pod image name',
        'Node status and capacity (kubectl get nodes)',
        'Service configuration',
        'Deployment strategy',
      ],
      correctIndex: 1,
      explanation:
        'FailedScheduling means the scheduler can\'t find an eligible node. Check if nodes are Ready and ' +
        'have capacity. Cordoned or full nodes can\'t accept pods.',
    },
    {
      question: 'What\'s the correct order for debugging a broken cluster?',
      choices: [
        'Delete all pods, then recreate',
        'Check pod status \u2192 read events \u2192 describe resources \u2192 fix issues \u2192 reconcile',
        'Restart the cluster',
        'Scale everything to 0 then back up',
      ],
      correctIndex: 1,
      explanation:
        'Systematic debugging: observe (get pods, events), diagnose (describe), fix (update image, uncordon, ' +
        'fix selector), verify (reconcile). Never blindly delete -- understand first.',
    },
  ],
  podFailureRules: {
    'nignx:2.0': 'ImagePullError',
  },
  afterTick: (tick, state) => {
    if (tick <= 2) {
      const frontendDep = state.deployments.find((d) => d.metadata.name === 'frontend');
      if (frontendDep) {
        const frontendPods = state.pods.filter(
          (p) =>
            p.metadata.labels['app'] === 'frontend' &&
            p.status.phase === 'Running' &&
            !p.metadata.deletionTimestamp
        );
        if (frontendPods.length > 1) {
          frontendPods[0].status.phase = 'Failed';
          frontendPods[0].status.reason = 'OOMKilled';
          frontendPods[0].status.message = 'Container exceeded memory limit';
        }
      }
    }
    return state;
  },
  initialState: () => {
    const frontendImage = 'nginx:1.0';
    const frontendHash = templateHash({ image: frontendImage });

    // Frontend deployment -- under-replicated (wants 3, only has 1)
    const frontendDepUid = generateUID();
    const frontendRsUid = generateUID();
    const frontendPods = Array.from({ length: 1 }, () => ({
      kind: 'Pod' as const,
      metadata: {
        name: generatePodName(`frontend-${frontendHash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'frontend', 'pod-template-hash': frontendHash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `frontend-${frontendHash.slice(0, 10)}`,
          uid: frontendRsUid,
        },
        creationTimestamp: Date.now() - 60000,
      },
      spec: { image: frontendImage },
      status: { phase: 'Running' as const },
    }));

    // Backend deployment -- image typo
    const backendBadImage = 'nignx:2.0'; // typo!
    const backendHash = templateHash({ image: backendBadImage });
    const backendDepUid = generateUID();
    const backendRsUid = generateUID();
    const backendPods = Array.from({ length: 2 }, () => ({
      kind: 'Pod' as const,
      metadata: {
        name: generatePodName(`backend-${backendHash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'backend', 'pod-template-hash': backendHash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `backend-${backendHash.slice(0, 10)}`,
          uid: backendRsUid,
        },
        creationTimestamp: Date.now() - 30000,
      },
      spec: { image: backendBadImage, failureMode: 'ImagePullError' as const },
      status: { phase: 'Pending' as const, reason: 'ImagePullError', message: 'Failed to pull image "nignx:2.0"' },
    }));

    // Nodes -- node-3 is cordoned/NotReady
    const nodeNames = ['node-1', 'node-2', 'node-3'];
    const nodes = nodeNames.map((name, i) => ({
      kind: 'Node' as const,
      metadata: {
        name,
        uid: generateUID(),
        labels: { 'kubernetes.io/hostname': name },
        creationTimestamp: Date.now() - 300000,
      },
      spec: { capacity: { pods: 4 } },
      status: {
        conditions: [{
          type: 'Ready' as const,
          status: (i === 2 ? 'False' : 'True') as 'True' | 'False',
        }] as [{ type: 'Ready'; status: 'True' | 'False' }],
        allocatedPods: i === 2 ? 0 : 2,
      },
    }));

    return {
      deployments: [
        {
          kind: 'Deployment' as const,
          metadata: {
            name: 'frontend',
            uid: frontendDepUid,
            labels: { app: 'frontend' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'frontend' },
            template: {
              labels: { app: 'frontend' },
              spec: { image: frontendImage },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 1,
            updatedReplicas: 1,
            readyReplicas: 1,
            availableReplicas: 1,
            conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
          },
        },
        {
          kind: 'Deployment' as const,
          metadata: {
            name: 'backend',
            uid: backendDepUid,
            labels: { app: 'backend' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'backend' },
            template: {
              labels: { app: 'backend' },
              spec: { image: backendBadImage },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 2,
            updatedReplicas: 2,
            readyReplicas: 0,
            availableReplicas: 0,
            conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
          },
        },
      ],
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `frontend-${frontendHash.slice(0, 10)}`,
            uid: frontendRsUid,
            labels: { app: 'frontend', 'pod-template-hash': frontendHash },
            ownerReference: {
              kind: 'Deployment',
              name: 'frontend',
              uid: frontendDepUid,
            },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'frontend', 'pod-template-hash': frontendHash },
            template: {
              labels: { app: 'frontend', 'pod-template-hash': frontendHash },
              spec: { image: frontendImage },
            },
          },
          status: { replicas: 1, readyReplicas: 1 },
        },
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `backend-${backendHash.slice(0, 10)}`,
            uid: backendRsUid,
            labels: { app: 'backend', 'pod-template-hash': backendHash },
            ownerReference: {
              kind: 'Deployment',
              name: 'backend',
              uid: backendDepUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: {
            replicas: 3,
            selector: { app: 'backend', 'pod-template-hash': backendHash },
            template: {
              labels: { app: 'backend', 'pod-template-hash': backendHash },
              spec: { image: backendBadImage },
            },
          },
          status: { replicas: 2, readyReplicas: 0 },
        },
      ],
      pods: [...frontendPods, ...backendPods],
      nodes,
      services: [
        {
          kind: 'Service' as const,
          metadata: {
            name: 'frontend-svc',
            uid: generateUID(),
            labels: {},
            creationTimestamp: Date.now() - 120000,
          },
          spec: { selector: { app: 'frontend' }, port: 80 },
          status: { endpoints: frontendPods.map((p) => p.metadata.name) },
        },
        {
          kind: 'Service' as const,
          metadata: {
            name: 'backend-svc',
            uid: generateUID(),
            labels: {},
            creationTimestamp: Date.now() - 120000,
          },
          // Wrong selector! Should be app=backend but says app=back-end
          spec: { selector: { app: 'back-end' }, port: 8080 },
          status: { endpoints: [] },
        },
      ],
      events: [
        {
          timestamp: Date.now() - 30000,
          tick: 0,
          type: 'Warning' as const,
          reason: 'ImagePullError',
          objectKind: 'Pod',
          objectName: backendPods[0]?.metadata.name || 'backend-pod',
          message: 'Failed to pull image "nignx:2.0": image not found',
        },
        {
          timestamp: Date.now() - 25000,
          tick: 0,
          type: 'Warning' as const,
          reason: 'FailedScheduling',
          objectKind: 'Pod',
          objectName: 'backend-pending',
          message: 'Node node-3 is not ready',
        },
      ],
    };
  },
  goalCheck: (state) => {
    // All deployments healthy
    const frontend = state.deployments.find((d) => d.metadata.name === 'frontend');
    const backend = state.deployments.find((d) => d.metadata.name === 'backend');
    if (!frontend || !backend) return false;

    const frontendRunning = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'frontend' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );

    const backendRunning = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'backend' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );

    if (frontendRunning.length < 3 || backendRunning.length < 3) return false;

    // All services have endpoints -- backend-svc must have selector app=backend
    const frontendSvc = state.services.find(
      (s) => s.spec.selector['app'] === 'frontend'
    );
    const backendSvc = state.services.find(
      (s) => s.spec.selector['app'] === 'backend'
    );
    if (!frontendSvc || frontendSvc.status.endpoints.length === 0) return false;
    if (!backendSvc || backendSvc.status.endpoints.length === 0) return false;

    // All nodes Ready
    const allNodesReady = state.nodes.every(
      (n) => n.status.conditions[0].status === 'True'
    );

    return allNodesReady;
  },
};
