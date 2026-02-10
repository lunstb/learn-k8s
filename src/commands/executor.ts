import { useSimulatorStore } from '../simulation/store';
import { parseCommand } from './parser';
import type { ParsedCommand } from './parser';
import type { Deployment, Pod, Service, Namespace, ConfigMap, Secret, Ingress, StatefulSet, DaemonSet, Job, CronJob, HorizontalPodAutoscaler } from '../simulation/types';
import { generateUID } from '../simulation/utils';
import { parseYaml } from './yaml-parser';

export function executeCommand(input: string): string[] {
  const store = useSimulatorStore.getState();

  // Handle special commands
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'help' || lower === 'kubectl help') {
    return getHelpText();
  }
  if (lower === 'clear') {
    store.clearOutput();
    return [];
  }
  if (lower === 'hint') {
    store.revealNextHint();
    return [];
  }

  // Auto-detect bare YAML pasting (multi-line starting with apiVersion: or kind:)
  if (trimmed.includes('\n') && /^(apiVersion|kind)\s*:/m.test(trimmed)) {
    return handleApplyYaml(trimmed);
  }

  // Handle "kubectl apply -f -" with YAML content after the command
  if (/^(kubectl\s+)?apply\s+-f\s+-\s*\n/i.test(trimmed)) {
    const yamlStart = trimmed.indexOf('\n');
    const yamlContent = trimmed.substring(yamlStart + 1);
    return handleApplyYaml(yamlContent);
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
    case 'helm-install':
      return handleHelmInstall(cmd);
    case 'helm-list':
      return handleHelmList();
    case 'helm-uninstall':
      return handleHelmUninstall(cmd);
    case 'autoscale':
      return handleAutoscale(cmd);
    case 'logs':
      return handleLogs(cmd);
    case 'apply':
      return handleApply(cmd);
    case 'label':
      return handleLabel(cmd);
    case 'drain':
      return handleDrain(cmd);
    case 'taint':
      return handleTaint(cmd);
    case 'patch':
      return handlePatch(cmd);
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

  if (cmd.resourceType === 'namespace') {
    if (!cmd.resourceName) {
      return ['Error: Missing namespace name. Usage: kubectl create namespace <name>'];
    }
    if (store.cluster.namespaces.find((n) => n.metadata.name === cmd.resourceName)) {
      return [`Error: namespace "${cmd.resourceName}" already exists`];
    }
    const ns: Namespace = {
      kind: 'Namespace',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: { name: cmd.resourceName },
        creationTimestamp: Date.now(),
      },
      status: { phase: 'Active' },
    };
    store.addNamespace(ns);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Namespace',
      objectName: cmd.resourceName,
      message: `Created namespace "${cmd.resourceName}"`,
    });
    return [`namespace/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'configmap') {
    if (!cmd.resourceName) {
      return ['Error: Missing configmap name. Usage: kubectl create configmap <name> --from-literal=key=val'];
    }
    if (store.cluster.configMaps.find((c) => c.metadata.name === cmd.resourceName)) {
      return [`Error: configmap "${cmd.resourceName}" already exists`];
    }
    const data: Record<string, string> = {};
    const fromLiteral = cmd.flags['from-literal'];
    if (fromLiteral) {
      const eqIdx = fromLiteral.indexOf('=');
      if (eqIdx > 0) {
        data[fromLiteral.substring(0, eqIdx)] = fromLiteral.substring(eqIdx + 1);
      }
    }
    const cm: ConfigMap = {
      kind: 'ConfigMap',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: {},
        creationTimestamp: Date.now(),
      },
      data,
    };
    store.addConfigMap(cm);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'ConfigMap',
      objectName: cmd.resourceName,
      message: `Created configmap "${cmd.resourceName}"`,
    });
    return [`configmap/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'secret') {
    if (!cmd.resourceName) {
      return ['Error: Missing secret name. Usage: kubectl create secret generic <name> --from-literal=key=val'];
    }
    if (store.cluster.secrets.find((s) => s.metadata.name === cmd.resourceName)) {
      return [`Error: secret "${cmd.resourceName}" already exists`];
    }
    const data: Record<string, string> = {};
    const fromLiteral = cmd.flags['from-literal'];
    if (fromLiteral) {
      const eqIdx = fromLiteral.indexOf('=');
      if (eqIdx > 0) {
        data[fromLiteral.substring(0, eqIdx)] = btoa(fromLiteral.substring(eqIdx + 1));
      }
    }
    const secret: Secret = {
      kind: 'Secret',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: {},
        creationTimestamp: Date.now(),
      },
      type: 'Opaque',
      data,
    };
    store.addSecret(secret);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Secret',
      objectName: cmd.resourceName,
      message: `Created secret "${cmd.resourceName}"`,
    });
    return [`secret/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'ingress') {
    if (!cmd.resourceName) {
      return ['Error: Missing ingress name. Usage: kubectl create ingress <name> --rule=host/path=svc:port'];
    }
    if (store.cluster.ingresses.find((i) => i.metadata.name === cmd.resourceName)) {
      return [`Error: ingress "${cmd.resourceName}" already exists`];
    }
    const ruleStr = cmd.flags.rule || '';
    const rules: Ingress['spec']['rules'] = [];
    if (ruleStr) {
      // Parse "host/path=svc:port"
      const eqIdx = ruleStr.indexOf('=');
      if (eqIdx > 0) {
        const hostPath = ruleStr.substring(0, eqIdx);
        const svcPort = ruleStr.substring(eqIdx + 1);
        const slashIdx = hostPath.indexOf('/');
        const host = slashIdx > 0 ? hostPath.substring(0, slashIdx) : hostPath;
        const path = slashIdx > 0 ? hostPath.substring(slashIdx) : '/';
        const colonIdx = svcPort.indexOf(':');
        const serviceName = colonIdx > 0 ? svcPort.substring(0, colonIdx) : svcPort;
        const servicePort = colonIdx > 0 ? parseInt(svcPort.substring(colonIdx + 1), 10) : 80;
        rules.push({ host, path, serviceName, servicePort });
      }
    }
    const ing: Ingress = {
      kind: 'Ingress',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: {},
        creationTimestamp: Date.now(),
      },
      spec: { rules },
      status: { loadBalancer: { ip: '10.0.0.1' } },
    };
    store.addIngress(ing);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Ingress',
      objectName: cmd.resourceName,
      message: `Created ingress "${cmd.resourceName}"`,
    });
    return [`ingress.networking.k8s.io/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'statefulset') {
    if (!cmd.resourceName) {
      return ['Error: Missing statefulset name. Usage: kubectl create statefulset <name> --image=<image> [--replicas=N]'];
    }
    if (store.cluster.statefulSets.find((s) => s.metadata.name === cmd.resourceName)) {
      return [`Error: statefulset "${cmd.resourceName}" already exists`];
    }
    const image = cmd.flags.image || 'nginx';
    const replicas = parseInt(cmd.flags.replicas || '1', 10);
    const sts: StatefulSet = {
      kind: 'StatefulSet',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: { app: cmd.resourceName },
        creationTimestamp: Date.now(),
      },
      spec: {
        replicas,
        selector: { app: cmd.resourceName },
        serviceName: cmd.resourceName,
        template: {
          labels: { app: cmd.resourceName },
          spec: { image },
        },
      },
      status: { replicas: 0, readyReplicas: 0, currentReplicas: 0 },
    };
    store.addStatefulSet(sts);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'StatefulSet',
      objectName: cmd.resourceName,
      message: `Created statefulset "${cmd.resourceName}" with ${replicas} replicas`,
    });
    return [`statefulset.apps/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'daemonset') {
    if (!cmd.resourceName) {
      return ['Error: Missing daemonset name. Usage: kubectl create daemonset <name> --image=<image>'];
    }
    if (store.cluster.daemonSets.find((d) => d.metadata.name === cmd.resourceName)) {
      return [`Error: daemonset "${cmd.resourceName}" already exists`];
    }
    const image = cmd.flags.image || 'nginx';
    const ds: DaemonSet = {
      kind: 'DaemonSet',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: { app: cmd.resourceName },
        creationTimestamp: Date.now(),
      },
      spec: {
        selector: { app: cmd.resourceName },
        template: {
          labels: { app: cmd.resourceName },
          spec: { image },
        },
      },
      status: { desiredNumberScheduled: 0, currentNumberScheduled: 0, numberReady: 0 },
    };
    store.addDaemonSet(ds);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'DaemonSet',
      objectName: cmd.resourceName,
      message: `Created daemonset "${cmd.resourceName}"`,
    });
    return [`daemonset.apps/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'job') {
    if (!cmd.resourceName) {
      return ['Error: Missing job name. Usage: kubectl create job <name> --image=<image> [--completions=N]'];
    }
    if (store.cluster.jobs.find((j) => j.metadata.name === cmd.resourceName)) {
      return [`Error: job "${cmd.resourceName}" already exists`];
    }
    const image = cmd.flags.image || 'busybox';
    const completions = parseInt(cmd.flags.completions || '1', 10);
    const parallelism = parseInt(cmd.flags.parallelism || '1', 10);
    const job: Job = {
      kind: 'Job',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: { 'job-name': cmd.resourceName },
        creationTimestamp: Date.now(),
      },
      spec: {
        completions,
        parallelism,
        backoffLimit: 6,
        template: {
          labels: { 'job-name': cmd.resourceName },
          spec: { image, completionTicks: 2, restartPolicy: 'Never' },
        },
      },
      status: { succeeded: 0, failed: 0, active: 0, startTime: store.cluster.tick },
    };
    store.addJob(job);
    store.addEvent({
      timestamp: Date.now(),
      tick: store.cluster.tick,
      type: 'Normal',
      reason: 'Created',
      objectKind: 'Job',
      objectName: cmd.resourceName,
      message: `Created job "${cmd.resourceName}" with ${completions} completions`,
    });
    return [`job.batch/${cmd.resourceName} created`];
  }

  if (cmd.resourceType === 'cronjob') {
    if (!cmd.resourceName) {
      return ['Error: Missing cronjob name. Usage: kubectl create cronjob <name> --image=<image> --schedule="*/5 * * * *"'];
    }
    if (store.cluster.cronJobs.find((c) => c.metadata.name === cmd.resourceName)) {
      return [`Error: cronjob "${cmd.resourceName}" already exists`];
    }
    const image = cmd.flags.image || 'busybox';
    const schedule = cmd.flags.schedule || '*/5 * * * *';
    const store2 = useSimulatorStore.getState();
    store2.addCronJob({
      kind: 'CronJob',
      metadata: {
        name: cmd.resourceName,
        uid: generateUID(),
        labels: { 'cronjob-name': cmd.resourceName },
        creationTimestamp: Date.now(),
      },
      spec: {
        schedule,
        jobTemplate: {
          spec: {
            completions: 1,
            parallelism: 1,
            backoffLimit: 6,
            template: {
              labels: { 'job-name': cmd.resourceName },
              spec: { image, completionTicks: 2, restartPolicy: 'Never' },
            },
          },
        },
      },
      status: { active: 0 },
    });
    return [`cronjob.batch/${cmd.resourceName} created`];
  }

  return [`Error: Cannot create resource type "${cmd.resourceType}". Supported: deployment, pod, service, namespace, configmap, secret, ingress, statefulset, daemonset, job, cronjob`];
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

  if (cmd.resourceType === 'namespace') {
    const nsList = cmd.resourceName
      ? store.cluster.namespaces.filter((n) => n.metadata.name === cmd.resourceName)
      : store.cluster.namespaces;
    if (cmd.resourceName && nsList.length === 0) {
      return [`Error: namespace "${cmd.resourceName}" not found`];
    }
    if (nsList.length === 0) {
      return ['No namespaces found.'];
    }
    const header = padRow(['NAME', 'STATUS']);
    const rows = nsList.map((n) => padRow([n.metadata.name, n.status.phase]));
    return [header, ...rows];
  }

  if (cmd.resourceType === 'configmap') {
    const cmList = cmd.resourceName
      ? store.cluster.configMaps.filter((c) => c.metadata.name === cmd.resourceName)
      : store.cluster.configMaps;
    if (cmd.resourceName && cmList.length === 0) {
      return [`Error: configmap "${cmd.resourceName}" not found`];
    }
    if (cmList.length === 0) {
      return ['No configmaps found.'];
    }
    const header = padRow(['NAME', 'DATA']);
    const rows = cmList.map((c) => padRow([c.metadata.name, String(Object.keys(c.data).length)]));
    return [header, ...rows];
  }

  if (cmd.resourceType === 'secret') {
    const secretList = cmd.resourceName
      ? store.cluster.secrets.filter((s) => s.metadata.name === cmd.resourceName)
      : store.cluster.secrets;
    if (cmd.resourceName && secretList.length === 0) {
      return [`Error: secret "${cmd.resourceName}" not found`];
    }
    if (secretList.length === 0) {
      return ['No secrets found.'];
    }
    const header = padRow(['NAME', 'TYPE', 'DATA']);
    const rows = secretList.map((s) => padRow([s.metadata.name, s.type, String(Object.keys(s.data).length)]));
    return [header, ...rows];
  }

  if (cmd.resourceType === 'ingress') {
    const ingList = cmd.resourceName
      ? store.cluster.ingresses.filter((i) => i.metadata.name === cmd.resourceName)
      : store.cluster.ingresses;
    if (cmd.resourceName && ingList.length === 0) {
      return [`Error: ingress "${cmd.resourceName}" not found`];
    }
    if (ingList.length === 0) {
      return ['No ingresses found.'];
    }
    const header = padRow(['NAME', 'HOSTS', 'ADDRESS']);
    const rows = ingList.map((i) => {
      const hosts = i.spec.rules.map((r) => r.host).join(',') || '*';
      const address = i.status.loadBalancer?.ip || '<pending>';
      return padRow([i.metadata.name, hosts, address]);
    });
    return [header, ...rows];
  }

  if (cmd.resourceType === 'statefulset') {
    const stsList = cmd.resourceName
      ? store.cluster.statefulSets.filter((s) => s.metadata.name === cmd.resourceName)
      : store.cluster.statefulSets;
    if (cmd.resourceName && stsList.length === 0) {
      return [`Error: statefulset "${cmd.resourceName}" not found`];
    }
    if (stsList.length === 0) {
      return ['No statefulsets found.'];
    }
    const header = padRow(['NAME', 'READY', 'IMAGE']);
    const rows = stsList.map((s) =>
      padRow([s.metadata.name, `${s.status.readyReplicas}/${s.spec.replicas}`, s.spec.template.spec.image])
    );
    return [header, ...rows];
  }

  if (cmd.resourceType === 'daemonset') {
    const dsList = cmd.resourceName
      ? store.cluster.daemonSets.filter((d) => d.metadata.name === cmd.resourceName)
      : store.cluster.daemonSets;
    if (cmd.resourceName && dsList.length === 0) {
      return [`Error: daemonset "${cmd.resourceName}" not found`];
    }
    if (dsList.length === 0) {
      return ['No daemonsets found.'];
    }
    const header = padRow(['NAME', 'DESIRED', 'CURRENT', 'READY']);
    const rows = dsList.map((d) =>
      padRow([
        d.metadata.name,
        String(d.status.desiredNumberScheduled),
        String(d.status.currentNumberScheduled),
        String(d.status.numberReady),
      ])
    );
    return [header, ...rows];
  }

  if (cmd.resourceType === 'job') {
    const jobList = cmd.resourceName
      ? store.cluster.jobs.filter((j) => j.metadata.name === cmd.resourceName)
      : store.cluster.jobs;
    if (cmd.resourceName && jobList.length === 0) {
      return [`Error: job "${cmd.resourceName}" not found`];
    }
    if (jobList.length === 0) {
      return ['No jobs found.'];
    }
    const header = padRow(['NAME', 'COMPLETIONS', 'ACTIVE', 'STATUS']);
    const rows = jobList.map((j) => {
      const status = j.status.completionTime ? 'Complete' : 'Running';
      return padRow([
        j.metadata.name,
        `${j.status.succeeded}/${j.spec.completions}`,
        String(j.status.active),
        status,
      ]);
    });
    return [header, ...rows];
  }

  if (cmd.resourceType === 'cronjob') {
    const cjList = cmd.resourceName
      ? store.cluster.cronJobs.filter((c) => c.metadata.name === cmd.resourceName)
      : store.cluster.cronJobs;
    if (cmd.resourceName && cjList.length === 0) {
      return [`Error: cronjob "${cmd.resourceName}" not found`];
    }
    if (cjList.length === 0) {
      return ['No cronjobs found.'];
    }
    const header = padRow(['NAME', 'SCHEDULE', 'ACTIVE', 'LAST SCHEDULE']);
    const rows = cjList.map((c) =>
      padRow([
        c.metadata.name,
        c.spec.schedule,
        String(c.status.active),
        c.status.lastScheduleTime ? `tick ${c.status.lastScheduleTime}` : '<none>',
      ])
    );
    return [header, ...rows];
  }

  if (cmd.resourceType === 'hpa') {
    const hpaList = cmd.resourceName
      ? store.cluster.hpas.filter((h) => h.metadata.name === cmd.resourceName)
      : store.cluster.hpas;
    if (cmd.resourceName && hpaList.length === 0) {
      return [`Error: hpa "${cmd.resourceName}" not found`];
    }
    if (hpaList.length === 0) {
      return ['No HPAs found.'];
    }
    const header = padRow(['NAME', 'REFERENCE', 'TARGETS', 'MINPODS', 'MAXPODS', 'REPLICAS']);
    const rows = hpaList.map((h) => {
      const cpuStr = h.status.currentCPUUtilizationPercentage !== undefined
        ? `${h.status.currentCPUUtilizationPercentage}%/${h.spec.targetCPUUtilizationPercentage}%`
        : `<unknown>/${h.spec.targetCPUUtilizationPercentage}%`;
      return padRow([
        h.metadata.name,
        `${h.spec.scaleTargetRef.kind}/${h.spec.scaleTargetRef.name}`,
        cpuStr,
        String(h.spec.minReplicas),
        String(h.spec.maxReplicas),
        String(h.status.currentReplicas),
      ]);
    });
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

  if (cmd.resourceType === 'namespace') {
    const ns = store.cluster.namespaces.find((n) => n.metadata.name === cmd.resourceName);
    if (!ns) return [`Error: namespace "${cmd.resourceName}" not found`];
    store.removeNamespace(ns.metadata.uid);
    return [`namespace "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'configmap') {
    const cm = store.cluster.configMaps.find((c) => c.metadata.name === cmd.resourceName);
    if (!cm) return [`Error: configmap "${cmd.resourceName}" not found`];
    store.removeConfigMap(cm.metadata.uid);
    return [`configmap "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'secret') {
    const secret = store.cluster.secrets.find((s) => s.metadata.name === cmd.resourceName);
    if (!secret) return [`Error: secret "${cmd.resourceName}" not found`];
    store.removeSecret(secret.metadata.uid);
    return [`secret "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'ingress') {
    const ing = store.cluster.ingresses.find((i) => i.metadata.name === cmd.resourceName);
    if (!ing) return [`Error: ingress "${cmd.resourceName}" not found`];
    store.removeIngress(ing.metadata.uid);
    return [`ingress "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'statefulset') {
    const sts = store.cluster.statefulSets.find((s) => s.metadata.name === cmd.resourceName);
    if (!sts) return [`Error: statefulset "${cmd.resourceName}" not found`];
    const ownedPods = store.cluster.pods.filter((p) => p.metadata.ownerReference?.uid === sts.metadata.uid);
    for (const p of ownedPods) store.removePod(p.metadata.uid);
    store.removeStatefulSet(sts.metadata.uid);
    return [`statefulset.apps "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'daemonset') {
    const ds = store.cluster.daemonSets.find((d) => d.metadata.name === cmd.resourceName);
    if (!ds) return [`Error: daemonset "${cmd.resourceName}" not found`];
    const ownedPods = store.cluster.pods.filter((p) => p.metadata.ownerReference?.uid === ds.metadata.uid);
    for (const p of ownedPods) store.removePod(p.metadata.uid);
    store.removeDaemonSet(ds.metadata.uid);
    return [`daemonset.apps "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'job') {
    const job = store.cluster.jobs.find((j) => j.metadata.name === cmd.resourceName);
    if (!job) return [`Error: job "${cmd.resourceName}" not found`];
    const ownedPods = store.cluster.pods.filter((p) => p.metadata.ownerReference?.uid === job.metadata.uid);
    for (const p of ownedPods) store.removePod(p.metadata.uid);
    store.removeJob(job.metadata.uid);
    return [`job.batch "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'cronjob') {
    const cj = store.cluster.cronJobs.find((c) => c.metadata.name === cmd.resourceName);
    if (!cj) return [`Error: cronjob "${cmd.resourceName}" not found`];
    store.removeCronJob(cj.metadata.uid);
    return [`cronjob.batch "${cmd.resourceName}" deleted`];
  }

  if (cmd.resourceType === 'hpa') {
    const hpa = store.cluster.hpas.find((h) => h.metadata.name === cmd.resourceName);
    if (!hpa) return [`Error: hpa "${cmd.resourceName}" not found`];
    store.removeHPA(hpa.metadata.uid);
    return [`horizontalpodautoscaler.autoscaling "${cmd.resourceName}" deleted`];
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

  if (cmd.resourceType === 'statefulset') {
    const sts = store.cluster.statefulSets.find((s) => s.metadata.name === cmd.resourceName);
    if (!sts) return [`Error: statefulset "${cmd.resourceName}" not found`];
    store.updateStatefulSet(sts.metadata.uid, { spec: { ...sts.spec, replicas } });
    return [`statefulset.apps/${cmd.resourceName} scaled to ${replicas}`];
  }

  return [`Error: Cannot scale resource type "${cmd.resourceType}". Supported: deployment, replicaset, statefulset`];
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
    if (pod.status.ready !== undefined) {
      lines.push(`Ready:         ${pod.status.ready}`);
    }
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

  if (cmd.resourceType === 'configmap') {
    const cm = store.cluster.configMaps.find((c) => c.metadata.name === cmd.resourceName);
    if (!cm) return [`Error: configmap "${cmd.resourceName}" not found`];
    const lines = [`Name:          ${cm.metadata.name}`, `Data:`];
    for (const [key, value] of Object.entries(cm.data)) {
      lines.push(`  ${key}: ${value}`);
    }
    return lines;
  }

  if (cmd.resourceType === 'secret') {
    const secret = store.cluster.secrets.find((s) => s.metadata.name === cmd.resourceName);
    if (!secret) return [`Error: secret "${cmd.resourceName}" not found`];
    const lines = [`Name:          ${secret.metadata.name}`, `Type:          ${secret.type}`, `Data:`];
    for (const key of Object.keys(secret.data)) {
      lines.push(`  ${key}: ***`);
    }
    return lines;
  }

  if (cmd.resourceType === 'statefulset') {
    const sts = store.cluster.statefulSets.find((s) => s.metadata.name === cmd.resourceName);
    if (!sts) return [`Error: statefulset "${cmd.resourceName}" not found`];
    const pods = store.cluster.pods.filter((p) => p.metadata.ownerReference?.uid === sts.metadata.uid);
    return [
      `Name:          ${sts.metadata.name}`,
      `Replicas:      ${sts.spec.replicas} desired | ${sts.status.currentReplicas} current | ${sts.status.readyReplicas} ready`,
      `Image:         ${sts.spec.template.spec.image}`,
      `ServiceName:   ${sts.spec.serviceName}`,
      `Pods:          ${pods.map((p) => p.metadata.name).join(', ') || '<none>'}`,
    ];
  }

  if (cmd.resourceType === 'daemonset') {
    const ds = store.cluster.daemonSets.find((d) => d.metadata.name === cmd.resourceName);
    if (!ds) return [`Error: daemonset "${cmd.resourceName}" not found`];
    return [
      `Name:          ${ds.metadata.name}`,
      `Desired:       ${ds.status.desiredNumberScheduled}`,
      `Current:       ${ds.status.currentNumberScheduled}`,
      `Ready:         ${ds.status.numberReady}`,
      `Image:         ${ds.spec.template.spec.image}`,
    ];
  }

  if (cmd.resourceType === 'job') {
    const job = store.cluster.jobs.find((j) => j.metadata.name === cmd.resourceName);
    if (!job) return [`Error: job "${cmd.resourceName}" not found`];
    return [
      `Name:          ${job.metadata.name}`,
      `Completions:   ${job.status.succeeded}/${job.spec.completions}`,
      `Parallelism:   ${job.spec.parallelism}`,
      `Active:        ${job.status.active}`,
      `Failed:        ${job.status.failed}`,
      `Image:         ${job.spec.template.spec.image}`,
      `Status:        ${job.status.completionTime ? 'Complete' : 'Running'}`,
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

function handleHelmInstall(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  const releaseName = cmd.resourceName;
  const chart = cmd.flags.chart || 'nginx-chart';

  if (store.cluster.helmReleases.find((r) => r.name === releaseName)) {
    return [`Error: cannot re-use a name that is still in use`];
  }

  const deploymentName = `${releaseName}-${chart.replace('-chart', '')}`;

  // Create deployment for the helm release
  const dep: Deployment = {
    kind: 'Deployment',
    metadata: {
      name: deploymentName,
      uid: generateUID(),
      labels: { app: deploymentName, 'helm-release': releaseName },
      creationTimestamp: Date.now(),
    },
    spec: {
      replicas: parseInt(cmd.flags.replicas || '2', 10),
      selector: { app: deploymentName },
      template: {
        labels: { app: deploymentName, 'helm-release': releaseName },
        spec: { image: cmd.flags.image || 'nginx:latest' },
      },
      strategy: { type: 'RollingUpdate', maxSurge: 1, maxUnavailable: 1 },
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
  store.addHelmRelease({
    name: releaseName,
    chart,
    status: 'deployed',
    deploymentName,
  });

  return [
    `NAME: ${releaseName}`,
    `STATUS: deployed`,
    `CHART: ${chart}`,
    ``,
    `deployment.apps/${deploymentName} created`,
  ];
}

function handleHelmList(): string[] {
  const store = useSimulatorStore.getState();
  const releases = store.cluster.helmReleases.filter((r) => r.status === 'deployed');
  if (releases.length === 0) {
    return ['No releases found.'];
  }
  const header = padRow(['NAME', 'CHART', 'STATUS']);
  const rows = releases.map((r) => padRow([r.name, r.chart, r.status]));
  return [header, ...rows];
}

function handleHelmUninstall(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  const release = store.cluster.helmReleases.find(
    (r) => r.name === cmd.resourceName && r.status === 'deployed'
  );
  if (!release) {
    return [`Error: release "${cmd.resourceName}" not found`];
  }

  // Delete the associated deployment
  const dep = store.cluster.deployments.find(
    (d) => d.metadata.name === release.deploymentName
  );
  if (dep) {
    const ownedRS = store.cluster.replicaSets.filter(
      (rs) => rs.metadata.ownerReference?.uid === dep.metadata.uid
    );
    for (const rs of ownedRS) {
      const rsPods = store.cluster.pods.filter(
        (p) => p.metadata.ownerReference?.uid === rs.metadata.uid
      );
      for (const p of rsPods) store.removePod(p.metadata.uid);
      store.removeReplicaSet(rs.metadata.uid);
    }
    store.removeDeployment(dep.metadata.uid);
  }

  store.removeHelmRelease(release.name);
  return [`release "${cmd.resourceName}" uninstalled`];
}

function handleAutoscale(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (cmd.resourceType !== 'deployment') {
    return ['Error: autoscale only supports deployments.'];
  }

  const dep = store.cluster.deployments.find((d) => d.metadata.name === cmd.resourceName);
  if (!dep) return [`Error: deployment "${cmd.resourceName}" not found`];

  const min = parseInt(cmd.flags.min || '1', 10);
  const max = parseInt(cmd.flags.max || '10', 10);
  const cpuPercent = parseInt(cmd.flags['cpu-percent'] || '80', 10);

  const hpa: HorizontalPodAutoscaler = {
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: cmd.resourceName,
      uid: generateUID(),
      labels: {},
      creationTimestamp: Date.now(),
    },
    spec: {
      scaleTargetRef: { kind: 'Deployment', name: cmd.resourceName },
      minReplicas: min,
      maxReplicas: max,
      targetCPUUtilizationPercentage: cpuPercent,
    },
    status: {
      currentReplicas: dep.spec.replicas,
      desiredReplicas: dep.spec.replicas,
    },
  };

  store.addHPA(hpa);
  return [`horizontalpodautoscaler.autoscaling/${cmd.resourceName} autoscaled`];
}

function handleLogs(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return ['Error: Missing pod name. Usage: kubectl logs <pod-name> [--tail=N]'];
  }
  const pod = store.cluster.pods.find(
    (p) => p.metadata.name === cmd.resourceName && !p.metadata.deletionTimestamp
  );
  if (!pod) {
    return [`Error: pod "${cmd.resourceName}" not found`];
  }
  const logs = pod.spec.logs || [];
  if (logs.length === 0) {
    return [`(no logs available for pod "${cmd.resourceName}")`];
  }
  const tail = cmd.flags.tail ? parseInt(cmd.flags.tail, 10) : 0;
  if (tail > 0) {
    return logs.slice(-tail);
  }
  return [...logs];
}

function handleApply(_cmd: ParsedCommand): string[] {
  return ['Error: kubectl apply requires YAML input. Use: kubectl apply -f - (then paste YAML), or paste YAML directly.'];
}

function handleApplyYaml(yamlContent: string): string[] {
  try {
    const doc = parseYaml(yamlContent) as Record<string, unknown>;
    const kind = String(doc.kind || '').toLowerCase();
    const metadata = doc.metadata as Record<string, unknown> | undefined;
    const name = String(metadata?.name || '');

    if (!kind) return ['Error: YAML must include a "kind" field.'];
    if (!name) return ['Error: YAML metadata.name is required.'];

    switch (kind) {
      case 'deployment': return applyDeployment(doc, name);
      case 'pod': return applyPod(doc, name);
      case 'service': return applyService(doc, name);
      case 'configmap': return applyConfigMap(doc, name);
      case 'secret': return applySecret(doc, name);
      case 'job': return applyJob(doc, name);
      case 'cronjob': return applyCronJob(doc, name);
      case 'ingress': return applyIngress(doc, name);
      case 'statefulset': return applyStatefulSet(doc, name);
      default: return [`Error: Unsupported kind "${doc.kind}" for apply.`];
    }
  } catch (e) {
    return [`Error: Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`];
  }
}

function extractLabels(metadata: Record<string, unknown>): Record<string, string> {
  const labels = metadata?.labels as Record<string, unknown> | undefined;
  if (!labels) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) {
    result[k] = String(v ?? '');
  }
  return result;
}

function extractPodSpec(specObj: Record<string, unknown>): { image: string; readinessProbe?: import('../simulation/types').Probe; livenessProbe?: import('../simulation/types').Probe; envFrom?: { configMapRef?: string; secretRef?: string }[]; resources?: import('../simulation/types').ResourceRequirements } {
  const containers = specObj.containers as Array<Record<string, unknown>> | undefined;
  const container = containers?.[0] || specObj;
  const image = String(container.image || 'nginx');
  const result: ReturnType<typeof extractPodSpec> = { image };

  if (container.readinessProbe) {
    const probe = container.readinessProbe as Record<string, unknown>;
    const httpGet = probe.httpGet as Record<string, unknown> | undefined;
    result.readinessProbe = {
      type: httpGet ? 'httpGet' : probe.tcpSocket ? 'tcpSocket' : 'exec',
      path: httpGet ? String(httpGet.path || '/') : undefined,
      port: httpGet ? Number(httpGet.port || 80) : (probe.tcpSocket as Record<string, unknown>)?.port ? Number((probe.tcpSocket as Record<string, unknown>).port) : undefined,
      initialDelaySeconds: probe.initialDelaySeconds ? Number(probe.initialDelaySeconds) : undefined,
      periodSeconds: probe.periodSeconds ? Number(probe.periodSeconds) : undefined,
      failureThreshold: probe.failureThreshold ? Number(probe.failureThreshold) : undefined,
    };
  }

  if (container.livenessProbe) {
    const probe = container.livenessProbe as Record<string, unknown>;
    const httpGet = probe.httpGet as Record<string, unknown> | undefined;
    result.livenessProbe = {
      type: httpGet ? 'httpGet' : probe.tcpSocket ? 'tcpSocket' : 'exec',
      path: httpGet ? String(httpGet.path || '/') : undefined,
      port: httpGet ? Number(httpGet.port || 80) : undefined,
      initialDelaySeconds: probe.initialDelaySeconds ? Number(probe.initialDelaySeconds) : undefined,
      periodSeconds: probe.periodSeconds ? Number(probe.periodSeconds) : undefined,
      failureThreshold: probe.failureThreshold ? Number(probe.failureThreshold) : undefined,
    };
  }

  if (container.envFrom) {
    const envFromArr = container.envFrom as Array<Record<string, unknown>>;
    result.envFrom = envFromArr.map((e) => ({
      configMapRef: e.configMapRef ? String((e.configMapRef as Record<string, unknown>).name || '') : undefined,
      secretRef: e.secretRef ? String((e.secretRef as Record<string, unknown>).name || '') : undefined,
    }));
  }

  if (container.resources) {
    result.resources = container.resources as import('../simulation/types').ResourceRequirements;
  }

  return result;
}

function applyDeployment(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.deployments.find((d) => d.metadata.name === name);
  const spec = doc.spec as Record<string, unknown> || {};
  const template = spec.template as Record<string, unknown> || {};
  const templateMeta = template.metadata as Record<string, unknown> || {};
  const templateSpec = template.spec as Record<string, unknown> || {};
  const metadata = doc.metadata as Record<string, unknown> || {};
  const selectorObj = spec.selector as Record<string, unknown> | undefined;
  const matchLabels = (selectorObj?.matchLabels || {}) as Record<string, string>;
  const replicas = spec.replicas ? Number(spec.replicas) : 1;
  const podSpec = extractPodSpec(templateSpec);
  const templateLabels = extractLabels(templateMeta);
  const labels = extractLabels(metadata);

  if (existing) {
    store.updateDeployment(existing.metadata.uid, {
      spec: {
        ...existing.spec,
        replicas,
        selector: Object.keys(matchLabels).length > 0 ? matchLabels : existing.spec.selector,
        template: {
          labels: Object.keys(templateLabels).length > 0 ? templateLabels : existing.spec.template.labels,
          spec: { ...existing.spec.template.spec, ...podSpec },
        },
      },
    });
    return [`deployment.apps/${name} configured`];
  }

  const dep: Deployment = {
    kind: 'Deployment',
    metadata: {
      name,
      uid: generateUID(),
      labels: Object.keys(labels).length > 0 ? labels : { app: name },
      creationTimestamp: Date.now(),
    },
    spec: {
      replicas,
      selector: Object.keys(matchLabels).length > 0 ? matchLabels : { app: name },
      template: {
        labels: Object.keys(templateLabels).length > 0 ? templateLabels : { app: name },
        spec: podSpec,
      },
      strategy: { type: 'RollingUpdate', maxSurge: 1, maxUnavailable: 1 },
    },
    status: { replicas: 0, updatedReplicas: 0, readyReplicas: 0, availableReplicas: 0, conditions: [] },
  };
  store.addDeployment(dep);
  store.addEvent({
    timestamp: Date.now(), tick: store.cluster.tick,
    type: 'Normal', reason: 'Created', objectKind: 'Deployment', objectName: name,
    message: `Created deployment "${name}" with image ${podSpec.image}`,
  });
  return [`deployment.apps/${name} created`];
}

function applyPod(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.pods.find((p) => p.metadata.name === name && !p.metadata.deletionTimestamp);
  if (existing) {
    return [`pod/${name} configured (unchanged — pods are mostly immutable)`];
  }
  const spec = doc.spec as Record<string, unknown> || {};
  const metadata = doc.metadata as Record<string, unknown> || {};
  const podSpec = extractPodSpec(spec);
  const pod: Pod = {
    kind: 'Pod',
    metadata: { name, uid: generateUID(), labels: extractLabels(metadata), creationTimestamp: Date.now() },
    spec: podSpec,
    status: { phase: 'Pending', tickCreated: store.cluster.tick },
  };
  store.addPod(pod);
  return [`pod/${name} created`];
}

function applyService(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.services.find((s) => s.metadata.name === name);
  const spec = doc.spec as Record<string, unknown> || {};
  const selectorObj = spec.selector as Record<string, string> || {};
  const port = spec.port ? Number(spec.port) : (spec.ports as Array<Record<string, unknown>>)?.[0]?.port ? Number((spec.ports as Array<Record<string, unknown>>)[0].port) : 80;

  if (existing) {
    // Update selector and port
    store.removeService(existing.metadata.uid);
  }
  const svc: Service = {
    kind: 'Service',
    metadata: { name, uid: generateUID(), labels: {}, creationTimestamp: Date.now() },
    spec: { selector: selectorObj, port },
    status: { endpoints: [] },
  };
  store.addService(svc);
  return [existing ? `service/${name} configured` : `service/${name} created`];
}

function applyConfigMap(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.configMaps.find((c) => c.metadata.name === name);
  const data: Record<string, string> = {};
  if (doc.data) {
    for (const [k, v] of Object.entries(doc.data as Record<string, unknown>)) {
      data[k] = String(v ?? '');
    }
  }
  if (existing) {
    store.removeConfigMap(existing.metadata.uid);
  }
  const cm: ConfigMap = {
    kind: 'ConfigMap',
    metadata: { name, uid: generateUID(), labels: {}, creationTimestamp: Date.now() },
    data,
  };
  store.addConfigMap(cm);
  return [existing ? `configmap/${name} configured` : `configmap/${name} created`];
}

function applySecret(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.secrets.find((s) => s.metadata.name === name);
  const data: Record<string, string> = {};
  if (doc.data) {
    for (const [k, v] of Object.entries(doc.data as Record<string, unknown>)) {
      data[k] = String(v ?? '');
    }
  }
  if (existing) {
    store.removeSecret(existing.metadata.uid);
  }
  const secret: Secret = {
    kind: 'Secret',
    metadata: { name, uid: generateUID(), labels: {}, creationTimestamp: Date.now() },
    type: String(doc.type || 'Opaque'),
    data,
  };
  store.addSecret(secret);
  return [existing ? `secret/${name} configured` : `secret/${name} created`];
}

function applyJob(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.jobs.find((j) => j.metadata.name === name);
  if (existing) return [`job.batch/${name} configured (unchanged)`];
  const spec = doc.spec as Record<string, unknown> || {};
  const template = spec.template as Record<string, unknown> || {};
  const templateSpec = template.spec as Record<string, unknown> || {};
  const podSpec = extractPodSpec(templateSpec);
  const job: Job = {
    kind: 'Job',
    metadata: { name, uid: generateUID(), labels: { 'job-name': name }, creationTimestamp: Date.now() },
    spec: {
      completions: spec.completions ? Number(spec.completions) : 1,
      parallelism: spec.parallelism ? Number(spec.parallelism) : 1,
      backoffLimit: spec.backoffLimit ? Number(spec.backoffLimit) : 6,
      template: { labels: { 'job-name': name }, spec: { ...podSpec, completionTicks: 2, restartPolicy: 'Never' } },
    },
    status: { succeeded: 0, failed: 0, active: 0, startTime: store.cluster.tick },
  };
  store.addJob(job);
  return [`job.batch/${name} created`];
}

function applyCronJob(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.cronJobs.find((c) => c.metadata.name === name);
  if (existing) return [`cronjob.batch/${name} configured (unchanged)`];
  const spec = doc.spec as Record<string, unknown> || {};
  const schedule = String(spec.schedule || '*/5 * * * *');
  const jobTemplate = spec.jobTemplate as Record<string, unknown> || {};
  const jobSpec = jobTemplate.spec as Record<string, unknown> || {};
  const template = jobSpec.template as Record<string, unknown> || {};
  const templateSpec = template.spec as Record<string, unknown> || {};
  const podSpec = extractPodSpec(templateSpec);
  const cj: CronJob = {
    kind: 'CronJob',
    metadata: { name, uid: generateUID(), labels: { 'cronjob-name': name }, creationTimestamp: Date.now() },
    spec: {
      schedule,
      jobTemplate: {
        spec: {
          completions: 1, parallelism: 1, backoffLimit: 6,
          template: { labels: { 'job-name': name }, spec: { ...podSpec, completionTicks: 2, restartPolicy: 'Never' } },
        },
      },
    },
    status: { active: 0 },
  };
  store.addCronJob(cj);
  return [`cronjob.batch/${name} created`];
}

function applyIngress(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.ingresses.find((i) => i.metadata.name === name);
  const spec = doc.spec as Record<string, unknown> || {};
  const rulesArr = spec.rules as Array<Record<string, unknown>> || [];
  const rules: Ingress['spec']['rules'] = [];
  for (const rule of rulesArr) {
    const host = String(rule.host || '*');
    const http = rule.http as Record<string, unknown> | undefined;
    const paths = (http?.paths || []) as Array<Record<string, unknown>>;
    for (const pathEntry of paths) {
      const path = String(pathEntry.path || '/');
      const backend = pathEntry.backend as Record<string, unknown> | undefined;
      const svcObj = backend?.service as Record<string, unknown> | undefined;
      const serviceName = svcObj ? String(svcObj.name || '') : String(pathEntry.serviceName || '');
      const portObj = svcObj?.port as Record<string, unknown> | undefined;
      const servicePort = portObj ? Number(portObj.number || 80) : Number(pathEntry.servicePort || 80);
      rules.push({ host, path, serviceName, servicePort });
    }
    // Simple rule without http paths
    if (paths.length === 0 && rule.serviceName) {
      rules.push({ host, path: '/', serviceName: String(rule.serviceName), servicePort: Number(rule.servicePort || 80) });
    }
  }
  if (existing) {
    store.removeIngress(existing.metadata.uid);
  }
  const ing: Ingress = {
    kind: 'Ingress',
    metadata: { name, uid: generateUID(), labels: {}, creationTimestamp: Date.now() },
    spec: { rules },
    status: { loadBalancer: { ip: '10.0.0.1' } },
  };
  store.addIngress(ing);
  return [existing ? `ingress.networking.k8s.io/${name} configured` : `ingress.networking.k8s.io/${name} created`];
}

function applyStatefulSet(doc: Record<string, unknown>, name: string): string[] {
  const store = useSimulatorStore.getState();
  const existing = store.cluster.statefulSets.find((s) => s.metadata.name === name);
  if (existing) return [`statefulset.apps/${name} configured (unchanged)`];
  const spec = doc.spec as Record<string, unknown> || {};
  const template = spec.template as Record<string, unknown> || {};
  const templateSpec = template.spec as Record<string, unknown> || {};
  const podSpec = extractPodSpec(templateSpec);
  const replicas = spec.replicas ? Number(spec.replicas) : 1;
  const sts: StatefulSet = {
    kind: 'StatefulSet',
    metadata: { name, uid: generateUID(), labels: { app: name }, creationTimestamp: Date.now() },
    spec: {
      replicas,
      selector: { app: name },
      serviceName: String(spec.serviceName || name),
      template: { labels: { app: name }, spec: podSpec },
    },
    status: { replicas: 0, readyReplicas: 0, currentReplicas: 0 },
  };
  store.addStatefulSet(sts);
  return [`statefulset.apps/${name} created`];
}

function handleLabel(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return ['Error: Missing resource name. Usage: kubectl label <type> <name> key=value'];
  }
  const labelArgs = (cmd.flags['_labels'] || '').split(',').filter(Boolean);
  if (labelArgs.length === 0) {
    return ['Error: No labels specified. Usage: kubectl label <type> <name> key=value [key-]'];
  }

  // Find the resource
  type Labeled = { metadata: { uid: string; name: string; labels: Record<string, string> } };
  let resource: Labeled | undefined;
  let kindName = cmd.resourceType;

  if (cmd.resourceType === 'pod') {
    resource = store.cluster.pods.find((p) => p.metadata.name === cmd.resourceName && !p.metadata.deletionTimestamp);
  } else if (cmd.resourceType === 'deployment') {
    resource = store.cluster.deployments.find((d) => d.metadata.name === cmd.resourceName);
    kindName = 'deployment';
  } else if (cmd.resourceType === 'node') {
    resource = store.cluster.nodes.find((n) => n.metadata.name === cmd.resourceName);
  } else if (cmd.resourceType === 'service') {
    resource = store.cluster.services.find((s) => s.metadata.name === cmd.resourceName);
  } else {
    return [`Error: kubectl label does not support resource type "${cmd.resourceType}" in this simulator.`];
  }

  if (!resource) {
    return [`Error: ${cmd.resourceType} "${cmd.resourceName}" not found`];
  }

  const newLabels = { ...resource.metadata.labels };
  for (const arg of labelArgs) {
    if (arg.endsWith('-')) {
      // Remove label
      const key = arg.slice(0, -1);
      delete newLabels[key];
    } else if (arg.includes('=')) {
      const [key, ...rest] = arg.split('=');
      newLabels[key] = rest.join('=');
    }
  }

  // Update the resource labels directly
  resource.metadata.labels = newLabels;

  return [`${kindName}/${cmd.resourceName} labeled`];
}

function handleDrain(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return ['Error: Missing node name. Usage: kubectl drain <node-name>'];
  }
  const node = store.cluster.nodes.find((n) => n.metadata.name === cmd.resourceName);
  if (!node) {
    return [`Error: node "${cmd.resourceName}" not found`];
  }

  // Cordon the node (mark unschedulable)
  store.updateNode(node.metadata.uid, {
    spec: { ...node.spec, unschedulable: true },
    status: {
      ...node.status,
      conditions: [{ type: 'Ready' as const, status: 'False' as const }],
    },
  });

  // Evict all non-DaemonSet pods on this node
  const podsOnNode = store.cluster.pods.filter(
    (p) => p.spec.nodeName === cmd.resourceName && !p.metadata.deletionTimestamp
  );
  const daemonSetUids = new Set(store.cluster.daemonSets.map((ds) => ds.metadata.uid));
  const evicted: string[] = [];
  for (const pod of podsOnNode) {
    // Skip DaemonSet pods
    if (pod.metadata.ownerReference && daemonSetUids.has(pod.metadata.ownerReference.uid)) continue;
    store.removePod(pod.metadata.uid);
    evicted.push(pod.metadata.name);
    store.addEvent({
      timestamp: Date.now(), tick: store.cluster.tick,
      type: 'Normal', reason: 'Evicted', objectKind: 'Pod', objectName: pod.metadata.name,
      message: `Evicted pod "${pod.metadata.name}" from node "${cmd.resourceName}"`,
    });
  }

  store.addEvent({
    timestamp: Date.now(), tick: store.cluster.tick,
    type: 'Warning', reason: 'NodeDrained', objectKind: 'Node', objectName: cmd.resourceName,
    message: `Node "${cmd.resourceName}" drained, ${evicted.length} pod(s) evicted`,
  });

  const lines = [`node/${cmd.resourceName} cordoned`];
  for (const name of evicted) {
    lines.push(`evicting pod ${name}`);
  }
  lines.push(`node/${cmd.resourceName} drained`);
  return lines;
}

function handleTaint(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return ['Error: Missing node name. Usage: kubectl taint node <name> key=value:Effect'];
  }
  const node = store.cluster.nodes.find((n) => n.metadata.name === cmd.resourceName);
  if (!node) {
    return [`Error: node "${cmd.resourceName}" not found`];
  }

  const taintArgs = (cmd.flags['_taints'] || '').split(',').filter(Boolean);
  if (taintArgs.length === 0) {
    return ['Error: No taint specified. Usage: kubectl taint node <name> key=value:Effect'];
  }

  const taints = [...(node.spec.taints || [])];

  for (const arg of taintArgs) {
    // Removal: key:Effect- or key-
    if (arg.endsWith('-')) {
      const spec = arg.slice(0, -1);
      if (spec.includes(':')) {
        const [key, effect] = spec.split(':');
        const idx = taints.findIndex((t) => t.key === key && t.effect === effect);
        if (idx >= 0) taints.splice(idx, 1);
      } else {
        // Remove all taints with this key
        for (let i = taints.length - 1; i >= 0; i--) {
          if (taints[i].key === spec) taints.splice(i, 1);
        }
      }
    } else {
      // Add: key=value:Effect or key:Effect
      const colonIdx = arg.lastIndexOf(':');
      if (colonIdx === -1) {
        return [`Error: Invalid taint format "${arg}". Expected key=value:Effect`];
      }
      const effect = arg.substring(colonIdx + 1) as 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
      const keyValue = arg.substring(0, colonIdx);
      let key: string, value: string | undefined;
      if (keyValue.includes('=')) {
        [key, value] = keyValue.split('=');
      } else {
        key = keyValue;
      }
      // Replace existing taint with same key+effect, or add new
      const existingIdx = taints.findIndex((t) => t.key === key && t.effect === effect);
      if (existingIdx >= 0) {
        taints[existingIdx] = { key, value, effect };
      } else {
        taints.push({ key, value, effect });
      }
    }
  }

  store.updateNode(node.metadata.uid, {
    spec: { ...node.spec, taints },
  });

  return [`node/${cmd.resourceName} tainted`];
}

function handlePatch(cmd: ParsedCommand): string[] {
  const store = useSimulatorStore.getState();
  if (!cmd.resourceName) {
    return ['Error: Missing resource name. Usage: kubectl patch <type> <name> --selector=key=value'];
  }

  if (cmd.resourceType === 'service') {
    const svc = store.cluster.services.find((s) => s.metadata.name === cmd.resourceName);
    if (!svc) return [`Error: service "${cmd.resourceName}" not found`];

    let patched = false;
    if (cmd.flags['selector']) {
      const newSelector: Record<string, string> = {};
      for (const pair of cmd.flags['selector'].split(',')) {
        const [k, ...rest] = pair.split('=');
        newSelector[k] = rest.join('=');
      }
      svc.spec.selector = newSelector;
      patched = true;
    }
    if (cmd.flags['port']) {
      svc.spec.port = parseInt(cmd.flags['port'], 10);
      patched = true;
    }
    if (!patched) {
      return ['Error: Nothing to patch. Use --selector=key=value or --port=N'];
    }
    return [`service/${cmd.resourceName} patched`];
  }

  if (cmd.resourceType === 'deployment') {
    const dep = store.cluster.deployments.find((d) => d.metadata.name === cmd.resourceName);
    if (!dep) return [`Error: deployment "${cmd.resourceName}" not found`];

    let patched = false;
    if (cmd.flags['image']) {
      dep.spec.template.spec.image = cmd.flags['image'];
      patched = true;
    }
    if (!patched) {
      return ['Error: Nothing to patch. Use --image=<image>'];
    }
    return [`deployment.apps/${cmd.resourceName} patched`];
  }

  return [`Error: patch is not supported for resource type "${cmd.resourceType}". Supported: service, deployment`];
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
    '  kubectl create namespace <name>',
    '  kubectl create configmap <name> --from-literal=key=val',
    '  kubectl create secret generic <name> --from-literal=key=val',
    '  kubectl create ingress <name> --rule=host/path=svc:port',
    '  kubectl create statefulset <name> --image=<image> [--replicas=N]',
    '  kubectl create daemonset <name> --image=<image>',
    '  kubectl create job <name> --image=<image> [--completions=N]',
    '  kubectl create cronjob <name> --image=<image> --schedule="*/5 * * * *"',
    '',
    '  kubectl get deployments|pods|services|nodes|events|namespaces|...',
    '  kubectl get configmaps|secrets|ingresses|statefulsets|daemonsets|jobs|cronjobs|hpa',
    '  kubectl describe <resource-type> <name>',
    '  kubectl logs <pod-name> [--tail=N]',
    '  kubectl scale deployment|replicaset|statefulset <name> --replicas=N',
    '  kubectl set image deployment/<name> <image>',
    '  kubectl delete <resource-type> <name>',
    '  kubectl rollout status deployment/<name>',
    '  kubectl patch service <name> --selector=key=value [--port=N]',
    '  kubectl label <resource-type> <name> key=value [key-]',
    '  kubectl cordon|uncordon <node-name>',
    '  kubectl drain <node-name>',
    '  kubectl taint node <name> key=value:Effect [key:Effect-]',
    '  kubectl autoscale deployment <name> --min=N --max=N --cpu-percent=N',
    '  kubectl apply -f - (then paste YAML, or paste YAML directly)',
    '',
    '  helm install <release-name> <chart>',
    '  helm list',
    '  helm uninstall <release-name>',
    '',
    'Shortcuts: deploy, rs, po, no, svc, ev, ns, cm, ing, sts, ds, cj, hpa',
    'The "kubectl" prefix is optional.',
    '',
    'Controls:',
    '  Press "Reconcile" or use Ctrl+Enter to advance one tick.',
    '  Shift+Enter for multi-line input (YAML). Ctrl+Enter to submit.',
    '  Press "Reset" to restart the current lesson.',
    '',
  ];
}
