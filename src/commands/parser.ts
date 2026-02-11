export interface ParsedCommand {
  action: string;
  resourceType: string;
  resourceName: string;
  flags: Record<string, string>;
}

const RESOURCE_ALIASES: Record<string, string> = {
  pod: 'pod',
  pods: 'pod',
  po: 'pod',
  replicaset: 'replicaset',
  replicasets: 'replicaset',
  rs: 'replicaset',
  deployment: 'deployment',
  deployments: 'deployment',
  deploy: 'deployment',
  event: 'event',
  events: 'event',
  ev: 'event',
  node: 'node',
  nodes: 'node',
  no: 'node',
  service: 'service',
  services: 'service',
  svc: 'service',
  namespace: 'namespace',
  namespaces: 'namespace',
  ns: 'namespace',
  configmap: 'configmap',
  configmaps: 'configmap',
  cm: 'configmap',
  secret: 'secret',
  secrets: 'secret',
  ingress: 'ingress',
  ingresses: 'ingress',
  ing: 'ingress',
  statefulset: 'statefulset',
  statefulsets: 'statefulset',
  sts: 'statefulset',
  daemonset: 'daemonset',
  daemonsets: 'daemonset',
  ds: 'daemonset',
  job: 'job',
  jobs: 'job',
  cronjob: 'cronjob',
  cronjobs: 'cronjob',
  cj: 'cronjob',
  horizontalpodautoscaler: 'hpa',
  horizontalpodautoscalers: 'hpa',
  hpa: 'hpa',
  hpas: 'hpa',
  pv: 'pv',
  persistentvolume: 'pv',
  persistentvolumes: 'pv',
  pvc: 'pvc',
  persistentvolumeclaim: 'pvc',
  persistentvolumeclaims: 'pvc',
  storageclass: 'storageclass',
  storageclasses: 'storageclass',
  sc: 'storageclass',
  pdb: 'pdb',
  poddisruptionbudget: 'pdb',
  poddisruptionbudgets: 'pdb',
  endpoints: 'endpoints',
  endpoint: 'endpoints',
  ep: 'endpoints',
};

export function parseCommand(input: string): ParsedCommand | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'No command entered.' };

  const parts = trimmed.split(/\s+/);
  let idx = 0;

  // Remove leading "kubectl" if present
  if (parts[idx] === 'kubectl') {
    idx++;
  }

  // Handle "helm" commands
  if (parts[idx] === 'helm') {
    idx++;
    if (idx >= parts.length) {
      return { error: 'Usage: helm install|list|uninstall ...' };
    }
    const helmAction = parts[idx].toLowerCase();
    idx++;

    if (helmAction === 'list' || helmAction === 'ls') {
      return { action: 'helm-list', resourceType: 'helm', resourceName: '', flags: {} };
    }

    if (helmAction === 'install') {
      if (idx >= parts.length) {
        return { error: 'Usage: helm install <release-name> <chart>' };
      }
      const releaseName = parts[idx];
      idx++;
      const chart = idx < parts.length && !parts[idx].startsWith('--') ? parts[idx] : 'nginx-chart';
      if (!parts[idx]?.startsWith('--')) idx++;
      const flags: Record<string, string> = { chart };
      while (idx < parts.length) {
        const part = parts[idx];
        if (part.startsWith('--')) {
          const flagPart = part.substring(2);
          if (flagPart.includes('=')) {
            const [key, ...rest] = flagPart.split('=');
            flags[key] = rest.join('=');
          } else if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--')) {
            flags[flagPart] = parts[idx + 1];
            idx++;
          }
        }
        idx++;
      }
      return { action: 'helm-install', resourceType: 'helm', resourceName: releaseName, flags };
    }

    if (helmAction === 'uninstall' || helmAction === 'delete') {
      if (idx >= parts.length) {
        return { error: 'Usage: helm uninstall <release-name>' };
      }
      return { action: 'helm-uninstall', resourceType: 'helm', resourceName: parts[idx], flags: {} };
    }

    return { error: `Unknown helm command: "${helmAction}". Supported: install, list, uninstall` };
  }

  if (idx >= parts.length) {
    return { error: 'No action specified. Try: create, get, delete, scale, set, describe' };
  }

  const action = parts[idx].toLowerCase();
  idx++;

  // Handle "set image" as a compound action
  if (action === 'set') {
    if (idx < parts.length && parts[idx].toLowerCase() === 'image') {
      idx++;
      if (idx >= parts.length) {
        return { error: 'Usage: kubectl set image deployment/<name> <image>' };
      }

      let resourceType: string;
      let resourceName: string;

      const resourcePart = parts[idx];
      if (resourcePart.includes('/')) {
        const [type, name] = resourcePart.split('/');
        const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
        if (!normalizedType) return { error: `Unknown resource type: ${type}` };
        resourceType = normalizedType;
        resourceName = name;
        idx++;
      } else {
        const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
        if (!normalizedType) return { error: `Unknown resource type: ${resourcePart}` };
        resourceType = normalizedType;
        idx++;
        if (idx >= parts.length) return { error: 'Missing resource name.' };
        resourceName = parts[idx];
        idx++;
      }

      if (idx >= parts.length) {
        return { error: 'Missing image specification.' };
      }

      let image = parts[idx];
      if (image.includes('=')) {
        image = image.split('=')[1];
      }

      return {
        action: 'set-image',
        resourceType,
        resourceName,
        flags: { image },
      };
    }
    return { error: `Unknown set subcommand. Supported: set image` };
  }

  // Handle "rollout" command
  if (action === 'rollout') {
    if (idx < parts.length && parts[idx].toLowerCase() === 'restart') {
      idx++;
      if (idx >= parts.length) {
        return { error: 'Usage: kubectl rollout restart deployment/<name>' };
      }
      const resourcePart = parts[idx];
      let resourceType: string;
      let resourceName: string;

      if (resourcePart.includes('/')) {
        const [type, name] = resourcePart.split('/');
        const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
        if (!normalizedType) return { error: `Unknown resource type: ${type}` };
        resourceType = normalizedType;
        resourceName = name;
      } else {
        const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
        if (!normalizedType) return { error: `Unknown resource type: ${resourcePart}` };
        resourceType = normalizedType;
        idx++;
        if (idx >= parts.length) return { error: 'Missing resource name.' };
        resourceName = parts[idx];
      }

      return {
        action: 'rollout-restart',
        resourceType,
        resourceName,
        flags: {},
      };
    }
    if (idx < parts.length && parts[idx].toLowerCase() === 'status') {
      idx++;
      if (idx >= parts.length) {
        return { error: 'Usage: kubectl rollout status deployment/<name>' };
      }
      const resourcePart = parts[idx];
      let resourceType: string;
      let resourceName: string;

      if (resourcePart.includes('/')) {
        const [type, name] = resourcePart.split('/');
        const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
        if (!normalizedType) return { error: `Unknown resource type: ${type}` };
        resourceType = normalizedType;
        resourceName = name;
      } else {
        const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
        if (!normalizedType) return { error: `Unknown resource type: ${resourcePart}` };
        resourceType = normalizedType;
        idx++;
        if (idx >= parts.length) return { error: 'Missing resource name.' };
        resourceName = parts[idx];
      }

      return {
        action: 'rollout-status',
        resourceType,
        resourceName,
        flags: {},
      };
    }
    return { error: 'Unknown rollout subcommand. Supported: rollout status, rollout restart' };
  }

  // Handle "logs" command: kubectl logs <pod-name> [--tail=N]
  if (action === 'logs') {
    if (idx >= parts.length) {
      return { error: 'Usage: kubectl logs <pod-name> [--tail=N]' };
    }
    const podName = parts[idx];
    idx++;
    const flags: Record<string, string> = {};
    while (idx < parts.length) {
      const part = parts[idx];
      if (part.startsWith('--')) {
        const flagPart = part.substring(2);
        if (flagPart.includes('=')) {
          const [key, ...rest] = flagPart.split('=');
          flags[key] = rest.join('=');
        } else if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--')) {
          flags[flagPart] = parts[idx + 1];
          idx++;
        }
      }
      idx++;
    }
    return { action: 'logs', resourceType: 'pod', resourceName: podName, flags };
  }

  // Handle "label" command: kubectl label <type> <name> key=value [key-]
  if (action === 'label') {
    if (idx >= parts.length) {
      return { error: 'Usage: kubectl label <resource-type> <name> key=value [key-]' };
    }
    const resourcePart = parts[idx];
    let resourceType: string;
    let resourceName: string;
    if (resourcePart.includes('/')) {
      const [type, name] = resourcePart.split('/');
      const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
      if (!normalizedType) return { error: `Unknown resource type: ${type}` };
      resourceType = normalizedType;
      resourceName = name;
      idx++;
    } else {
      const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
      if (!normalizedType) return { error: `Unknown resource type: ${resourcePart}` };
      resourceType = normalizedType;
      idx++;
      if (idx >= parts.length) return { error: 'Missing resource name.' };
      resourceName = parts[idx];
      idx++;
    }
    // Remaining non-flag tokens are label args (key=value or key-)
    const flags: Record<string, string> = {};
    const labelArgs: string[] = [];
    while (idx < parts.length) {
      const part = parts[idx];
      if (part.startsWith('--')) {
        const flagPart = part.substring(2);
        if (flagPart.includes('=')) {
          const [key, ...rest] = flagPart.split('=');
          flags[key] = rest.join('=');
        }
      } else {
        labelArgs.push(part);
      }
      idx++;
    }
    flags['_labels'] = labelArgs.join(',');
    return { action: 'label', resourceType, resourceName, flags };
  }

  // Handle "drain" command: kubectl drain <node-name>
  if (action === 'drain') {
    if (idx >= parts.length) {
      return { error: 'Usage: kubectl drain <node-name>' };
    }
    return { action: 'drain', resourceType: 'node', resourceName: parts[idx], flags: {} };
  }

  // Handle "taint" command: kubectl taint node <name> key=value:Effect [key:Effect-]
  if (action === 'taint') {
    if (idx >= parts.length) {
      return { error: 'Usage: kubectl taint node <name> key=value:Effect' };
    }
    // Skip optional "node" or "nodes" resource type token
    const maybetype = parts[idx].toLowerCase();
    if (maybetype === 'node' || maybetype === 'nodes' || maybetype === 'no') {
      idx++;
    }
    if (idx >= parts.length) {
      return { error: 'Missing node name.' };
    }
    const resourceName = parts[idx];
    idx++;
    // Remaining tokens are taint specs
    const taintArgs: string[] = [];
    while (idx < parts.length) {
      taintArgs.push(parts[idx]);
      idx++;
    }
    return { action: 'taint', resourceType: 'node', resourceName, flags: { '_taints': taintArgs.join(',') } };
  }

  // Handle "patch" command: kubectl patch <type> <name> --selector=key=value [--port=N]
  if (action === 'patch') {
    if (idx >= parts.length) {
      return { error: 'Usage: kubectl patch <resource-type> <name> --selector=key=value' };
    }
    const resourcePart = parts[idx];
    let resourceType: string;
    let resourceName: string;
    if (resourcePart.includes('/')) {
      const [type, name] = resourcePart.split('/');
      const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
      if (!normalizedType) return { error: `Unknown resource type: ${type}` };
      resourceType = normalizedType;
      resourceName = name;
      idx++;
    } else {
      const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
      if (!normalizedType) return { error: `Unknown resource type: ${resourcePart}` };
      resourceType = normalizedType;
      idx++;
      if (idx >= parts.length) return { error: 'Missing resource name.' };
      resourceName = parts[idx];
      idx++;
    }
    const flags: Record<string, string> = {};
    while (idx < parts.length) {
      const part = parts[idx];
      if (part.startsWith('--')) {
        const flagPart = part.substring(2);
        if (flagPart.includes('=')) {
          const [key, ...rest] = flagPart.split('=');
          flags[key] = rest.join('=');
        } else if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--')) {
          flags[flagPart] = parts[idx + 1];
          idx++;
        }
      }
      idx++;
    }
    return { action: 'patch', resourceType, resourceName, flags };
  }

  // Handle "cordon" and "uncordon" as actions
  if (action === 'cordon' || action === 'uncordon') {
    if (idx >= parts.length) {
      return { error: `Usage: kubectl ${action} <node-name>` };
    }
    return {
      action,
      resourceType: 'node',
      resourceName: parts[idx],
      flags: {},
    };
  }

  // Handle "autoscale" command
  if (action === 'autoscale') {
    if (idx >= parts.length) {
      return { error: 'Usage: kubectl autoscale deployment <name> --min=N --max=N --cpu-percent=N' };
    }
    const resourcePart = parts[idx];
    let resourceType: string;
    let resourceName: string;

    if (resourcePart.includes('/')) {
      const [type, name] = resourcePart.split('/');
      const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
      if (!normalizedType) return { error: `Unknown resource type: ${type}` };
      resourceType = normalizedType;
      resourceName = name;
      idx++;
    } else {
      const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
      if (!normalizedType) return { error: `Unknown resource type: ${resourcePart}` };
      resourceType = normalizedType;
      idx++;
      if (idx >= parts.length) return { error: 'Missing resource name.' };
      resourceName = parts[idx];
      idx++;
    }

    const flags: Record<string, string> = {};
    while (idx < parts.length) {
      const part = parts[idx];
      if (part.startsWith('--')) {
        const flagPart = part.substring(2);
        if (flagPart.includes('=')) {
          const [key, ...rest] = flagPart.split('=');
          flags[key] = rest.join('=');
        } else if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--')) {
          flags[flagPart] = parts[idx + 1];
          idx++;
        }
      }
      idx++;
    }

    return { action: 'autoscale', resourceType, resourceName, flags };
  }

  const validActions = ['create', 'get', 'delete', 'scale', 'describe', 'apply'];
  const unsupportedCommands: Record<string, string> = {
    'exec': '"kubectl exec" is not supported in this simulator. Use "kubectl logs <pod>" to inspect pod output.',
    'port-forward': '"kubectl port-forward" is not supported in this simulator. Use "kubectl get endpoints" to see service connectivity.',
    'edit': '"kubectl edit" is not supported in this simulator. Use "kubectl patch" or "kubectl set image" to modify resources.',
    'attach': '"kubectl attach" is not supported in this simulator.',
    'cp': '"kubectl cp" is not supported in this simulator.',
    'proxy': '"kubectl proxy" is not supported in this simulator.',
    'auth': '"kubectl auth" is not supported in this simulator.',
    'config': '"kubectl config" is not supported in this simulator.',
    'wait': '"kubectl wait" is not supported in this simulator. Use the Reconcile button to advance cluster state.',
    'run': '"kubectl run" is not supported. Use "kubectl create pod <name> --image=<image>" instead.',
    'expose': '"kubectl expose" is not supported. Use "kubectl create service <name> --selector=<sel> --port=<port>" instead.',
  };
  if (unsupportedCommands[action]) {
    return { error: unsupportedCommands[action] };
  }
  if (!validActions.includes(action)) {
    return { error: `Unknown command: "${action}". Supported: create, get, delete, scale, set image, describe, logs, apply, patch, label, drain, taint, cordon, uncordon, autoscale, rollout, helm` };
  }

  // Handle "apply -f -" pattern
  if (action === 'apply') {
    const flags: Record<string, string> = {};
    while (idx < parts.length) {
      const part = parts[idx];
      if (part.startsWith('--')) {
        const flagPart = part.substring(2);
        if (flagPart.includes('=')) {
          const [key, ...rest] = flagPart.split('=');
          flags[key] = rest.join('=');
        } else if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--')) {
          flags[flagPart] = parts[idx + 1];
          idx++;
        }
      } else if (part === '-f') {
        idx++;
        if (idx < parts.length) {
          flags['f'] = parts[idx];
        }
      }
      idx++;
    }
    return { action: 'apply', resourceType: '', resourceName: '', flags };
  }

  // Parse resource type
  if (idx >= parts.length) {
    if (action === 'get') {
      return { error: 'Usage: kubectl get <resource-type> [name]' };
    }
    return { error: `Missing resource type. Available: deployment, replicaset, pod, node, service, event, namespace, configmap, secret, ingress, statefulset, daemonset, job, cronjob, hpa, pv, pvc, storageclass` };
  }

  let resourceType: string;
  let resourceName = '';

  const resourcePart = parts[idx];

  // Handle type/name format (e.g., deployment/my-app)
  if (resourcePart.includes('/')) {
    const [type, name] = resourcePart.split('/');
    const normalizedType = RESOURCE_ALIASES[type.toLowerCase()];
    if (!normalizedType) return { error: `Unknown resource type: ${type}` };
    resourceType = normalizedType;
    resourceName = name;
    idx++;
  } else {
    const normalizedType = RESOURCE_ALIASES[resourcePart.toLowerCase()];
    if (!normalizedType) {
      return { error: `Unknown resource type: "${resourcePart}". Available: deployment (deploy), replicaset (rs), pod (po), node (no), service (svc), endpoints (ep), event (ev), namespace (ns), configmap (cm), secret, ingress (ing), statefulset (sts), daemonset (ds), job, cronjob (cj), hpa, pv, pvc, storageclass (sc)` };
    }
    resourceType = normalizedType;
    idx++;

    // Next non-flag token is the resource name
    if (idx < parts.length && !parts[idx].startsWith('--')) {
      resourceName = parts[idx];
      idx++;
    }
  }

  // Parse flags
  const flags: Record<string, string> = {};
  while (idx < parts.length) {
    const part = parts[idx];
    if (part.startsWith('--')) {
      const flagPart = part.substring(2);
      if (flagPart.includes('=')) {
        const [key, ...rest] = flagPart.split('=');
        flags[key] = rest.join('=');
      } else {
        if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--') && !parts[idx + 1].startsWith('-')) {
          flags[flagPart] = parts[idx + 1];
          idx++;
        } else {
          flags[flagPart] = 'true';
        }
      }
    } else if (part === '-o' && idx + 1 < parts.length) {
      flags['o'] = parts[idx + 1];
      idx++;
    }
    idx++;
  }

  return { action, resourceType, resourceName, flags };
}
