import { Handle, Position } from '@xyflow/react';

interface StatefulSetNodeData {
  label: string;
  replicas: number;
  readyReplicas: number;
  image: string;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function StatefulSetNode({ data }: { data: StatefulSetNodeData }) {
  return (
    <div className={`k8s-node statefulset-node ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-header">
        <span className="node-icon" style={{ background: '#10b981' }}>SS</span>
        <span className="node-kind">StatefulSet</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Replicas:</span>
          <span className={`field-value ${data.readyReplicas !== data.replicas ? 'mismatch' : ''}`}>
            {data.readyReplicas}/{data.replicas}
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
