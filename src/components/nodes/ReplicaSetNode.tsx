import { Handle, Position } from '@xyflow/react';

interface ReplicaSetNodeData {
  label: string;
  desiredReplicas: number;
  currentReplicas: number;
  image: string;
  isConverged: boolean;
  isOld: boolean;
}

export function ReplicaSetNode({ data }: { data: ReplicaSetNodeData }) {
  return (
    <div
      className={`k8s-node replicaset-node ${data.isConverged ? 'converged' : 'converging'} ${data.isOld ? 'old-rs' : ''}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-header">
        <span className="node-icon">RS</span>
        <span className="node-kind">ReplicaSet</span>
      </div>
      <div className="node-name" title={data.label}>
        {data.label.length > 24 ? data.label.slice(0, 22) + '...' : data.label}
      </div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Desired:</span>
          <span className="field-value">{data.desiredReplicas}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Current:</span>
          <span className={`field-value ${data.currentReplicas !== data.desiredReplicas ? 'mismatch' : ''}`}>
            {data.currentReplicas}
          </span>
        </div>
        <div className="node-field">
          <span className="field-label">Image:</span>
          <span className="field-value image">{data.image}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
