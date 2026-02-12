import type { Lesson } from './types';

export const lessonRomeNetworking: Lesson = {
  id: 33,
  title: 'From Ingress to Pod: How Traffic Reaches Rome AI',
  description:
    'Map the simulator\'s Ingress → Service → Pod chain to the real traffic path: Cloudflare DNS → ACM certs → AWS ALB → NGINX DaemonSet → K8s Service → Pod.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand how production traffic flows from the internet to a Pod in Rome AI.',
  lecture: {
    sections: [
      {
        title: 'Simulator Recap: Ingress → Service → Pod',
        content:
          'In the simulator, you created an Ingress resource with host and path rules pointing to a Service, ' +
          'which selected Pods by label. The Ingress controller (NGINX) was the reverse proxy that actually handled traffic.\n\n' +
          'The core chain was: External request → Ingress Controller → Ingress Rules → Service → Pod.\n\n' +
          'In the simulator, this was the whole story. In production, every link in this chain has real infrastructure behind it — ' +
          'DNS providers, cloud load balancers, TLS certificates, VPC networking, and node-level routing. ' +
          'This lesson maps each simulator concept to its production equivalent in the Rome AI deployment.',
        keyTakeaway:
          'In the simulator you saw a simplified version of this chain. In production, every link in this chain has real infrastructure behind it.',
      },
      {
        title: 'The Rome AI Traffic Path: Cloudflare to Pod',
        content:
          'A user opens `mp.acme.staging.getrome.io` in their browser. Here is the full production path:\n\n' +
          '1. DNS resolves via Cloudflare, which provides DDoS protection and CDN caching.\n' +
          '2. Cloudflare forwards to an AWS Application Load Balancer (ALB) in the VPC\'s public subnets. ' +
          'The ALB terminates TLS using an ACM wildcard certificate (`*.{tenant}.{env}.getrome.io`).\n' +
          '3. The ALB forwards to the NGINX Ingress Controller running as a DaemonSet on every node.\n' +
          '4. NGINX matches the hostname against Ingress rules and routes to the correct K8s Service.\n' +
          '5. The Service selects Pods via labels, and kube-proxy routes to a healthy Pod in the private app subnets.\n\n' +
          'This is the same Ingress → Service → Pod chain from the simulator, but with Cloudflare (DNS/CDN), ' +
          'ALB (cloud load balancer with TLS), and a DaemonSet-based NGINX controller added in front.',
        diagram:
          '  User Browser\n' +
          '       │\n' +
          '  Cloudflare DNS (DDoS + CDN)\n' +
          '       │\n' +
          '  AWS ALB (public subnet, TLS via ACM)\n' +
          '       │\n' +
          '  NGINX Ingress Controller (DaemonSet, every node)\n' +
          '       │\n' +
          '  K8s Service (ClusterIP)\n' +
          '       │\n' +
          '  Pod (private app subnet, /20 per AZ)',
        keyTakeaway:
          'The simulator\'s Ingress → Service → Pod chain is three links. Production adds Cloudflare (DNS/CDN), ALB (cloud load balancer with TLS), and runs the NGINX controller as a DaemonSet for node-level availability.',
      },
      {
        title: 'Subdomains and Multi-Tenant Routing',
        content:
          'In the simulator, Ingress rules used a single host like `myapp.example.com`. Rome AI uses a structured subdomain pattern: ' +
          '`{service}.{tenant}.{env}.getrome.io`.\n\n' +
          'This means `api.acme.prod.getrome.io` routes to the applayer Deployment for the Acme tenant in production, ' +
          'while `mp.acme.staging.getrome.io` routes to the material-planners frontend for Acme in staging.\n\n' +
          'Each tenant has their own EKS cluster in their own AWS account, so a single NGINX Ingress Controller handles ' +
          'all services for that tenant. The websocket service (Centrifugo) gets its own Ingress with ' +
          '`ws.{tenant}.{env}.getrome.io` because websocket connections require different NGINX configuration ' +
          '(connection upgrades, longer timeouts). Keycloak runs in a separate namespace with its own subdomain.',
        keyTakeaway:
          'Subdomain structure encodes service, tenant, and environment. Each tenant cluster has its own Ingress Controller, ALB, and DNS records, keeping tenant traffic completely isolated.',
      },
      {
        title: 'VPC Network Architecture',
        content:
          'In the simulator, networking was invisible — Pods could just talk to each other. In production, ' +
          'network isolation is enforced at the AWS VPC level.\n\n' +
          'Rome AI uses three subnet tiers:\n\n' +
          '- Public subnets hold the ALB and NAT gateways (internet-facing).\n' +
          '- System subnets hold managed services like RDS and ElastiCache (no direct internet access).\n' +
          '- Private app subnets (/20 per AZ) hold all Kubernetes Pods.\n\n' +
          'The /20 CIDR per AZ gives approximately 4,096 IP addresses per zone — critical because every Pod ' +
          'gets its own IP address in EKS (via the AWS VPC CNI plugin). Cross-account communication ' +
          '(e.g., tenant cluster talking to the engineering observability stack) uses VPC peering.',
        diagram:
          '  VPC: 10.0.0.0/16\n' +
          '  ├── Public Subnets (/24 x3)      ← ALB, NAT Gateway\n' +
          '  ├── System Subnets (/24 x3)      ← RDS, ElastiCache\n' +
          '  └── Private App Subnets (/20 x3) ← K8s Pods\n' +
          '       (4,096 IPs per AZ)\n' +
          '\n' +
          '  Tenant VPC ←── VPC Peering ──→ Engineering VPC',
        keyTakeaway:
          'Every Pod gets a real VPC IP address. The /20 subnets provide enough IPs for thousands of Pods. The three-tier subnet layout isolates internet-facing, managed service, and application traffic.',
      },
      {
        title: 'Why NGINX Runs as a DaemonSet',
        content:
          'In the simulator, the Ingress controller was just a concept. In Rome AI, the NGINX Ingress Controller runs ' +
          'as a DaemonSet, meaning one Pod per Node.\n\n' +
          'Recall from the DaemonSets lesson: DaemonSets guarantee exactly one Pod per node and automatically deploy to ' +
          'new nodes when Karpenter provisions them. For the Ingress Controller, this means traffic arriving at any node ' +
          'can be handled immediately.\n\n' +
          'The ALB health-checks every node; if a node\'s NGINX Pod is unhealthy, the ALB stops sending traffic to it. ' +
          'Compare this to running the Ingress controller as a Deployment with 2 replicas — traffic would only work ' +
          'on the 2 nodes where the Pods are scheduled, and you would need a separate mechanism to route ALB traffic only to those nodes.',
        keyTakeaway:
          'DaemonSet ensures every node can handle ingress traffic. The ALB distributes across all nodes, and Karpenter-provisioned nodes automatically get an NGINX Pod.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A new tenant is onboarded and their EKS cluster is created. Traffic to `api.newcorp.prod.getrome.io` is returning 502 errors. The ALB is healthy and Cloudflare DNS resolves correctly. What is the most likely cause?',
      choices: [
        'The NGINX Ingress Controller DaemonSet has not been deployed to the new cluster yet, so no Pod can process the incoming requests',
        'The ACM wildcard certificate does not cover the `newcorp` subdomain because wildcards only match one level',
        'Cloudflare\'s CDN cache is stale from a previous tenant that used the same IP address range',
        'The ALB cannot route to private subnets because public-to-private routing requires explicit NAT configuration',
      ],
      correctIndex: 0,
      explanation:
        'The ACM wildcard `*.newcorp.prod.getrome.io` would cover `api.newcorp.prod.getrome.io`. ' +
        'The most likely cause of a 502 is that while the ALB is listening, the backend (NGINX Ingress Controller) ' +
        'is not yet running in the new cluster. Without NGINX Pods on the nodes, the ALB has no healthy targets and returns 502 Bad Gateway.',
    },
    {
      question:
        'Rome AI runs NGINX Ingress Controller as a DaemonSet instead of a Deployment. If Karpenter provisions a new node to handle pod scheduling pressure, what happens to NGINX on that node?',
      choices: [
        'Nothing — NGINX only runs on the original nodes. The new node handles application pods only.',
        'The DaemonSet controller automatically schedules a NGINX Pod on the new node, and the ALB starts health-checking it',
        'A separate Karpenter hook must be configured to notify the NGINX Deployment to add a replica on the new node',
        'The new node joins the cluster without NGINX, but traffic still reaches it because kube-proxy forwards from other nodes',
      ],
      correctIndex: 1,
      explanation:
        'DaemonSets automatically schedule a Pod on every node, including newly provisioned ones. ' +
        'The DaemonSet controller detects the new node and creates a NGINX Pod. Once the Pod passes health checks, ' +
        'the ALB includes the node in its target group.',
    },
    {
      question:
        'The private app subnets in Rome AI\'s VPC use /20 CIDR blocks per AZ. Why is this sizing important for an EKS cluster?',
      choices: [
        'Larger subnets reduce network latency because packets travel shorter routes within the same CIDR range',
        'AWS EKS with the VPC CNI plugin assigns each Pod a real VPC IP address, so the subnet must have enough IPs for all Pods',
        'The /20 size is required by AWS for any subnet that holds EC2 instances running Kubernetes',
        'Larger subnets allow more security group rules, which are needed for pod-level network policies',
      ],
      correctIndex: 1,
      explanation:
        'AWS VPC CNI assigns each Pod a real IP address from the subnet (unlike overlay networks). ' +
        'A /20 provides ~4,096 addresses per AZ. With multiple Pods per node and autoscaling, ' +
        'you can easily exhaust smaller subnets. The /20 ensures room for growth.',
    },
    {
      question:
        'A developer asks: in the simulator, I created an Ingress with a TLS section referencing a Secret. How does TLS work differently in the Rome AI production setup?',
      choices: [
        'There is no difference — Rome AI also uses Kubernetes Secrets containing TLS certificates referenced by Ingress resources',
        'Rome AI uses ACM (AWS Certificate Manager) wildcard certificates on the ALB, so TLS terminates at the ALB before traffic reaches NGINX',
        'TLS is handled entirely by Cloudflare and all traffic between Cloudflare and the cluster is unencrypted HTTP',
        'Rome AI uses cert-manager to provision per-service certificates from Let\'s Encrypt for each subdomain',
      ],
      correctIndex: 1,
      explanation:
        'Rome AI terminates TLS at the ALB using ACM wildcard certificates. This is different from the simulator ' +
        'pattern where TLS terminated at the Ingress controller. ACM certificates are free, auto-renewing, and ' +
        'managed by AWS — no Kubernetes Secrets needed for the main TLS termination. Traffic between ALB and NGINX is internal to the VPC.',
    },
    {
      question:
        'In the simulator, any Pod could reach any other Pod. Rome AI\'s VPC has three subnet tiers: public, system, and private app. Which statement about cross-tier communication is correct?',
      choices: [
        'Pods in private app subnets can directly reach RDS in system subnets because both are within the same VPC, with security groups controlling access',
        'Pods must go through the ALB to reach any resource outside their own subnet tier',
        'Network ACLs block all traffic between tiers — each tier is a completely isolated network',
        'RDS instances in system subnets are exposed via Kubernetes Services so Pods discover them through CoreDNS',
      ],
      correctIndex: 0,
      explanation:
        'Within a VPC, subnets can communicate with each other by default. Security groups act as the firewall, ' +
        'controlling which ports and source IPs are allowed. Rome AI uses security groups per tier — application Pods ' +
        'can reach RDS on port 5432 because the RDS security group allows inbound from the private app subnet CIDR.',
    },
  ],
};
