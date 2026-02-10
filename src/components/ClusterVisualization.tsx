import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
} from '@xyflow/react';
import type { Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSimulatorStore } from '../simulation/store';
import { DeploymentNode } from './nodes/DeploymentNode';
import { ReplicaSetNode } from './nodes/ReplicaSetNode';
import { PodNode } from './nodes/PodNode';
import { NodeNode } from './nodes/NodeNode';
import { ServiceNode } from './nodes/ServiceNode';
import { StatefulSetNode } from './nodes/StatefulSetNode';
import { DaemonSetNode } from './nodes/DaemonSetNode';
import { JobNode } from './nodes/JobNode';
import { CronJobNode } from './nodes/CronJobNode';
import { IngressNode } from './nodes/IngressNode';
import { HPANode } from './nodes/HPANode';
import { ClusterGroupNode } from './nodes/ClusterGroupNode';
import { NodeGroupNode } from './nodes/NodeGroupNode';
import { PodMiniNode } from './nodes/PodMiniNode';
import { computeLogicalLayout } from './layouts/logicalLayout';
import { computeInfrastructureLayout } from './layouts/infrastructureLayout';

const nodeTypes = {
  deployment: DeploymentNode,
  replicaset: ReplicaSetNode,
  pod: PodNode,
  infranode: NodeNode,
  service: ServiceNode,
  statefulset: StatefulSetNode,
  daemonset: DaemonSetNode,
  job: JobNode,
  cronjob: CronJobNode,
  ingress: IngressNode,
  hpa: HPANode,
  'cluster-group': ClusterGroupNode,
  'node-group': NodeGroupNode,
  'pod-mini': PodMiniNode,
};

export function ClusterVisualization() {
  const cluster = useSimulatorStore((s) => s.cluster);
  const viewMode = useSimulatorStore((s) => s.viewMode);
  const selectedResource = useSimulatorStore((s) => s.selectedResource);
  const setSelectedResource = useSimulatorStore((s) => s.setSelectedResource);
  const showNetworkOverlay = useSimulatorStore((s) => s.showNetworkOverlay);

  const selectedUid = selectedResource?.uid ?? null;

  const { nodes, edges } = useMemo(() => {
    return viewMode === 'infrastructure'
      ? computeInfrastructureLayout(cluster, selectedUid, showNetworkOverlay)
      : computeLogicalLayout(cluster, selectedUid, showNetworkOverlay);
  }, [cluster, viewMode, selectedUid, showNetworkOverlay]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const { kind, uid } = node.data as { kind?: string; uid?: string };
      if (kind && uid && kind !== 'pending') {
        setSelectedResource({ kind, uid });
      }
    },
    [setSelectedResource],
  );

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
          onNodeClick={onNodeClick}
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
