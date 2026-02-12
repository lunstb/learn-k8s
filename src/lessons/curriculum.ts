import type { CurriculumSection, Lesson } from './types';
import { lessonWhyK8s } from './lesson-why-k8s';
import { lessonPods } from './lesson-pods';
import { lessonReplicaSets } from './lesson-replicasets';
import { lessonDeployments } from './lesson-deployments';
import { lessonServices } from './lesson-services';
import { lessonScheduling } from './lesson-scheduling';
import { lessonDebugging } from './lesson-debugging';
import { lessonCapstoneTroubleshooting } from './lesson-capstone-troubleshooting';
import { lessonNamespaces } from './lesson-namespaces';
import { lessonConfigMaps } from './lesson-configmaps';
import { lessonSecrets } from './lesson-secrets';
import { lessonResourceLimits } from './lesson-resource-limits';
import { lessonProbes } from './lesson-probes';
import { lessonLabelsAnnotations } from './lesson-labels-annotations';
import { lessonInitContainers } from './lesson-init-containers';
import { lessonIngress } from './lesson-ingress';
import { lessonNetworkPolicies } from './lesson-network-policies';
import { lessonDNS } from './lesson-dns';
import { lessonStatefulSets } from './lesson-statefulsets';
import { lessonDaemonSets } from './lesson-daemonsets';
import { lessonJobs } from './lesson-jobs';
import { lessonStorage } from './lesson-storage';
import { lessonHelm } from './lesson-helm';
import { lessonHPA } from './lesson-hpa';
import { lessonClusterAutoscaling } from './lesson-cluster-autoscaling';
import { lessonRBAC } from './lesson-rbac';
import { lessonTaintsTolerations } from './lesson-taints-tolerations';
import { lessonPDB } from './lesson-pdb';
import { lessonStartupShutdown } from './lesson-startup-shutdown';
import { lessonArchitecture } from './lesson-architecture';
import { lessonCRDsOperators } from './lesson-crds-operators';
import { lessonCapstoneMultiservice } from './lesson-capstone-multiservice';
import { lessonRomeNetworking } from './lesson-rome-networking';
import { lessonRomeWorkloads } from './lesson-rome-workloads';
import { lessonRomeSecurity } from './lesson-rome-security';
import { lessonRomeIaC } from './lesson-rome-iac';

export const curriculum: CurriculumSection[] = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    description: 'Start here. By the end of this section you can deploy an app, expose it as a Service, debug failures, and understand the reconciliation loop that drives Kubernetes.',
    lessons: [lessonWhyK8s, lessonPods, lessonReplicaSets, lessonDeployments, lessonServices, lessonScheduling, lessonDebugging, lessonCapstoneTroubleshooting],
  },
  {
    id: 'workload-config',
    title: 'Workload Configuration',
    description: 'Now that you can deploy, expose, and debug applications, it\'s time to configure them properly — labels, namespaces, environment variables, secrets, resource constraints, and health checks.',
    lessons: [lessonLabelsAnnotations, lessonNamespaces, lessonConfigMaps, lessonSecrets, lessonResourceLimits, lessonProbes, lessonInitContainers],
  },
  {
    id: 'networking',
    title: 'Networking & Discovery',
    description: 'With your workloads configured, learn how traffic reaches them from outside the cluster and how pods discover and talk to each other through Ingress, network policies, and DNS.',
    lessons: [lessonIngress, lessonNetworkPolicies, lessonDNS],
  },
  {
    id: 'workload-types',
    title: 'Workload Types',
    description: 'Not every workload is a stateless web server. Learn the specialized controllers for databases, node-level agents, batch jobs, and persistent storage.',
    lessons: [lessonStatefulSets, lessonDaemonSets, lessonJobs, lessonStorage],
  },
  {
    id: 'operations',
    title: 'Operations & Scaling',
    description: 'Now that you know what to run, learn how to run it in production — package management with Helm, autoscaling, access control, disruption budgets, and graceful startup/shutdown.',
    lessons: [lessonHelm, lessonHPA, lessonClusterAutoscaling, lessonRBAC, lessonTaintsTolerations, lessonPDB, lessonStartupShutdown],
  },
  {
    id: 'architecture',
    title: 'Architecture & Concepts',
    description: 'Go deeper into how Kubernetes itself works — the control plane, etcd, and how to extend the platform with Custom Resource Definitions and operators.',
    lessons: [lessonArchitecture, lessonCRDsOperators],
  },
  {
    id: 'advanced',
    title: 'Advanced Troubleshooting',
    description: 'Put it all together. Debug a broken multi-service application using everything you have learned across the entire curriculum.',
    lessons: [lessonCapstoneMultiservice],
  },
  {
    id: 'rome-ai',
    title: 'Your Deployment: Rome AI',
    description: 'See how every simulator concept maps to your real production EKS infrastructure — from traffic routing and workload architecture to security, observability, and Infrastructure as Code.',
    lessons: [lessonRomeNetworking, lessonRomeWorkloads, lessonRomeSecurity, lessonRomeIaC],
  },
];

export const allLessons: Lesson[] = curriculum.flatMap((s) => s.lessons);

// Map from internal lesson.id → display number (1-indexed position in curriculum)
export const lessonDisplayNumber: Record<number, number> = {};
allLessons.forEach((lesson, i) => {
  lessonDisplayNumber[lesson.id] = i + 1;
});
