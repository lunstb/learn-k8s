import { v4 as uuidv4 } from 'uuid';

export function generateUID(): string {
  return uuidv4().slice(0, 8);
}

export function generatePodName(baseName: string): string {
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${baseName}-${suffix}`;
}

export function generateReplicaSetName(deploymentName: string): string {
  const hash = Math.random().toString(36).substring(2, 12);
  return `${deploymentName}-${hash.slice(0, 10)}`;
}

export function labelsMatch(
  selector: Record<string, string>,
  labels: Record<string, string>
): boolean {
  return Object.entries(selector).every(
    ([key, value]) => labels[key] === value
  );
}

export function templateHash(spec: { image: string }): string {
  let hash = 0;
  const str = spec.image;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 10);
}
