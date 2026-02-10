import { Handle, Position } from '@xyflow/react';

interface IngressNodeData {
  label: string;
  rulesCount: number;
  hosts: string;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function IngressNode({ data }: { data: IngressNodeData }) {
  return (
    <div className={`k8s-node ingress-node ${data.selected ? 'selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon" style={{ background: '#d946ef' }}>Ing</span>
        <span className="node-kind">Ingress</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Rules:</span>
          <span className="field-value">{data.rulesCount}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Hosts:</span>
          <span className="field-value image">{data.hosts}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
