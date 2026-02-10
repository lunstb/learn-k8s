import { Handle, Position } from '@xyflow/react';

interface DeploymentNodeData {
  label: string;
  replicas: number;
  readyReplicas: number;
  image: string;
  isConverged: boolean;
}

export function DeploymentNode({ data }: { data: DeploymentNodeData }) {
  return (
    <div
      className={`k8s-node deployment-node ${data.isConverged ? 'converged' : 'converging'}`}
    >
      <div className="node-header">
        <span className="node-icon">D</span>
        <span className="node-kind">Deployment</span>
      </div>
      <div className="node-name">{data.label}</div>
      <div className="node-details">
        <div className="node-field">
          <span className="field-label">Replicas:</span>
          <span className={`field-value ${data.readyReplicas === data.replicas ? '' : 'mismatch'}`}>
            {data.readyReplicas}/{data.replicas}
          </span>
        </div>
        <div className="node-field">
          <span className="field-label">Image:</span>
          <span className="field-value image">{data.image}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
