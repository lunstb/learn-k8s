import type { Node, Edge } from '@xyflow/react';
import type { ClusterState } from '../../simulation/types';
import { labelsMatch } from '../../simulation/utils';

const POD_MINI_WIDTH = 110;
const POD_MINI_HEIGHT = 44;
const POD_GRID_COLS = 3;
const POD_GAP = 8;
const NODE_HEADER = 52;
const NODE_PADDING = 12;
const NODE_GAP = 24;
const CLUSTER_PADDING = 32;

export function computeInfrastructureLayout(
  cluster: ClusterState,
  selectedUid: string | null,
  showNetworkOverlay: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const pods = cluster.pods.filter((p) => !p.metadata.deletionTimestamp);
  const simNodes = cluster.nodes;
  const services = cluster.services;
  const ingresses = cluster.ingresses;
  const deployments = cluster.deployments.filter((d) => !d.metadata.deletionTimestamp);
  const replicaSets = cluster.replicaSets.filter((rs) => !rs.metadata.deletionTimestamp);
  const statefulSets = cluster.statefulSets.filter((s) => !s.metadata.deletionTimestamp);
  const daemonSets = cluster.daemonSets.filter((d) => !d.metadata.deletionTimestamp);
  const jobs = cluster.jobs.filter((j) => !j.metadata.deletionTimestamp);
  const cronJobs = cluster.cronJobs;
  const hpas = cluster.hpas;

  const networkDim = showNetworkOverlay ? 0.15 : 1;

  // Group pods by node
  const podsByNode = new Map<string, typeof pods>();
  const unscheduledPods: typeof pods = [];
  for (const pod of pods) {
    if (pod.spec.nodeName) {
      const arr = podsByNode.get(pod.spec.nodeName) || [];
      arr.push(pod);
      podsByNode.set(pod.spec.nodeName, arr);
    } else {
      unscheduledPods.push(pod);
    }
  }

  // Calculate node group sizes
  const nodeGroups: Array<{
    node: typeof simNodes[0];
    nodePods: typeof pods;
    width: number;
    height: number;
  }> = [];

  for (const node of simNodes) {
    const nodePods = podsByNode.get(node.metadata.name) || [];
    const rows = Math.max(Math.ceil(nodePods.length / POD_GRID_COLS), 1);
    const cols = Math.min(nodePods.length, POD_GRID_COLS);
    const width = Math.max(cols * (POD_MINI_WIDTH + POD_GAP) + NODE_PADDING * 2 - POD_GAP, 200);
    const height = NODE_HEADER + rows * (POD_MINI_HEIGHT + POD_GAP) + NODE_PADDING * 2;
    nodeGroups.push({ node, nodePods, width, height });
  }

  // Calculate cluster boundary
  let clusterContentWidth = 0;
  let clusterContentHeight = 0;
  for (const ng of nodeGroups) {
    clusterContentWidth += ng.width + NODE_GAP;
    clusterContentHeight = Math.max(clusterContentHeight, ng.height);
  }
  if (unscheduledPods.length > 0) {
    const pendingRows = Math.ceil(unscheduledPods.length / POD_GRID_COLS);
    const pendingWidth = Math.min(unscheduledPods.length, POD_GRID_COLS) * (POD_MINI_WIDTH + POD_GAP) + NODE_PADDING * 2;
    clusterContentWidth += pendingWidth + NODE_GAP;
    clusterContentHeight = Math.max(clusterContentHeight, NODE_HEADER + pendingRows * (POD_MINI_HEIGHT + POD_GAP) + NODE_PADDING * 2);
  }
  clusterContentWidth = Math.max(clusterContentWidth - NODE_GAP, 300);
  const clusterWidth = clusterContentWidth + CLUSTER_PADDING * 2;
  const clusterHeight = clusterContentHeight + CLUSTER_PADDING * 2 + 30; // 30 for label

  // Workload controllers row above cluster
  let workloadX = 0;

  // Ingresses
  const hasIngresses = ingresses.length > 0;
  const INGRESS_Y = 30;
  const SERVICE_Y_BASE = hasIngresses ? 180 : 30;

  if (hasIngresses) {
    for (let idx = 0; idx < ingresses.length; idx++) {
      const ing = ingresses[idx];
      const ingNodeId = `ing-${ing.metadata.uid}`;
      nodes.push({
        id: ingNodeId,
        type: 'ingress',
        position: { x: idx * 200, y: INGRESS_Y },
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

      for (const rule of ing.spec.rules) {
        const targetSvc = services.find((s) => s.metadata.name === rule.serviceName);
        if (targetSvc) {
          edges.push({
            id: `edge-${ingNodeId}-svc-${targetSvc.metadata.uid}`,
            source: ingNodeId,
            target: `svc-${targetSvc.metadata.uid}`,
            type: 'smoothstep',
            style: { stroke: '#d946ef', strokeWidth: showNetworkOverlay ? 2.5 : 1.5 },
            animated: showNetworkOverlay,
          });
        }
      }
    }
  }

  // Services above cluster
  const SERVICE_Y = services.length > 0 ? SERVICE_Y_BASE : SERVICE_Y_BASE;
  for (let svcIdx = 0; svcIdx < services.length; svcIdx++) {
    const svc = services[svcIdx];
    const svcNodeId = `svc-${svc.metadata.uid}`;
    nodes.push({
      id: svcNodeId,
      type: 'service',
      position: { x: svcIdx * 220, y: SERVICE_Y },
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

    // Edges from service to endpoint pods (through node groups)
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
            strokeWidth: showNetworkOverlay ? (isEndpoint ? 2.5 : 1) : 1.5,
            strokeDasharray: isEndpoint ? undefined : '5 5',
          },
          animated: showNetworkOverlay && isEndpoint,
        });
      }
    }
  }

  // Workload controllers above cluster
  const hasServicesOrIngresses = services.length > 0 || hasIngresses;
  const CONTROLLER_Y = hasServicesOrIngresses ? SERVICE_Y + 150 : 30;
  const CLUSTER_Y = CONTROLLER_Y + 130;

  // Deployments
  for (const dep of deployments) {
    const depNodeId = `dep-${dep.metadata.uid}`;
    const ownedRS = replicaSets.filter((rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid);
    const allDepPods = pods.filter((p) =>
      ownedRS.some((rs) => rs.metadata.uid === p.metadata.ownerReference?.uid)
    );
    const isConverged =
      allDepPods.length === dep.spec.replicas &&
      allDepPods.every((p) => p.status.phase === 'Running');

    nodes.push({
      id: depNodeId,
      type: 'deployment',
      position: { x: workloadX, y: CONTROLLER_Y },
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

    // Edge from deployment to each of its pods (via RS)
    for (const pod of allDepPods) {
      edges.push({
        id: `edge-dep-${dep.metadata.uid}-pod-${pod.metadata.uid}`,
        source: depNodeId,
        target: `pod-${pod.metadata.uid}`,
        type: 'smoothstep',
        style: {
          stroke: '#3b82f6',
          strokeWidth: 1,
          strokeDasharray: '4 4',
          opacity: showNetworkOverlay ? networkDim : 0.5,
        },
      });
    }
    workloadX += 200;
  }

  // StatefulSets
  for (const sts of statefulSets) {
    const stsNodeId = `sts-${sts.metadata.uid}`;
    const stsPods = pods.filter((p) => p.metadata.ownerReference?.uid === sts.metadata.uid);

    nodes.push({
      id: stsNodeId,
      type: 'statefulset',
      position: { x: workloadX, y: CONTROLLER_Y },
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

    for (const pod of stsPods) {
      edges.push({
        id: `edge-sts-${sts.metadata.uid}-pod-${pod.metadata.uid}`,
        source: stsNodeId,
        target: `pod-${pod.metadata.uid}`,
        type: 'smoothstep',
        style: {
          stroke: '#10b981',
          strokeWidth: 1,
          strokeDasharray: '4 4',
          opacity: showNetworkOverlay ? networkDim : 0.5,
        },
      });
    }
    workloadX += 200;
  }

  // DaemonSets
  for (const ds of daemonSets) {
    const dsNodeId = `ds-${ds.metadata.uid}`;
    const dsPods = pods.filter((p) => p.metadata.ownerReference?.uid === ds.metadata.uid);

    nodes.push({
      id: dsNodeId,
      type: 'daemonset',
      position: { x: workloadX, y: CONTROLLER_Y },
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

    for (const pod of dsPods) {
      edges.push({
        id: `edge-ds-${ds.metadata.uid}-pod-${pod.metadata.uid}`,
        source: dsNodeId,
        target: `pod-${pod.metadata.uid}`,
        type: 'smoothstep',
        style: {
          stroke: '#f59e0b',
          strokeWidth: 1,
          strokeDasharray: '4 4',
          opacity: showNetworkOverlay ? networkDim : 0.5,
        },
      });
    }
    workloadX += 200;
  }

  // Jobs
  for (const job of jobs) {
    const jobNodeId = `job-${job.metadata.uid}`;
    const jobPods = pods.filter((p) => p.metadata.ownerReference?.uid === job.metadata.uid);
    const isDone = job.status.succeeded >= job.spec.completions;

    nodes.push({
      id: jobNodeId,
      type: 'job',
      position: { x: workloadX, y: CONTROLLER_Y },
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

    for (const pod of jobPods) {
      edges.push({
        id: `edge-job-${job.metadata.uid}-pod-${pod.metadata.uid}`,
        source: jobNodeId,
        target: `pod-${pod.metadata.uid}`,
        type: 'smoothstep',
        style: {
          stroke: '#8b5cf6',
          strokeWidth: 1,
          strokeDasharray: '4 4',
          opacity: showNetworkOverlay ? networkDim : 0.5,
        },
      });
    }
    workloadX += 200;
  }

  // CronJobs
  for (const cj of cronJobs) {
    const cjNodeId = `cj-${cj.metadata.uid}`;
    nodes.push({
      id: cjNodeId,
      type: 'cronjob',
      position: { x: workloadX, y: CONTROLLER_Y - 130 },
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

    for (const job of jobs) {
      if (job.metadata.ownerReference?.uid === cj.metadata.uid) {
        edges.push({
          id: `edge-${cjNodeId}-job-${job.metadata.uid}`,
          source: cjNodeId,
          target: `job-${job.metadata.uid}`,
          type: 'smoothstep',
          style: {
            stroke: '#a855f7',
            strokeWidth: 1.5,
            opacity: showNetworkOverlay ? networkDim : undefined,
          },
        });
      }
    }
    workloadX += 200;
  }

  // HPAs
  for (const hpa of hpas) {
    const hpaNodeId = `hpa-${hpa.metadata.uid}`;
    const targetDep = deployments.find((d) => d.metadata.name === hpa.spec.scaleTargetRef.name);

    nodes.push({
      id: hpaNodeId,
      type: 'hpa',
      position: { x: workloadX, y: CONTROLLER_Y },
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
    workloadX += 200;
  }

  // --- Cluster boundary group ---
  const clusterNodeId = 'cluster-boundary';
  nodes.push({
    id: clusterNodeId,
    type: 'cluster-group',
    position: { x: 0, y: CLUSTER_Y },
    data: { label: 'Cluster', width: clusterWidth, height: clusterHeight },
    draggable: false,
    selectable: false,
  });

  // --- Node groups inside cluster ---
  let nodeX = CLUSTER_PADDING;
  for (const ng of nodeGroups) {
    const nodeId = `node-${ng.node.metadata.uid}`;
    const isReady = ng.node.status.conditions[0].status === 'True';

    nodes.push({
      id: nodeId,
      type: 'node-group',
      position: { x: nodeX, y: CLUSTER_Y + CLUSTER_PADDING + 30 },
      data: {
        label: ng.node.metadata.name,
        isReady,
        allocated: ng.node.status.allocatedPods,
        capacity: ng.node.spec.capacity.pods,
        width: ng.width,
        height: ng.height,
        selected: selectedUid === ng.node.metadata.uid,
        kind: 'Node',
        uid: ng.node.metadata.uid,
      },
      draggable: false,
    });

    // Pod mini nodes inside this node group
    for (let i = 0; i < ng.nodePods.length; i++) {
      const pod = ng.nodePods[i];
      const col = i % POD_GRID_COLS;
      const row = Math.floor(i / POD_GRID_COLS);
      const podX = nodeX + NODE_PADDING + col * (POD_MINI_WIDTH + POD_GAP);
      const podY = CLUSTER_Y + CLUSTER_PADDING + 30 + NODE_HEADER + NODE_PADDING + row * (POD_MINI_HEIGHT + POD_GAP);

      const podNodeId = `pod-${pod.metadata.uid}`;
      nodes.push({
        id: podNodeId,
        type: 'pod-mini',
        position: { x: podX, y: podY },
        data: {
          label: pod.metadata.name,
          status: pod.status.phase,
          reason: pod.status.reason,
          selected: selectedUid === pod.metadata.uid,
          kind: 'Pod',
          uid: pod.metadata.uid,
        },
        draggable: false,
      });
    }

    nodeX += ng.width + NODE_GAP;
  }

  // --- Unscheduled pods area ---
  if (unscheduledPods.length > 0) {
    const pendingRows = Math.ceil(unscheduledPods.length / POD_GRID_COLS);
    const pendingCols = Math.min(unscheduledPods.length, POD_GRID_COLS);
    const pendingWidth = pendingCols * (POD_MINI_WIDTH + POD_GAP) + NODE_PADDING * 2 - POD_GAP;
    const pendingHeight = NODE_HEADER + pendingRows * (POD_MINI_HEIGHT + POD_GAP) + NODE_PADDING * 2;
    const hasRealNodes = simNodes.length > 0;

    if (hasRealNodes) {
      // Real nodes exist but some pods aren't scheduled yet — show as amber "Pending"
      nodes.push({
        id: 'pending-area',
        type: 'node-group',
        position: { x: nodeX, y: CLUSTER_Y + CLUSTER_PADDING + 30 },
        data: {
          label: 'Pending',
          isReady: false,
          isPending: true,
          allocated: unscheduledPods.length,
          capacity: 0,
          width: pendingWidth,
          height: pendingHeight,
          kind: 'pending',
          uid: 'pending',
        },
        draggable: false,
        selectable: false,
      });
    }

    // Place pod minis (inside the pending area when nodes exist, or directly in cluster when not)
    const podAreaY = hasRealNodes
      ? CLUSTER_Y + CLUSTER_PADDING + 30 + NODE_HEADER + NODE_PADDING
      : CLUSTER_Y + CLUSTER_PADDING + 30 + NODE_PADDING;

    for (let i = 0; i < unscheduledPods.length; i++) {
      const pod = unscheduledPods[i];
      const col = i % POD_GRID_COLS;
      const row = Math.floor(i / POD_GRID_COLS);
      const podX = nodeX + NODE_PADDING + col * (POD_MINI_WIDTH + POD_GAP);
      const podY = podAreaY + row * (POD_MINI_HEIGHT + POD_GAP);

      nodes.push({
        id: `pod-${pod.metadata.uid}`,
        type: 'pod-mini',
        position: { x: podX, y: podY },
        data: {
          label: pod.metadata.name,
          status: pod.status.phase,
          reason: pod.status.reason,
          selected: selectedUid === pod.metadata.uid,
          kind: 'Pod',
          uid: pod.metadata.uid,
        },
        draggable: false,
      });
    }
  }

  return { nodes, edges };
}
