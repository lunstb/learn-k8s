import type { Lesson } from './types';

export const lessonNetworkPolicies: Lesson = {
  id: 15,
  title: 'Network Policies',
  description:
    'Network Policies control pod-to-pod traffic flow, letting you define which pods can communicate and blocking everything else.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage:
    'You now understand how Network Policies control traffic flow in Kubernetes.',
  lecture: {
    sections: [
      {
        title: 'Default Behavior: Allow All',
        content:
          'By default, Kubernetes allows all network traffic between all pods in the cluster. ' +
          'Any pod can talk to any other pod, regardless of namespace. There are no firewalls, no access control lists, ' +
          'no restrictions.\n\n' +
          'This is convenient for development but dangerous for production. If an attacker compromises one pod, ' +
          'they can reach every other pod in the cluster — your database, your internal APIs, your secret stores.\n\n' +
          'Network Policies are the Kubernetes mechanism for restricting this traffic. They act as a firewall ' +
          'between pods, letting you declare which connections are allowed and implicitly denying everything else.\n\n' +
          'Important: Network Policies are only enforced if your cluster\'s CNI plugin supports them. ' +
          'Popular CNI plugins with Network Policy support include Calico, Cilium, and Weave Net. ' +
          'If your CNI does not support them (e.g., basic Flannel), Network Policy resources can be created ' +
          'but have no effect — a dangerous false sense of security.',
        keyTakeaway:
          'Kubernetes defaults to allow-all networking. Network Policies restrict traffic, but only if your CNI plugin supports them. Always verify your CNI enforces policies.',
      },
      {
        title: 'NetworkPolicy Spec: Selecting Pods and Defining Rules',
        content:
          'A NetworkPolicy has two key parts: which pods it applies to (podSelector) and what traffic is allowed ' +
          '(ingress and egress rules).\n\n' +
          'podSelector: Uses labels to select which pods this policy applies to. An empty selector ({}) means ' +
          'all pods in the namespace.\n\n' +
          '  spec:\n' +
          '    podSelector:\n' +
          '      matchLabels:\n' +
          '        app: api\n\n' +
          'This policy applies to all pods with the label app=api.\n\n' +
          'policyTypes: Specifies whether the policy restricts ingress (incoming), egress (outgoing), or both.\n\n' +
          '  policyTypes:\n' +
          '    - Ingress\n' +
          '    - Egress\n\n' +
          'A critical detail: once any NetworkPolicy selects a pod, all traffic not explicitly allowed by ANY policy ' +
          'is denied. This is the "default deny" effect. If you create a policy that allows ingress from app=frontend ' +
          'to pods with app=api, all other ingress to app=api pods is implicitly blocked.',
        keyTakeaway:
          'podSelector picks which pods the policy governs. policyTypes declares ingress, egress, or both. Once a pod is selected by any policy, unlisted traffic is denied.',
      },
      {
        title: 'Ingress and Egress Rules',
        content:
          'Ingress rules control incoming traffic to the selected pods. Each rule specifies where traffic can come from:\n\n' +
          '  ingress:\n' +
          '    - from:\n' +
          '        - podSelector:\n' +
          '            matchLabels:\n' +
          '              app: frontend\n' +
          '      ports:\n' +
          '        - port: 8080\n\n' +
          'This allows traffic from pods labeled app=frontend on port 8080. All other ingress is denied.\n\n' +
          'Egress rules control outgoing traffic from the selected pods:\n\n' +
          '  egress:\n' +
          '    - to:\n' +
          '        - podSelector:\n' +
          '            matchLabels:\n' +
          '              app: database\n' +
          '      ports:\n' +
          '        - port: 5432\n\n' +
          'This allows outbound connections to pods labeled app=database on port 5432. All other egress is denied.\n\n' +
          'Rules can have multiple "from" or "to" blocks, and they are OR-ed together — traffic matching any rule is allowed.',
        diagram:
          '  frontend pods          api pods             database pods\n' +
          '  ┌──────────┐          ┌──────────┐          ┌──────────┐\n' +
          '  │ app:     │  allow   │ app:     │  allow   │ app:     │\n' +
          '  │ frontend │ ──────→  │ api      │ ──────→  │ database │\n' +
          '  └──────────┘  :8080   └──────────┘  :5432   └──────────┘\n' +
          '       ✗                     ✗                     ✗\n' +
          '  (other traffic denied) (other denied)     (other denied)',
        keyTakeaway:
          'Ingress rules = who can send traffic TO these pods. Egress rules = where these pods can send traffic. Multiple rules are OR-ed. Anything not explicitly allowed is denied.',
      },
      {
        title: 'Selectors: Pod, Namespace, and CIDR',
        content:
          'NetworkPolicy rules support three types of selectors:\n\n' +
          'podSelector: Matches pods by labels within the same namespace (unless combined with namespaceSelector).\n' +
          '  from:\n' +
          '    - podSelector:\n' +
          '        matchLabels:\n' +
          '          app: frontend\n\n' +
          'namespaceSelector: Matches pods from specific namespaces. Use this for cross-namespace communication:\n' +
          '  from:\n' +
          '    - namespaceSelector:\n' +
          '        matchLabels:\n' +
          '          env: production\n' +
          '      podSelector:\n' +
          '        matchLabels:\n' +
          '          app: monitoring\n\n' +
          'This allows traffic from pods labeled app=monitoring in namespaces labeled env=production.\n\n' +
          'ipBlock: Matches traffic from specific CIDR ranges. Used for external IPs or known infrastructure:\n' +
          '  from:\n' +
          '    - ipBlock:\n' +
          '        cidr: 10.0.0.0/8\n' +
          '        except:\n' +
          '          - 10.0.1.0/24\n\n' +
          'This allows traffic from the 10.0.0.0/8 range except 10.0.1.0/24.',
        keyTakeaway:
          'Use podSelector for same-namespace pods, namespaceSelector for cross-namespace control, and ipBlock for external CIDR ranges. Combine selectors for precise rules.',
      },
      {
        title: 'Common Patterns: Default Deny and Allowlisting',
        content:
          'The most important Network Policy pattern is "default deny" — block all traffic to a namespace, ' +
          'then explicitly allow only what is needed:\n\n' +
          'Default deny all ingress:\n' +
          '  apiVersion: networking.k8s.io/v1\n' +
          '  kind: NetworkPolicy\n' +
          '  metadata:\n' +
          '    name: deny-all-ingress\n' +
          '  spec:\n' +
          '    podSelector: {}\n' +
          '    policyTypes:\n' +
          '      - Ingress\n\n' +
          'The empty podSelector selects all pods. The empty ingress rules (none listed) mean no ingress is allowed. ' +
          'All incoming traffic to this namespace is blocked.\n\n' +
          'Default deny all egress:\n' +
          '  spec:\n' +
          '    podSelector: {}\n' +
          '    policyTypes:\n' +
          '      - Egress\n\n' +
          'After applying deny-all, you create specific allow policies for legitimate communication paths. ' +
          'This is the allowlist approach — deny everything, then punch holes for what you need.\n\n' +
          'This pattern follows the principle of least privilege: pods can only communicate with what they ' +
          'explicitly need, reducing the blast radius of a compromised pod.',
        keyTakeaway:
          'Start with "deny all" using an empty podSelector and no rules. Then add specific policies to allow required traffic. This is the principle of least privilege applied to networking.',
      },
    ],
  },
  quiz: [
    {
      question:
        'You carefully create a NetworkPolicy that denies all ingress to your database pods. You test it, but traffic from other pods still reaches the database without any restriction. The policy YAML is correct. What is the most likely explanation?',
      choices: [
        'Your cluster\'s CNI plugin (e.g., basic Flannel) does not support NetworkPolicy enforcement — the resource exists but is silently ignored',
        'NetworkPolicy resources only take effect after a cluster restart',
        'The policy needs to be created in the kube-system namespace to be enforced cluster-wide',
        'You need to also create an egress policy on the source pods for the ingress policy to take effect',
      ],
      correctIndex: 0,
      explanation:
        'This is a dangerous gotcha. Kubernetes always lets you create NetworkPolicy resources regardless of whether your CNI enforces them. If your CNI plugin does not support Network Policies (e.g., basic Flannel), ' +
        'the policies are stored in etcd but have zero effect on traffic — giving you a false sense of security. Always verify your CNI supports enforcement. Calico, Cilium, and Weave Net all support Network Policies; basic Flannel does not.',
    },
    {
      question:
        'You create a NetworkPolicy that selects pods with app=api and defines only Ingress rules (allowing traffic from app=frontend on port 8080). The policyTypes field lists only "Ingress". What happens to egress traffic FROM the api pods?',
      choices: [
        'All egress from api pods is also denied, since the policy selects those pods',
        'Egress is denied by default whenever any NetworkPolicy selects a pod, regardless of policyTypes',
        'Egress is limited to the same pods listed in the ingress "from" rules',
        'Egress from api pods is completely unaffected — only the Ingress policy type was specified, so egress remains open',
      ],
      correctIndex: 3,
      explanation:
        'This is a subtle but critical detail. NetworkPolicy enforcement only applies to the policy types explicitly listed in policyTypes. If you only list "Ingress", then only ingress traffic is restricted (to what the rules allow). ' +
        'Egress is completely untouched — it remains fully open as if no policy existed for that direction. To restrict egress, you must explicitly add "Egress" to policyTypes. Many people assume selecting a pod locks down all traffic, but it only locks down the declared directions.',
    },
    {
      question:
        'You want to create a "deny all ingress" policy for a namespace. You write a NetworkPolicy with podSelector: {} and policyTypes: ["Ingress"] but no ingress rules. What does the empty podSelector {} match?',
      choices: [
        'No pods — an empty selector matches nothing, so the policy has no effect',
        'Only pods without any labels',
        'All pods in the namespace where the NetworkPolicy is created',
        'All pods across all namespaces in the cluster',
      ],
      correctIndex: 2,
      explanation:
        'An empty podSelector {} selects ALL pods in the policy\'s namespace — this is how "deny all" policies work. Combined with policyTypes: ["Ingress"] and no ingress rules listed, it means: ' +
        '"select every pod in this namespace and deny all incoming traffic to them." This is the standard deny-all-ingress pattern. Note that it only affects the namespace where the policy is created, not the entire cluster. ' +
        'You must create separate deny-all policies in each namespace you want to protect.',
    },
    {
      question:
        'Your cluster has two namespaces: "frontend" and "backend". You create a NetworkPolicy in the "backend" namespace that allows ingress only from pods with app=web. A pod with app=web exists in the "frontend" namespace. Does it get access?',
      choices: [
        'Yes — podSelector matches pods across all namespaces by default',
        'Yes — but only because pods in different namespaces can always communicate regardless of policies',
        'No — a podSelector without a namespaceSelector only matches pods within the same namespace ("backend"), not pods in "frontend"',
        'No — cross-namespace traffic is always blocked by NetworkPolicy regardless of selectors',
      ],
      correctIndex: 2,
      explanation:
        'A podSelector in a NetworkPolicy rule only matches pods within the policy\'s own namespace by default. To allow traffic from pods in a different namespace, you must also include a namespaceSelector. ' +
        'For example, to allow traffic from app=web pods in the "frontend" namespace, you would need both a namespaceSelector matching the frontend namespace labels AND a podSelector matching app=web. ' +
        'This catches many people off guard — they write a podSelector expecting it to match cluster-wide, but it only matches within the local namespace.',
    },
  ],
};
