import type { Lesson } from './types';
import { generateUID, templateHash } from '../simulation/utils';

export const lesson1: Lesson = {
  id: 1,
  title: 'Why Kubernetes?',
  description:
    'Discover why container orchestration exists and learn the core pattern that drives all of Kubernetes.',
  goalDescription: 'Get all 3 pods Running by using the Reconcile button.',
  successMessage:
    'The RS controller brought the cluster to desired state. You declared 3 pods, the controller made it happen. ' +
    'This is the core K8s pattern: declare what you want, controllers make it happen.',
  hints: [
    'Click the "Reconcile" button to advance the control loop.',
    'The first reconcile creates Pending pods. The second tick transitions them to Running.',
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
      question: 'What is the main advantage of a declarative system over an imperative one?',
      choices: [
        'You have more control over individual steps',
        'The system self-heals by continuously reconciling toward desired state',
        'It\'s faster to execute',
        'It uses less memory',
      ],
      correctIndex: 1,
      explanation:
        'Declarative systems automatically correct drift. If something crashes, the controller notices ' +
        'the gap between desired and actual state and fixes it — without you writing recovery logic.',
    },
    {
      question: 'In the Kubernetes control loop, what happens when current state doesn\'t match desired state?',
      choices: [
        'An error is thrown',
        'The desired state is updated to match current state',
        'A controller takes action to reconcile',
        'The cluster shuts down',
      ],
      correctIndex: 2,
      explanation:
        'Controllers reconcile. If desired is 3 pods and current is 1, the controller creates 2 more. ' +
        'This loop runs continuously.',
    },
    {
      question: 'What is a Pod in Kubernetes?',
      choices: [
        'A virtual machine',
        'The smallest deployable unit that wraps one or more containers',
        'A networking rule',
        'A storage volume',
      ],
      correctIndex: 1,
      explanation:
        'A Pod is the atomic unit of deployment. It wraps one or more containers that share networking ' +
        'and storage. Most pods run a single container.',
    },
    {
      question: 'What does a ReplicaSet do?',
      choices: [
        'Routes network traffic to pods',
        'Stores configuration data',
        'Ensures a specified number of pod replicas are running',
        'Manages cluster nodes',
      ],
      correctIndex: 2,
      explanation:
        'A ReplicaSet watches pods and ensures the actual count matches the desired count. ' +
        'If pods are missing, it creates them. If there are too many, it deletes the extras.',
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
