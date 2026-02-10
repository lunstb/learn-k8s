import type { CurriculumSection, Lesson } from './types';
import { lesson1 } from './lesson1';
import { lesson2 } from './lesson2';
import { lesson3 } from './lesson3';
import { lesson4 } from './lesson4';
import { lesson5 } from './lesson5';
import { lesson6 } from './lesson6';
import { lesson7 } from './lesson7';
import { lesson8 } from './lesson8';
import { lesson9 } from './lesson9';
import { lesson10 } from './lesson10';
import { lesson11 } from './lesson11';
import { lesson12 } from './lesson12';
import { lesson13 } from './lesson13';
import { lesson14 } from './lesson14';
import { lesson15 } from './lesson15';
import { lesson16 } from './lesson16';
import { lesson17 } from './lesson17';
import { lesson18 } from './lesson18';
import { lesson19 } from './lesson19';
import { lesson20 } from './lesson20';
import { lesson21 } from './lesson21';
import { lesson22 } from './lesson22';
import { lesson23 } from './lesson23';

export const curriculum: CurriculumSection[] = [
  {
    id: 'fundamentals',
    title: 'Fundamentals',
    description: 'Core Kubernetes concepts: pods, deployments, services, and the control loop.',
    lessons: [lesson1, lesson2, lesson3, lesson4, lesson5, lesson6, lesson7, lesson8],
  },
  {
    id: 'workload-config',
    title: 'Workload Configuration',
    description: 'Namespaces, configuration, secrets, and resource management.',
    lessons: [lesson9, lesson10, lesson11, lesson12, lesson13],
  },
  {
    id: 'networking',
    title: 'Networking & Routing',
    description: 'Ingress routing and network policies.',
    lessons: [lesson14, lesson15],
  },
  {
    id: 'workload-types',
    title: 'Workload Types',
    description: 'StatefulSets, DaemonSets, Jobs, and CronJobs.',
    lessons: [lesson16, lesson17, lesson18],
  },
  {
    id: 'operations',
    title: 'Operations & Scaling',
    description: 'Helm, autoscaling, and access control.',
    lessons: [lesson19, lesson20, lesson21, lesson22],
  },
  {
    id: 'advanced',
    title: 'Advanced Troubleshooting',
    description: 'Multi-service architecture and advanced debugging.',
    lessons: [lesson23],
  },
];

export const allLessons: Lesson[] = curriculum.flatMap((s) => s.lessons);
