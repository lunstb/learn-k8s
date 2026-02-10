/**
 * YAML serializer for --dry-run -o yaml.
 * Converts objects to clean YAML, omitting internal simulator fields.
 */

const INTERNAL_FIELDS = new Set([
  'uid', 'creationTimestamp', 'deletionTimestamp', 'ownerReference',
  'tickCreated', 'failureMode', 'logs', 'ready', 'cpuUsage',
  'restartCount', 'reason', 'message', '_crashTick',
]);

export function toYaml(obj: unknown, indent = 0): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') {
    // Quote strings that could be ambiguous
    if (obj === '' || obj === 'true' || obj === 'false' || obj === 'null' ||
        /^\d+$/.test(obj) || /^\d+\.\d+$/.test(obj) || obj.includes(': ') || obj.includes('#')) {
      return `"${obj}"`;
    }
    return obj;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  const prefix = '  '.repeat(indent);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const lines: string[] = [];
    for (const item of obj) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item).filter(([k]) => !INTERNAL_FIELDS.has(k));
        if (entries.length === 0) {
          lines.push(`${prefix}- {}`);
        } else {
          const [firstKey, firstVal] = entries[0];
          lines.push(`${prefix}- ${firstKey}: ${toYaml(firstVal, indent + 2)}`);
          for (let i = 1; i < entries.length; i++) {
            const [k, v] = entries[i];
            const valStr = toYaml(v, indent + 2);
            if (typeof v === 'object' && v !== null) {
              lines.push(`${prefix}  ${k}:`);
              lines.push(valStr);
            } else {
              lines.push(`${prefix}  ${k}: ${valStr}`);
            }
          }
        }
      } else {
        lines.push(`${prefix}- ${toYaml(item, indent + 1)}`);
      }
    }
    return lines.join('\n');
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>).filter(
      ([k, v]) => !INTERNAL_FIELDS.has(k) && v !== undefined
    );
    if (entries.length === 0) return '{}';
    const lines: string[] = [];
    for (const [key, value] of entries) {
      if (typeof value === 'object' && value !== null) {
        const valStr = toYaml(value, indent + 1);
        if (Array.isArray(value) && value.length === 0) {
          lines.push(`${prefix}${key}: []`);
        } else if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
          lines.push(`${prefix}${key}: {}`);
        } else {
          lines.push(`${prefix}${key}:`);
          lines.push(valStr);
        }
      } else {
        lines.push(`${prefix}${key}: ${toYaml(value, indent)}`);
      }
    }
    return lines.join('\n');
  }

  return String(obj);
}

/**
 * Minimal YAML parser for kubectl apply.
 * Supports: key: value pairs, nested indentation (2-space), lists (- item),
 * nested maps in lists, quoted strings, numbers, booleans.
 * No external dependencies.
 */

type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

export function parseYaml(input: string): { [key: string]: YamlValue } {
  const lines = input.split('\n');
  return parseBlock(lines, 0, 0).value as { [key: string]: YamlValue };
}

interface ParseResult {
  value: YamlValue;
  nextLine: number;
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

function parseScalar(raw: string): string | number | boolean | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === '~') return null;
  if (trimmed === 'true' || trimmed === 'True' || trimmed === 'TRUE') return true;
  if (trimmed === 'false' || trimmed === 'False' || trimmed === 'FALSE') return false;

  // Remove surrounding quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Try number
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

  return trimmed;
}

function parseBlock(lines: string[], startLine: number, baseIndent: number): ParseResult {
  const result: { [key: string]: YamlValue } = {};
  let i = startLine;

  while (i < lines.length) {
    if (isBlankOrComment(lines[i])) {
      i++;
      continue;
    }

    const indent = getIndent(lines[i]);
    if (indent < baseIndent) break;
    if (indent > baseIndent) break; // shouldn't happen at this level

    const line = lines[i].trim();

    // Check for list item at this level
    if (line.startsWith('- ')) {
      break; // lists are handled by the caller
    }

    // Parse key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.substring(0, colonIdx).trim();
    const afterColon = line.substring(colonIdx + 1).trim();

    if (afterColon === '' || afterColon === '|' || afterColon === '>') {
      // Check if next non-blank line is a list or a nested map
      let nextI = i + 1;
      while (nextI < lines.length && isBlankOrComment(lines[nextI])) nextI++;

      if (nextI >= lines.length) {
        result[key] = null;
        i = nextI;
        continue;
      }

      const nextIndent = getIndent(lines[nextI]);
      if (nextIndent <= baseIndent) {
        result[key] = null;
        i = nextI;
        continue;
      }

      const nextLine = lines[nextI].trim();
      if (nextLine.startsWith('- ')) {
        // Parse list
        const listResult = parseList(lines, nextI, nextIndent);
        result[key] = listResult.value;
        i = listResult.nextLine;
      } else {
        // Parse nested map
        const blockResult = parseBlock(lines, nextI, nextIndent);
        result[key] = blockResult.value;
        i = blockResult.nextLine;
      }
    } else {
      // Inline value
      result[key] = parseScalar(afterColon);
      i++;
    }
  }

  return { value: result, nextLine: i };
}

function parseList(lines: string[], startLine: number, baseIndent: number): ParseResult {
  const result: YamlValue[] = [];
  let i = startLine;

  while (i < lines.length) {
    if (isBlankOrComment(lines[i])) {
      i++;
      continue;
    }

    const indent = getIndent(lines[i]);
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      i++;
      continue;
    }

    const line = lines[i].trim();
    if (!line.startsWith('- ')) break;

    const afterDash = line.substring(2).trim();

    if (afterDash === '') {
      // Nested content under list item
      let nextI = i + 1;
      while (nextI < lines.length && isBlankOrComment(lines[nextI])) nextI++;

      if (nextI < lines.length) {
        const nextIndent = getIndent(lines[nextI]);
        if (nextIndent > baseIndent) {
          const blockResult = parseBlock(lines, nextI, nextIndent);
          result.push(blockResult.value);
          i = blockResult.nextLine;
          continue;
        }
      }
      result.push(null);
      i++;
    } else if (afterDash.includes(':')) {
      // Inline map in list item: "- name: web"
      // Parse this line and any continuation lines at indent+2
      const mapObj: { [key: string]: YamlValue } = {};
      const colonIdx = afterDash.indexOf(':');
      const key = afterDash.substring(0, colonIdx).trim();
      const val = afterDash.substring(colonIdx + 1).trim();

      if (val === '') {
        // Value is a nested block
        let nextI = i + 1;
        while (nextI < lines.length && isBlankOrComment(lines[nextI])) nextI++;
        if (nextI < lines.length) {
          const nextIndent = getIndent(lines[nextI]);
          if (nextIndent > baseIndent) {
            const blockResult = parseBlock(lines, nextI, nextIndent);
            mapObj[key] = blockResult.value;
            i = blockResult.nextLine;
          } else {
            mapObj[key] = null;
            i++;
          }
        } else {
          mapObj[key] = null;
          i++;
        }
      } else {
        mapObj[key] = parseScalar(val);
        i++;
      }

      // Continue parsing additional keys at indent baseIndent + 2
      const continuationIndent = baseIndent + 2;
      while (i < lines.length) {
        if (isBlankOrComment(lines[i])) {
          i++;
          continue;
        }
        const nextInd = getIndent(lines[i]);
        if (nextInd < continuationIndent) break;
        if (nextInd > continuationIndent) {
          // This is a nested block of a previous key - skip (already handled)
          i++;
          continue;
        }
        const contLine = lines[i].trim();
        if (contLine.startsWith('- ')) break; // new list item

        const cColonIdx = contLine.indexOf(':');
        if (cColonIdx === -1) {
          i++;
          continue;
        }
        const cKey = contLine.substring(0, cColonIdx).trim();
        const cVal = contLine.substring(cColonIdx + 1).trim();

        if (cVal === '') {
          // Nested block value
          let nextI = i + 1;
          while (nextI < lines.length && isBlankOrComment(lines[nextI])) nextI++;
          if (nextI < lines.length) {
            const nextIndent = getIndent(lines[nextI]);
            if (nextIndent > continuationIndent) {
              const nextTrimmed = lines[nextI].trim();
              if (nextTrimmed.startsWith('- ')) {
                const listResult = parseList(lines, nextI, nextIndent);
                mapObj[cKey] = listResult.value;
                i = listResult.nextLine;
              } else {
                const blockResult = parseBlock(lines, nextI, nextIndent);
                mapObj[cKey] = blockResult.value;
                i = blockResult.nextLine;
              }
            } else {
              mapObj[cKey] = null;
              i = nextI;
            }
          } else {
            mapObj[cKey] = null;
            i = nextI;
          }
        } else {
          mapObj[cKey] = parseScalar(cVal);
          i++;
        }
      }

      result.push(mapObj);
    } else {
      // Simple scalar list item
      result.push(parseScalar(afterDash));
      i++;
    }
  }

  return { value: result, nextLine: i };
}
