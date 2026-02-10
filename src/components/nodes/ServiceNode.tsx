import { Handle, Position } from '@xyflow/react';

interface ServiceNodeData {
  label: string;
  selector: string;
  port: number;
  endpointCount: number;
  endpoints: string[];
  selected?: boolean;
  kind: string;
  uid: string;
}

export function ServiceNode({ data }: { data: ServiceNodeData }) {
  const hasEndpoints = data.endpointCount > 0;
  const color = hasEndpoints ? '#06b6d4' : '#6b7280';

  return (
    <div
      className={`k8s-node service-node ${hasEndpoints ? '' : 'no-endpoints'} ${data.selected ? 'selected' : ''}`}
      style={{ borderColor: color }}
    >
      <div className="node-header">
        <span className="node-icon" style={{ background: color }}>S</span>
        <span className="node-kind">Service</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Selector:</span>
          <span className="field-value image">{data.selector}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Port:</span>
          <span className="field-value">{data.port}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Endpoints:</span>
          <span className={`field-value ${hasEndpoints ? '' : 'mismatch'}`}>
            {data.endpointCount > 0 ? `${data.endpointCount} ready` : 'none'}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
