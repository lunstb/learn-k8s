import { Handle, Position } from '@xyflow/react';

interface CronJobNodeData {
  label: string;
  schedule: string;
  activeJobs: number;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function CronJobNode({ data }: { data: CronJobNodeData }) {
  return (
    <div className={`k8s-node cronjob-node ${data.selected ? 'selected' : ''}`}>
      <div className="node-header">
        <span className="node-icon" style={{ background: '#a855f7' }}>CJ</span>
        <span className="node-kind">CronJob</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Schedule:</span>
          <span className="field-value image">{data.schedule}</span>
        </div>
        <div className="node-field">
          <span className="field-label">Active:</span>
          <span className="field-value">{data.activeJobs}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
