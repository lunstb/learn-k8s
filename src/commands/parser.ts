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
};

export function parseCommand(input: string): ParsedCommand | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'No command entered.' };

  // Remove leading "kubectl" if present
  const parts = trimmed.split(/\s+/);
  let idx = 0;
  if (parts[idx] === 'kubectl') {
    idx++;
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
    return { error: 'Unknown rollout subcommand. Supported: rollout status' };
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

  const validActions = ['create', 'get', 'delete', 'scale', 'describe'];
  if (!validActions.includes(action)) {
    return { error: `Unknown command: "${action}". Try: create, get, delete, scale, set image, describe, cordon, uncordon` };
  }

  // Parse resource type
  if (idx >= parts.length) {
    if (action === 'get') {
      return { error: 'Usage: kubectl get <resource-type> [name]' };
    }
    return { error: `Missing resource type. Available: deployment, replicaset, pod, node, service, event` };
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
      return { error: `Unknown resource type: "${resourcePart}". Available: deployment (deploy), replicaset (rs), pod (po), node (no), service (svc), event (ev)` };
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
        if (idx + 1 < parts.length && !parts[idx + 1].startsWith('--')) {
          flags[flagPart] = parts[idx + 1];
          idx++;
        } else {
          flags[flagPart] = 'true';
        }
      }
    }
    idx++;
  }

  return { action, resourceType, resourceName, flags };
}
