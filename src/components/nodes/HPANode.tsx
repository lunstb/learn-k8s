import { Handle, Position } from '@xyflow/react';

interface HPANodeData {
  label: string;
  target: string;
  minReplicas: number;
  maxReplicas: number;
  cpuPercent: number | null;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function HPANode({ data }: { data: HPANodeData }) {
  return (
    <div className={`k8s-node hpa-node ${data.selected ? 'selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon" style={{ background: '#06b6d4' }}>HPA</span>
        <span className="node-kind">HPA</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Target:</span>
          <span className="field-value">{data.target}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Replicas:</span>
          <span className="field-value">{data.minReplicas}-{data.maxReplicas}</span>
        </div>
        <div className="node-field">
          <span className="field-label">CPU:</span>
          <span className="field-value">
            {data.cpuPercent !== null ? `${data.cpuPercent}%` : 'N/A'}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
