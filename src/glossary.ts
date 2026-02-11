export const glossary: Record<string, string> = {
  // Core
  'Pod': 'The smallest deployable unit in Kubernetes — one or more containers that share networking and storage, scheduled together on a single Node.',
  'Container': 'A lightweight, isolated process running from a container image. Pods run one or more containers.',
  'Node': 'A worker machine (physical or virtual) that runs Pods. Each Node runs a kubelet and container runtime.',
  'Namespace': 'A virtual partition within a cluster that isolates resources and names. Useful for organizing teams or environments.',
  'Label': 'A key-value pair attached to objects like Pods. Used by selectors to group and target resources.',
  'Selector': 'A query that matches objects by their labels. Used by Services, Deployments, and other controllers to find their targets.',
  'Annotation': 'Arbitrary key-value metadata on an object. Unlike labels, annotations are not used for selection — they store supplementary information.',

  // Workload Controllers
  'ReplicaSet': 'Ensures a specified number of identical Pod replicas are running at all times. Usually managed by a Deployment.',
  'Deployment': 'Manages ReplicaSets to provide declarative updates, rolling rollouts, and rollbacks for stateless applications.',
  'StatefulSet': 'Like a Deployment but for stateful apps — provides stable network identities, persistent storage, and ordered scaling.',
  'DaemonSet': 'Ensures exactly one Pod runs on every Node (or a subset). Common for log collectors, monitoring agents, and network plugins.',
  'Job': 'Creates one or more Pods that run to completion. Used for batch work like data processing or migrations.',
  'CronJob': 'Creates Jobs on a recurring schedule using cron syntax. Useful for periodic tasks like backups or report generation.',

  // Networking
  'Service': 'A stable network endpoint that routes traffic to a set of Pods matched by a selector. Provides load balancing and DNS discovery.',
  'ClusterIP': 'The default Service type — exposes the Service on an internal-only IP reachable within the cluster.',
  'NodePort': 'A Service type that opens a static port on every Node, forwarding external traffic to the Service.',
  'LoadBalancer': 'A Service type that provisions an external load balancer (cloud provider) to route traffic into the cluster.',
  'Ingress': 'An API object that manages external HTTP/HTTPS access to Services, providing routing rules, TLS termination, and virtual hosting.',
  'NetworkPolicy': 'Rules that control which Pods can communicate with each other and with external endpoints, acting as a Pod-level firewall.',
  'Endpoint': 'An object listing the IP addresses and ports of Pods backing a Service. Automatically managed by the Endpoints controller.',

  // Config
  'ConfigMap': 'Stores non-sensitive configuration data as key-value pairs. Pods consume ConfigMaps as environment variables or mounted files.',
  'Secret': 'Like a ConfigMap but for sensitive data (passwords, tokens, keys). Values are base64-encoded and can be encrypted at rest.',

  // Storage
  'PersistentVolume': 'A piece of cluster storage provisioned by an admin or dynamically. Exists independently of any Pod.',
  'PersistentVolumeClaim': 'A request for storage by a Pod. The cluster binds it to a matching PersistentVolume.',
  'StorageClass': 'Defines a class of storage (e.g., SSD vs HDD) and the provisioner used to create PersistentVolumes dynamically.',
  'Volume': 'A directory accessible to containers in a Pod. Volumes outlive individual containers but may not outlive the Pod itself.',

  // Scaling
  'HorizontalPodAutoscaler': 'Automatically scales the number of Pod replicas based on CPU utilization or custom metrics.',
  'Cluster Autoscaler': 'Automatically adjusts the number of Nodes in a cluster when Pods cannot be scheduled or Nodes are underutilized.',

  // RBAC
  'Role': 'Grants permissions (verbs on resources) within a single Namespace. Paired with a RoleBinding to assign to users or ServiceAccounts.',
  'ClusterRole': 'Like a Role but cluster-wide — can grant access to non-namespaced resources or be used across all Namespaces.',
  'RoleBinding': 'Binds a Role (or ClusterRole) to a user, group, or ServiceAccount within a specific Namespace.',
  'ServiceAccount': 'An identity for processes running inside Pods. Used to authenticate with the API server and control permissions via RBAC.',

  // System Components
  'kubelet': 'The agent on each Node that ensures containers described by PodSpecs are running and healthy.',
  'kube-proxy': 'A network component on each Node that maintains iptables/IPVS rules so Services can route traffic to Pods.',
  'etcd': 'A distributed key-value store that holds all cluster state and configuration. The single source of truth for Kubernetes.',
  'API Server': 'The front door to the cluster — all kubectl commands and internal components communicate through the Kubernetes API Server.',
  'Scheduler': 'Watches for newly created Pods with no Node assigned and selects the best Node for each one based on resource requirements and constraints.',
  'Controller Manager': 'Runs core control loops (Deployment controller, ReplicaSet controller, etc.) that reconcile desired state with actual state.',

  // Tools
  'kubectl': 'The command-line tool for interacting with a Kubernetes cluster. Sends requests to the API Server.',
  'Helm': 'A package manager for Kubernetes that bundles manifests into reusable, versioned Charts.',
  'Chart': 'A Helm package containing templated Kubernetes manifests, a values file, and metadata for deploying an application.',

  // Concepts
  'Control Loop': 'The core Kubernetes pattern: observe current state, compare to desired state, take action to reconcile differences. All controllers follow this loop.',
  'Rolling Update': 'A Deployment strategy that gradually replaces old Pods with new ones, ensuring zero-downtime upgrades.',
  'Liveness Probe': 'A periodic health check that restarts a container if it fails. Detects deadlocks and unrecoverable errors.',
  'Readiness Probe': 'A periodic check that removes a Pod from Service traffic if it fails. Ensures only ready Pods receive requests.',
  'Startup Probe': 'A probe that runs during container startup, suspending liveness and readiness probes until it passes. Prevents slow-starting apps from being killed prematurely.',
  'Resource Requests': 'The minimum CPU/memory a container needs. The Scheduler uses requests to decide which Node can fit the Pod.',
  'Resource Limits': 'The maximum CPU/memory a container may use. Exceeding memory limits causes an OOM kill; CPU is throttled.',

  // Scheduling
  'Taint': 'A property on a Node that repels Pods unless they have a matching toleration. Effects: NoSchedule, PreferNoSchedule, NoExecute.',
  'Toleration': 'A Pod property that allows it to be scheduled on a Node with a matching taint. Tolerations are permissive, not prescriptive.',
  'Topology Spread Constraint': 'A scheduling rule that distributes Pods evenly across failure domains (zones, nodes) to improve availability.',

  // Reliability
  'PodDisruptionBudget': 'Limits how many Pods from a set can be voluntarily disrupted at once. Protects availability during drains, upgrades, and autoscaler consolidation.',
  'Graceful Shutdown': 'The sequence when a Pod terminates: endpoints removed, preStop hook, SIGTERM, grace period, SIGKILL. Allows in-flight requests to complete.',

  // Containers
  'Init Container': 'A container that runs to completion before the main containers start. Used for dependency checks, migrations, and configuration setup.',

  // Extensibility
  'CRD': 'Custom Resource Definition — extends the Kubernetes API with new resource types. CRDs are just data; an operator (controller) adds behavior.',
  'Operator': 'A CRD paired with a custom controller that encodes operational knowledge (install, upgrade, backup, failover) into software following the Kubernetes reconciliation model.',

  // DNS
  'CoreDNS': 'The cluster DNS server that provides service discovery. Every Service gets a DNS record: <svc>.<ns>.svc.cluster.local.',
};
