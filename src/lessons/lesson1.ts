import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, templateHash } from '../simulation/utils';

export const lesson1: Lesson = {
  id: 1,
  title: 'Why Kubernetes?',
  description:
    'Discover why container orchestration exists and learn the core pattern that drives all of Kubernetes.',
  mode: 'full',
  goalDescription: 'Get all 3 pods Running by using the Reconcile button.',
  successMessage:
    'The RS controller brought the cluster to desired state. You declared 3 pods, the controller made it happen. ' +
    'This is the core K8s pattern: declare what you want, controllers make it happen.',
  hints: [
    { text: 'The Reconcile button advances the control loop by one tick.' },
    { text: 'The first reconcile creates Pending pods. The second tick transitions them to Running.' },
  ],
  goals: [
    {
      description: 'Reconcile to create 3 Pending pods from the ReplicaSet',
      check: (s: ClusterState) => s.pods.filter(p => p.metadata.ownerReference && !p.metadata.deletionTimestamp).length >= 3,
    },
    {
      description: 'Reconcile again until all 3 pods are Running',
      check: (s: ClusterState) => {
        const rs = s.replicaSets.find(r => r.metadata.name === 'web-app-rs');
        if (!rs) return false;
        return s.pods.filter(p => p.metadata.ownerReference?.uid === rs.metadata.uid && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length === 3;
      },
    },
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Managing Containers at Scale',
        content:
          'You know Docker. One container is easy. But what about 50? 100? ' +
          'Who restarts a crashed container at 3 AM? Who distributes containers across machines? ' +
          'Who handles rolling updates without downtime?\n\n' +
          'These questions define the container orchestration problem. When you have a handful of containers ' +
          'on a single machine, you can manage them by hand. But modern applications run dozens or hundreds of containers ' +
          'across multiple machines. You need a system that automates placement, scaling, health checking, and recovery.\n\n' +
          'Kubernetes is that system. It was born at Google from over a decade of experience running containers ' +
          'in production (an internal system called Borg). It takes the pain of manual container management and ' +
          'replaces it with automation.',
        keyTakeaway:
          'Kubernetes exists because managing containers by hand doesn\'t scale. The moment you have multiple machines and need uptime guarantees, you need orchestration.',
      },
      {
        title: 'Declarative vs Imperative',
        content:
          'There are two ways to manage infrastructure:\n\n' +
          'Imperative: "Create 3 pods. If one dies, create another one." You write the exact steps and handle every edge case yourself.\n\n' +
          'Declarative: "I want 3 pods running at all times." You describe the end state and let the system figure out how to get there.\n\n' +
          'Kubernetes is declarative. You tell it WHAT you want, not HOW to get there. This is a fundamental shift. ' +
          'Instead of writing scripts that create, check, and repair containers, you write a simple manifest that says ' +
          '"I want 3 replicas of this container image" and Kubernetes continuously works to make that true.\n\n' +
          'If a pod crashes, you don\'t need a monitoring script to detect it and a recovery script to replace it. ' +
          'Kubernetes notices the gap between desired state (3 pods) and actual state (2 pods) and fixes it automatically.',
        keyTakeaway:
          'Declarative means you describe the destination, not the route. Kubernetes figures out the "how" and keeps correcting course.',
      },
      {
        title: 'The Control Loop',
        content:
          'Kubernetes constantly runs a loop: Observe the current state, compare it to the desired state, ' +
          'and take action to reconcile the difference. This is the core engine that powers everything.\n\n' +
          'Every controller in Kubernetes follows this exact pattern. The ReplicaSet controller watches pods ' +
          'and ensures the right number are running. The Deployment controller watches ReplicaSets and manages rollouts. ' +
          'The Node controller watches nodes and handles failures.\n\n' +
          'This loop never stops. It runs continuously, which means the system is self-healing. ' +
          'If something breaks at 3 AM, the control loop detects the drift and corrects it — no human intervention required.',
        diagram:
          '    +-----------------------------+\n' +
          '    |     Desired State           |\n' +
          '    |  "I want 3 Running pods"   |\n' +
          '    +--------------+--------------+\n' +
          '                   | compare\n' +
          '    +--------------v--------------+\n' +
          '    |    Current State            |\n' +
          '    |  "Only 1 pod exists"        |\n' +
          '    +--------------+--------------+\n' +
          '                   | action\n' +
          '    +--------------v--------------+\n' +
          '    |  Reconcile: Create 2 pods   |\n' +
          '    +-----------------------------+',
        keyTakeaway:
          'The control loop is the heartbeat of Kubernetes. Observe, compare, act — on repeat, forever. This is why the system self-heals.',
      },
      {
        title: 'Key Terminology: Problems and Their Names',
        content:
          'Every Kubernetes term exists because of a specific problem. If you understand the problem, the name becomes obvious.\n\n' +
          'You have multiple machines running containers. You need a name for "the whole system" — that\'s a Cluster.\n\n' +
          'Each machine in the cluster needs a name — that\'s a Node. Nodes provide the CPU, memory, and disk that containers need to run.\n\n' +
          'Containers need a wrapper that gives them shared networking and storage — that\'s a Pod. A pod is the smallest thing you deploy. Most pods run one container, but sometimes you need a helper (like a logging sidecar) that shares the same network, so they go in the same pod.\n\n' +
          'Something needs to watch pods and replace them when they crash — that\'s a Controller. Specifically, a ReplicaSet is a controller that maintains a desired count of identical pods. It creates pods when there are too few and deletes them when there are too many.\n\n' +
          'The act of making actual state match desired state has a name too — that\'s Reconciliation. Every time a controller runs its loop and fixes a gap, that\'s reconciliation.',
        keyTakeaway:
          'Every K8s term is a solution to a problem. Cluster = "the whole system." Node = "a machine." Pod = "container wrapper." Controller = "the thing that watches and fixes." If you know the problem, you know the term.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A ReplicaSet is configured with replicas=3 and all 3 pods are Running. One pod crashes at 3 AM. What happens next?',
      choices: [
        'Kubernetes restarts the crashed pod on the same node with the same IP address',
        'The ReplicaSet waits for an administrator to acknowledge the failure before acting',
        'The control loop detects 2 Running vs 3 desired and creates a brand-new replacement pod',
        'The desired state is automatically reduced to 2 to match the current state',
      ],
      correctIndex: 2,
      explanation:
        'The ReplicaSet controller does not restart the old pod — it creates an entirely new pod. The crashed pod is gone forever. ' +
        'This is a key distinction: Kubernetes replaces, it does not repair. The new pod gets a new name, new IP, ' +
        'and may land on a different node. The control loop runs continuously, so this happens in seconds without human intervention.',
    },
    {
      question:
        'Your team writes a shell script that checks pod count every 30 seconds and creates replacements if any are missing. ' +
        'How does the Kubernetes declarative approach differ from this?',
      choices: [
        'Kubernetes does the same thing but checks more frequently',
        'The script is imperative — it encodes HOW to recover; Kubernetes is declarative — you specify WHAT state you want and controllers continuously reconcile toward it',
        'Kubernetes only checks pod count on a schedule, just like the script',
        'There is no practical difference — both achieve the same reliability guarantees',
      ],
      correctIndex: 1,
      explanation:
        'The script is fragile: it can crash, it handles only the scenarios you coded, and it requires you to write recovery logic for every edge case. ' +
        'Kubernetes controllers are built into the system, always running, and handle any deviation from desired state — not just the scenarios you anticipated. ' +
        'Declarative also means the desired state is stored and versioned, so the system survives restarts and can be audited.',
    },
    {
      question:
        'You have a ReplicaSet with replicas=3. Currently there are 5 pods matching its selector (someone manually created 2 extra). What does the controller do?',
      choices: [
        'It ignores the extra pods since it did not create them',
        'It creates 3 more pods for a total of 8, since replicas=3 means "add 3"',
        'It deletes 2 pods to bring the count down to the desired 3',
        'It crashes because the state is inconsistent',
      ],
      correctIndex: 2,
      explanation:
        'The ReplicaSet controller reconciles in both directions. It does not just create missing pods — it also removes excess ones. ' +
        'The controller counts all pods matching its selector, regardless of who created them. If actual (5) > desired (3), it terminates the surplus. ' +
        'This is why you should never manually create pods with labels that match an existing controller\'s selector.',
    },
    {
      question:
        'A pod is stuck in Pending phase for 10 minutes. Which of these is a plausible explanation?',
      choices: [
        'The container image is crashing on startup',
        'Pending pods automatically terminate after 5 minutes, so this scenario is impossible',
        'The pod\'s ReplicaSet has been deleted',
        'No node in the cluster has sufficient available capacity to schedule the pod',
      ],
      correctIndex: 3,
      explanation:
        'Pending means the pod has been accepted by the API server but has not been assigned to a node yet. The most common cause is insufficient cluster resources. ' +
        'A crashing container would show as CrashLoopBackOff within a Running pod (the pod is scheduled, but its container keeps failing). ' +
        'If the ReplicaSet were deleted, the pod would still exist — standalone pods are not automatically removed when their parent disappears ' +
        '(unless garbage collection cascade deletes them).',
    },
  ],
  initialState: () => {
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    return {
      deployments: [],
      replicaSets: [
        {
          kind: 'ReplicaSet',
          metadata: {
            name: 'web-app-rs',
            uid: rsUid,
            labels: { app: 'web-app', 'pod-template-hash': hash },
            creationTimestamp: Date.now(),
          },
          spec: {
            replicas: 3,
            selector: { app: 'web-app' },
            template: {
              labels: { app: 'web-app', 'pod-template-hash': hash },
              spec: { image },
            },
          },
          status: { replicas: 0, readyReplicas: 0 },
        },
      ],
      pods: [],
      nodes: [],
      services: [],
      events: [],
    };
  },
  goalCheck: (state) => {
    const rs = state.replicaSets.find((r) => r.metadata.name === 'web-app-rs');
    if (!rs) return false;
    const pods = state.pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === rs.metadata.uid &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );
    return pods.length === 3;
  },
};
