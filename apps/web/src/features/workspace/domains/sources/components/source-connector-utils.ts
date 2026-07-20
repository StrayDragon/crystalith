import type { SnapshotEntry } from './source-connector-types';

export type ConnectorDialogStep = 'select' | 'config' | 'snapshot' | 'scope' | 'sync';

export function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

type JsonSchemaObject = {
  properties?: Record<string, unknown>;
  required?: unknown[];
};

function asJsonSchemaObject(schema: unknown): JsonSchemaObject | null {
  if (!isRecord(schema)) return null;
  return schema;
}

export function schemaProperties(schema: unknown): Record<string, unknown> {
  const props = asJsonSchemaObject(schema)?.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  return props;
}

export function schemaRequired(schema: unknown): Set<string> {
  const req = asJsonSchemaObject(schema)?.required;
  if (!Array.isArray(req)) return new Set();
  return new Set(req.map(String));
}

export function normalizeConfigValue(value: unknown, type: string | undefined): unknown {
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
  return value;
}
