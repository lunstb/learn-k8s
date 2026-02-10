interface NodeGroupNodeData {
  label: string;
  isReady: boolean;
  isPending?: boolean;
  allocated: number;
  capacity: number;
  width: number;
  height: number;
  selected?: boolean;
  kind: string;
  uid: string;
}

export function NodeGroupNode({ data }: { data: NodeGroupNodeData }) {
  const isPending = data.isPending;
  const color = isPending ? '#f59e0b' : data.isReady ? '#22c55e' : '#ef4444';
  const fillPercent = data.capacity > 0
    ? Math.min((data.allocated / data.capacity) * 100, 100)
    : 0;

  return (
    <div
      className={`node-group-node ${isPending ? 'node-pending' : data.isReady ? '' : 'node-not-ready'} ${data.selected ? 'selected' : ''}`}
      style={{ width: data.width, height: data.height, borderColor: color }}
    >
      <div className="node-group-header" style={{ borderBottomColor: color }}>
        <span className="node-group-icon" style={{ background: color }}>
          {isPending ? '?' : 'N'}
        </span>
        <span className="node-group-name">{data.label}</span>
        <span className="node-group-status" style={{ color }}>
          {isPending ? 'Unscheduled' : data.isReady ? 'Ready' : 'NotReady'}
        </span>
      </div>
      <div className="capacity-bar">
        <div
          className="capacity-fill"
          style={{
            width: `${fillPercent}%`,
            background: fillPercent >= 90 ? '#ef4444' : fillPercent >= 70 ? '#f59e0b' : '#22c55e',
          }}
        />
        <span className="capacity-text">{data.allocated}/{data.capacity} pods</span>
      </div>
    </div>
  );
}
