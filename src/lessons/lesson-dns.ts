import type { Lesson } from './types';

export const lessonDNS: Lesson = {
  id: 29,
  title: 'Cluster DNS & Service Discovery',
  description:
    'Understand how CoreDNS provides service discovery within a Kubernetes cluster — FQDN format, headless services, and common DNS debugging.',
  mode: 'lecture-quiz',
  goalDescription: 'Complete the quiz to finish this lesson.',
  successMessage: 'You now understand Kubernetes DNS and service discovery.',
  lecture: {
    sections: [
      {
        title: 'CoreDNS and Cluster DNS',
        content:
          'Every Kubernetes cluster runs a DNS server — typically CoreDNS — as pods in the kube-system namespace. ' +
          'When a pod is created, its `/etc/resolv.conf` is automatically configured to use the cluster DNS service ' +
          '(usually at IP 10.96.0.10).\n\n' +
          'This means every pod can resolve Service names to ClusterIPs without any manual configuration. ' +
          'When you create a Service named "api" in namespace "production", pods can reach it by just using "api" ' +
          'as the hostname (if they are in the same namespace) or "api.production" (from another namespace).\n\n' +
          'CoreDNS watches the Kubernetes API for new Services and Endpoints. When a Service is created, CoreDNS ' +
          'automatically creates a DNS A record pointing to the Service ClusterIP. When the Service is deleted, ' +
          'the record is removed.\n\n' +
          'This is the foundation of service discovery in Kubernetes — applications use DNS names instead of ' +
          'hardcoded IPs, and the cluster DNS keeps the mapping up to date.',
        keyTakeaway:
          'CoreDNS runs in kube-system and auto-configures DNS for every pod. Services get DNS records automatically. Pods use DNS names for service discovery — no hardcoded IPs needed.',
      },
      {
        title: 'Service FQDN Format',
        content:
          'Every Service gets a Fully Qualified Domain Name (FQDN) in this format:\n\n' +
          '  `<service-name>.<namespace>.svc.cluster.local`\n\n' +
          'For a Service named "api" in namespace "production":\n' +
          '  api.production.svc.cluster.local\n\n' +
          'DNS search domains in pods are configured to allow shorter names:\n' +
          '  nameserver 10.96.0.10\n' +
          '  search production.svc.cluster.local svc.cluster.local cluster.local\n\n' +
          'So from a pod in the "production" namespace:\n' +
          '- `api` resolves (matches production.svc.cluster.local search domain)\n' +
          '- `api.production` resolves\n' +
          '- `api.production.svc` resolves\n' +
          '- `api.production.svc.cluster.local` resolves (FQDN)\n\n' +
          'From a pod in a DIFFERENT namespace (e.g., "staging"):\n' +
          '- `api` does NOT resolve (would try staging.svc.cluster.local first)\n' +
          '- `api.production` resolves\n' +
          '- `api.production.svc.cluster.local` resolves\n\n' +
          'Best practice: use the short `<service>.<namespace>` form for cross-namespace calls. ' +
          'Use the bare `<service>` name for same-namespace calls.',
        diagram:
          '  Pod in "staging" namespace:\n' +
          '  \n' +
          '  curl api                  → FAILS (no "api" in staging)\n' +
          '  curl api.production      → 10.96.42.5 (ClusterIP)\n' +
          '  curl db.staging           → 10.96.88.3 (same namespace)',
        keyTakeaway:
          'Service FQDN: <svc>.<ns>.svc.cluster.local. Use bare name within the same namespace. Use <svc>.<ns> across namespaces. DNS search domains make short names work.',
      },
      {
        title: 'Headless Services and Per-Pod DNS',
        content:
          'A headless Service (clusterIP: None) does not get a ClusterIP. Instead, DNS returns the individual ' +
          'pod IPs directly.\n\n' +
          'This is essential for StatefulSets. A headless Service named "mysql" with a StatefulSet creates ' +
          'per-pod DNS records:\n' +
          '  mysql-0.mysql.<namespace>.svc.cluster.local → pod IP of mysql-0\n' +
          '  mysql-1.mysql.<namespace>.svc.cluster.local → pod IP of mysql-1\n\n' +
          'This gives each pod a stable, predictable DNS name that persists across pod restarts (even though the IP changes). ' +
          'Applications like databases use this for peer discovery and replication configuration.\n\n' +
          'Regular (non-headless) Services return the ClusterIP, which load-balances across all pods. ' +
          'Headless Services let clients discover and connect to specific pods.\n\n' +
          'Use cases for headless Services:\n' +
          '- Database clusters: connect to a specific primary/replica\n' +
          '- Distributed systems: peer discovery (Kafka brokers, Elasticsearch nodes)\n' +
          '- gRPC: client-side load balancing (needs individual pod IPs)',
        keyTakeaway:
          'Headless Services (clusterIP: None) return pod IPs instead of a ClusterIP. StatefulSet pods get stable DNS names: <pod>.<svc>.<ns>.svc.cluster.local. Used for databases, peer discovery, and client-side load balancing.',
      },
      {
        title: 'Common DNS Debugging',
        content:
          'DNS issues are one of the most common Kubernetes debugging scenarios. Here are the typical problems and how to diagnose them:\n\n' +
          'Wrong namespace: A pod in "staging" tries to reach `api` but the Service is in "production". ' +
          'Fix: use `api.production` or the full FQDN.\n\n' +
          'Missing Service: The DNS lookup fails because the Service does not exist. ' +
          'Check: `kubectl get svc -n <namespace>` to verify the Service exists.\n\n' +
          'Service exists but no endpoints: DNS resolves to the ClusterIP, but traffic fails. ' +
          'Check: `kubectl get endpoints <svc-name>` — if empty, the Service selector does not match any running pods. ' +
          'Verify labels match between Service selector and Pod labels.\n\n' +
          'Debugging commands:\n' +
          '  kubectl run debug --rm -it --image=busybox -- nslookup api.production\n' +
          '  kubectl run debug --rm -it --image=busybox -- wget -qO- api.production:8080/health\n\n' +
          'CoreDNS issues: If DNS fails for ALL services, check CoreDNS pods:\n' +
          '  kubectl get pods -n kube-system -l k8s-app=kube-dns\n' +
          '  kubectl logs -n kube-system -l k8s-app=kube-dns\n\n' +
          'ExternalName Services: A Service of type ExternalName returns a CNAME record pointing to an external domain. ' +
          'Useful for referencing external databases or APIs through Kubernetes service discovery.',
        keyTakeaway:
          'Common DNS issues: wrong namespace, missing service, selector mismatch (no endpoints). Debug with nslookup from a temporary pod. Check CoreDNS pods in kube-system if all DNS fails.',
      },
    ],
  },
  quiz: [
    {
      question:
        'A pod in the "orders" namespace needs to reach a Service named "payments" in the "billing" namespace. Which DNS name works?',
      choices: [
        '`payments` — the DNS search domains include all namespaces in the cluster automatically',
        '`payments.billing` — the <service>.<namespace> format resolves across namespaces via the svc.cluster.local search domain',
        '`payments.billing.pod.cluster.local` — the pod subdomain is required for cross-namespace resolution',
        '`billing/payments` — Kubernetes uses slash-delimited notation similar to resource API paths',
      ],
      correctIndex: 1,
      explanation:
        'The DNS search domain for a pod in "orders" only includes orders.svc.cluster.local. ' +
        'So bare "payments" would try payments.orders.svc.cluster.local and fail. ' +
        'The correct cross-namespace form is payments.billing, which resolves via the svc.cluster.local search domain ' +
        'to payments.billing.svc.cluster.local — the Service ClusterIP.',
    },
    {
      question:
        'You create a headless Service (clusterIP: None) for a 3-replica StatefulSet named "redis" with serviceName "redis". What DNS records are created?',
      choices: [
        'Three per-pod A records: redis-0.redis.<ns>.svc.cluster.local, redis-1.redis.<ns>.svc.cluster.local, redis-2.redis.<ns>.svc.cluster.local — each resolving to its pod IP',
        'Only one A record: redis.<namespace>.svc.cluster.local pointing to a virtual ClusterIP that load-balances across all pod IPs',
        'Three SRV records for port discovery but no A records — headless services rely on SRV lookups for connectivity',
        'One CNAME record per pod that maps to the node hostname where each pod is scheduled rather than to pod IPs directly',
      ],
      correctIndex: 0,
      explanation:
        'A headless Service for a StatefulSet creates individual A records for each pod. The format is ' +
        '<pod-name>.<service-name>.<namespace>.svc.cluster.local. Additionally, the service name itself (redis.<ns>.svc.cluster.local) ' +
        'returns all three pod IPs (not a ClusterIP). This gives applications both individual pod access ' +
        'and collective discovery.',
    },
    {
      question:
        'DNS resolves "api-svc" to a ClusterIP successfully, but HTTP requests to that IP time out. `kubectl get endpoints api-svc` shows `<none>`. What is the problem?',
      choices: [
        'CoreDNS is returning a cached ClusterIP from a previously deleted version of the Service that no longer routes correctly',
        'kube-proxy has failed and is not programming the iptables or IPVS rules needed to route ClusterIP traffic to backends',
        'The Service port number does not match the container port, so kube-proxy drops the packets at the forwarding stage',
        'The Service exists and has a ClusterIP, but no Running pods match its selector — so the Endpoints list is empty and traffic has nowhere to go',
      ],
      correctIndex: 3,
      explanation:
        'DNS resolution and endpoint routing are separate concerns. DNS maps a Service name to its ClusterIP — this works as long as the Service exists. ' +
        'But having a ClusterIP does not mean traffic will succeed. kube-proxy routes ClusterIP traffic to the pods listed in the Endpoints object. ' +
        'If endpoints are empty (no matching Running pods), traffic reaches the ClusterIP but has no backend to forward to, resulting in timeouts. ' +
        'The fix: check `kubectl get pods -l <selector>` to see if matching pods exist and are Running. Common causes: selector typo, pods in CrashLoopBackOff, or no pods deployed yet.',
    },
    {
      question:
        'A pod in namespace "orders" runs `curl redis`. The request fails. The same pod runs `curl redis.cache.svc.cluster.local` and it succeeds. What is the most likely cause?',
      choices: [
        'CoreDNS is caching a stale record for "redis" and needs to be restarted to pick up the correct IP',
        'The Redis Service is in the "cache" namespace, not "orders" — the short name `redis` only resolves within the pod\'s own namespace',
        'CoreDNS is partially down and can only resolve FQDNs, not short names that rely on search domain expansion',
        'The Redis Service is using a non-standard port, and the short name `redis` defaults to port 80 while the FQDN uses the correct port',
      ],
      correctIndex: 1,
      explanation:
        'When a pod uses a bare service name like "redis", the DNS resolver appends the search domains from /etc/resolv.conf. ' +
        'For a pod in the "orders" namespace, the first search domain is orders.svc.cluster.local, so "redis" resolves to redis.orders.svc.cluster.local — ' +
        'which does not exist because the Redis Service is in the "cache" namespace. The FQDN redis.cache.svc.cluster.local works because it bypasses search domain expansion entirely. ' +
        'The fix is to use the cross-namespace short form: `curl redis.cache`. This is one of the most common DNS debugging scenarios in Kubernetes — ' +
        'services in different namespaces require at least `<service>.<namespace>` to resolve correctly.',
    },
  ],
};
