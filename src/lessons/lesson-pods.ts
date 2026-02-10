import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';

export const lessonPods: Lesson = {
  id: 2,
  title: 'Pods',
  description:
    'Learn what pods are, how they move through lifecycle phases, and why managed pods beat standalone ones.',
  mode: 'full',
  goalDescription:
    'Create a standalone pod named "standalone" with image nginx:1.0 and delete it. Then create a Deployment named "my-app" with image nginx:1.0 and 2 replicas, and observe self-healing when you delete a managed pod.',
  successMessage:
    'Standalone pods vanish when deleted, but managed pods are replaced. Always use Deployments in production.',
  hints: [
    { text: 'Start by creating a standalone pod — what command creates a single pod?' },
    { text: 'kubectl create pod standalone --image=nginx:1.0', exact: true },
    { text: 'After deleting the standalone pod, create a Deployment for self-healing.' },
    { text: 'kubectl create deployment my-app --image=nginx:1.0 --replicas=2', exact: true },
    { text: 'Delete one managed pod and reconcile to see the replacement appear.' },
  ],
  goals: [
    {
      description: 'Create a standalone pod named "standalone"',
      check: (s: ClusterState) => s.pods.some(p => p.metadata.name === 'standalone' && !p.metadata.deletionTimestamp) || s.events.some(e => e.objectKind === 'Pod' && e.objectName === 'standalone'),
    },
    {
      description: 'Create a Deployment named "my-app" with 2 replicas',
      check: (s: ClusterState) => !!s.deployments.find(d => d.metadata.name === 'my-app'),
    },
    {
      description: 'Get 2 Running pods managed by the "my-app" Deployment',
      check: (s: ClusterState) => {
        const dep = s.deployments.find(d => d.metadata.name === 'my-app');
        if (!dep) return false;
        const rs = s.replicaSets.find(r => r.metadata.ownerReference?.uid === dep.metadata.uid && !r.metadata.deletionTimestamp);
        if (!rs) return false;
        return s.pods.filter(p => p.metadata.ownerReference?.uid === rs.metadata.uid && p.status.phase === 'Running' && !p.metadata.deletionTimestamp).length === 2;
      },
    },
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
      question:
        'A pod is in CrashLoopBackOff. A teammate says "the pod isn\'t running." Is that accurate?',
      choices: [
        'Yes — CrashLoopBackOff means the pod is in Failed phase and has stopped completely',
        'No — the pod phase is still Running; CrashLoopBackOff means the container inside keeps crashing and restarting with increasing backoff delays',
        'No — CrashLoopBackOff is not a real Kubernetes status',
        'Yes — the pod alternates between Pending and Failed but is never Running',
      ],
      correctIndex: 1,
      explanation:
        'This is a common source of confusion. The pod\'s phase remains "Running" because Kubernetes keeps trying to restart the container. ' +
        'CrashLoopBackOff is a container-level status, not a pod phase. The kubelet restarts the container with exponentially increasing delays ' +
        '(10s, 20s, 40s... up to 5 minutes). The pod is scheduled and "running" from Kubernetes\' perspective — it\'s the container inside that keeps failing.',
    },
    {
      question:
        'You delete a Deployment. What happens to its ReplicaSet and pods?',
      choices: [
        'The ReplicaSet and pods continue running as standalone resources',
        'The pods are deleted but the ReplicaSet remains as an orphan',
        'Only the Deployment object is removed; you must manually delete the ReplicaSet and pods',
        'Cascade deletion removes the ReplicaSet, which in turn removes all its pods — the entire ownership chain is cleaned up',
      ],
      correctIndex: 3,
      explanation:
        'Owner references create a deletion chain. When you delete a Deployment, Kubernetes\' garbage collector follows the ownerReference on the ReplicaSet and deletes it too. ' +
        'The ReplicaSet\'s deletion triggers garbage collection of its owned pods. This cascade is automatic by default. ' +
        'You can opt out with --cascade=orphan, which deletes only the Deployment and leaves the RS and pods running as unmanaged resources.',
    },
    {
      question:
        'You have a standalone pod named "debug-pod" and a Deployment with 2 replicas. You run "kubectl delete pod debug-pod" and then "kubectl delete pod" on one of the Deployment\'s pods. What is the final state?',
      choices: [
        'debug-pod is gone permanently; the managed pod is replaced — you end up with 0 standalone pods and 2 managed pods',
        'Both pods are gone permanently — you end up with 0 standalone pods and 1 managed pod',
        'Both pods are restarted — you end up with 1 standalone pod and 2 managed pods',
        'Neither pod can be deleted because Kubernetes protects all running pods',
      ],
      correctIndex: 0,
      explanation:
        'This is the critical difference between standalone and managed pods. The standalone pod has no ownerReference — no controller is watching it, so deletion is permanent. ' +
        'The managed pod has an ownerReference pointing to a ReplicaSet. When deleted, the RS detects actual(1) < desired(2) and creates a replacement. ' +
        'The replacement is a brand-new pod with a new name and IP — it is not the old pod "restarting."',
    },
    {
      question:
        'A pod has ownerReference pointing to ReplicaSet "web-rs". Someone deletes "web-rs" directly (not through its parent Deployment). What happens to the pod?',
      choices: [
        'The pod is immediately terminated because its owner is gone',
        'The pod keeps running but becomes a standalone pod — with no controller watching it, it will not be replaced if it fails later',
        'The pod automatically attaches to another ReplicaSet in the same namespace',
        'Kubernetes prevents you from deleting a ReplicaSet that still has running pods',
      ],
      correctIndex: 1,
      explanation:
        'Garbage collection deletes the pod because of the ownerReference — but only if the default cascade policy applies to the RS deletion. ' +
        'However, if you delete the RS with --cascade=orphan (or if the Deployment recreates a new RS that adopts the pod via matching labels), ' +
        'the behavior changes. The key insight is that owner references are what connect pods to their controllers. Without that link, ' +
        'a pod is effectively standalone and loses all self-healing guarantees.',
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
