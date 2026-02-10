import type { Lesson } from './types';

export const lesson2: Lesson = {
  id: 2,
  title: 'Pods',
  description:
    'Learn what pods are, how they move through lifecycle phases, and why managed pods beat standalone ones.',
  goalDescription:
    'Create a standalone pod and delete it. Then create a Deployment and see self-healing when you delete a managed pod.',
  successMessage:
    'Standalone pods vanish when deleted, but managed pods are replaced. Always use Deployments in production.',
  hints: [
    'Start with: kubectl create pod standalone --image=nginx:1.0',
    'Reconcile until it is Running, then: kubectl delete pod standalone',
    'Create the Deployment: kubectl create deployment my-app --image=nginx:1.0 --replicas=2',
    'Reconcile until 2 pods are Running, then delete one managed pod with: kubectl delete pod <name>',
    'Reconcile again to see the replacement appear.',
  ],
  lecture: {
    sections: [
      {
        title: 'Why Do Containers Need Grouping?',
        content:
          'Imagine you\'re running a web server. Simple enough — one container. But now you need a logging sidecar ' +
          'that ships logs to your monitoring system. The sidecar needs to read the web server\'s log files and share ' +
          'its network (so it can scrape metrics on localhost).\n\n' +
          'You could run them as two separate containers and wire up networking and shared volumes manually. ' +
          'But this creates a coordination problem: they need to be scheduled together on the same machine, started ' +
          'together, and stopped together. If one moves, the other must follow.\n\n' +
          'This is why Pods exist. A Pod wraps one or more containers that share the same network namespace ' +
          '(they reach each other on localhost) and can share storage volumes. The pod is the unit of scheduling — ' +
          'Kubernetes places the entire pod on one node, never splitting its containers across machines.\n\n' +
          'Most pods run a single container. The multi-container pattern is reserved for tightly-coupled helpers ' +
          'like logging sidecars, proxy containers, or init containers that run setup tasks before the main container starts.',
        keyTakeaway:
          'Pods exist because some containers must be co-located. A pod is the atomic scheduling unit — its containers always land on the same node, share the same network, and live or die together.',
      },
      {
        title: 'Pod Lifecycle: What Happens After Creation',
        content:
          'When you create a pod, it doesn\'t just appear Running. It goes through a sequence of phases, ' +
          'and understanding these phases helps you diagnose problems.\n\n' +
          'Pending: The pod has been accepted but isn\'t running yet. Why? It may be waiting for a node ' +
          '(the scheduler hasn\'t placed it), waiting for images to download, or waiting for resources. ' +
          'If a pod stays Pending, something is blocking it.\n\n' +
          'Running: At least one container is running. The pod has been placed on a node and containers have started.\n\n' +
          'Succeeded: All containers exited with code 0. This is normal for batch jobs — they run once and finish.\n\n' +
          'Failed: A container exited with a non-zero code. Something went wrong.\n\n' +
          'Terminating: The pod is shutting down. Kubernetes gives it a grace period to finish work ' +
          '(draining connections, running cleanup hooks), then forcefully stops it.',
        diagram:
          '  Pending --> Running --> Succeeded\n' +
          '     |            |\n' +
          '     |            +---> Failed\n' +
          '     |\n' +
          '     +---> Failed (e.g. ImagePullError)',
        keyTakeaway:
          'A pod that\'s stuck in Pending is telling you something is wrong with scheduling or image pulling. A pod in CrashLoopBackOff is telling you the application is crashing. The phase is always your first diagnostic clue.',
      },
      {
        title: 'Standalone vs Managed Pods',
        content:
          'You CAN create a pod directly with "kubectl create pod". This creates a standalone pod — one with no ' +
          'controller watching over it. If that pod dies or is deleted, it\'s gone forever. No one recreates it.\n\n' +
          'Think about what this means in production. Your web server is a standalone pod. It crashes at 2 AM. ' +
          'Your site is down. Nobody notices until morning. Even when someone does notice, they have to manually ' +
          'create a new pod. This is exactly the manual toil Kubernetes was designed to eliminate.\n\n' +
          'Managed pods are owned by a controller (like a ReplicaSet, which is itself managed by a Deployment). ' +
          'If a managed pod is deleted, the controller notices that actual count < desired count and creates a replacement. ' +
          'This happens automatically, usually in seconds — often before anyone even notices there was a problem.',
        keyTakeaway:
          'Never create standalone pods in production. Always use a controller (Deployment) so pods are automatically replaced when they fail. Standalone pods are fine for one-off debugging, never for real workloads.',
      },
      {
        title: 'Owner References: How Kubernetes Tracks Ownership',
        content:
          'When a controller creates a pod, it stamps it with an ownerReference — a metadata field that records ' +
          'who owns this pod. Without this link, the ReplicaSet wouldn\'t know which pods belong to it.\n\n' +
          'The ownership chain forms a hierarchy: a Deployment owns a ReplicaSet, and the ReplicaSet owns Pods. ' +
          'Each link is recorded as an ownerReference on the child resource.\n\n' +
          'This chain enables two critical features:\n\n' +
          'Cascade deletion: Delete a Deployment, and Kubernetes automatically deletes its ReplicaSets, ' +
          'which automatically deletes their Pods. You don\'t clean up manually.\n\n' +
          'Self-healing: When a pod is deleted, the ReplicaSet controller sees that one of its owned pods is gone ' +
          'and creates a replacement. The ownerReference is how it knows "that was mine, I need to replace it."',
        keyTakeaway:
          'Owner references create the chain of accountability. The Deployment owns the ReplicaSet, the ReplicaSet owns the Pods. This chain is what makes cascade deletion and self-healing work.',
      },
    ],
  },
  quiz: [
    {
      question: 'What happens when you delete a standalone pod?',
      choices: [
        'It restarts automatically',
        'It\'s gone forever — no controller replaces it',
        'It moves to another node',
        'An error occurs',
      ],
      correctIndex: 1,
      explanation:
        'Standalone pods have no owner controller. When deleted, nothing notices they\'re gone ' +
        'and nothing creates a replacement.',
    },
    {
      question: 'Which pod phase means "accepted by the cluster but not yet running"?',
      choices: [
        'Running',
        'Pending',
        'Succeeded',
        'Terminating',
      ],
      correctIndex: 1,
      explanation:
        'Pending means the pod has been accepted but the container(s) haven\'t started yet. ' +
        'This could be due to waiting for scheduling, image pulling, or resource availability.',
    },
    {
      question: 'Why should you almost never create pods directly in production?',
      choices: [
        'Pods are slower than containers',
        'Direct pods can\'t use networking',
        'Direct pods aren\'t replaced if they fail',
        'Pods require special permissions',
      ],
      correctIndex: 2,
      explanation:
        'If a standalone pod fails or is deleted, nothing replaces it. Use a Deployment ' +
        '(which manages a ReplicaSet, which manages pods) so you get automatic self-healing.',
    },
    {
      question: 'A Deployment has 2 Running pods. You delete one. What happens?',
      choices: [
        'The Deployment scales down to 1',
        'The ReplicaSet creates a replacement pod',
        'The deleted pod restarts',
        'Nothing — you can\'t delete managed pods',
      ],
      correctIndex: 1,
      explanation:
        'The RS detects actual(1) < desired(2) and creates a new pod. This is self-healing in action — ' +
        'the control loop automatically reconciles.',
    },
  ],
  initialState: () => {
    return {
      deployments: [],
      replicaSets: [],
      pods: [],
      nodes: [],
      services: [],
      events: [],
    };
  },
  steps: [
    {
      id: 'create-standalone',
      trigger: 'onLoad',
      instruction:
        'Step 1: Create a standalone pod with "kubectl create pod standalone --image=nginx:1.0" and Reconcile until it\'s Running.',
    },
    {
      id: 'create-deployment',
      trigger: 'afterCommand',
      triggerCondition: (state) =>
        !state.pods.some((p) => p.metadata.name === 'standalone' && !p.metadata.deletionTimestamp),
      instruction:
        'The standalone pod is gone. Now create a Deployment: "kubectl create deployment my-app --image=nginx:1.0 --replicas=2" and Reconcile until 2 pods are Running.',
    },
  ],
  goalCheck: (state) => {
    const dep = state.deployments.find((d) => d.metadata.name === 'my-app');
    if (!dep) return false;
    if (state.tick === 0) return false;
    const rs = state.replicaSets.find(
      (r) =>
        r.metadata.ownerReference?.uid === dep.metadata.uid &&
        !r.metadata.deletionTimestamp
    );
    if (!rs) return false;
    const pods = state.pods.filter(
      (p) =>
        p.metadata.ownerReference?.uid === rs.metadata.uid &&
        p.status.phase === 'Running' &&
        !p.metadata.deletionTimestamp
    );
    return pods.length === 2;
  },
};
