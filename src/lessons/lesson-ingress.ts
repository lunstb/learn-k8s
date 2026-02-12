import type { Lesson } from './types';
import type { ClusterState } from '../simulation/types';
import { generateUID, generatePodName, templateHash } from '../simulation/utils';

export const lessonIngress: Lesson = {
  id: 14,
  title: 'Ingress',
  description:
    'Ingress provides HTTP/HTTPS routing from outside the cluster to Services inside, with host-based and path-based rules.',
  mode: 'full',
  goalDescription:
    'Create an Ingress named "web-ing" that routes traffic from myapp.example.com to the "web-svc" Service on port 80.',
  successMessage:
    'You created an Ingress. External traffic to your specified host/path will now be routed through the Ingress controller ' +
    'to the "web-svc" Service and its pods. This is how you expose HTTP applications to the outside world.',
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
        'The Ingress rules have a syntax error in the host field that the API server accepted but the controller rejects',
        'The backend Service "api-svc" does not exist yet, so the Ingress controller has no target to forward traffic to',
        'No Ingress controller is installed in the cluster, so nothing is reading or acting on the Ingress resource',
        'The DNS record for api.example.com has not propagated yet, so requests are not reaching the cluster at all',
      ],
      correctIndex: 2,
      explanation:
        'This is one of the most common Ingress mistakes. Kubernetes lets you create Ingress resources even without a controller installed — the API server accepts the object, and kubectl shows it. ' +
        'But an Ingress resource is just a declaration of desired routing. Without an Ingress controller (nginx, Traefik, etc.) actively watching and implementing those rules, nothing actually happens. ' +
        'Always verify your controller is running: kubectl get pods -n ingress-nginx.',
    },
    {
      question:
        'Your company runs 12 microservices, each needing external HTTPS access. A colleague suggests creating a LoadBalancer Service for each. What is the primary problem with this approach compared to using Ingress?',
      choices: [
        'LoadBalancer Services cannot perform TLS termination, so each microservice must handle its own certificates internally',
        'LoadBalancer Services expose random NodePorts that conflict when more than 10 services share the same cluster nodes',
        'LoadBalancer Services route traffic at L4 only, making it impossible to distinguish between different microservices by hostname',
        'Each LoadBalancer Service provisions a separate cloud load balancer, creating 12 load balancers with significant cost overhead',
      ],
      correctIndex: 3,
      explanation:
        'Each LoadBalancer Service creates a dedicated cloud load balancer (e.g., an AWS ELB or GCP LB), each with its own public IP and monthly cost. With 12 services, that is 12 separate load balancers. ' +
        'An Ingress controller uses a single load balancer and routes traffic to all 12 services based on host/path rules. This saves cost, simplifies DNS management, and centralizes TLS termination.',
    },
    {
      question:
        'You need to serve api.example.com over HTTPS. Where does TLS termination typically happen in a Kubernetes Ingress setup, and what do the backend pods receive?',
      choices: [
        'TLS terminates at the Ingress controller, which handles certificates from a referenced TLS Secret and forwards plain HTTP to backend Services',
        'TLS terminates at the cloud load balancer before reaching the cluster, so the Ingress controller only handles unencrypted HTTP traffic',
        'Each backend pod must have its own TLS certificate configured in its container, because the Ingress controller passes encrypted traffic through unchanged',
        'TLS terminates at the kube-proxy level on each node, so both the Ingress controller and backend pods only handle decrypted HTTP',
      ],
      correctIndex: 0,
      explanation:
        'In the standard Kubernetes pattern, the Ingress controller performs TLS termination. You store certificates in a Kubernetes Secret (type kubernetes.io/tls) and reference it in the Ingress spec. ' +
        'The controller handles the TLS handshake with clients and forwards decrypted HTTP to backend Services. This means your application containers only need to serve plain HTTP, simplifying deployment. ' +
        'Tools like cert-manager can automate certificate provisioning and renewal via Let\'s Encrypt.',
    },
    {
      question:
        'Your cluster runs both an nginx Ingress controller for public traffic and a Traefik controller for internal APIs. You create a new Ingress resource but do not specify an ingressClassName. What happens?',
      choices: [
        'Both controllers process the Ingress simultaneously, causing duplicate routing and potential conflicts between them',
        'If a default IngressClass exists, that controller handles it; otherwise the behavior is undefined and both may ignore it',
        'Kubernetes automatically selects whichever controller has the lowest current resource usage to handle the Ingress',
        'The API server rejects the Ingress resource at admission time because ingressClassName is a required field',
      ],
      correctIndex: 1,
      explanation:
        'When multiple Ingress controllers exist, IngressClass determines which controller handles each Ingress. If you omit ingressClassName, Kubernetes looks for an IngressClass marked as default ' +
        '(via the annotation ingressclass.kubernetes.io/is-default-class=true). If exactly one default exists, that controller picks it up. If no default is set, the behavior depends on the controllers — ' +
        'some may ignore it, some may claim it, leading to unpredictable results. Always specify ingressClassName explicitly in multi-controller environments.',
    },
  ],
  practices: [
    {
      title: 'Create a Multi-Path Ingress',
      goalDescription:
        'Two backend services exist: "web-svc" and "api-svc". Create an Ingress named "web-ing" that routes ' +
        'myapp.example.com/ to "web-svc" and myapp.example.com/api to "api-svc", both on port 80.',
      successMessage:
        'You created an Ingress with path-based routing. External traffic to "/" goes to the web frontend, ' +
        'while "/api" goes to the API backend. This is the standard pattern for serving a frontend and ' +
        'API from the same domain — one Ingress controller handles both routes.',
      yamlTemplate: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ing
spec:
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: ???
            port:
              number: 80
      - path: /api
        backend:
          service:
            name: ???
            port:
              number: 80`,
      hints: [
        { text: 'Run "kubectl get services" to see the available backend services before creating the Ingress.' },
        { text: 'In the YAML template, set the first service name to "web-svc" for path "/" and the second to "api-svc" for path "/api".' },
        { text: 'Or use the terminal: kubectl create ingress web-ing --rule=myapp.example.com/=web-svc:80 (note: this only creates one rule — use YAML for multi-path)', exact: false },
        { text: 'After applying, run "kubectl get ingress" to verify the Ingress was created with both rules.' },
      ],
      goals: [
        {
          description: 'Use "kubectl get services" to see available backends',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('get-services'),
        },
        {
          description: 'Use "kubectl apply" or "kubectl create ingress" to create the Ingress',
          check: (s: ClusterState) => (s._commandsUsed ?? []).includes('apply') || (s._commandsUsed ?? []).includes('create-ingress'),
        },
        {
          description: 'Ingress routes myapp.example.com/ to "web-svc"',
          check: (s: ClusterState) => {
            return s.ingresses.some(ing => ing.spec.rules.some(r => r.serviceName === 'web-svc' && r.host === 'myapp.example.com'));
          },
        },
        {
          description: 'Ingress routes myapp.example.com/api to "api-svc"',
          check: (s: ClusterState) => {
            return s.ingresses.some(ing => ing.spec.rules.some(r => r.serviceName === 'api-svc' && r.host === 'myapp.example.com' && r.path === '/api'));
          },
        },
        {
          description: 'Verify Ingress was created',
          check: (s: ClusterState) => s.ingresses.length > 0,
        },
      ],
      initialState: () => {
        const webDepUid = generateUID();
        const webRsUid = generateUID();
        const apiDepUid = generateUID();
        const apiRsUid = generateUID();
        const webImage = 'nginx:1.0';
        const apiImage = 'node-api:1.0';
        const webHash = templateHash({ image: webImage });
        const apiHash = templateHash({ image: apiImage });

        const webPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`web-${webHash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'web', 'pod-template-hash': webHash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `web-${webHash.slice(0, 10)}`,
              uid: webRsUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image: webImage },
          status: { phase: 'Running' as const },
        }));

        const apiPods = Array.from({ length: 2 }, () => ({
          kind: 'Pod' as const,
          metadata: {
            name: generatePodName(`api-${apiHash.slice(0, 10)}`),
            uid: generateUID(),
            labels: { app: 'api', 'pod-template-hash': apiHash },
            ownerReference: {
              kind: 'ReplicaSet',
              name: `api-${apiHash.slice(0, 10)}`,
              uid: apiRsUid,
            },
            creationTimestamp: Date.now() - 60000,
          },
          spec: { image: apiImage },
          status: { phase: 'Running' as const },
        }));

        return {
          deployments: [
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'web',
                uid: webDepUid,
                labels: { app: 'web' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'web' },
                template: {
                  labels: { app: 'web' },
                  spec: { image: webImage },
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
            {
              kind: 'Deployment' as const,
              metadata: {
                name: 'api',
                uid: apiDepUid,
                labels: { app: 'api' },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'api' },
                template: {
                  labels: { app: 'api' },
                  spec: { image: apiImage },
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
                name: `web-${webHash.slice(0, 10)}`,
                uid: webRsUid,
                labels: { app: 'web', 'pod-template-hash': webHash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'web',
                  uid: webDepUid,
                },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'web', 'pod-template-hash': webHash },
                template: {
                  labels: { app: 'web', 'pod-template-hash': webHash },
                  spec: { image: webImage },
                },
              },
              status: { replicas: 2, readyReplicas: 2 },
            },
            {
              kind: 'ReplicaSet' as const,
              metadata: {
                name: `api-${apiHash.slice(0, 10)}`,
                uid: apiRsUid,
                labels: { app: 'api', 'pod-template-hash': apiHash },
                ownerReference: {
                  kind: 'Deployment',
                  name: 'api',
                  uid: apiDepUid,
                },
                creationTimestamp: Date.now() - 120000,
              },
              spec: {
                replicas: 2,
                selector: { app: 'api', 'pod-template-hash': apiHash },
                template: {
                  labels: { app: 'api', 'pod-template-hash': apiHash },
                  spec: { image: apiImage },
                },
              },
              status: { replicas: 2, readyReplicas: 2 },
            },
          ],
          pods: [...webPods, ...apiPods],
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
              spec: { capacity: { pods: 5 } },
              status: {
                conditions: [{ type: 'Ready' as const, status: 'True' as const }] as [{ type: 'Ready'; status: 'True' | 'False' }],
                allocatedPods: 2,
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
              status: { endpoints: webPods.map((p) => p.metadata.name) },
            },
            {
              kind: 'Service' as const,
              metadata: {
                name: 'api-svc',
                uid: generateUID(),
                labels: {},
                creationTimestamp: Date.now() - 120000,
              },
              spec: { selector: { app: 'api' }, port: 80 },
              status: { endpoints: apiPods.map((p) => p.metadata.name) },
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
      goalCheck: (state: ClusterState) => {
        // Need an ingress that routes to both web-svc and api-svc
        const ingress = state.ingresses.find((ing) =>
          ing.spec.rules.some((r) => r.serviceName === 'web-svc' && r.host === 'myapp.example.com') &&
          ing.spec.rules.some((r) => r.serviceName === 'api-svc' && r.host === 'myapp.example.com' && r.path === '/api')
        );
        return !!ingress;
      },
    },
  ],
};
