import { Handle, Position } from '@xyflow/react';

interface JobNodeData {
  label: string;
  succeeded: number;
  completions: number;
  status: string;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function JobNode({ data }: { data: JobNodeData }) {
  const isDone = data.succeeded >= data.completions;
  const color = isDone ? '#6b7280' : '#8b5cf6';

  return (
    <div
      className={`k8s-node job-node ${data.selected ? 'selected' : ''}`}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-header">
        <span className="node-icon" style={{ background: '#8b5cf6' }}>J</span>
        <span className="node-kind">Job</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Progress:</span>
          <span className={`field-value ${isDone ? '' : 'mismatch'}`}>
            {data.succeeded}/{data.completions}
          </span>
        </div>
        <div className="node-field">
          <span className="field-label">Status:</span>
          <span className="field-value">{data.status}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
