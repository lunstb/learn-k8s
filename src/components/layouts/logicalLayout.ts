import type { Node, Edge } from '@xyflow/react';
import type { ClusterState } from '../../simulation/types';
import { labelsMatch } from '../../simulation/utils';

export function computeLogicalLayout(
  cluster: ClusterState,
  selectedUid: string | null,
  showNetworkOverlay: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const deployments = cluster.deployments.filter((d) => !d.metadata.deletionTimestamp);
  const replicaSets = cluster.replicaSets.filter((rs) => !rs.metadata.deletionTimestamp);
  const pods = cluster.pods.filter((p) => !p.metadata.deletionTimestamp);
  const simNodes = cluster.nodes;
  const services = cluster.services;
  const ingresses = cluster.ingresses;
  const statefulSets = cluster.statefulSets.filter((s) => !s.metadata.deletionTimestamp);
  const daemonSets = cluster.daemonSets.filter((d) => !d.metadata.deletionTimestamp);
  const jobs = cluster.jobs.filter((j) => !j.metadata.deletionTimestamp);
  const cronJobs = cluster.cronJobs;
  const hpas = cluster.hpas;

  const hasNodes = simNodes.length > 0;
  const hasServices = services.length > 0;
  const hasIngresses = ingresses.length > 0;

  // Layout constants
  const INGRESS_Y = 30;
  const SERVICE_Y = hasIngresses ? 180 : 30;
  const DEP_Y = (hasServices || hasIngresses) ? SERVICE_Y + 150 : 30;
  const RS_Y = DEP_Y + 150;
  const POD_Y = RS_Y + 170;
  const NODE_Y = POD_Y + 170;
  const DEP_SPACING = 400;
  const RS_SPACING = 280;
  const POD_SPACING = 150;

  const networkDim = showNetworkOverlay ? 0.15 : 1;
  const networkHighlight = showNetworkOverlay;

  let depX = 0;

  // --- Ingresses (top row) ---
  if (hasIngresses) {
    for (let idx = 0; idx < ingresses.length; idx++) {
      const ing = ingresses[idx];
      const ingNodeId = `ing-${ing.metadata.uid}`;
      nodes.push({
        id: ingNodeId,
        type: 'ingress',
        position: { x: idx * 250, y: INGRESS_Y },
        data: {
          label: ing.metadata.name,
          rulesCount: ing.spec.rules.length,
          hosts: ing.spec.rules.map((r) => r.host).join(', '),
          selected: selectedUid === ing.metadata.uid,
          kind: 'Ingress',
          uid: ing.metadata.uid,
        },
        draggable: false,
      });

      // Edges from ingress to target services
      for (const rule of ing.spec.rules) {
        const targetSvc = services.find((s) => s.metadata.name === rule.serviceName);
        if (targetSvc) {
          const svcNodeId = `svc-${targetSvc.metadata.uid}`;
          edges.push({
            id: `edge-${ingNodeId}-${svcNodeId}`,
            source: ingNodeId,
            target: svcNodeId,
            type: 'smoothstep',
            style: {
              stroke: '#d946ef',
              strokeWidth: networkHighlight ? 2.5 : 1.5,
              opacity: networkHighlight ? 1 : undefined,
            },
            animated: networkHighlight,
          });
        }
      }
    }
  }

  // --- Services ---
  if (hasServices) {
    for (let svcIdx = 0; svcIdx < services.length; svcIdx++) {
      const svc = services[svcIdx];
      const svcNodeId = `svc-${svc.metadata.uid}`;
      nodes.push({
        id: svcNodeId,
        type: 'service',
        position: { x: svcIdx * 250, y: SERVICE_Y },
        data: {
          label: svc.metadata.name,
          selector: Object.entries(svc.spec.selector).map(([k, v]) => `${k}=${v}`).join(','),
          port: svc.spec.port,
          endpointCount: svc.status.endpoints.length,
          endpoints: svc.status.endpoints,
          selected: selectedUid === svc.metadata.uid,
          kind: 'Service',
          uid: svc.metadata.uid,
        },
        draggable: false,
      });

      for (const pod of pods) {
        if (
          pod.status.phase === 'Running' &&
          labelsMatch(svc.spec.selector, pod.metadata.labels)
        ) {
          const podNodeId = `pod-${pod.metadata.uid}`;
          const isEndpoint = svc.status.endpoints.includes(pod.metadata.name);
          edges.push({
            id: `edge-${svcNodeId}-${podNodeId}`,
            source: svcNodeId,
            target: podNodeId,
            type: 'smoothstep',
            style: {
              stroke: isEndpoint ? '#06b6d4' : '#6b7280',
              strokeWidth: networkHighlight ? (isEndpoint ? 2.5 : 1) : 1.5,
              strokeDasharray: isEndpoint ? undefined : '5 5',
              opacity: networkHighlight ? 1 : undefined,
            },
            animated: networkHighlight && isEndpoint,
          });
        }
      }
    }
  }

  // --- Deployments → ReplicaSets → Pods ---
  for (const dep of deployments) {
    const depNodeId = `dep-${dep.metadata.uid}`;
    const ownedRS = replicaSets.filter((rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid);

    let totalPods = 0;
    for (const rs of ownedRS) {
      const rsPods = pods.filter((p) => p.metadata.ownerReference?.uid === rs.metadata.uid);
      totalPods += Math.max(rsPods.length, 1);
    }

    const totalWidth = Math.max(totalPods * POD_SPACING, ownedRS.length * RS_SPACING, 200);
    const depCenterX = depX + totalWidth / 2;

    const allDepPods = pods.filter((p) =>
      ownedRS.some((rs) => rs.metadata.uid === p.metadata.ownerReference?.uid)
    );
    const isConverged =
      allDepPods.length === dep.spec.replicas &&
      allDepPods.every((p) => p.status.phase === 'Running');

    nodes.push({
      id: depNodeId,
      type: 'deployment',
      position: { x: depCenterX - 90, y: DEP_Y },
      data: {
        label: dep.metadata.name,
        replicas: dep.spec.replicas,
        readyReplicas: dep.status.readyReplicas,
        image: dep.spec.template.spec.image,
        isConverged,
        selected: selectedUid === dep.metadata.uid,
        kind: 'Deployment',
        uid: dep.metadata.uid,
      },
      draggable: false,
    });

    let rsX = depX;
    for (const rs of ownedRS) {
      const rsNodeId = `rs-${rs.metadata.uid}`;
      const rsPods = pods.filter((p) => p.metadata.ownerReference?.uid === rs.metadata.uid);
      const rsWidth = Math.max(rsPods.length * POD_SPACING, POD_SPACING);
      const rsCenterX = rsX + rsWidth / 2;
      const isOld = rs.spec.template.spec.image !== dep.spec.template.spec.image;

      nodes.push({
        id: rsNodeId,
        type: 'replicaset',
        position: { x: rsCenterX - 80, y: RS_Y },
        data: {
          label: rs.metadata.name,
          desiredReplicas: rs.spec.replicas,
          currentReplicas: rsPods.length,
          image: rs.spec.template.spec.image,
          isConverged: rsPods.length === rs.spec.replicas,
          isOld,
          selected: selectedUid === rs.metadata.uid,
          kind: 'ReplicaSet',
          uid: rs.metadata.uid,
        },
        draggable: false,
      });

      edges.push({
        id: `edge-${depNodeId}-${rsNodeId}`,
        source: depNodeId,
        target: rsNodeId,
        type: 'smoothstep',
        style: {
          stroke: isOld ? '#6b7280' : '#3b82f6',
          strokeWidth: 2,
          opacity: showNetworkOverlay ? networkDim : undefined,
        },
        animated: !isOld && rsPods.length !== rs.spec.replicas,
      });

      const podStartX = rsCenterX - ((rsPods.length - 1) * POD_SPACING) / 2;
      for (let podIdx = 0; podIdx < rsPods.length; podIdx++) {
        const pod = rsPods[podIdx];
        const podNodeId = `pod-${pod.metadata.uid}`;
        nodes.push({
          id: podNodeId,
          type: 'pod',
          position: { x: podStartX + podIdx * POD_SPACING - 55, y: POD_Y },
          data: {
            label: pod.metadata.name,
            status: pod.status.phase,
            image: pod.spec.image,
            isNew: Date.now() - pod.metadata.creationTimestamp < 2000,
            reason: pod.status.reason,
            restartCount: pod.status.restartCount,
            selected: selectedUid === pod.metadata.uid,
            kind: 'Pod',
            uid: pod.metadata.uid,
          },
          draggable: false,
        });

        edges.push({
          id: `edge-${rsNodeId}-${podNodeId}`,
          source: rsNodeId,
          target: podNodeId,
          type: 'smoothstep',
          style: {
            stroke: '#64748b',
            strokeWidth: 1.5,
            opacity: showNetworkOverlay ? networkDim : undefined,
          },
        });
      }

      rsX += rsWidth + 40;
    }

    depX += totalWidth + DEP_SPACING / 2;
  }

  // --- StatefulSets (alongside deployments) ---
  for (const sts of statefulSets) {
    const stsNodeId = `sts-${sts.metadata.uid}`;
    const stsPods = pods.filter((p) => p.metadata.ownerReference?.uid === sts.metadata.uid);
    const stsWidth = Math.max(stsPods.length * POD_SPACING, POD_SPACING);
    const stsCenterX = depX + stsWidth / 2;

    nodes.push({
      id: stsNodeId,
      type: 'statefulset',
      position: { x: stsCenterX - 90, y: DEP_Y },
      data: {
        label: sts.metadata.name,
        replicas: sts.spec.replicas,
        readyReplicas: sts.status.readyReplicas,
        image: sts.spec.template.spec.image,
        selected: selectedUid === sts.metadata.uid,
        kind: 'StatefulSet',
        uid: sts.metadata.uid,
      },
      draggable: false,
    });

    const podStartX = stsCenterX - ((stsPods.length - 1) * POD_SPACING) / 2;
    for (let i = 0; i < stsPods.length; i++) {
      const pod = stsPods[i];
      const podNodeId = `pod-${pod.metadata.uid}`;
      nodes.push({
        id: podNodeId,
        type: 'pod',
        position: { x: podStartX + i * POD_SPACING - 55, y: POD_Y },
        data: {
          label: pod.metadata.name,
          status: pod.status.phase,
          image: pod.spec.image,
          isNew: Date.now() - pod.metadata.creationTimestamp < 2000,
          reason: pod.status.reason,
          restartCount: pod.status.restartCount,
          selected: selectedUid === pod.metadata.uid,
          kind: 'Pod',
          uid: pod.metadata.uid,
        },
        draggable: false,
      });
      edges.push({
        id: `edge-${stsNodeId}-${podNodeId}`,
        source: stsNodeId,
        target: podNodeId,
        type: 'smoothstep',
        style: {
          stroke: '#10b981',
          strokeWidth: 1.5,
          opacity: showNetworkOverlay ? networkDim : undefined,
        },
      });
    }
    depX += stsWidth + 200;
  }

  // --- DaemonSets ---
  for (const ds of daemonSets) {
    const dsNodeId = `ds-${ds.metadata.uid}`;
    const dsPods = pods.filter((p) => p.metadata.ownerReference?.uid === ds.metadata.uid);
    const dsWidth = Math.max(dsPods.length * POD_SPACING, POD_SPACING);
    const dsCenterX = depX + dsWidth / 2;

    nodes.push({
      id: dsNodeId,
      type: 'daemonset',
      position: { x: dsCenterX - 90, y: DEP_Y },
      data: {
        label: ds.metadata.name,
        desired: ds.status.desiredNumberScheduled,
        ready: ds.status.numberReady,
        image: ds.spec.template.spec.image,
        selected: selectedUid === ds.metadata.uid,
        kind: 'DaemonSet',
        uid: ds.metadata.uid,
      },
      draggable: false,
    });

    const podStartX = dsCenterX - ((dsPods.length - 1) * POD_SPACING) / 2;
    for (let i = 0; i < dsPods.length; i++) {
      const pod = dsPods[i];
      const podNodeId = `pod-${pod.metadata.uid}`;
      nodes.push({
        id: podNodeId,
        type: 'pod',
        position: { x: podStartX + i * POD_SPACING - 55, y: POD_Y },
        data: {
          label: pod.metadata.name,
          status: pod.status.phase,
          image: pod.spec.image,
          isNew: Date.now() - pod.metadata.creationTimestamp < 2000,
          reason: pod.status.reason,
          restartCount: pod.status.restartCount,
          selected: selectedUid === pod.metadata.uid,
          kind: 'Pod',
          uid: pod.metadata.uid,
        },
        draggable: false,
      });
      edges.push({
        id: `edge-${dsNodeId}-${podNodeId}`,
        source: dsNodeId,
        target: podNodeId,
        type: 'smoothstep',
        style: {
          stroke: '#f59e0b',
          strokeWidth: 1.5,
          opacity: showNetworkOverlay ? networkDim : undefined,
        },
      });
    }
    depX += dsWidth + 200;
  }

  // --- Jobs ---
  for (const job of jobs) {
    const jobNodeId = `job-${job.metadata.uid}`;
    const jobPods = pods.filter((p) => p.metadata.ownerReference?.uid === job.metadata.uid);
    const jobWidth = Math.max(jobPods.length * POD_SPACING, POD_SPACING);
    const jobCenterX = depX + jobWidth / 2;

    const isDone = job.status.succeeded >= job.spec.completions;
    nodes.push({
      id: jobNodeId,
      type: 'job',
      position: { x: jobCenterX - 90, y: DEP_Y },
      data: {
        label: job.metadata.name,
        succeeded: job.status.succeeded,
        completions: job.spec.completions,
        status: isDone ? 'Complete' : job.status.active > 0 ? 'Running' : 'Pending',
        selected: selectedUid === job.metadata.uid,
        kind: 'Job',
        uid: job.metadata.uid,
      },
      draggable: false,
    });

    const podStartX = jobCenterX - ((jobPods.length - 1) * POD_SPACING) / 2;
    for (let i = 0; i < jobPods.length; i++) {
      const pod = jobPods[i];
      const podNodeId = `pod-${pod.metadata.uid}`;
      nodes.push({
        id: podNodeId,
        type: 'pod',
        position: { x: podStartX + i * POD_SPACING - 55, y: POD_Y },
        data: {
          label: pod.metadata.name,
          status: pod.status.phase,
          image: pod.spec.image,
          isNew: Date.now() - pod.metadata.creationTimestamp < 2000,
          reason: pod.status.reason,
          restartCount: pod.status.restartCount,
          selected: selectedUid === pod.metadata.uid,
          kind: 'Pod',
          uid: pod.metadata.uid,
        },
        draggable: false,
      });
      edges.push({
        id: `edge-${jobNodeId}-${podNodeId}`,
        source: jobNodeId,
        target: podNodeId,
        type: 'smoothstep',
        style: {
          stroke: '#8b5cf6',
          strokeWidth: 1.5,
          opacity: showNetworkOverlay ? networkDim : undefined,
        },
      });
    }
    depX += jobWidth + 200;
  }

  // --- CronJobs (row above jobs) ---
  for (const cj of cronJobs) {
    const cjNodeId = `cj-${cj.metadata.uid}`;
    nodes.push({
      id: cjNodeId,
      type: 'cronjob',
      position: { x: depX, y: DEP_Y - 130 },
      data: {
        label: cj.metadata.name,
        schedule: cj.spec.schedule,
        activeJobs: cj.status.active,
        selected: selectedUid === cj.metadata.uid,
        kind: 'CronJob',
        uid: cj.metadata.uid,
      },
      draggable: false,
    });

    // Edges from CronJob to owned Jobs
    for (const job of jobs) {
      if (job.metadata.ownerReference?.uid === cj.metadata.uid) {
        const jobNodeId = `job-${job.metadata.uid}`;
        edges.push({
          id: `edge-${cjNodeId}-${jobNodeId}`,
          source: cjNodeId,
          target: jobNodeId,
          type: 'smoothstep',
          style: {
            stroke: '#a855f7',
            strokeWidth: 1.5,
            opacity: showNetworkOverlay ? networkDim : undefined,
          },
        });
      }
    }
    depX += 200;
  }

  // --- HPAs ---
  for (const hpa of hpas) {
    const hpaNodeId = `hpa-${hpa.metadata.uid}`;
    const targetDep = deployments.find((d) => d.metadata.name === hpa.spec.scaleTargetRef.name);

    nodes.push({
      id: hpaNodeId,
      type: 'hpa',
      position: { x: depX, y: DEP_Y },
      data: {
        label: hpa.metadata.name,
        target: hpa.spec.scaleTargetRef.name,
        minReplicas: hpa.spec.minReplicas,
        maxReplicas: hpa.spec.maxReplicas,
        cpuPercent: hpa.status.currentCPUUtilizationPercentage ?? null,
        selected: selectedUid === hpa.metadata.uid,
        kind: 'HorizontalPodAutoscaler',
        uid: hpa.metadata.uid,
      },
      draggable: false,
    });

    if (targetDep) {
      edges.push({
        id: `edge-${hpaNodeId}-dep-${targetDep.metadata.uid}`,
        source: hpaNodeId,
        target: `dep-${targetDep.metadata.uid}`,
        type: 'smoothstep',
        style: {
          stroke: '#06b6d4',
          strokeWidth: 1.5,
          strokeDasharray: '5 5',
          opacity: showNetworkOverlay ? networkDim : undefined,
        },
      });
    }
    depX += 200;
  }

  // Standalone ReplicaSets
  const standaloneRS = replicaSets.filter((rs) => !rs.metadata.ownerReference);
  for (const rs of standaloneRS) {
    const rsNodeId = `rs-${rs.metadata.uid}`;
    const rsPods = pods.filter((p) => p.metadata.ownerReference?.uid === rs.metadata.uid);
    const rsWidth = Math.max(rsPods.length * POD_SPACING, POD_SPACING);
    const rsCenterX = depX + rsWidth / 2;

    nodes.push({
      id: rsNodeId,
      type: 'replicaset',
      position: { x: rsCenterX - 80, y: RS_Y - 130 },
      data: {
        label: rs.metadata.name,
        desiredReplicas: rs.spec.replicas,
        currentReplicas: rsPods.length,
        image: rs.spec.template.spec.image,
        isConverged: rsPods.length === rs.spec.replicas,
        isOld: false,
        selected: selectedUid === rs.metadata.uid,
        kind: 'ReplicaSet',
        uid: rs.metadata.uid,
      },
      draggable: false,
    });

    const podStartX = rsCenterX - ((rsPods.length - 1) * POD_SPACING) / 2;
    for (let podIdx = 0; podIdx < rsPods.length; podIdx++) {
      const pod = rsPods[podIdx];
      const podNodeId = `pod-${pod.metadata.uid}`;
      nodes.push({
        id: podNodeId,
        type: 'pod',
        position: { x: podStartX + podIdx * POD_SPACING - 55, y: RS_Y + 20 + 150 },
        data: {
          label: pod.metadata.name,
          status: pod.status.phase,
          image: pod.spec.image,
          isNew: Date.now() - pod.metadata.creationTimestamp < 2000,
          reason: pod.status.reason,
          restartCount: pod.status.restartCount,
          selected: selectedUid === pod.metadata.uid,
          kind: 'Pod',
          uid: pod.metadata.uid,
        },
        draggable: false,
      });
      edges.push({
        id: `edge-${rsNodeId}-${podNodeId}`,
        source: rsNodeId,
        target: podNodeId,
        type: 'smoothstep',
        style: {
          stroke: '#64748b',
          strokeWidth: 1.5,
          opacity: showNetworkOverlay ? networkDim : undefined,
        },
      });
    }
    depX += rsWidth + 100;
  }

  // Standalone Pods
  const ownedPodUids = new Set<string>();
  for (const p of pods) {
    if (p.metadata.ownerReference) ownedPodUids.add(p.metadata.uid);
  }
  const standalonePods = pods.filter((p) => !p.metadata.ownerReference);
  for (let podIdx = 0; podIdx < standalonePods.length; podIdx++) {
    const pod = standalonePods[podIdx];
    const podNodeId = `pod-${pod.metadata.uid}`;
    nodes.push({
      id: podNodeId,
      type: 'pod',
      position: { x: depX + podIdx * POD_SPACING, y: RS_Y },
      data: {
        label: pod.metadata.name,
        status: pod.status.phase,
        image: pod.spec.image,
        isNew: Date.now() - pod.metadata.creationTimestamp < 2000,
        reason: pod.status.reason,
        restartCount: pod.status.restartCount,
        selected: selectedUid === pod.metadata.uid,
        kind: 'Pod',
        uid: pod.metadata.uid,
      },
      draggable: false,
    });
  }

  // --- Nodes (bottom row) ---
  if (hasNodes) {
    const nodeSpacing = 200;
    const totalNodeWidth = simNodes.length * nodeSpacing;
    const nodeStartX = Math.max(0, (depX - totalNodeWidth) / 2);

    for (let nIdx = 0; nIdx < simNodes.length; nIdx++) {
      const node = simNodes[nIdx];
      const nodeId = `node-${node.metadata.uid}`;
      nodes.push({
        id: nodeId,
        type: 'infranode',
        position: { x: nodeStartX + nIdx * nodeSpacing, y: NODE_Y },
        data: {
          label: node.metadata.name,
          capacity: node.spec.capacity.pods,
          allocated: node.status.allocatedPods,
          isReady: node.status.conditions[0].status === 'True',
          selected: selectedUid === node.metadata.uid,
          kind: 'Node',
          uid: node.metadata.uid,
        },
        draggable: false,
      });

      for (const pod of pods) {
        if (pod.spec.nodeName === node.metadata.name) {
          const podNodeId = `pod-${pod.metadata.uid}`;
          edges.push({
            id: `edge-${podNodeId}-${nodeId}`,
            source: podNodeId,
            target: nodeId,
            type: 'smoothstep',
            style: {
              stroke: node.status.conditions[0].status === 'True' ? '#334155' : '#ef4444',
              strokeWidth: 1,
              strokeDasharray: '3 3',
              opacity: showNetworkOverlay ? networkDim : undefined,
            },
          });
        }
      }
    }
  }

  return { nodes, edges };
}
