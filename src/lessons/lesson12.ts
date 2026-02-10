import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson12: Lesson = {
  id: 12,
  title: 'Resource Requests & Limits',
  description:
    'Resource requests and limits tell Kubernetes how much CPU and memory your containers need, affecting scheduling and stability.',
  mode: 'full',
  goalDescription:
    'Create a Deployment "hungry-app" with image hungry-app:1.0 (which will be OOMKilled), observe the failure, then fix it by changing the image to web-app:1.0. Both "web" and "hungry-app" deployments must be healthy.',
  successMessage:
    'You observed OOMKilled — the container exceeded its memory limit and was killed by the kernel. ' +
    'Setting proper resource limits prevents one container from starving others. In production, always set both requests and limits.',
  hints: [
    { text: 'Start by creating the deployment. Use "kubectl describe pod <name>" after reconciling to see why pods are failing.' },
    { text: 'kubectl create deployment hungry-app --image=hungry-app:1.0', exact: true },
    { text: 'The pods get OOMKilled — you need to change to a working image.' },
    { text: 'kubectl set image deployment/hungry-app hungry-app=web-app:1.0', exact: true },
  ],
  goals: [
    {
      description: 'Create the "hungry-app" Deployment',
      check: (s: ClusterState) => !!s.deployments.find(d => d.metadata.name === 'hungry-app'),
    },
    {
      description: 'Fix the OOMKill by changing the image to web-app:1.0',
      check: (s: ClusterState) => {
        const dep = s.deployments.find(d => d.metadata.name === 'hungry-app');
        return !!dep && dep.spec.template.spec.image !== 'hungry-app:1.0';
      },
    },
    {
      description: 'Both "web" and "hungry-app" deployments fully healthy',
      check: (s: ClusterState) => {
        const web = s.deployments.find(d => d.metadata.name === 'web');
        const hungry = s.deployments.find(d => d.metadata.name === 'hungry-app');
        if (!web || !hungry) return false;
        return [web, hungry].every(dep => (dep.status.readyReplicas || 0) >= dep.spec.replicas);
      },
    },
  ],
  podFailureRules: {
    'hungry-app:1.0': 'OOMKilled',
  },
  lecture: {
    sections: [
      {
        title: 'The Problem: Resource Contention',
        content:
          'Containers share the resources of the node they run on — CPU, memory, disk I/O. Without any controls, ' +
          'a single misbehaving container can consume all available memory and crash everything else on the node.\n\n' +
          'Imagine three containers on a node with 4GB of RAM. One container has a memory leak and gradually ' +
          'consumes 3.5GB. The other two containers get squeezed out, slow down, and eventually get killed by the ' +
          'kernel\'s out-of-memory (OOM) killer.\n\n' +
          'This is not a theoretical concern — it is one of the most common production issues in Kubernetes. ' +
          'Without resource controls, you have no isolation between containers. One bad actor can take down an entire node.\n\n' +
          'Kubernetes addresses this with two mechanisms: resource requests (how much a container needs to start) ' +
          'and resource limits (the maximum a container is allowed to consume).',
        keyTakeaway:
          'Without resource controls, one container can starve others. Requests and limits are how Kubernetes provides resource isolation on shared nodes.',
      },
      {
        title: 'Requests vs Limits',
        content:
          'Requests and limits serve different purposes:\n\n' +
          'Requests: The minimum resources guaranteed to the container. The scheduler uses requests to decide ' +
          'which node has enough capacity. A container requesting 512Mi of memory will only be placed on a node ' +
          'with at least 512Mi available. If no node has enough, the pod stays Pending as Unschedulable.\n\n' +
          'Limits: The maximum resources the container is allowed to use. If a container tries to exceed its memory ' +
          'limit, the kernel kills it (OOMKilled). If it tries to exceed its CPU limit, it gets throttled — not killed, ' +
          'just slowed down.\n\n' +
          'Key difference: exceeding memory limits is fatal (OOMKilled), while exceeding CPU limits is just slow ' +
          '(throttled). This is because memory cannot be compressed — once allocated, it cannot be transparently reclaimed. ' +
          'CPU time, however, can be shared and throttled.\n\n' +
          'Example spec:\n' +
          '  resources:\n' +
          '    requests:\n' +
          '      cpu: "250m"    # 250 millicores (0.25 CPU)\n' +
          '      memory: "128Mi"\n' +
          '    limits:\n' +
          '      cpu: "500m"\n' +
          '      memory: "256Mi"',
        diagram:
          '  Memory Usage\n' +
          '  ─────────────────────────────────\n' +
          '  |         |  request  |  limit  |\n' +
          '  |  usage  |  128Mi    |  256Mi  |\n' +
          '  ─────────────────────────────────\n' +
          '  Below request: guaranteed, scheduled here\n' +
          '  Between request & limit: allowed, best-effort\n' +
          '  Above limit: OOMKilled!',
        keyTakeaway:
          'Requests = minimum guaranteed (used for scheduling). Limits = maximum allowed (enforced at runtime). Memory over-limit = OOMKilled. CPU over-limit = throttled.',
      },
      {
        title: 'Quality of Service (QoS) Classes',
        content:
          'Based on how you set requests and limits, Kubernetes assigns each pod a QoS class that determines ' +
          'its eviction priority when a node runs low on resources:\n\n' +
          'Guaranteed: Requests equal limits for all containers. These pods are the last to be evicted. ' +
          'Use for critical workloads that need predictable performance.\n\n' +
          'Burstable: Requests are set but are lower than limits. The container gets its requested amount guaranteed ' +
          'but can burst up to the limit when resources are available. Most production workloads use this class.\n\n' +
          'BestEffort: No requests or limits set at all. These pods get whatever is left over and are the first to be ' +
          'evicted when resources are scarce. Only use for truly non-critical workloads.\n\n' +
          'When a node is under memory pressure, Kubernetes evicts BestEffort pods first, then Burstable pods that ' +
          'exceed their requests, and finally Guaranteed pods (only as a last resort).',
        keyTakeaway:
          'QoS classes (Guaranteed, Burstable, BestEffort) determine eviction order. Set requests=limits for critical workloads. Always set at least requests to avoid BestEffort.',
      },
      {
        title: 'OOMKilled: What Happens and Why',
        content:
          'When a container exceeds its memory limit, the Linux kernel\'s OOM killer terminates it. ' +
          'In Kubernetes, this appears as the pod status showing "OOMKilled."\n\n' +
          'The sequence of events:\n' +
          '1. Container allocates memory beyond its limit.\n' +
          '2. The kernel detects the cgroup memory limit violation.\n' +
          '3. The OOM killer selects the container process and sends SIGKILL.\n' +
          '4. The container exits with code 137 (128 + 9 for SIGKILL).\n' +
          '5. Kubernetes records the reason as OOMKilled.\n' +
          '6. If restartPolicy is Always (default), kubelet restarts the container.\n' +
          '7. If it keeps crashing, you see CrashLoopBackOff with OOMKilled reason.\n\n' +
          'Common causes: memory leaks, processing larger data than expected, limits set too low, ' +
          'or the application genuinely needs more memory than provisioned.\n\n' +
          'The fix depends on the cause: increase the limit if the app legitimately needs more memory, ' +
          'or fix the memory leak if the app is misbehaving.',
        keyTakeaway:
          'OOMKilled means the container exceeded its memory limit and was killed by the kernel. Fix by either increasing the limit or fixing the memory-consuming code.',
      },
      {
        title: 'Best Practices',
        content:
          'Follow these guidelines for resource management:\n\n' +
          '1. Always set requests. Without them, pods are BestEffort and will be evicted first. ' +
          'Requests also enable the scheduler to make intelligent placement decisions.\n\n' +
          '2. Set limits based on observed usage. Monitor your application under real load to determine ' +
          'appropriate limits. Setting limits too low causes OOMKilled; setting them too high wastes resources.\n\n' +
          '3. Start with requests = limits for critical services. This gives you the Guaranteed QoS class ' +
          'and the most predictable behavior.\n\n' +
          '4. Use LimitRanges for defaults. A LimitRange in each namespace ensures that pods without explicit ' +
          'resource specs get sensible defaults. This prevents accidental BestEffort pods.\n\n' +
          '5. Combine with ResourceQuotas. Quotas prevent a single namespace from consuming all cluster resources, ' +
          'while requests/limits control individual pod consumption.',
        keyTakeaway:
          'Always set requests (for scheduling). Set limits based on observed usage. Use Guaranteed QoS for critical workloads. Use LimitRanges and ResourceQuotas as safety nets.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A container has a CPU limit of 500m. During a traffic spike, it tries to use 800m of CPU. What happens?',
      choices: [
        'The container is killed (OOMKilled) for exceeding its limit',
        'The CPU limit is automatically raised to accommodate the spike',
        'The container is evicted from the node and rescheduled on a node with more CPU capacity',
        'The container is throttled -- it continues running but is restricted to 500m of CPU, making it slower',
      ],
      correctIndex: 3,
      explanation:
        'CPU and memory limits behave fundamentally differently. CPU is a compressible resource -- when a container exceeds its CPU limit, the kernel throttles it by limiting its CPU time slices. The container keeps running, just slower. Memory is incompressible -- exceeding a memory limit triggers OOMKill because allocated memory cannot be transparently reclaimed. This distinction is crucial: CPU over-limit = degraded performance, memory over-limit = container death. Many engineers mistakenly assume both resources are enforced the same way.',
    },
    {
      question:
        'A node is under memory pressure. It has three pods: Pod A (Guaranteed QoS, using 200Mi of its 200Mi request), Pod B (Burstable QoS, using 300Mi with 100Mi requested), and Pod C (BestEffort QoS, using 150Mi). In what order will Kubernetes evict pods?',
      choices: [
        'Pod B first (highest memory usage), then Pod C, then Pod A',
        'Pod C first (BestEffort), then Pod B (Burstable exceeding its request), then Pod A (Guaranteed) only as last resort',
        'All pods are evicted simultaneously and rescheduled',
        'Pod A first (it is at 100% of its request, so it has no room to shrink)',
      ],
      correctIndex: 1,
      explanation:
        'Kubernetes evicts pods based on QoS class in this strict order: BestEffort first (no guarantees at all), then Burstable pods that exceed their requests (Pod B is using 300Mi but only requested 100Mi, making it a prime target), and finally Guaranteed pods only as an absolute last resort. Pod A has Guaranteed QoS because its requests equal its limits, giving it the strongest eviction protection. This is why setting requests=limits for critical services matters -- it provides the highest eviction resistance. Pod B is especially vulnerable because it is consuming 3x its requested amount.',
    },
    {
      question:
        'You set a pod with requests of 2Gi memory and limits of 2Gi memory (requests = limits). The cluster has 3 nodes, each with 4Gi total memory and 3Gi already committed to other pod requests. What happens when you create this pod?',
      choices: [
        'The pod is scheduled on any node -- Kubernetes uses actual memory usage, not requests, for scheduling',
        'The pod is scheduled but immediately OOMKilled because the node does not have enough physical memory',
        'The pod stays Pending with "Insufficient memory" because no node has 2Gi of unrequested memory available',
        'Kubernetes evicts lower-priority pods to make room for this Guaranteed QoS pod',
      ],
      correctIndex: 2,
      explanation:
        'The scheduler uses resource requests (not actual usage or limits) to decide if a pod fits on a node. Each node has 4Gi total but 3Gi already committed to existing pod requests, leaving only 1Gi of allocatable capacity. Since the new pod requests 2Gi, no node can satisfy it, and the pod stays Pending with a FailedScheduling event. This is true even if the existing pods are not actually using their full requested amounts. Kubernetes does NOT preempt regular pods for other regular pods (Option D) -- priority-based preemption requires explicit PriorityClasses. Understanding that scheduling is based on requests, not actual usage, is fundamental to capacity planning.',
    },
    {
      question:
        'A pod has containers with these resource specs: requests.cpu=250m, limits.cpu=1000m, requests.memory=128Mi, limits.memory=512Mi. What QoS class does this pod receive, and why does it matter?',
      choices: [
        'BestEffort -- because the requests are too low relative to the limits',
        'Guaranteed -- because both CPU and memory have requests and limits defined',
        'Burstable -- but this is equivalent to Guaranteed in terms of eviction priority since all resource types are specified',
        'Burstable -- because requests are lower than limits, meaning it can burst above its guaranteed baseline but is more vulnerable to eviction than Guaranteed pods',
      ],
      correctIndex: 3,
      explanation:
        'A pod is Guaranteed ONLY when every container has requests equal to limits for both CPU and memory. Here, requests differ from limits (250m vs 1000m CPU, 128Mi vs 512Mi memory), so the pod is Burstable. This means it gets its requested resources guaranteed but can burst higher when capacity is available. The tradeoff: Burstable pods are evicted before Guaranteed pods under node pressure. Option D is wrong -- Burstable and Guaranteed are NOT equivalent in eviction behavior, even if all resource types are specified. For critical production services, setting requests=limits provides stronger eviction protection at the cost of not being able to burst.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    const pods = Array.from({ length: 3 }, () => ({
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
      spec: { image },
      status: { phase: 'Running' as const },
    }));

    return {
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
            replicas: 3,
            selector: { app: 'web' },
            template: {
              labels: { app: 'web' },
              spec: { image },
            },
            strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
          },
          status: {
            replicas: 3,
            updatedReplicas: 3,
            readyReplicas: 3,
            availableReplicas: 3,
            conditions: [{ type: 'Available', status: 'True' }],
          },
        },
      ],
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
            replicas: 3,
            selector: { app: 'web', 'pod-template-hash': hash },
            template: {
              labels: { app: 'web', 'pod-template-hash': hash },
              spec: { image },
            },
          },
          status: { replicas: 3, readyReplicas: 3 },
        },
      ],
      pods,
      nodes: [
        {
          kind: 'Node' as const,
          metadata: {
            name: 'node-1',
            uid: generateUID(),
            labels: { 'kubernetes.io/hostname': 'node-1' },
            creationTimestamp: Date.now() - 300000,
          },
          spec: { capacity: { pods: 3 } },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: 2,
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
          spec: { capacity: { pods: 3 } },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: 1,
          },
        },
      ],
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
    // Must have "hungry-app" deployment with image changed from hungry-app:1.0
    const hungryApp = state.deployments.find((d) => d.metadata.name === 'hungry-app');
    if (!hungryApp) return false;
    if (hungryApp.spec.template.spec.image === 'hungry-app:1.0') return false;

    // Both "web" and "hungry-app" must have readyReplicas >= spec.replicas
    const web = state.deployments.find((d) => d.metadata.name === 'web');
    if (!web) return false;

    return [web, hungryApp].every((dep) => {
      const readyReplicas = dep.status.readyReplicas || 0;
      return readyReplicas >= dep.spec.replicas;
    });
  },
};
