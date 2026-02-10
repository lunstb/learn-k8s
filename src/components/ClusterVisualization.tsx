import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSimulatorStore } from '../simulation/store';
import { DeploymentNode } from './nodes/DeploymentNode';
import { ReplicaSetNode } from './nodes/ReplicaSetNode';
import { PodNode } from './nodes/PodNode';
import { NodeNode } from './nodes/NodeNode';
import { ServiceNode } from './nodes/ServiceNode';
import { labelsMatch } from '../simulation/utils';

const nodeTypes = {
  deployment: DeploymentNode,
  replicaset: ReplicaSetNode,
  pod: PodNode,
  infranode: NodeNode,
  service: ServiceNode,
};

export function ClusterVisualization() {
  const cluster = useSimulatorStore((s) => s.cluster);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const deployments = cluster.deployments.filter((d) => !d.metadata.deletionTimestamp);
    const replicaSets = cluster.replicaSets.filter((rs) => !rs.metadata.deletionTimestamp);
    const pods = cluster.pods.filter((p) => !p.metadata.deletionTimestamp);
    const simNodes = cluster.nodes;
    const services = cluster.services;

    // Layout constants
    const hasNodes = simNodes.length > 0;
    const hasServices = services.length > 0;
    const SERVICE_Y = 30;
    const DEP_Y = hasServices ? 180 : 30;
    const RS_Y = DEP_Y + 150;
    const POD_Y = RS_Y + 170;
    const NODE_Y = POD_Y + 170;
    const DEP_SPACING = 400;
    const RS_SPACING = 280;
    const POD_SPACING = 150;

    let depX = 0;

    // --- Services (top row) ---
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
          },
          draggable: false,
        });

        // Edges from service to matching pods
        for (const pod of pods) {
          if (
            pod.status.phase === 'Running' &&
            labelsMatch(svc.spec.selector, pod.metadata.labels)
          ) {
            const podNodeId = `pod-${pod.metadata.uid}`;
            edges.push({
              id: `edge-${svcNodeId}-${podNodeId}`,
              source: svcNodeId,
              target: podNodeId,
              type: 'smoothstep',
              style: {
                stroke: svc.status.endpoints.includes(pod.metadata.name)
                  ? '#06b6d4'
                  : '#6b7280',
                strokeWidth: 1.5,
                strokeDasharray: svc.status.endpoints.includes(pod.metadata.name)
                  ? undefined
                  : '5 5',
              },
            });
          }
        }
      }
    }

    // --- Deployments → ReplicaSets → Pods ---
    for (const dep of deployments) {
      const depNodeId = `dep-${dep.metadata.uid}`;

      const ownedRS = replicaSets.filter(
        (rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid
      );

      let totalPods = 0;
      for (const rs of ownedRS) {
        const rsPods = pods.filter(
          (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
        );
        totalPods += Math.max(rsPods.length, 1);
      }

      const totalWidth = Math.max(
        (totalPods) * POD_SPACING,
        ownedRS.length * RS_SPACING,
        200
      );
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
        },
        draggable: false,
      });

      let rsX = depX;
      for (let rsIdx = 0; rsIdx < ownedRS.length; rsIdx++) {
        const rs = ownedRS[rsIdx];
        const rsNodeId = `rs-${rs.metadata.uid}`;

        const rsPods = pods.filter(
          (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
        );

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
          },
          draggable: false,
        });

        edges.push({
          id: `edge-${depNodeId}-${rsNodeId}`,
          source: depNodeId,
          target: rsNodeId,
          type: 'smoothstep',
          style: { stroke: isOld ? '#6b7280' : '#3b82f6', strokeWidth: 2 },
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
            },
            draggable: false,
          });

          edges.push({
            id: `edge-${rsNodeId}-${podNodeId}`,
            source: rsNodeId,
            target: podNodeId,
            type: 'smoothstep',
            style: { stroke: '#64748b', strokeWidth: 1.5 },
          });
        }

        rsX += rsWidth + 40;
      }

      depX += totalWidth + DEP_SPACING / 2;
    }

    // Standalone ReplicaSets
    const standaloneRS = replicaSets.filter((rs) => !rs.metadata.ownerReference);
    for (const rs of standaloneRS) {
      const rsNodeId = `rs-${rs.metadata.uid}`;
      const rsPods = pods.filter(
        (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
      );

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
          },
          draggable: false,
        });

        edges.push({
          id: `edge-${rsNodeId}-${podNodeId}`,
          source: rsNodeId,
          target: podNodeId,
          type: 'smoothstep',
          style: { stroke: '#64748b', strokeWidth: 1.5 },
        });
      }

      depX += rsWidth + 100;
    }

    // Standalone Pods
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
          },
          draggable: false,
        });

        // Edges from pods to their assigned node
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
              },
            });
          }
        }
      }
    }

    return { nodes, edges };
  }, [cluster]);

  return (
    <div className="cluster-visualization">
      {nodes.length === 0 ? (
        <div className="empty-cluster">
          <div className="empty-cluster-icon">K8s</div>
          <p>No resources in the cluster</p>
          <p className="empty-hint">
            Create a deployment or load a lesson to get started
          </p>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          connectionMode={ConnectionMode.Loose}
          panOnDrag
          zoomOnScroll
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        </ReactFlow>
      )}
    </div>
  );
}
