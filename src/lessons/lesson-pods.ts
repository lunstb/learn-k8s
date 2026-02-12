import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

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
          '(draining connections, running cleanup hooks), then forcefully stops it.\n\n' +
          'An important subtlety: pod phases and container statuses are different things. A pod can be in the Running ' +
          'phase while its container is crashing repeatedly. When you see CrashLoopBackOff, the pod phase is still ' +
          '"Running" — Kubernetes has placed it on a node and keeps trying to restart the container. CrashLoopBackOff ' +
          'is a container-level status, not a pod phase. The kubelet restarts the container with increasing delays ' +
          '(10s, 20s, 40s, up to 5 minutes). This distinction matters for debugging: "kubectl get pods" shows CrashLoopBackOff ' +
          'in the STATUS column, which combines pod phase and container status into a single display.',
        diagram:
          '  Pending --> Running --> Succeeded\n' +
          '     |            |\n' +
          '     |            +---> Failed\n' +
          '     |\n' +
          '     +---> Failed (e.g. ImagePullError)',
        keyTakeaway:
          'A pod stuck in Pending has a scheduling or image problem. CrashLoopBackOff means the container keeps crashing — but the pod phase is still Running. The STATUS column in "kubectl get pods" blends pod phase and container status, so learn to read both.',
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
        'Yes — CrashLoopBackOff means the pod is in Failed phase and has completely stopped running',
        'Yes — the pod alternates between Pending and Failed phases but never reaches Running',
        'No — the pod phase is still Running; CrashLoopBackOff is a container-level status indicating repeated crashes with backoff delays',
        'No — the pod phase is Succeeded, and the kubelet is restarting it as a precautionary measure',
      ],
      correctIndex: 2,
      explanation:
        'This is a common source of confusion. The pod\'s phase remains "Running" because Kubernetes keeps trying to restart the container. ' +
        'CrashLoopBackOff is a container-level status, not a pod phase. The kubelet restarts the container with exponentially increasing delays ' +
        '(10s, 20s, 40s... up to 5 minutes). The pod is scheduled and "running" from Kubernetes\' perspective — it\'s the container inside that keeps failing.',
    },
    {
      question:
        'You delete a Deployment. What happens to its ReplicaSet and pods?',
      choices: [
        'The ReplicaSet and pods continue running independently as unmanaged standalone resources',
        'The pods are deleted but the ReplicaSet remains as an orphaned resource in the namespace',
        'Only the Deployment object is removed; you must manually delete the ReplicaSet and pods separately',
        'Cascade deletion removes the ReplicaSet, which in turn removes all its pods via the ownership chain',
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
        'debug-pod is gone permanently; the managed pod is replaced — you end up with 0 standalone and 2 managed pods',
        'Both pods are gone permanently — you end up with 0 standalone pods and only 1 managed pod',
        'Both pods are restarted in place — you end up with 1 standalone pod and 2 managed pods unchanged',
        'The managed pod is gone permanently too — the ReplicaSet only recreates pods on a timed interval',
      ],
      correctIndex: 0,
      explanation:
        'This is the critical difference between standalone and managed pods. The standalone pod has no ownerReference — no controller is watching it, so deletion is permanent. ' +
        'The managed pod has an ownerReference pointing to a ReplicaSet. When deleted, the RS detects actual(1) < desired(2) and creates a replacement. ' +
        'The replacement is a brand-new pod with a new name and IP — it is not the old pod "restarting."',
    },
    {
      question:
        'A pod managed by a Deployment enters CrashLoopBackOff. You delete the pod with kubectl delete pod. What happens?',
      choices: [
        'The pod is permanently removed — deleting a pod always removes it regardless of ownership',
        'The ReplicaSet creates a replacement pod immediately, but it will also crash if the underlying issue is not fixed',
        'The Deployment detects the deletion and scales down its desired replica count by one',
        'Kubernetes prevents deletion of managed pods — you must delete the owning Deployment instead',
      ],
      correctIndex: 1,
      explanation:
        'Deleting a managed pod triggers replacement by its owning ReplicaSet. The RS sees fewer pods than desired and creates a new one. However, if the root cause (bad image, missing config, etc.) is not fixed, the replacement pod will also crash. This is why deleting pods is rarely a fix — you need to address the underlying issue in the Deployment spec. The only case where deleting a pod helps is if the failure was truly transient (like a network blip during image pull).',
    },
    {
      question:
        'Two containers in the same pod need to communicate. How do they reach each other?',
      choices: [
        'Via the Kubernetes Service DNS name that is automatically created for each pod',
        'Via localhost — containers in a pod share the same network namespace, so they communicate on 127.0.0.1 with different ports',
        'Through a shared ConfigMap that acts as a message bus between the containers',
        'Using the pod\'s cluster IP address, which is assigned to the first container and forwarded to the second',
      ],
      correctIndex: 1,
      explanation:
        'Containers in the same pod share the same network namespace. This means they share the same IP address and can reach each other on localhost (127.0.0.1) ' +
        'using different ports. This is one of the key reasons pods exist: to provide a shared execution environment for tightly-coupled containers. ' +
        'A web server on port 80 and a logging sidecar on port 9090 can communicate directly via localhost without any networking setup. ' +
        'This is also why two containers in the same pod cannot bind to the same port — they share the same network namespace.',
    },
  ],
  practices: [
    {
      title: 'Create and Compare Pods',
      goalDescription:
        'Create a standalone pod named "standalone" with image nginx:1.0 and delete it. Then create a Deployment named "my-app" with image nginx:1.0 and 2 replicas, and observe self-healing when you delete a managed pod.',
      successMessage:
        'Standalone pods vanish when deleted, but managed pods are replaced. Always use Deployments in production.',
      initialState: () => ({
        deployments: [],
        replicaSets: [],
        pods: [],
        nodes: [],
        services: [],
        events: [],
      }),
      goals: [
        {
          description: 'Use "kubectl create pod" to create a standalone pod',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('create-pod'),
        },
        {
          description: 'Use "kubectl create deployment" to create a managed deployment',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('create-deployment'),
        },
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
      hints: [
        { text: 'Start by creating a standalone pod — what command creates a single pod?' },
        { text: 'kubectl create pod standalone --image=nginx:1.0', exact: true },
        { text: 'After deleting the standalone pod, create a Deployment for self-healing.' },
        { text: 'kubectl create deployment my-app --image=nginx:1.0 --replicas=2', exact: true },
        { text: 'Delete one managed pod and reconcile to see the replacement appear.' },
      ],
      steps: [
        {
          id: 'create-standalone',
          trigger: 'onLoad' as const,
          instruction:
            'Step 1: Create a standalone pod with "kubectl create pod standalone --image=nginx:1.0" and Reconcile until it\'s Running.',
        },
        {
          id: 'create-deployment',
          trigger: 'afterCommand' as const,
          triggerCondition: (state: ClusterState) =>
            !state.pods.some((p) => p.metadata.name === 'standalone' && !p.metadata.deletionTimestamp),
          instruction:
            'The standalone pod is gone. Now create a Deployment: "kubectl create deployment my-app --image=nginx:1.0 --replicas=2" and Reconcile until 2 pods are Running.',
        },
      ],
    },
    {
      title: 'Investigate a Broken Pod',
      goalDescription:
        'A deployment has a crashing pod. Use describe and logs to diagnose the issue, then fix the image.',
      successMessage:
        'You diagnosed a CrashLoopBackOff using describe and logs, then fixed it. These two commands are your go-to tools for any pod issue.',
      podFailureRules: { 'crash-app:1.0': 'CrashLoopBackOff' },
      initialState: () => {
        const depUid = generateUID();
        const rsUid = generateUID();
        const image = 'crash-app:1.0';
        const hash = templateHash({ image });

        return {
          deployments: [{
            kind: 'Deployment' as const,
            metadata: { name: 'broken-app', uid: depUid, labels: { app: 'broken-app' }, creationTimestamp: Date.now() - 120000 },
            spec: {
              replicas: 1, selector: { app: 'broken-app' },
              template: { labels: { app: 'broken-app' }, spec: { image } },
              strategy: { type: 'RollingUpdate' as const, maxSurge: 1, maxUnavailable: 1 },
            },
            status: { replicas: 1, updatedReplicas: 1, readyReplicas: 0, availableReplicas: 0, conditions: [] },
          }],
          replicaSets: [{
            kind: 'ReplicaSet' as const,
            metadata: {
              name: `broken-app-${hash.slice(0, 10)}`, uid: rsUid,
              labels: { app: 'broken-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'Deployment', name: 'broken-app', uid: depUid },
              creationTimestamp: Date.now() - 120000,
            },
            spec: {
              replicas: 1, selector: { app: 'broken-app', 'pod-template-hash': hash },
              template: { labels: { app: 'broken-app', 'pod-template-hash': hash }, spec: { image } },
            },
            status: { replicas: 1, readyReplicas: 0 },
          }],
          pods: [{
            kind: 'Pod' as const,
            metadata: {
              name: generatePodName(`broken-app-${hash.slice(0, 10)}`), uid: generateUID(),
              labels: { app: 'broken-app', 'pod-template-hash': hash },
              ownerReference: { kind: 'ReplicaSet', name: `broken-app-${hash.slice(0, 10)}`, uid: rsUid },
              creationTimestamp: Date.now() - 30000,
            },
            spec: { image, failureMode: 'CrashLoopBackOff' as const, logs: ['[startup] Container started with image crash-app:1.0', '[fatal] Process exited with code 1', '[error] Back-off restarting failed container'] },
            status: { phase: 'CrashLoopBackOff' as const, reason: 'CrashLoopBackOff', message: 'Back-off restarting failed container', restartCount: 3 },
          }],
          nodes: [{
            kind: 'Node' as const,
            metadata: { name: 'node-1', uid: generateUID(), labels: { 'kubernetes.io/hostname': 'node-1' }, creationTimestamp: Date.now() - 300000 },
            spec: { capacity: { pods: 5 } },
            status: { conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }], allocatedPods: 1 },
          }],
          services: [],
          events: [{
            timestamp: Date.now() - 20000, tick: 0, type: 'Warning' as const, reason: 'BackOff',
            objectKind: 'Pod', objectName: 'broken-app-pod',
            message: 'Back-off restarting failed container (restart count: 3)',
          }],
        };
      },
      goals: [
        {
          description: 'Use "kubectl describe pod" to investigate',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('describe-pod'),
        },
        {
          description: 'Use "kubectl logs" to read the error',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('logs'),
        },
        {
          description: 'Use "kubectl set image" to fix the broken image',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('set-image'),
        },
        {
          description: 'Fix the deployment image to "app:2.0"',
          check: (s: ClusterState) => {
            const dep = s.deployments.find(d => d.metadata.name === 'broken-app');
            return !!dep && dep.spec.template.spec.image === 'app:2.0';
          },
        },
        {
          description: 'Pod Running with the fixed image',
          check: (s: ClusterState) => s.pods.some(p => p.spec.image === 'app:2.0' && p.status.phase === 'Running' && !p.metadata.deletionTimestamp),
        },
      ],
      hints: [
        { text: 'What does "kubectl get pods" show? Look at the STATUS column.' },
        { text: 'Use "kubectl describe pod <name>" to see pod events and details.' },
        { text: 'Use "kubectl logs <name>" to see what the container printed before crashing.' },
        { text: 'The image is bad. Fix it with kubectl set image.' },
        { text: 'kubectl set image deployment/broken-app broken-app=app:2.0', exact: true },
      ],
    },
  ],
};
