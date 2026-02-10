export function ClusterGroupNode({ data }: { data: { label: string; width: number; height: number } }) {
  return (
    <div
      className="cluster-group-node"
      style={{ width: data.width, height: data.height }}
    >
      <span className="cluster-group-label">{data.label}</span>
    </div>
  );
}
