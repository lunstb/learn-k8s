import { Handle, Position } from '@xyflow/react';

interface PodNodeData {
  label: string;
  status: string;
  image: string;
  isNew: boolean;
  reason?: string;
  restartCount?: number;
}

const statusColors: Record<string, string> = {
  Running: '#22c55e',
  Pending: '#eab308',
  Failed: '#ef4444',
  Terminating: '#f97316',
  Succeeded: '#6b7280',
  CrashLoopBackOff: '#ef4444',
  ImagePullError: '#f59e0b',
  Unschedulable: '#f59e0b',
};

export function PodNode({ data }: { data: PodNodeData }) {
  const displayStatus = data.reason || data.status;
  const color = statusColors[displayStatus] || statusColors[data.status] || '#6b7280';
  const isCrashing = displayStatus === 'CrashLoopBackOff';
  const isImageError = displayStatus === 'ImagePullError';

  return (
    <div
      className={`k8s-node pod-node ${data.isNew ? 'node-new' : ''} ${isCrashing ? 'pod-crashing' : ''} ${isImageError ? 'pod-image-error' : ''}`}
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="pod-status-dot" style={{ backgroundColor: color }} />
      <div className="pod-name" title={data.label}>
        {data.label.length > 18 ? data.label.slice(0, 16) + '...' : data.label}
      </div>
      <div className="pod-info">
        <span className="pod-status" style={{ color }}>{displayStatus}</span>
        {data.restartCount !== undefined && data.restartCount > 0 && (
          <span className="pod-restarts" style={{ color: '#ef4444' }}>Restarts: {data.restartCount}</span>
        )}
        <span className="pod-image">{data.image}</span>
      </div>
    </div>
  );
}
