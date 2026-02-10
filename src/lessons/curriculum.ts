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
import { lessonIngress } from './lesson-ingress';
import { lessonNetworkPolicies } from './lesson-network-policies';
import { lessonStatefulSets } from './lesson-statefulsets';
import { lessonDaemonSets } from './lesson-daemonsets';
import { lessonJobs } from './lesson-jobs';
import { lessonStorage } from './lesson-storage';
import { lessonHelm } from './lesson-helm';
import { lessonHPA } from './lesson-hpa';
import { lessonClusterAutoscaling } from './lesson-cluster-autoscaling';
import { lessonRBAC } from './lesson-rbac';
import { lessonCapstoneMultiservice } from './lesson-capstone-multiservice';

export const curriculum: CurriculumSection[] = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    description: 'Core Kubernetes concepts: pods, deployments, services, and the control loop.',
    lessons: [lessonWhyK8s, lessonPods, lessonReplicaSets, lessonDeployments, lessonServices, lessonScheduling, lessonDebugging, lessonCapstoneTroubleshooting],
  },
  {
    id: 'workload-config',
    title: 'Workload Configuration',
    description: 'Namespaces, configuration, secrets, and resource management.',
    lessons: [lessonNamespaces, lessonConfigMaps, lessonSecrets, lessonResourceLimits, lessonProbes],
  },
  {
    id: 'networking',
    title: 'Networking & Routing',
    description: 'Ingress routing and network policies.',
    lessons: [lessonIngress, lessonNetworkPolicies],
  },
  {
    id: 'workload-types',
    title: 'Workload Types',
    description: 'StatefulSets, DaemonSets, Jobs, CronJobs, and persistent storage.',
    lessons: [lessonStatefulSets, lessonDaemonSets, lessonJobs, lessonStorage],
  },
  {
    id: 'operations',
    title: 'Operations & Scaling',
    description: 'Helm, autoscaling, and access control.',
    lessons: [lessonHelm, lessonHPA, lessonClusterAutoscaling, lessonRBAC],
  },
  {
    id: 'advanced',
    title: 'Advanced Troubleshooting',
    description: 'Multi-service architecture and advanced debugging.',
    lessons: [lessonCapstoneMultiservice],
  },
];

export const allLessons: Lesson[] = curriculum.flatMap((s) => s.lessons);

// Map from internal lesson.id → display number (1-indexed position in curriculum)
export const lessonDisplayNumber: Record<number, number> = {};
allLessons.forEach((lesson, i) => {
  lessonDisplayNumber[lesson.id] = i + 1;
});
