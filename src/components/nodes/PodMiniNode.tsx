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

interface PodMiniNodeData {
  label: string;
  status: string;
  reason?: string;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function PodMiniNode({ data }: { data: PodMiniNodeData }) {
  const displayStatus = data.reason || data.status;
  const color = statusColors[displayStatus] || statusColors[data.status] || '#6b7280';

  return (
    <div className={`pod-mini-node ${data.selected ? 'selected' : ''}`} style={{ borderLeftColor: color }}>
      <div className="pod-mini-dot" style={{ background: color }} />
      <div className="pod-mini-info">
        <span className="pod-mini-name" title={data.label}>
          {data.label.length > 14 ? data.label.slice(0, 12) + '..' : data.label}
        </span>
        <span className="pod-mini-status" style={{ color }}>{displayStatus}</span>
      </div>
    </div>
  );
}
