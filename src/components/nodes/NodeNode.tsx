import { Handle, Position } from '@xyflow/react';

interface NodeNodeData {
  label: string;
  capacity: number;
  allocated: number;
  isReady: boolean;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function NodeNode({ data }: { data: NodeNodeData }) {
  const color = data.isReady ? '#22c55e' : '#ef4444';

  return (
    <div
      className={`k8s-node infra-node ${data.isReady ? '' : 'node-not-ready'} ${data.selected ? 'selected' : ''}`}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-header">
        <span className="node-icon" style={{ background: color }}>N</span>
        <span className="node-kind">Node</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Status:</span>
          <span className="field-value" style={{ color }}>{data.isReady ? 'Ready' : 'NotReady'}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Pods:</span>
          <span className={`field-value ${data.allocated >= data.capacity ? 'mismatch' : ''}`}>
            {data.allocated}/{data.capacity}
          </span>
        </div>
      </div>
    </div>
  );
}
