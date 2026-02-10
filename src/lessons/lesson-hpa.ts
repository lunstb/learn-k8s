import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonHPA: Lesson = {
  id: 20,
  title: 'Horizontal Pod Autoscaler',
  description:
    'HPA automatically scales your application based on CPU utilization or custom metrics, matching capacity to demand.',
  mode: 'full',
  goalDescription:
    'The "web" pods have high CPU usage (~85%) but no autoscaler. Create an HPA targeting the "web" Deployment with min=2, max=8, target CPU=50%. Reconcile until the HPA scales beyond 2 replicas.',
  successMessage:
    'You created the HPA and it detected high CPU utilization, scaling the deployment up automatically. ' +
    'HPA is the key to matching capacity to demand — no manual intervention needed after setup.',
  yamlTemplate: `apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  name: web
spec:
  scaleTargetRef:
    kind: Deployment
    name: ???
  minReplicas: ???
  maxReplicas: ???
  targetCPUUtilizationPercentage: ???`,
  hints: [
    { text: 'Switch to the YAML Editor tab — fill in scaleTargetRef name as "web", minReplicas as 2, maxReplicas as 8, and targetCPUUtilizationPercentage as 50.' },
    { text: 'Or use the terminal: kubectl autoscale deployment web --min=2 --max=8 --cpu-percent=50', exact: false },
    { text: 'Reconcile to trigger the HPA evaluation loop and see new pods created.' },
  ],
  goals: [
    {
      description: 'Create an HPA for the "web" Deployment (min=2, max=8, cpu=50%)',
      check: (s: ClusterState) => s.hpas.some(h => h.spec.scaleTargetRef.name === 'web'),
    },
    {
      description: 'HPA scales the deployment beyond 2 replicas',
      check: (s: ClusterState) => {
        const dep = s.deployments.find(d => d.metadata.name === 'web');
        return !!dep && dep.spec.replicas > 2;
      },
    },
    {
      description: 'More than 2 "web" pods Running',
      check: (s: ClusterState) => {
        return s.pods.filter(p => p.metadata.labels['app'] === 'web' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length > 2;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Static Scaling Wastes Resources',
        content:
          'You deploy a web application with 3 replicas. During business hours, traffic spikes and each pod hits ' +
          '90% CPU — users experience slow responses. At night, traffic drops and pods sit at 5% CPU — ' +
          'you are paying for capacity you do not need.\n\n' +
          'You could manually scale: `kubectl scale deployment web --replicas=10` during the day and ' +
          '`--replicas=2` at night. But this requires human attention, does not respond to unexpected traffic ' +
          'spikes, and is error-prone.\n\n' +
          'The Horizontal Pod Autoscaler (HPA) solves this by automatically adjusting the replica count based on ' +
          'observed metrics. When CPU goes up, replicas increase. When CPU goes down, replicas decrease. ' +
          'The application scales itself in response to actual demand.',
        keyTakeaway:
          'HPA replaces manual scaling with automatic, metrics-driven scaling. More traffic means more pods; less traffic means fewer pods. Resources match demand without human intervention.',
      },
      {
        title: 'How HPA Works: The Scaling Algorithm',
        content:
          'The HPA controller runs a control loop (every 15 seconds by default) that:\n\n' +
          '1. Collects current metric values from all pods in the target Deployment\n' +
          '2. Computes the average across all pods\n' +
          '3. Compares the average to the target value\n' +
          '4. Calculates desired replicas using: desired = ceil(current * (currentMetric / targetMetric))\n\n' +
          'Example: You have 2 pods at 85% CPU, target is 50%.\n' +
          'desired = ceil(2 * (85 / 50)) = ceil(3.4) = 4 replicas.\n\n' +
          'The HPA then updates the Deployment\'s replica count to 4. The Deployment controller creates ' +
          '2 new pods, and the load is distributed across 4 pods instead of 2.\n\n' +
          'The HPA respects minReplicas and maxReplicas bounds. Even if the calculation says 20 replicas, ' +
          'if maxReplicas=8, it caps at 8. If load drops to near zero, it won\'t go below minReplicas.',
        diagram:
          '  HPA: web-hpa (target CPU: 50%, min: 2, max: 8)\n' +
          '  ─────────────────────────────────────────────────\n' +
          '  Current: 2 pods @ 85% CPU avg\n' +
          '  Formula: ceil(2 * (85/50)) = ceil(3.4) = 4\n' +
          '  Action:  Scale Deployment web from 2 → 4 replicas\n' +
          '  \n' +
          '  Later: 4 pods @ 30% CPU avg\n' +
          '  Formula: ceil(4 * (30/50)) = ceil(2.4) = 3\n' +
          '  Action:  Scale Deployment web from 4 → 3 replicas',
        keyTakeaway:
          'The HPA formula is simple: desired = current replicas * (actual metric / target metric). It scales up when metrics exceed the target and scales down when they drop below.',
      },
      {
        title: 'Metrics Server and Custom Metrics',
        content:
          'HPA needs metric data to make decisions. The default metric source is the Kubernetes Metrics Server, ' +
          'which provides CPU and memory utilization for pods and nodes.\n\n' +
          'CPU-based scaling (targetCPUUtilizationPercentage) is the most common. It measures CPU usage ' +
          'relative to the pod\'s resource request. If a pod requests 500m CPU and uses 400m, utilization is 80%.\n\n' +
          'For more sophisticated scaling, HPA v2 supports custom metrics:\n' +
          '- Requests per second from an Ingress controller\n' +
          '- Queue depth from a message broker\n' +
          '- Active connections from a load balancer\n' +
          '- Any metric exposed via the Custom Metrics API\n\n' +
          'You can even combine multiple metrics. HPA evaluates each one and picks the highest replica count ' +
          'suggestion. This ensures the application has enough capacity for whichever dimension is most stressed.',
        keyTakeaway:
          'Metrics Server provides CPU/memory data for basic HPA. Custom metrics (requests/sec, queue depth) enable smarter scaling based on application-specific indicators.',
      },
      {
        title: 'Scaling Behavior and Cooldown',
        content:
          'Naive autoscaling is dangerous. Imagine: traffic spikes, HPA scales to 10 pods, the spike passes, ' +
          'HPA scales down to 2, traffic returns, scales to 10 again — this "thrashing" wastes resources ' +
          'and destabilizes the application.\n\n' +
          'HPA v2 includes scaling policies that control the rate of change:\n\n' +
          'stabilizationWindowSeconds: HPA considers the highest (for scale-down) or lowest (for scale-up) ' +
          'recommendation over this window before acting. Default: 300 seconds for scale-down, 0 for scale-up.\n\n' +
          'Scale-up is aggressive by default — respond to load spikes quickly. ' +
          'Scale-down is conservative — wait 5 minutes to confirm load actually dropped.\n\n' +
          'You can customize policies per direction:\n' +
          '- Scale up by at most 4 pods per 60 seconds\n' +
          '- Scale down by at most 10% per 60 seconds\n\n' +
          'These guardrails prevent autoscaling oscillation while still responding to genuine load changes.',
        keyTakeaway:
          'Scale-up is fast (respond to spikes immediately). Scale-down is slow (wait to confirm load truly dropped). Stabilization windows and rate limits prevent autoscaling thrashing.',
      },
    ],
  },
  quiz: [
    {
      question:
        'Your deployment has 4 pods, each using 75% CPU. The HPA target is 50% CPU. How many replicas will the HPA calculate?',
      choices: [
        '5 replicas — ceil(4 * 75/50) rounds 6.0 down because the ratio is exact',
        '8 replicas — the formula doubles the pod count when usage exceeds the target',
        '4 replicas — HPA only scales when average CPU exceeds 100%',
        '6 replicas — ceil(4 * 75/50) = ceil(6.0) = 6',
      ],
      correctIndex: 3,
      explanation:
        'The HPA formula is: desired = ceil(currentReplicas * (currentMetric / targetMetric)). ' +
        'ceil(4 * (75/50)) = ceil(4 * 1.5) = ceil(6.0) = 6. Even though 6.0 is already a whole number, ' +
        'the ceiling function confirms it. The HPA scales from 4 to 6 pods so that the load distributes ' +
        'to approximately 50% per pod (4 * 75 = 300 total CPU units / 6 pods = 50% each).',
    },
    {
      question:
        'An HPA targets 50% CPU utilization. Your pods each request 500m CPU. One pod is currently using 400m CPU. ' +
        'What does the HPA consider its CPU utilization percentage to be?',
      choices: [
        '50% — because the pod is using 400m out of a typical 800m node capacity',
        '80% — because utilization is measured against the pod resource REQUEST (400m / 500m)',
        '40% — because utilization is a fraction of 1 full CPU core (1000m)',
        '100% — any usage above 250m is considered fully utilized',
      ],
      correctIndex: 1,
      explanation:
        'HPA measures CPU utilization as a percentage of the pod\'s resource REQUEST, not the node\'s total capacity ' +
        'or a full CPU core. A pod requesting 500m and using 400m is at 80% utilization. This is why setting ' +
        'accurate resource requests is critical for HPA to work correctly. If requests are too low, HPA will ' +
        'think pods are overloaded and scale up excessively. If too high, HPA will underscale.',
    },
    {
      question:
        'You create an HPA for your deployment, but the Metrics Server is not installed in the cluster. What happens?',
      choices: [
        'The HPA falls back to counting pods and uses a round-robin estimation',
        'The HPA scales to maxReplicas as a safety precaution since it cannot measure load',
        'The HPA cannot make scaling decisions and the deployment stays at its current replica count',
        'The HPA scales to minReplicas since it assumes zero load without metrics',
      ],
      correctIndex: 2,
      explanation:
        'Without the Metrics Server, the HPA has no data to feed its scaling formula. It logs events like ' +
        '"unable to get metrics for resource cpu" and takes no scaling action. The deployment remains at whatever ' +
        'replica count it currently has. This is a common gotcha in new clusters — you create an HPA and nothing ' +
        'happens because the Metrics Server was never installed. Check with `kubectl get apiservice v1beta1.metrics.k8s.io`.',
    },
    {
      question:
        'Traffic to your app spikes for 30 seconds then returns to normal. The HPA scales up from 3 to 8 pods during the spike. ' +
        'How quickly does the HPA scale back down to 3?',
      choices: [
        'Immediately — once metrics drop below target, the HPA removes excess pods within 15 seconds',
        'After about 5 minutes — the default scale-down stabilization window prevents premature scale-down',
        'After exactly 60 seconds — the HPA evaluation interval is 15 seconds times 4 cycles',
        'Never automatically — you must manually reduce replicas or delete the HPA and recreate it',
      ],
      correctIndex: 1,
      explanation:
        'The default scale-down stabilization window is 300 seconds (5 minutes). During this window, the HPA ' +
        'considers the highest recommended replica count and will not scale down until the window passes with ' +
        'consistently low recommendations. This prevents thrashing — if the spike returns within 5 minutes, ' +
        'the pods are still there to absorb it. Scale-UP has no stabilization window by default (0 seconds) ' +
        'to respond to spikes immediately.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'web-app:1.0';
    const hash = templateHash({ image });

    const nodeNames = ['node-1', 'node-2', 'node-3'];
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
        name: generatePodName(`web-${hash.slice(0, 10)}`),
        uid: generateUID(),
        labels: { app: 'web', 'pod-template-hash': hash },
        ownerReference: {
          kind: 'ReplicaSet',
          name: `web-${hash.slice(0, 10)}`,
          uid: rsUid,
        },
        creationTimestamp: Date.now() - 60000,
      },
      spec: { image, nodeName: nodeNames[i] },
      status: { phase: 'Running' as const, cpuUsage: 85 },
    }));

    return {
      pods,
      replicaSets: [
        {
          kind: 'ReplicaSet' as const,
          metadata: {
            name: `web-${hash.slice(0, 10)}`,
            uid: rsUid,
            labels: { app: 'web', 'pod-template-hash': hash },
            ownerReference: {
              kind: 'Deployment',
              name: 'web',
              uid: depUid,
            },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 2,
            selector: { app: 'web', 'pod-template-hash': hash },
            template: {
              labels: { app: 'web', 'pod-template-hash': hash },
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
            name: 'web',
            uid: depUid,
            labels: { app: 'web' },
            creationTimestamp: Date.now() - 120000,
          },
          spec: {
            replicas: 2,
            selector: { app: 'web' },
            template: {
              labels: { app: 'web' },
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
      helmReleases: [],
    };
  },
  afterTick: (tick, state) => {
    const webPods = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'web' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );

    if (tick <= 3) {
      // High CPU for first 3 ticks to trigger scale-up
      for (const pod of webPods) {
        pod.status.cpuUsage = 85;
      }
    } else if (tick > 5) {
      // CPU drops after tick 5
      for (const pod of webPods) {
        pod.status.cpuUsage = 30;
      }
    }

    return state;
  },
  goalCheck: (state) => {
    // HPA must exist targeting "web"
    const hpa = state.hpas.find(
      (h) => h.spec.scaleTargetRef.name === 'web'
    );
    if (!hpa) return false;

    const dep = state.deployments.find((d) => d.metadata.name === 'web');
    if (!dep) return false;

    // HPA should have scaled the deployment beyond 2 replicas
    if (dep.spec.replicas <= 2) return false;

    const runningWebPods = state.pods.filter(
      (p) =>
        p.metadata.labels['app'] === 'web' &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );

    return runningWebPods.length > 2;
  },
};
