import { useSimulatorStore } from '../simulation/store';
import { parseCommand } from './parser';
import type { ParsedCommand } from './parser';
import type { Deployment, Pod, Service } from '../simulation/types';
import { generateUID } from '../simulation/utils';

export function executeCommand(input: string): string[] {
  const store = useSimulatorStore.getState();

  // Handle special commands
  const trimmed = input.trim().toLowerCase();
  if (trimmed === 'help' || trimmed === 'kubectl help') {
    return getHelpText();
  }
  if (trimmed === 'clear') {
    store.clearOutput();
    return [];
  }

  const result = parseCommand(input);

  if ('error' in result) {
    return [`Error: ${result.error}`];
  }

  const cmd = result as ParsedCommand;

  switch (cmd.action) {
    case 'create':
      return handleCreate(cmd);
    case 'get':
      return handleGet(cmd);
    case 'delete':
      return handleDelete(cmd);
    case 'scale':
      return handleScale(cmd);
    case 'set-image':
      return handleSetImage(cmd);
    case 'describe':
      return handleDescribe(cmd);
    case 'rollout-status':
      return handleRolloutStatus(cmd);
    case 'cordon':
      return handleCordon(cmd, false);
    case 'uncordon':
      return handleCordon(cmd, true);
    default:
      return [`Error: Unimplemented action "${cmd.action}"`];
  }
}

function handleCreate(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();

  if (cmd.resourceType === 'deployment') {
    if (!cmd.resourceName) {
      return ['Error: Missing deployment name. Usage: kubectl create deployment <name> --image=<image> [--replicas=N]'];
    }
    if (store.cluster.deployments.find((d) => d.metadata.name === cmd.resourceName)) {
      return [`Error: deployment "${cmd.resourceName}" already exists`];
    }
    const image = cmd.flags.image || 'nginx';
    const replicas = parseInt(cmd.flags.replicas || '1', 10);
    if (isNaN(replicas) || replicas < 0) {
      return ['Error: --replicas must be a non-negative number'];
    }
    const dep: Deployment = {
      kind: 'Deployment',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: { app: cmd.resourceName },
        creationTimestamp: Date.now(),
      },
      spec: {
        replicas,
        selector: { app: cmd.resourceName },
        template: {
          labels: { app: cmd.resourceName },
          spec: { image },
        },
        strategy: {
          type: 'RollingUpdate',
          maxSurge: 1,
          maxUnavailable: 1,
        },
      },
      status: {
        replicas: 0,
        updatedReplicas: 0,
        readyReplicas: 0,
        availableReplicas: 0,
        conditions: [],
      },
    };
    store.addDeployment(dep);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Deployment',
      objectName: cmd.resourceName,
      message: `Created deployment "${cmd.resourceName}" with image ${image}`,
    });
    return [`deployment.apps/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'pod') {
    if (!cmd.resourceName) {
      return ['Error: Missing pod name. Usage: kubectl create pod <name> --image=<image>'];
    }
    if (store.cluster.pods.find((p) => p.metadata.name === cmd.resourceName)) {
      return [`Error: pod "${cmd.resourceName}" already exists`];
    }
    const image = cmd.flags.image || 'nginx';
    const pod: Pod = {
      kind: 'Pod',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: {},
        creationTimestamp: Date.now(),
      },
      spec: { image },
      status: { phase: 'Pending', tickCreated: store.cluster.tick },
    };
    store.addPod(pod);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Pod',
      objectName: cmd.resourceName,
      message: `Created pod "${cmd.resourceName}" with image ${image}`,
    });
    return [`pod/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'service') {
    if (!cmd.resourceName) {
      return ['Error: Missing service name. Usage: kubectl create service <name> --selector=app=myapp --port=80'];
    }
    if (store.cluster.services.find((s) => s.metadata.name === cmd.resourceName)) {
      return [`Error: service "${cmd.resourceName}" already exists`];
    }
    const selectorStr = cmd.flags.selector || '';
    const selector: Record<string, string> = {};
    if (selectorStr) {
      for (const pair of selectorStr.split(',')) {
        const [key, value] = pair.split('=');
        if (key && value) {
          selector[key] = value;
        }
      }
    }
    if (Object.keys(selector).length === 0) {
      return ['Error: --selector is required. Usage: kubectl create service <name> --selector=app=myapp --port=80'];
    }
    const port = parseInt(cmd.flags.port || '80', 10);
    const svc: Service = {
      kind: 'Service',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: {},
        creationTimestamp: Date.now(),
      },
      spec: { selector, port },
      status: { endpoints: [] },
    };
    store.addService(svc);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Service',
      objectName: cmd.resourceName,
      message: `Created service "${cmd.resourceName}" with selector ${selectorStr}`,
    });
    return [`service/${cmd.resourceName} created`];
  }

  return [`Error: Cannot create resource type "${cmd.resourceType}". Supported: deployment, pod, service`];
}

function handleGet(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();

  if (cmd.resourceType === 'deployment') {
    const deps = cmd.resourceName
      ? store.cluster.deployments.filter((d) => d.metadata.name === cmd.resourceName)
      : store.cluster.deployments;
    if (cmd.resourceName && deps.length === 0) {
      return [`Error: deployment "${cmd.resourceName}" not found`];
    }
    if (deps.length === 0) {
      return ['No deployments found.'];
    }
    const header = padRow(['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'IMAGE']);
    const rows = deps.map((d) => {
      return padRow([
        d.metadata.name,
        `${d.status.readyReplicas}/${d.spec.replicas}`,
        String(d.status.updatedReplicas),
        String(d.status.availableReplicas),
        d.spec.template.spec.image,
      ]);
    });
    return [header, ...rows];
  }

  if (cmd.resourceType === 'replicaset') {
    const rsList = cmd.resourceName
      ? store.cluster.replicaSets.filter((rs) => rs.metadata.name === cmd.resourceName)
      : store.cluster.replicaSets.filter((rs) => !rs.metadata.deletionTimestamp);
    if (cmd.resourceName && rsList.length === 0) {
      return [`Error: replicaset "${cmd.resourceName}" not found`];
    }
    if (rsList.length === 0) {
      return ['No replicasets found.'];
    }
    const header = padRow(['NAME', 'DESIRED', 'CURRENT', 'READY', 'IMAGE']);
    const rows = rsList.map((rs) => {
      const currentPods = store.cluster.pods.filter(
        (p) =>
          p.metadata.ownerReference?.uid === rs.metadata.uid &&
          !p.metadata.deletionTimestamp
      ).length;
      return padRow([
        rs.metadata.name,
        String(rs.spec.replicas),
        String(currentPods),
        String(rs.status.readyReplicas),
        rs.spec.template.spec.image,
      ]);
    });
    return [header, ...rows];
  }

  if (cmd.resourceType === 'pod') {
    const podList = cmd.resourceName
      ? store.cluster.pods.filter((p) => p.metadata.name === cmd.resourceName)
      : store.cluster.pods.filter((p) => !p.metadata.deletionTimestamp);
    if (cmd.resourceName && podList.length === 0) {
      return [`Error: pod "${cmd.resourceName}" not found`];
    }
    if (podList.length === 0) {
      return ['No pods found.'];
    }
    const header = padRow(['NAME', 'STATUS', 'RESTARTS', 'NODE', 'IMAGE']);
    const rows = podList.map((p) => {
      const displayStatus = p.status.reason || p.status.phase;
      const restarts = p.status.restartCount || 0;
      const node = p.spec.nodeName || '<none>';
      return padRow([
        p.metadata.name,
        displayStatus,
        String(restarts),
        node,
        p.spec.image,
      ]);
    });
    return [header, ...rows];
  }

  if (cmd.resourceType === 'event') {
    const events = store.cluster.events;
    if (events.length === 0) {
      return ['No events found.'];
    }
    const header = padRow(['TICK', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE']);
    const rows = events.slice(-20).map((e) =>
      padRow([
        String(e.tick),
        e.type,
        e.reason,
        `${e.objectKind}/${e.objectName}`,
        e.message,
      ])
    );
    return [header, ...rows];
  }

  if (cmd.resourceType === 'node') {
    const nodeList = cmd.resourceName
      ? store.cluster.nodes.filter((n) => n.metadata.name === cmd.resourceName)
      : store.cluster.nodes;
    if (cmd.resourceName && nodeList.length === 0) {
      return [`Error: node "${cmd.resourceName}" not found`];
    }
    if (nodeList.length === 0) {
      return ['No nodes found.'];
    }
    const header = padRow(['NAME', 'STATUS', 'CAPACITY', 'ALLOCATED']);
    const rows = nodeList.map((n) =>
      padRow([
        n.metadata.name,
        n.status.conditions[0].status === 'True' ? 'Ready' : 'NotReady',
        String(n.spec.capacity.pods),
        String(n.status.allocatedPods),
      ])
    );
    return [header, ...rows];
  }

  if (cmd.resourceType === 'service') {
    const svcList = cmd.resourceName
      ? store.cluster.services.filter((s) => s.metadata.name === cmd.resourceName)
      : store.cluster.services;
    if (cmd.resourceName && svcList.length === 0) {
      return [`Error: service "${cmd.resourceName}" not found`];
    }
    if (svcList.length === 0) {
      return ['No services found.'];
    }
    const header = padRow(['NAME', 'SELECTOR', 'PORT', 'ENDPOINTS']);
    const rows = svcList.map((s) =>
      padRow([
        s.metadata.name,
        Object.entries(s.spec.selector).map(([k, v]) => `${k}=${v}`).join(','),
        String(s.spec.port),
        s.status.endpoints.length > 0 ? `${s.status.endpoints.length} ready` : '<none>',
      ])
    );
    return [header, ...rows];
  }

  return [`Error: Unknown resource type "${cmd.resourceType}"`];
}

function handleDelete(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return [`Error: Missing resource name. Usage: kubectl delete ${cmd.resourceType} <name>`];
  }

  if (cmd.resourceType === 'pod') {
    const pod = store.cluster.pods.find(
      (p) => p.metadata.name === cmd.resourceName && !p.metadata.deletionTimestamp
    );
    if (!pod) {
      return [`Error: pod "${cmd.resourceName}" not found`];
    }
    store.removePod(pod.metadata.uid);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Killing',
      objectKind: 'Pod',
      objectName: cmd.resourceName,
      message: `Deleted pod "${cmd.resourceName}"`,
    });
    return [`pod "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'deployment') {
    const dep = store.cluster.deployments.find(
      (d) => d.metadata.name === cmd.resourceName
    );
    if (!dep) {
      return [`Error: deployment "${cmd.resourceName}" not found`];
    }
    const ownedRS = store.cluster.replicaSets.filter(
      (rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid
    );
    const podUids: string[] = [];
    for (const rs of ownedRS) {
      const rsPods = store.cluster.pods.filter(
        (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
      );
      for (const p of rsPods) {
        podUids.push(p.metadata.uid);
      }
    }
    for (const uid of podUids) {
      store.removePod(uid);
    }
    for (const rs of ownedRS) {
      store.removeReplicaSet(rs.metadata.uid);
    }
    store.removeDeployment(dep.metadata.uid);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Killing',
      objectKind: 'Deployment',
      objectName: cmd.resourceName,
      message: `Deleted deployment "${cmd.resourceName}" and all owned resources`,
    });
    return [`deployment.apps "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'replicaset') {
    const rs = store.cluster.replicaSets.find(
      (r) => r.metadata.name === cmd.resourceName
    );
    if (!rs) {
      return [`Error: replicaset "${cmd.resourceName}" not found`];
    }
    const ownedPods = store.cluster.pods.filter(
      (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
    );
    for (const p of ownedPods) {
      store.removePod(p.metadata.uid);
    }
    store.removeReplicaSet(rs.metadata.uid);
    return [`replicaset.apps "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'service') {
    const svc = store.cluster.services.find(
      (s) => s.metadata.name === cmd.resourceName
    );
    if (!svc) {
      return [`Error: service "${cmd.resourceName}" not found`];
    }
    store.removeService(svc.metadata.uid);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Killing',
      objectKind: 'Service',
      objectName: cmd.resourceName,
      message: `Deleted service "${cmd.resourceName}"`,
    });
    return [`service "${cmd.resourceName}" deleted`];
  }

  return [`Error: Cannot delete resource type "${cmd.resourceType}"`];
}

function handleScale(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return [`Error: Missing resource name. Usage: kubectl scale ${cmd.resourceType} <name> --replicas=N`];
  }
  const replicas = parseInt(cmd.flags.replicas, 10);
  if (isNaN(replicas) || replicas < 0) {
    return ['Error: --replicas must be a non-negative number'];
  }

  if (cmd.resourceType === 'deployment') {
    const dep = store.cluster.deployments.find(
      (d) => d.metadata.name === cmd.resourceName
    );
    if (!dep) {
      return [`Error: deployment "${cmd.resourceName}" not found`];
    }
    store.updateDeployment(dep.metadata.uid, {
      spec: { ...dep.spec, replicas },
    });
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Scaled',
      objectKind: 'Deployment',
      objectName: cmd.resourceName,
      message: `Scaled deployment "${cmd.resourceName}" to ${replicas} replicas`,
    });
    return [`deployment.apps/${cmd.resourceName} scaled to ${replicas}`];
  }

  if (cmd.resourceType === 'replicaset') {
    const rs = store.cluster.replicaSets.find(
      (r) => r.metadata.name === cmd.resourceName
    );
    if (!rs) {
      return [`Error: replicaset "${cmd.resourceName}" not found`];
    }
    store.updateReplicaSet(rs.metadata.uid, {
      spec: { ...rs.spec, replicas },
    });
    return [`replicaset.apps/${cmd.resourceName} scaled to ${replicas}`];
  }

  return [`Error: Cannot scale resource type "${cmd.resourceType}". Supported: deployment, replicaset`];
}

function handleSetImage(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  const image = cmd.flags.image;
  if (!image) {
    return ['Error: Missing image. Usage: kubectl set image deployment/<name> <image>'];
  }
  if (cmd.resourceType !== 'deployment') {
    return ['Error: set image only supports deployments.'];
  }
  const dep = store.cluster.deployments.find(
    (d) => d.metadata.name === cmd.resourceName
  );
  if (!dep) {
    return [`Error: deployment "${cmd.resourceName}" not found`];
  }
  if (dep.spec.template.spec.image === image) {
    return [`deployment "${cmd.resourceName}" image is already ${image}`];
  }
  store.updateDeployment(dep.metadata.uid, {
    spec: {
      ...dep.spec,
      template: {
        ...dep.spec.template,
        spec: { ...dep.spec.template.spec, image },
      },
    },
  });
  store.addEvent({
    timestamp: Date.now(),
    tick: store.cluster.tick,
    type: 'Normal',
    reason: 'ImageUpdated',
    objectKind: 'Deployment',
    objectName: cmd.resourceName,
    message: `Updated image to "${image}"`,
  });
  return [`deployment.apps/${cmd.resourceName} image updated to ${image}`];
}

function handleDescribe(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return [`Error: Missing resource name. Usage: kubectl describe ${cmd.resourceType} <name>`];
  }

  // Get related events for any resource
  const getRelatedEvents = (kind: string, name: string) => {
    return store.cluster.events
      .filter((e) => e.objectKind === kind && e.objectName === name)
      .slice(-5)
      .map((e) => `  Tick ${e.tick}: ${e.type} - ${e.reason}: ${e.message}`);
  };

  if (cmd.resourceType === 'deployment') {
    const dep = store.cluster.deployments.find(
      (d) => d.metadata.name === cmd.resourceName
    );
    if (!dep) return [`Error: deployment "${cmd.resourceName}" not found`];
    const ownedRS = store.cluster.replicaSets.filter(
      (rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid && !rs.metadata.deletionTimestamp
    );
    const eventLines = getRelatedEvents('Deployment', dep.metadata.name);
    return [
      `Name:          ${dep.metadata.name}`,
      `Replicas:      ${dep.spec.replicas} desired | ${dep.status.updatedReplicas} updated | ${dep.status.replicas} total | ${dep.status.availableReplicas} available`,
      `Image:         ${dep.spec.template.spec.image}`,
      `Strategy:      RollingUpdate (maxSurge=${dep.spec.strategy.maxSurge}, maxUnavailable=${dep.spec.strategy.maxUnavailable})`,
      `Selector:      ${Object.entries(dep.spec.selector).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      `ReplicaSets:   ${ownedRS.map((rs) => `${rs.metadata.name} (${rs.spec.replicas} replicas)`).join(', ') || '<none>'}`,
      `Conditions:    ${dep.status.conditions.map((c) => `${c.type}=${c.status}`).join(', ') || '<none>'}`,
      ...(eventLines.length > 0 ? ['Events:', ...eventLines] : []),
    ];
  }

  if (cmd.resourceType === 'replicaset') {
    const rs = store.cluster.replicaSets.find(
      (r) => r.metadata.name === cmd.resourceName
    );
    if (!rs) return [`Error: replicaset "${cmd.resourceName}" not found`];
    const pods = store.cluster.pods.filter(
      (p) => p.metadata.ownerReference?.uid === rs.metadata.uid && !p.metadata.deletionTimestamp
    );
    const eventLines = getRelatedEvents('ReplicaSet', rs.metadata.name);
    return [
      `Name:          ${rs.metadata.name}`,
      `Replicas:      ${rs.spec.replicas} desired | ${pods.length} current | ${rs.status.readyReplicas} ready`,
      `Image:         ${rs.spec.template.spec.image}`,
      `Selector:      ${Object.entries(rs.spec.selector).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      `Owner:         ${rs.metadata.ownerReference ? `${rs.metadata.ownerReference.kind}/${rs.metadata.ownerReference.name}` : '<none>'}`,
      `Pods:          ${pods.map((p) => p.metadata.name).join(', ') || '<none>'}`,
      ...(eventLines.length > 0 ? ['Events:', ...eventLines] : []),
    ];
  }

  if (cmd.resourceType === 'pod') {
    const pod = store.cluster.pods.find(
      (p) => p.metadata.name === cmd.resourceName
    );
    if (!pod) return [`Error: pod "${cmd.resourceName}" not found`];
    const eventLines = getRelatedEvents('Pod', pod.metadata.name);
    const lines = [
      `Name:          ${pod.metadata.name}`,
      `Status:        ${pod.status.phase}`,
    ];
    if (pod.status.reason) {
      lines.push(`Reason:        ${pod.status.reason}`);
    }
    if (pod.status.message) {
      lines.push(`Message:       ${pod.status.message}`);
    }
    if (pod.status.restartCount) {
      lines.push(`Restarts:      ${pod.status.restartCount}`);
    }
    lines.push(
      `Image:         ${pod.spec.image}`,
      `Node:          ${pod.spec.nodeName || '<none>'}`,
      `Labels:        ${Object.entries(pod.metadata.labels).map(([k, v]) => `${k}=${v}`).join(', ') || '<none>'}`,
      `Owner:         ${pod.metadata.ownerReference ? `${pod.metadata.ownerReference.kind}/${pod.metadata.ownerReference.name}` : '<none>'}`,
    );
    if (eventLines.length > 0) {
      lines.push('Events:', ...eventLines);
    }
    return lines;
  }

  if (cmd.resourceType === 'node') {
    const node = store.cluster.nodes.find(
      (n) => n.metadata.name === cmd.resourceName
    );
    if (!node) return [`Error: node "${cmd.resourceName}" not found`];
    const podsOnNode = store.cluster.pods.filter(
      (p) => p.spec.nodeName === node.metadata.name && !p.metadata.deletionTimestamp
    );
    return [
      `Name:          ${node.metadata.name}`,
      `Status:        ${node.status.conditions[0].status === 'True' ? 'Ready' : 'NotReady'}`,
      `Capacity:      ${node.spec.capacity.pods} pods`,
      `Allocated:     ${podsOnNode.length} pods`,
      `Pods:          ${podsOnNode.map((p) => p.metadata.name).join(', ') || '<none>'}`,
    ];
  }

  if (cmd.resourceType === 'service') {
    const svc = store.cluster.services.find(
      (s) => s.metadata.name === cmd.resourceName
    );
    if (!svc) return [`Error: service "${cmd.resourceName}" not found`];
    const eventLines = getRelatedEvents('Service', svc.metadata.name);
    return [
      `Name:          ${svc.metadata.name}`,
      `Selector:      ${Object.entries(svc.spec.selector).map(([k, v]) => `${k}=${v}`).join(', ')}`,
      `Port:          ${svc.spec.port}`,
      `Endpoints:     ${svc.status.endpoints.join(', ') || '<none>'}`,
      ...(eventLines.length > 0 ? ['Events:', ...eventLines] : []),
    ];
  }

  return [`Error: Cannot describe resource type "${cmd.resourceType}"`];
}

function handleRolloutStatus(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (cmd.resourceType !== 'deployment') {
    return ['Error: rollout status only supports deployments.'];
  }
  const dep = store.cluster.deployments.find(
    (d) => d.metadata.name === cmd.resourceName
  );
  if (!dep) return [`Error: deployment "${cmd.resourceName}" not found`];

  const isComplete = dep.status.updatedReplicas === dep.spec.replicas &&
    dep.status.availableReplicas === dep.spec.replicas;

  if (isComplete) {
    return [`deployment "${cmd.resourceName}" successfully rolled out`];
  }

  return [
    `Waiting for deployment "${cmd.resourceName}" rollout to finish:`,
    `  ${dep.status.updatedReplicas} of ${dep.spec.replicas} updated replicas are available...`,
  ];
}

function handleCordon(cmd: ParsedCommand, uncordon: boolean): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return [`Error: Missing node name. Usage: kubectl ${uncordon ? 'uncordon' : 'cordon'} <node-name>`];
  }

  const node = store.cluster.nodes.find(
    (n) => n.metadata.name === cmd.resourceName
  );
  if (!node) {
    return [`Error: node "${cmd.resourceName}" not found`];
  }

  const newStatus = uncordon ? 'True' : 'False';
  const currentStatus = node.status.conditions[0].status;

  if (currentStatus === newStatus) {
    return [`node "${cmd.resourceName}" is already ${uncordon ? 'uncordoned' : 'cordoned'}`];
  }

  store.updateNode(node.metadata.uid, {
    status: {
      ...node.status,
      conditions: [{ type: 'Ready' as const, status: newStatus as 'True' | 'False' }],
    },
  });

  store.addEvent({
    timestamp: Date.now(),
    tick: store.cluster.tick,
    type: uncordon ? 'Normal' : 'Warning',
    reason: uncordon ? 'NodeReady' : 'NodeNotReady',
    objectKind: 'Node',
    objectName: cmd.resourceName,
    message: `Node "${cmd.resourceName}" marked as ${uncordon ? 'Ready' : 'NotReady'}`,
  });

  return [`node/${cmd.resourceName} ${uncordon ? 'uncordoned' : 'cordoned'}`];
}

function padRow(cols: string[]): string {
  const widths = [28, 18, 14, 14, 30];
  return cols.map((col, i) => col.padEnd(widths[i] || 20)).join('');
}

function getHelpText(): string[] {
  return [
    'Available commands:',
    '',
    '  kubectl create deployment <name> --image=<image> [--replicas=N]',
    '  kubectl create pod <name> --image=<image>',
    '  kubectl create service <name> --selector=app=myapp --port=80',
    '  kubectl get deployments|replicasets|pods|nodes|services|events [name]',
    '  kubectl describe deployment|replicaset|pod|node|service <name>',
    '  kubectl scale deployment|replicaset <name> --replicas=N',
    '  kubectl set image deployment/<name> <image>',
    '  kubectl delete deployment|replicaset|pod|service <name>',
    '  kubectl rollout status deployment/<name>',
    '  kubectl cordon <node-name>',
    '  kubectl uncordon <node-name>',
    '',
    'Shortcuts: deploy, rs, po, no, svc, ev for resource types',
    'The "kubectl" prefix is optional.',
    '',
    'Controls:',
    '  Press "Reconcile" or use Ctrl+Enter to advance one tick.',
    '  Press "Reset" to restart the current lesson.',
    '',
  ];
}
