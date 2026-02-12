import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonCapstoneTroubleshooting: Lesson = {
  id: 8,
  title: 'Capstone: Troubleshooting',
  description:
    'Put everything together by diagnosing and fixing a broken cluster with multiple simultaneous issues.',
  mode: 'full',
  goalDescription:
    'Find and fix all issues: the frontend deployment only has 1 replica (needs 3), the backend has an image typo ("nignx:2.0"), the backend-svc has the wrong selector, and one node is cordoned. Scale, fix, and restore everything.',
  successMessage:
    'Congratulations! You diagnosed and fixed: backend image typo, wrong service selector, ' +
    'cordoned node, and under-scaled frontend. Four distinct issues, one systematic approach.',
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
          '5. `kubectl get nodes` \u2014 any NotReady or SchedulingDisabled? Nodes that can\'t accept pods explain scheduling failures.\n\n' +
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
      question:
        'A Service named "backend-svc" shows 0 endpoints, but "kubectl get pods" shows 3 backend pods in Running state. What is the most likely cause?',
      choices: [
        'The pods are Running but not yet Ready -- they may be failing their configured readiness probes',
        'The Service\'s label selector does not match the labels on the Running pods (e.g., "app: back-end" vs "app: backend")',
        'The Service is in a different namespace than the pods, so the endpoints controller cannot find them',
        'The Service port does not match the container port, which prevents endpoints from being registered',
      ],
      correctIndex: 1,
      explanation:
        'Endpoints are populated by matching the Service\'s selector against pod labels. If there is any mismatch -- even a small one like a hyphen ("back-end" vs "backend") -- the Service finds zero matching pods, resulting in 0 endpoints despite pods being Running. Option A is plausible (only Ready pods become endpoints), but the scenario says pods are Running, and by default pods without readiness probes are considered Ready. Port mismatches do not affect endpoint registration -- they cause connection failures, not missing endpoints.',
    },
    {
      question:
        'You are troubleshooting a cluster and find: frontend deployment has 1/3 pods running, backend pods show ImagePullError, one node is cordoned (SchedulingDisabled). You only have time to fix one thing first. Which fix restores the most user-facing functionality?',
      choices: [
        'Uncordon the cordoned node to restore scheduling capacity for all pending pods',
        'Scale the frontend deployment down to 1 replica to match available node capacity',
        'Delete and recreate both deployments to force a clean state across the entire cluster',
        'Fix the backend image name so backend pods can start and restore that application tier',
      ],
      correctIndex: 3,
      explanation:
        'Fixing the backend image unblocks all backend pods from starting, which restores an entire tier of the application. The frontend already has 1 pod running (partial service). Uncordoning a node helps with capacity but does not fix the root cause of the backend failure. In production triage, restoring a completely broken tier (0 pods serving) takes priority over scaling up a partially working one (1/3 pods serving). This tests the ability to prioritize based on impact, not just alphabetical order of symptoms.',
    },
    {
      question:
        'After running "kubectl get events", you see both "FailedScheduling: 0/3 nodes are available" and "ImagePullError: image not found" warnings. These are for pods in the same deployment. What does this tell you about the deployment?',
      choices: [
        'The FailedScheduling is caused by the ImagePullError -- fixing the image name will resolve both issues',
        'The events are stale from a previous rollout and may not reflect the current deployment state',
        'Some pods failed at scheduling while others were scheduled but failed to pull the image -- multiple failure points in one deployment',
        'The deployment has two independent problems, but FailedScheduling always takes priority over ImagePullError in triage',
      ],
      correctIndex: 2,
      explanation:
        'A deployment creating multiple replicas can have pods fail at different stages. Some pods might land on nodes that are full (FailedScheduling), while others get scheduled successfully but fail to pull the image (ImagePullError). These are independent failures requiring separate fixes: the image name needs correcting AND scheduling capacity needs attention. This illustrates why systematic debugging matters -- a single deployment can exhibit multiple failure modes simultaneously. Option D is a good debugging practice but does not explain what the events mean.',
    },
    {
      question:
        'A colleague says: "The pods keep crashing, so I\'ll just delete them and let Kubernetes recreate them." Under what condition would this actually solve the problem?',
      choices: [
        'It would work if the crash is caused by corrupted container-local state or a transient dependency that is now available',
        'It would always work because Kubernetes creates fresh pods from the current deployment spec each time',
        'It would never work because new pods use the same image and config, so they will crash identically',
        'It would only work if you also restart the node to clear its container runtime cache simultaneously',
      ],
      correctIndex: 0,
      explanation:
        'Deleting pods usually does not fix crashes because new pods use the same image and config. However, there are edge cases where it helps: corrupted container-local storage, stale DNS cache, a transient dependency that is now available, or a race condition that does not reproduce on fresh start. Option C is the common wisdom and is correct most of the time, but understanding the exceptions makes you a better debugger. The key principle: diagnose before acting. If "kubectl logs" shows a consistent error, deleting pods will not help. If logs show intermittent issues, a restart might.',
    },
  ],
  practices: [
    {
      title: 'Multi-Issue Cluster Repair',
      goalDescription:
        'Find and fix all issues: the frontend deployment only has 1 replica (needs 3), the backend has an image typo ("nignx:2.0"), the backend-svc has the wrong selector, and one node is cordoned. Scale, fix, and restore everything.',
      successMessage:
        'Congratulations! You diagnosed and fixed: backend image typo, wrong service selector, cordoned node, and under-scaled frontend. Four distinct issues, one systematic approach.',
      podFailureRules: { 'nignx:2.0': 'ImagePullError' },
      initialState: () => {
        const frontendImage = 'nginx:1.0';
        const frontendHash = templateHash({ image: frontendImage });
        const frontendDepUid = generateUID();
        const frontendRsUid = generateUID();
        const frontendPods = Array.from({ length: 1 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`frontend-${frontendHash.slice(0, 10)}`), uid: generateUID(),
            labels: { app: 'frontend', 'pod-template-hash': frontendHash },
            ownerReference: { kind: 'ReplicaSet', name: `frontend-${frontendHash.slice(0, 10)}`, uid: frontendRsUid },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image: frontendImage },
          status: { phase: 'Running' as const },
        }));

        const backendBadImage = 'nignx:2.0';
        const backendHash = templateHash({ image: backendBadImage });
        const backendDepUid = generateUID();
        const backendRsUid = generateUID();
        const backendPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`backend-${backendHash.slice(0, 10)}`), uid: generateUID(),
            labels: { app: 'backend', 'pod-template-hash': backendHash },
            ownerReference: { kind: 'ReplicaSet', name: `backend-${backendHash.slice(0, 10)}`, uid: backendRsUid },
            creationTimestamp: Date.now() - 30000,
          },
          spec: { image: backendBadImage, failureMode: 'ImagePullError' as const },
          status: { phase: 'Pending' as const, reason: 'ImagePullError', message: 'Failed to pull image "nignx:2.0"' },
        }));

        const nodeNames = ['node-1', 'node-2', 'node-3'];
        const nodes = nodeNames.map((name, i) => ({
          kind: 'Node' as const,
          metadata: { name, uid: generateUID(), labels: { 'kubernetes.io/hostname': name }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 4 }, ...(i === 2 ? { unschedulable: true } : {}) },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as 'True' | 'False' }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: i === 2 ? 0 : 2,
          },
        }));

        return {
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: { name: 'frontend', uid: frontendDepUid, labels: { app: 'frontend' }, creationTimestamp: Date.now() - 120000 },
              spec: {
                replicas: 1, selector: { app: 'frontend' },
                template: { labels: { app: 'frontend' }, spec: { image: frontendImage } },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: { replicas: 1, updatedReplicas: 1, readyReplicas: 1, availableReplicas: 1, conditions: [{ type: 'Available', status: 'True' }] },
            },
            {
              kind: 'Deployment' as const,
              metadata: { name: 'backend', uid: backendDepUid, labels: { app: 'backend' }, creationTimestamp: Date.now() - 120000 },
              spec: {
                replicas: 3, selector: { app: 'backend' },
                template: { labels: { app: 'backend' }, spec: { image: backendBadImage } },
                strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
              },
              status: { replicas: 2, updatedReplicas: 2, readyReplicas: 0, availableReplicas: 0, conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }] },
            },
          ],
          replicaSets: [
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `frontend-${frontendHash.slice(0, 10)}`, uid: frontendRsUid,
                labels: { app: 'frontend', 'pod-template-hash': frontendHash },
                ownerReference: { kind: 'Deployment', name: 'frontend', uid: frontendDepUid },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 1, selector: { app: 'frontend', 'pod-template-hash': frontendHash },
                template: { labels: { app: 'frontend', 'pod-template-hash': frontendHash }, spec: { image: frontendImage } },
              },
              status: { replicas: 1, readyReplicas: 1 },
            },
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `backend-${backendHash.slice(0, 10)}`, uid: backendRsUid,
                labels: { app: 'backend', 'pod-template-hash': backendHash },
                ownerReference: { kind: 'Deployment', name: 'backend', uid: backendDepUid },
                creationTimestamp: Date.now() - 60000,
              },
              spec: {
                replicas: 3, selector: { app: 'backend', 'pod-template-hash': backendHash },
                template: { labels: { app: 'backend', 'pod-template-hash': backendHash }, spec: { image: backendBadImage } },
              },
              status: { replicas: 2, readyReplicas: 0 },
            },
          ],
          pods: [...frontendPods, ...backendPods],
          nodes,
          services: [
            {
              kind: 'Service' as const,
              metadata: { name: 'frontend-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 },
              spec: { selector: { app: 'frontend' }, port: 80 },
              status: { endpoints: frontendPods.map(p => p.metadata.name) },
            },
            {
              kind: 'Service' as const,
              metadata: { name: 'backend-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 },
              spec: { selector: { app: 'back-end' }, port: 8080 },
              status: { endpoints: [] },
            },
          ],
          events: [
            { timestamp: Date.now() - 30000, tick: 0, type: 'Warning' as const, reason: 'ImagePullError', objectKind: 'Pod', objectName: backendPods[0]?.metadata.name || 'backend-pod', message: 'Failed to pull image "nignx:2.0": image not found' },
            { timestamp: Date.now() - 25000, tick: 0, type: 'Warning' as const, reason: 'FailedScheduling', objectKind: 'Pod', objectName: 'backend-pending', message: 'Node node-3 is not ready' },
          ],
        };
      },
      goals: [
        {
          description: 'Fix the backend image with "kubectl set image"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('set-image'),
        },
        {
          description: 'Fix the service selector with "kubectl patch"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('patch'),
        },
        {
          description: 'Restore the cordoned node with "kubectl uncordon"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('uncordon'),
        },
        {
          description: 'Scale the frontend with "kubectl scale"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('scale'),
        },
        {
          description: 'Fix the backend image typo (currently "nignx:2.0")',
          check: (s: ClusterState) => {
            const backend = s.deployments.find(d => d.metadata.name === 'backend');
            return !!backend && backend.spec.template.spec.image === 'nginx:2.0';
          },
        },
        {
          description: 'Fix the backend-svc selector to match backend pods (app=backend)',
          check: (s: ClusterState) => {
            const svc = s.services.find(svc => svc.spec.selector['app'] === 'backend');
            return !!svc && svc.status.endpoints.length > 0;
          },
        },
        {
          description: 'Uncordon the cordoned node',
          check: (s: ClusterState) => s.nodes.every(n => !n.spec.unschedulable),
        },
        {
          description: 'Scale frontend deployment to 3 replicas',
          check: (s: ClusterState) => {
            const frontend = s.deployments.find(d => d.metadata.name === 'frontend');
            return !!frontend && frontend.spec.replicas >= 3;
          },
        },
        {
          description: '3 Running frontend pods and 3 Running backend pods',
          check: (s: ClusterState) => {
            const frontendRunning = s.pods.filter(p => p.metadata.labels['app'] === 'frontend' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
            const backendRunning = s.pods.filter(p => p.metadata.labels['app'] === 'backend' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp);
            return frontendRunning.length >= 3 && backendRunning.length >= 3;
          },
        },
      ],
      hints: [
        { text: 'Start with kubectl get pods to identify which pods are not Running, and kubectl get deployments to check replica counts.' },
        { text: 'Check events with kubectl get events for error details.' },
        { text: 'The backend deployment has an image typo — look at the image name carefully.' },
        { text: 'kubectl set image deployment/backend nginx:2.0', exact: false },
        { text: 'The backend-svc selector doesn\'t match the backend pods. Compare labels with kubectl describe service backend-svc.' },
        { text: 'kubectl patch service backend-svc --selector=app=backend', exact: true },
        { text: 'One node is cordoned (SchedulingDisabled). Use kubectl get nodes to find it, then uncordon it.' },
        { text: 'The frontend deployment only has 1 replica — scale it to 3.' },
        { text: 'kubectl scale deployment frontend --replicas=3', exact: true },
      ],
    },
    {
      title: 'Cascading Failures',
      goalDescription:
        'Multiple deployments are failing simultaneously. Use logs and events to diagnose each issue, then fix all deployments to get 6 pods Running.',
      successMessage:
        'You triaged multiple simultaneous failures — CrashLoopBackOff and OOMKilled — and fixed them all. In production, always triage by impact: fix the most critical service first.',
      podFailureRules: { 'payment:1.0': 'CrashLoopBackOff', 'redis-oom:1.0': 'OOMKilled' },
      initialState: () => {
        const paymentDepUid = generateUID();
        const paymentRsUid = generateUID();
        const paymentImage = 'payment:1.0';
        const paymentHash = templateHash({ image: paymentImage });

        const cacheDepUid = generateUID();
        const cacheRsUid = generateUID();
        const cacheImage = 'redis-oom:1.0';
        const cacheHash = templateHash({ image: cacheImage });

        const gatewayDepUid = generateUID();
        const gatewayRsUid = generateUID();
        const gatewayImage = 'gateway:1.0';
        const gatewayHash = templateHash({ image: gatewayImage });

        const nodes = ['node-1', 'node-2', 'node-3'].map(name => ({
          kind: 'Node' as const,
          metadata: { name, uid: generateUID(), labels: { 'kubernetes.io/hostname': name }, creationTimestamp: Date.now() - 300000 },
          spec: { capacity: { pods: 5 } },
          status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 2 },
        }));

        const paymentPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`payment-api-${paymentHash.slice(0, 10)}`), uid: generateUID(),
            labels: { app: 'payment-api', 'pod-template-hash': paymentHash },
            ownerReference: { kind: 'ReplicaSet', name: `payment-api-${paymentHash.slice(0, 10)}`, uid: paymentRsUid },
            creationTimestamp: Date.now() - 30000,
          },
          spec: { image: paymentImage, failureMode: 'CrashLoopBackOff' as const, logs: ['[startup] Container started with image payment:1.0', '[fatal] Process exited with code 1', '[error] Back-off restarting failed container'] },
          status: { phase: 'CrashLoopBackOff' as const, reason: 'CrashLoopBackOff', message: 'Back-off restarting failed container', restartCount: 5 },
        }));

        const cachePods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`cache-server-${cacheHash.slice(0, 10)}`), uid: generateUID(),
            labels: { app: 'cache-server', 'pod-template-hash': cacheHash },
            ownerReference: { kind: 'ReplicaSet', name: `cache-server-${cacheHash.slice(0, 10)}`, uid: cacheRsUid },
            creationTimestamp: Date.now() - 30000,
          },
          spec: { image: cacheImage, failureMode: 'OOMKilled' as const, logs: ['[startup] Container started with image redis-oom:1.0', '[fatal] Container killed: OOMKilled — memory limit exceeded'] },
          status: { phase: 'Failed' as const, reason: 'OOMKilled', message: 'Container exceeded memory limit', restartCount: 3 },
        }));

        const gatewayPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`web-gateway-${gatewayHash.slice(0, 10)}`), uid: generateUID(),
            labels: { app: 'web-gateway', 'pod-template-hash': gatewayHash },
            ownerReference: { kind: 'ReplicaSet', name: `web-gateway-${gatewayHash.slice(0, 10)}`, uid: gatewayRsUid },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image: gatewayImage },
          status: { phase: 'Running' as const },
        }));

        return {
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: { name: 'payment-api', uid: paymentDepUid, labels: { app: 'payment-api' }, creationTimestamp: Date.now() - 120000 },
              spec: { replicas: 2, selector: { app: 'payment-api' }, template: { labels: { app: 'payment-api' }, spec: { image: paymentImage } }, strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 } },
              status: { replicas: 2, updatedReplicas: 2, readyReplicas: 0, availableReplicas: 0, conditions: [] },
            },
            {
              kind: 'Deployment' as const,
              metadata: { name: 'cache-server', uid: cacheDepUid, labels: { app: 'cache-server' }, creationTimestamp: Date.now() - 120000 },
              spec: { replicas: 2, selector: { app: 'cache-server' }, template: { labels: { app: 'cache-server' }, spec: { image: cacheImage } }, strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 } },
              status: { replicas: 2, updatedReplicas: 2, readyReplicas: 0, availableReplicas: 0, conditions: [] },
            },
            {
              kind: 'Deployment' as const,
              metadata: { name: 'web-gateway', uid: gatewayDepUid, labels: { app: 'web-gateway' }, creationTimestamp: Date.now() - 120000 },
              spec: { replicas: 2, selector: { app: 'web-gateway' }, template: { labels: { app: 'web-gateway' }, spec: { image: gatewayImage } }, strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 } },
              status: { replicas: 2, updatedReplicas: 2, readyReplicas: 2, availableReplicas: 2, conditions: [{ type: 'Available', status: 'True' }] },
            },
          ],
          replicaSets: [
            {
              kind: 'ReplicaSet' as const,
              metadata: { name: `payment-api-${paymentHash.slice(0, 10)}`, uid: paymentRsUid, labels: { app: 'payment-api', 'pod-template-hash': paymentHash }, ownerReference: { kind: 'Deployment', name: 'payment-api', uid: paymentDepUid }, creationTimestamp: Date.now() - 120000 },
              spec: { replicas: 2, selector: { app: 'payment-api', 'pod-template-hash': paymentHash }, template: { labels: { app: 'payment-api', 'pod-template-hash': paymentHash }, spec: { image: paymentImage } } },
              status: { replicas: 2, readyReplicas: 0 },
            },
            {
              kind: 'ReplicaSet' as const,
              metadata: { name: `cache-server-${cacheHash.slice(0, 10)}`, uid: cacheRsUid, labels: { app: 'cache-server', 'pod-template-hash': cacheHash }, ownerReference: { kind: 'Deployment', name: 'cache-server', uid: cacheDepUid }, creationTimestamp: Date.now() - 120000 },
              spec: { replicas: 2, selector: { app: 'cache-server', 'pod-template-hash': cacheHash }, template: { labels: { app: 'cache-server', 'pod-template-hash': cacheHash }, spec: { image: cacheImage } } },
              status: { replicas: 2, readyReplicas: 0 },
            },
            {
              kind: 'ReplicaSet' as const,
              metadata: { name: `web-gateway-${gatewayHash.slice(0, 10)}`, uid: gatewayRsUid, labels: { app: 'web-gateway', 'pod-template-hash': gatewayHash }, ownerReference: { kind: 'Deployment', name: 'web-gateway', uid: gatewayDepUid }, creationTimestamp: Date.now() - 120000 },
              spec: { replicas: 2, selector: { app: 'web-gateway', 'pod-template-hash': gatewayHash }, template: { labels: { app: 'web-gateway', 'pod-template-hash': gatewayHash }, spec: { image: gatewayImage } } },
              status: { replicas: 2, readyReplicas: 2 },
            },
          ],
          pods: [...paymentPods, ...cachePods, ...gatewayPods],
          nodes,
          services: [
            { kind: 'Service' as const, metadata: { name: 'payment-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 }, spec: { selector: { app: 'payment-api' }, port: 8080 }, status: { endpoints: [] } },
            { kind: 'Service' as const, metadata: { name: 'cache-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 }, spec: { selector: { app: 'cache-server' }, port: 6379 }, status: { endpoints: [] } },
            { kind: 'Service' as const, metadata: { name: 'gateway-svc', uid: generateUID(), labels: {}, creationTimestamp: Date.now() - 120000 }, spec: { selector: { app: 'web-gateway' }, port: 80 }, status: { endpoints: gatewayPods.map(p => p.metadata.name) } },
          ],
          events: [
            { timestamp: Date.now() - 20000, tick: 0, type: 'Warning' as const, reason: 'BackOff', objectKind: 'Pod', objectName: 'payment-api-pod', message: 'Back-off restarting failed container (restart count: 5)' },
            { timestamp: Date.now() - 15000, tick: 0, type: 'Warning' as const, reason: 'OOMKilled', objectKind: 'Pod', objectName: 'cache-server-pod', message: 'OOMKilled - container exceeded memory limit' },
          ],
        };
      },
      goals: [
        {
          description: 'Use "kubectl logs" to diagnose the failures',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('logs'),
        },
        {
          description: 'Use "kubectl get events" to see the failure timeline',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-events'),
        },
        {
          description: 'Fix both failing deployments with "kubectl set image"',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('set-image'),
        },
        {
          description: 'Fix payment-api image to "payment:2.0"',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'payment-api');
            return !!dep && dep.spec.template.spec.image === 'payment:2.0';
          },
        },
        {
          description: 'Fix cache-server image to "redis:7.0"',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'cache-server');
            return !!dep && dep.spec.template.spec.image === 'redis:7.0';
          },
        },
        {
          description: 'All 6 pods Running',
          check: (s: ClusterState) => s.pods.filter(p => p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length === 6,
        },
      ],
      hints: [
        { text: 'Run "kubectl logs" on a payment-api pod and a cache-server pod to see what\'s wrong.' },
        { text: 'Run "kubectl get events" to see the timeline of failures.' },
        { text: 'payment-api has CrashLoopBackOff — the image is bad. Fix it with set image.' },
        { text: 'kubectl set image deployment/payment-api payment-api=payment:2.0', exact: true },
        { text: 'cache-server has OOMKilled — the image is bad. Fix it with set image.' },
        { text: 'kubectl set image deployment/cache-server cache-server=redis:7.0', exact: true },
      ],
    },
  ],
};
