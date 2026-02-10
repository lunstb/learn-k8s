import { useEffect } from 'react';
import { useSimulatorStore } from '../simulation/store';
import type {
  Pod, ReplicaSet, Deployment, SimNode, Service,
  StatefulSet, DaemonSet, Job, CronJob, Ingress,
  HorizontalPodAutoscaler, ClusterState,
} from '../simulation/types';
import './ResourceDetailPanel.css';

function findResource(cluster: ClusterState, kind: string, uid: string) {
  switch (kind) {
    case 'Pod': return cluster.pods.find((p) => p.metadata.uid === uid);
    case 'ReplicaSet': return cluster.replicaSets.find((r) => r.metadata.uid === uid);
    case 'Deployment': return cluster.deployments.find((d) => d.metadata.uid === uid);
    case 'Node': return cluster.nodes.find((n) => n.metadata.uid === uid);
    case 'Service': return cluster.services.find((s) => s.metadata.uid === uid);
    case 'StatefulSet': return cluster.statefulSets.find((s) => s.metadata.uid === uid);
    case 'DaemonSet': return cluster.daemonSets.find((d) => d.metadata.uid === uid);
    case 'Job': return cluster.jobs.find((j) => j.metadata.uid === uid);
    case 'CronJob': return cluster.cronJobs.find((c) => c.metadata.uid === uid);
    case 'Ingress': return cluster.ingresses.find((i) => i.metadata.uid === uid);
    case 'HorizontalPodAutoscaler': return cluster.hpas.find((h) => h.metadata.uid === uid);
    default: return undefined;
  }
}

function Field({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="detail-section">
      <h4 className="detail-section-title">{title}</h4>
      {children}
    </div>
  );
}

function CrossRef({ kind, uid, name, onClick }: { kind: string; uid: string; name: string; onClick: (kind: string, uid: string) => void }) {
  return (
    <button className="detail-crossref" onClick={() => onClick(kind, uid)}>
      {kind}/{name}
    </button>
  );
}

function Labels({ labels }: { labels: Record<string, string> }) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return <span className="detail-value mono">none</span>;
  return (
    <div className="detail-labels">
      {entries.map(([k, v]) => (
        <span key={k} className="detail-label-badge">{k}={v}</span>
      ))}
    </div>
  );
}

function PodDetail({ pod, cluster, navigate }: { pod: Pod; cluster: ClusterState; navigate: (kind: string, uid: string) => void }) {
  const node = pod.spec.nodeName
    ? cluster.nodes.find((n) => n.metadata.name === pod.spec.nodeName)
    : null;

  return (
    <>
      <Field label="Status" value={pod.status.reason || pod.status.phase} />
      <Field label="Image" value={pod.spec.image} mono />
      {pod.spec.nodeName && (
        <div className="detail-field">
          <span className="detail-label">Node</span>
          {node ? (
            <CrossRef kind="Node" uid={node.metadata.uid} name={node.metadata.name} onClick={navigate} />
          ) : (
            <span className="detail-value mono">{pod.spec.nodeName}</span>
          )}
        </div>
      )}
      {pod.status.restartCount !== undefined && pod.status.restartCount > 0 && (
        <Field label="Restarts" value={pod.status.restartCount} />
      )}
      {pod.status.ready !== undefined && (
        <Field label="Ready" value={pod.status.ready ? 'Yes' : 'No'} />
      )}
      {pod.metadata.ownerReference && (
        <div className="detail-field">
          <span className="detail-label">Owner</span>
          <CrossRef
            kind={pod.metadata.ownerReference.kind}
            uid={pod.metadata.ownerReference.uid}
            name={pod.metadata.ownerReference.name}
            onClick={navigate}
          />
        </div>
      )}
      {pod.spec.resources && (
        <Section title="Resources">
          {pod.spec.resources.requests?.cpu && <Field label="CPU Request" value={pod.spec.resources.requests.cpu} />}
          {pod.spec.resources.requests?.memory && <Field label="Memory Request" value={pod.spec.resources.requests.memory} />}
          {pod.spec.resources.limits?.cpu && <Field label="CPU Limit" value={pod.spec.resources.limits.cpu} />}
          {pod.spec.resources.limits?.memory && <Field label="Memory Limit" value={pod.spec.resources.limits.memory} />}
        </Section>
      )}
      {(pod.spec.livenessProbe || pod.spec.readinessProbe) && (
        <Section title="Probes">
          {pod.spec.livenessProbe && <Field label="Liveness" value={`${pod.spec.livenessProbe.type} (delay: ${pod.spec.livenessProbe.initialDelaySeconds || 0}s)`} />}
          {pod.spec.readinessProbe && <Field label="Readiness" value={`${pod.spec.readinessProbe.type} (delay: ${pod.spec.readinessProbe.initialDelaySeconds || 0}s)`} />}
        </Section>
      )}
      <Section title="Labels">
        <Labels labels={pod.metadata.labels} />
      </Section>
    </>
  );
}

function NodeDetail({ node, cluster, navigate }: { node: SimNode; cluster: ClusterState; navigate: (kind: string, uid: string) => void }) {
  const hostedPods = cluster.pods.filter(
    (p) => p.spec.nodeName === node.metadata.name && !p.metadata.deletionTimestamp
  );

  return (
    <>
      <Field label="Status" value={node.status.conditions[0].status === 'True' ? 'Ready' : 'NotReady'} />
      <Field label="Pod Capacity" value={node.spec.capacity.pods} />
      <Field label="Allocated Pods" value={node.status.allocatedPods} />
      <Section title={`Hosted Pods (${hostedPods.length})`}>
        {hostedPods.length === 0 ? (
          <span className="detail-value">none</span>
        ) : (
          <div className="detail-pod-list">
            {hostedPods.map((p) => (
              <CrossRef key={p.metadata.uid} kind="Pod" uid={p.metadata.uid} name={p.metadata.name} onClick={navigate} />
            ))}
          </div>
        )}
      </Section>
      <Section title="Labels">
        <Labels labels={node.metadata.labels} />
      </Section>
    </>
  );
}

function DeploymentDetail({ dep, cluster, navigate }: { dep: Deployment; cluster: ClusterState; navigate: (kind: string, uid: string) => void }) {
  const ownedRS = cluster.replicaSets.filter((rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid);

  return (
    <>
      <Field label="Replicas" value={`${dep.status.readyReplicas}/${dep.spec.replicas} ready`} />
      <Field label="Available" value={dep.status.availableReplicas} />
      <Field label="Strategy" value={dep.spec.strategy.type} />
      <Field label="Image" value={dep.spec.template.spec.image} mono />
      <Field label="Selector" value={Object.entries(dep.spec.selector).map(([k, v]) => `${k}=${v}`).join(', ')} mono />
      <Section title={`ReplicaSets (${ownedRS.length})`}>
        {ownedRS.map((rs) => (
          <CrossRef key={rs.metadata.uid} kind="ReplicaSet" uid={rs.metadata.uid} name={rs.metadata.name} onClick={navigate} />
        ))}
      </Section>
      <Section title="Labels">
        <Labels labels={dep.metadata.labels} />
      </Section>
    </>
  );
}

function ReplicaSetDetail({ rs, cluster, navigate }: { rs: ReplicaSet; cluster: ClusterState; navigate: (kind: string, uid: string) => void }) {
  const ownedPods = cluster.pods.filter((p) => p.metadata.ownerReference?.uid === rs.metadata.uid);

  return (
    <>
      <Field label="Replicas" value={`${rs.status.readyReplicas}/${rs.spec.replicas}`} />
      <Field label="Image" value={rs.spec.template.spec.image} mono />
      {rs.metadata.ownerReference && (
        <div className="detail-field">
          <span className="detail-label">Owner</span>
          <CrossRef
            kind={rs.metadata.ownerReference.kind}
            uid={rs.metadata.ownerReference.uid}
            name={rs.metadata.ownerReference.name}
            onClick={navigate}
          />
        </div>
      )}
      <Section title={`Pods (${ownedPods.length})`}>
        {ownedPods.map((p) => (
          <CrossRef key={p.metadata.uid} kind="Pod" uid={p.metadata.uid} name={p.metadata.name} onClick={navigate} />
        ))}
      </Section>
    </>
  );
}

function ServiceDetail({ svc, cluster, navigate }: { svc: Service; cluster: ClusterState; navigate: (kind: string, uid: string) => void }) {
  return (
    <>
      <Field label="Type" value={svc.spec.type || 'ClusterIP'} />
      <Field label="Selector" value={Object.entries(svc.spec.selector).map(([k, v]) => `${k}=${v}`).join(', ')} mono />
      <Field label="Port" value={svc.spec.port} />
      <Section title={`Endpoints (${svc.status.endpoints.length})`}>
        {svc.status.endpoints.length === 0 ? (
          <span className="detail-value">none</span>
        ) : (
          <div className="detail-pod-list">
            {svc.status.endpoints.map((ep) => {
              const pod = cluster.pods.find((p) => p.metadata.name === ep);
              return pod ? (
                <CrossRef key={ep} kind="Pod" uid={pod.metadata.uid} name={ep} onClick={navigate} />
              ) : (
                <span key={ep} className="detail-value mono">{ep}</span>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}

function StatefulSetDetail({ sts }: { sts: StatefulSet }) {
  return (
    <>
      <Field label="Replicas" value={`${sts.status.readyReplicas}/${sts.spec.replicas}`} />
      <Field label="Service" value={sts.spec.serviceName} mono />
      <Field label="Image" value={sts.spec.template.spec.image} mono />
      <Section title="Labels">
        <Labels labels={sts.metadata.labels} />
      </Section>
    </>
  );
}

function DaemonSetDetail({ ds }: { ds: DaemonSet }) {
  return (
    <>
      <Field label="Desired" value={ds.status.desiredNumberScheduled} />
      <Field label="Current" value={ds.status.currentNumberScheduled} />
      <Field label="Ready" value={ds.status.numberReady} />
      <Field label="Image" value={ds.spec.template.spec.image} mono />
    </>
  );
}

function JobDetail({ job }: { job: Job }) {
  return (
    <>
      <Field label="Completions" value={`${job.status.succeeded}/${job.spec.completions}`} />
      <Field label="Parallelism" value={job.spec.parallelism} />
      <Field label="Failed" value={job.status.failed} />
      <Field label="Active" value={job.status.active} />
    </>
  );
}

function CronJobDetail({ cj }: { cj: CronJob }) {
  return (
    <>
      <Field label="Schedule" value={cj.spec.schedule} mono />
      <Field label="Active Jobs" value={cj.status.active} />
      {cj.status.lastScheduleTime !== undefined && (
        <Field label="Last Schedule" value={`tick ${cj.status.lastScheduleTime}`} />
      )}
    </>
  );
}

function IngressDetail({ ing }: { ing: Ingress }) {
  return (
    <>
      {ing.status.loadBalancer?.ip && <Field label="LB IP" value={ing.status.loadBalancer.ip} mono />}
      <Section title={`Rules (${ing.spec.rules.length})`}>
        {ing.spec.rules.map((rule, i) => (
          <div key={i} className="detail-rule">
            <Field label="Host" value={rule.host} mono />
            <Field label="Path" value={rule.path} mono />
            <Field label="Backend" value={`${rule.serviceName}:${rule.servicePort}`} mono />
          </div>
        ))}
      </Section>
    </>
  );
}

function HPADetail({ hpa }: { hpa: HorizontalPodAutoscaler }) {
  return (
    <>
      <Field label="Target" value={`${hpa.spec.scaleTargetRef.kind}/${hpa.spec.scaleTargetRef.name}`} />
      <Field label="Min Replicas" value={hpa.spec.minReplicas} />
      <Field label="Max Replicas" value={hpa.spec.maxReplicas} />
      <Field label="Target CPU" value={`${hpa.spec.targetCPUUtilizationPercentage}%`} />
      <Field label="Current CPU" value={hpa.status.currentCPUUtilizationPercentage !== undefined ? `${hpa.status.currentCPUUtilizationPercentage}%` : 'N/A'} />
      <Field label="Current Replicas" value={hpa.status.currentReplicas} />
      <Field label="Desired Replicas" value={hpa.status.desiredReplicas} />
    </>
  );
}

const kindColors: Record<string, string> = {
  Pod: '#22c55e',
  ReplicaSet: '#8b5cf6',
  Deployment: '#3b82f6',
  Node: '#22c55e',
  Service: '#06b6d4',
  StatefulSet: '#10b981',
  DaemonSet: '#f59e0b',
  Job: '#8b5cf6',
  CronJob: '#a855f7',
  Ingress: '#d946ef',
  HorizontalPodAutoscaler: '#06b6d4',
};

export function ResourceDetailPanel() {
  const selectedResource = useSimulatorStore((s) => s.selectedResource);
  const setSelectedResource = useSimulatorStore((s) => s.setSelectedResource);
  const cluster = useSimulatorStore((s) => s.cluster);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedResource(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSelectedResource]);

  if (!selectedResource) return null;

  const resource = findResource(cluster, selectedResource.kind, selectedResource.uid);
  if (!resource) return null;

  const meta = 'metadata' in resource ? (resource as { metadata: { name: string; uid: string; labels: Record<string, string> } }).metadata : null;
  if (!meta) return null;

  const navigate = (kind: string, uid: string) => setSelectedResource({ kind, uid });
  const color = kindColors[selectedResource.kind] || '#64748b';

  return (
    <div className="detail-panel">
      <div className="detail-panel-header">
        <div className="detail-panel-kind" style={{ color }}>
          {selectedResource.kind}
        </div>
        <div className="detail-panel-name">{meta.name}</div>
        <button className="detail-panel-close" onClick={() => setSelectedResource(null)}>
          &times;
        </button>
      </div>
      <div className="detail-panel-body">
        <Field label="UID" value={meta.uid} mono />
        {selectedResource.kind === 'Pod' && (
          <PodDetail pod={resource as Pod} cluster={cluster} navigate={navigate} />
        )}
        {selectedResource.kind === 'Node' && (
          <NodeDetail node={resource as SimNode} cluster={cluster} navigate={navigate} />
        )}
        {selectedResource.kind === 'Deployment' && (
          <DeploymentDetail dep={resource as Deployment} cluster={cluster} navigate={navigate} />
        )}
        {selectedResource.kind === 'ReplicaSet' && (
          <ReplicaSetDetail rs={resource as ReplicaSet} cluster={cluster} navigate={navigate} />
        )}
        {selectedResource.kind === 'Service' && (
          <ServiceDetail svc={resource as Service} cluster={cluster} navigate={navigate} />
        )}
        {selectedResource.kind === 'StatefulSet' && (
          <StatefulSetDetail sts={resource as StatefulSet} />
        )}
        {selectedResource.kind === 'DaemonSet' && (
          <DaemonSetDetail ds={resource as DaemonSet} />
        )}
        {selectedResource.kind === 'Job' && (
          <JobDetail job={resource as Job} />
        )}
        {selectedResource.kind === 'CronJob' && (
          <CronJobDetail cj={resource as CronJob} />
        )}
        {selectedResource.kind === 'Ingress' && (
          <IngressDetail ing={resource as Ingress} />
        )}
        {selectedResource.kind === 'HorizontalPodAutoscaler' && (
          <HPADetail hpa={resource as HorizontalPodAutoscaler} />
        )}
      </div>
    </div>
  );
}
