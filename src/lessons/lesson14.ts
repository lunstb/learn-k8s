import type { Lesson } from './types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lesson14: Lesson = {
  id: 14,
  title: 'Ingress',
  description:
    'Ingress provides HTTP/HTTPS routing from outside the cluster to Services inside, with host-based and path-based rules.',
  mode: 'full',
  goalDescription:
    'Create an Ingress resource that routes external traffic to the "web-svc" Service.',
  successMessage:
    'You created an Ingress. External traffic to your specified host/path will now be routed through the Ingress controller ' +
    'to the "web-svc" Service and its pods. This is how you expose HTTP applications to the outside world.',
  hints: [
    'kubectl create ingress web-ing --rule=myapp.example.com/=web-svc:80',
    'Use: kubectl get ingresses to verify it was created.',
    'The Ingress controller reads your rules and configures routing automatically.',
  ],
  lecture: {
    sections: [
      {
        title: 'The Problem: Exposing HTTP Services',
        content:
          'You have a web application running in your cluster behind a ClusterIP Service. It works great internally — ' +
          'other pods can reach it. But external users cannot. How do you get external HTTP traffic into the cluster?\n\n' +
          'You could use a NodePort Service, but that exposes a random high port (30000-32767) on every node. ' +
          'Users would have to access your app at http://node-ip:31234 — not very user-friendly.\n\n' +
          'You could use a LoadBalancer Service, which provisions a cloud load balancer with a proper IP. ' +
          'But each LoadBalancer Service creates a separate cloud load balancer. If you have 10 services, ' +
          'that is 10 load balancers — expensive and wasteful.\n\n' +
          'Neither solution provides host-based routing (api.example.com vs web.example.com), path-based routing ' +
          '(/api vs /web), or TLS termination. For HTTP applications, you need something smarter.\n\n' +
          'Ingress is that solution. A single Ingress controller handles all external HTTP traffic and routes it ' +
          'to the correct Service based on rules you define.',
        keyTakeaway:
          'NodePort exposes ugly ports. LoadBalancer creates expensive per-service load balancers. Ingress provides a single entry point with smart HTTP routing rules.',
      },
      {
        title: 'How Ingress Works',
        content:
          'Ingress has two components:\n\n' +
          'Ingress resource: A Kubernetes object that defines routing rules. "Send traffic for api.example.com to the api-svc Service." ' +
          '"Send traffic for /static to the static-svc Service." You declare what routing you want.\n\n' +
          'Ingress controller: A running pod (typically nginx, Traefik, or HAProxy) that reads Ingress resources ' +
          'and configures itself accordingly. It is the actual reverse proxy that accepts external traffic and forwards it.\n\n' +
          'Kubernetes does NOT include an Ingress controller by default. You must install one. ' +
          'Popular choices include nginx-ingress-controller, Traefik, and cloud-specific controllers like ' +
          'AWS ALB Ingress Controller or GKE Ingress.\n\n' +
          'The flow: External HTTP request arrives at the Ingress controller. The controller matches the request\'s ' +
          'host and path against Ingress rules. It forwards the request to the matching Service, which routes ' +
          'to a healthy pod.',
        diagram:
          '  Internet\n' +
          '     │\n' +
          '     ▼\n' +
          '  Ingress Controller (nginx/traefik)\n' +
          '     │\n' +
          '     ├── api.example.com  →  api-svc  →  api pods\n' +
          '     ├── web.example.com  →  web-svc  →  web pods\n' +
          '     └── *.example.com/static  →  cdn-svc  →  cdn pods',
        keyTakeaway:
          'Ingress = routing rules (what you want). Ingress controller = the reverse proxy that implements them (how it happens). You must install a controller — Kubernetes does not include one.',
      },
      {
        title: 'Ingress Rules: Host and Path Routing',
        content:
          'Ingress rules let you route based on two dimensions:\n\n' +
          'Host-based routing: Different hostnames go to different Services.\n' +
          '  rules:\n' +
          '    - host: api.example.com\n' +
          '      http:\n' +
          '        paths:\n' +
          '          - path: /\n' +
          '            backend:\n' +
          '              service:\n' +
          '                name: api-svc\n' +
          '                port: { number: 80 }\n' +
          '    - host: web.example.com\n' +
          '      http:\n' +
          '        paths:\n' +
          '          - path: /\n' +
          '            backend:\n' +
          '              service:\n' +
          '                name: web-svc\n' +
          '                port: { number: 80 }\n\n' +
          'Path-based routing: Different URL paths go to different Services.\n' +
          '  - host: example.com\n' +
          '    http:\n' +
          '      paths:\n' +
          '        - path: /api\n' +
          '          backend: { service: { name: api-svc } }\n' +
          '        - path: /web\n' +
          '          backend: { service: { name: web-svc } }\n\n' +
          'You can combine both: api.example.com/v1 goes to api-v1-svc, api.example.com/v2 goes to api-v2-svc.',
        keyTakeaway:
          'Ingress rules match on host (domain name) and path (URL path). One Ingress resource can route traffic to many different Services based on these dimensions.',
      },
      {
        title: 'TLS Termination',
        content:
          'Ingress can terminate HTTPS traffic, so your backend Services only need to handle plain HTTP.\n\n' +
          'To enable TLS, you create a Kubernetes Secret of type kubernetes.io/tls containing your certificate ' +
          'and private key, then reference it in the Ingress:\n\n' +
          '  tls:\n' +
          '    - hosts:\n' +
          '        - api.example.com\n' +
          '      secretName: api-tls-cert\n\n' +
          'The Ingress controller handles the TLS handshake and decrypts traffic. It then forwards plain HTTP ' +
          'to the backend Service. This simplifies your application — it does not need to manage certificates.\n\n' +
          'For automatic certificate management, many teams use cert-manager, which integrates with Let\'s Encrypt ' +
          'to automatically provision and renew TLS certificates. You annotate your Ingress and cert-manager handles ' +
          'the rest.\n\n' +
          'TLS termination at the Ingress controller is the standard pattern in Kubernetes. It centralizes certificate ' +
          'management in one place instead of distributing it across every application.',
        keyTakeaway:
          'Ingress handles TLS termination so backend apps only deal with HTTP. Use cert-manager with Let\'s Encrypt for automatic certificate management.',
      },
      {
        title: 'IngressClass and Multiple Controllers',
        content:
          'A cluster can run multiple Ingress controllers. For example, you might have nginx for public traffic ' +
          'and Traefik for internal traffic. IngressClass lets you specify which controller should handle each Ingress:\n\n' +
          '  apiVersion: networking.k8s.io/v1\n' +
          '  kind: IngressClass\n' +
          '  metadata:\n' +
          '    name: nginx\n' +
          '  spec:\n' +
          '    controller: k8s.io/ingress-nginx\n\n' +
          'Then in your Ingress resource:\n' +
          '  spec:\n' +
          '    ingressClassName: nginx\n\n' +
          'You can set a default IngressClass so that Ingress resources without an explicit class are handled ' +
          'by a specific controller. This is useful when most of your Ingresses use the same controller.\n\n' +
          'IngressClass was introduced to solve the ambiguity of "which controller handles this?" when multiple ' +
          'controllers exist. Before IngressClass, controllers used annotations, which was fragile and inconsistent.',
        keyTakeaway:
          'IngressClass selects which controller handles an Ingress when multiple controllers exist. Set a default for convenience. This replaced the older annotation-based approach.',
      },
    ],
  },
  quiz: [
    {
      question:
        'You run "kubectl apply" to create an Ingress resource with routing rules for api.example.com. The resource is created successfully (kubectl get ingress shows it), but HTTP requests to api.example.com get no response. What is the most likely cause?',
      choices: [
        'No Ingress controller is installed in the cluster — the Ingress resource exists but nothing is reading or acting on it',
        'The Ingress rules have a syntax error in the host field',
        'The backend Service "api-svc" does not exist yet, so the Ingress has no targets',
        'The DNS record for api.example.com has not propagated yet',
      ],
      correctIndex: 0,
      explanation:
        'This is one of the most common Ingress mistakes. Kubernetes lets you create Ingress resources even without a controller installed — the API server accepts the object, and kubectl shows it. ' +
        'But an Ingress resource is just a declaration of desired routing. Without an Ingress controller (nginx, Traefik, etc.) actively watching and implementing those rules, nothing actually happens. ' +
        'Always verify your controller is running: kubectl get pods -n ingress-nginx.',
    },
    {
      question:
        'Your company runs 12 microservices, each needing external HTTPS access. A colleague suggests creating a LoadBalancer Service for each. What is the primary problem with this approach compared to using Ingress?',
      choices: [
        'LoadBalancer Services do not support HTTPS traffic, so TLS termination is impossible',
        'Each LoadBalancer Service provisions a separate cloud load balancer, resulting in 12 load balancers with 12 separate IP addresses and significant cost — Ingress shares a single entry point',
        'LoadBalancer Services are limited to 5 per cluster by the Kubernetes API',
        'LoadBalancer Services require NodePort allocation, and there are only 2768 available NodePorts in a cluster',
      ],
      correctIndex: 1,
      explanation:
        'Each LoadBalancer Service creates a dedicated cloud load balancer (e.g., an AWS ELB or GCP LB), each with its own public IP and monthly cost. With 12 services, that is 12 separate load balancers. ' +
        'An Ingress controller uses a single load balancer and routes traffic to all 12 services based on host/path rules. This saves cost, simplifies DNS management, and centralizes TLS termination.',
    },
    {
      question:
        'You need to serve api.example.com over HTTPS. Where does TLS termination typically happen in a Kubernetes Ingress setup, and what do the backend pods receive?',
      choices: [
        'TLS terminates at the cloud load balancer before it reaches the cluster — the Ingress controller receives plain HTTP',
        'TLS terminates at the Ingress controller, which handles certificates and forwards plain HTTP to backend Services — pods do not need TLS configuration',
        'Each backend pod must have its own TLS certificate configured — the Ingress controller passes encrypted traffic through unchanged',
        'TLS terminates at the Service level — the Service object decrypts traffic before forwarding to pods',
      ],
      correctIndex: 1,
      explanation:
        'In the standard Kubernetes pattern, the Ingress controller performs TLS termination. You store certificates in a Kubernetes Secret (type kubernetes.io/tls) and reference it in the Ingress spec. ' +
        'The controller handles the TLS handshake with clients and forwards decrypted HTTP to backend Services. This means your application containers only need to serve plain HTTP, simplifying deployment. ' +
        'Tools like cert-manager can automate certificate provisioning and renewal via Let\'s Encrypt.',
    },
    {
      question:
        'Your cluster runs both an nginx Ingress controller for public traffic and a Traefik controller for internal APIs. You create a new Ingress resource but do not specify an ingressClassName. What happens?',
      choices: [
        'Both controllers process the Ingress, causing duplicate routing and conflicts',
        'Kubernetes automatically selects the controller with the lowest resource usage',
        'The Ingress is rejected by the API server since no class is specified',
        'If a default IngressClass is set, that controller handles it; if no default exists, the behavior is undefined and the Ingress may be ignored by both controllers',
      ],
      correctIndex: 3,
      explanation:
        'When multiple Ingress controllers exist, IngressClass determines which controller handles each Ingress. If you omit ingressClassName, Kubernetes looks for an IngressClass marked as default ' +
        '(via the annotation ingressclass.kubernetes.io/is-default-class=true). If exactly one default exists, that controller picks it up. If no default is set, the behavior depends on the controllers — ' +
        'some may ignore it, some may claim it, leading to unpredictable results. Always specify ingressClassName explicitly in multi-controller environments.',
    },
  ],
  initialState: () => {
    const depUid = generateUID();
    const rsUid = generateUID();
    const image = 'nginx:1.0';
    const hash = templateHash({ image });

    const pods = Array.from({ length: 2 }, () => ({
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
          spec: { capacity: { pods: 5 } },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: 1,
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
          spec: { capacity: { pods: 5 } },
          status: {
            conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
            allocatedPods: 1,
          },
        },
      ],
      services: [
        {
          kind: 'Service' as const,
          metadata: {
            name: 'web-svc',
            uid: generateUID(),
            labels: {},
            creationTimestamp: Date.now() - 120000,
          },
          spec: { selector: { app: 'web' }, port: 80 },
          status: { endpoints: pods.map((p) => p.metadata.name) },
        },
      ],
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
    // Need at least 1 ingress
    return state.ingresses.length >= 1;
  },
};
