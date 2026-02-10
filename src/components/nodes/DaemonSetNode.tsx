import { Handle, Position } from '@xyflow/react';

interface DaemonSetNodeData {
  label: string;
  desired: number;
  ready: number;
  image: string;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function DaemonSetNode({ data }: { data: DaemonSetNodeData }) {
  return (
    <div className={`k8s-node daemonset-node ${data.selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div className="node-header">
        <span className="node-icon" style={{ background: '#f59e0b' }}>DS</span>
        <span className="node-kind">DaemonSet</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Desired:</span>
          <span className="field-value">{data.desired}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Ready:</span>
          <span className={`field-value ${data.ready !== data.desired ? 'mismatch' : ''}`}>
            {data.ready}
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
