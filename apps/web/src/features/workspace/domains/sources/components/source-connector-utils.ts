import type { JsonValueInput, SnapshotEntry } from './source-connector-types';

export type ConnectorDialogStep = 'select' | 'config' | 'snapshot' | 'scope' | 'sync';

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function titleForEntry(entry: SnapshotEntry): string | null {
  const title = entry.frontmatterSummary?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

/** Eden treaty may coerce ISO strings into Date; never render Date as a React child. */
export function formatSnapshotTimestamp(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  return '';
}

export function allParentDirs(path: string): string[] {
  const parts = String(path || '')
    .split('/')
    .filter(Boolean);
  if (parts.length <= 1) return [];
  const dirs: string[] = [];
  for (let idx = 1; idx < parts.length; idx += 1) {
    const dir = parts.slice(0, idx).join('/');
    if (dir) dirs.push(dir);
  }
  return dirs;
}

export function buildDirectories(entries: SnapshotEntry[]): string[] {
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const entry of entries) {
    for (const dir of allParentDirs(entry.relativePath)) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      dirs.push(dir);
    }
  }
  dirs.sort((a, b) => a.localeCompare(b));
  return dirs;
}

export function schemaProperties(schema: unknown): Record<string, any> {
  if (!schema || typeof schema !== 'object') return {};
  const props = (schema as any).properties;
  if (!props || typeof props !== 'object') return {};
  return props as Record<string, any>;
}

export function schemaRequired(schema: unknown): Set<string> {
  if (!schema || typeof schema !== 'object') return new Set();
  const req = (schema as any).required;
  if (!Array.isArray(req)) return new Set();
  return new Set(req.map(String));
}

export function normalizeConfigValue(value: unknown, type: string | undefined): JsonValueInput {
  if (type === 'boolean') {
    return Boolean(value);
  }
  if (type === 'integer' || type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    }
  }
  return value as JsonValueInput;
}
