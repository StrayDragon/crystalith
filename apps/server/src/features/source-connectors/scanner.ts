// Filesystem scanner for built-in source connectors.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { extensionsForConnector, rootPathKeyForConnector } from './connectors.ts';
import { normalizeRelativePath } from './paths.ts';
import type { Diagnostic, FrontmatterSummary, Snapshot, SnapshotEntry } from './types.ts';

const FRONTMATTER_MAX_BYTES = 64 * 1024;

function frontmatterList(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [text] : null;
  }
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? [...new Set(items)] : null;
  }
  return null;
}

function frontmatterDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    try {
      return new Date(value * 1000).toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  return null;
}

function extractFrontmatterSummary(filePath: string, raw: Uint8Array): FrontmatterSummary {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(
    raw.subarray(0, Math.min(raw.length, FRONTMATTER_MAX_BYTES)),
  );
  if (!text) return {};

  const lines = text.split(/\r?\n/u);
  if (!lines.length || lines[0]?.trim() !== '---') return {};

  let endIdx: number | null = null;
  for (let idx = 1; idx < Math.min(lines.length, 2048); idx += 1) {
    const marker = lines[idx]?.trim();
    if (marker === '---' || marker === '...') {
      endIdx = idx;
      break;
    }
  }
  if (endIdx === null || endIdx <= 1) return {};

  const yamlText = lines.slice(1, endIdx).join('\n').trim();
  if (!yamlText) return {};

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const record: Record<string, unknown> = Object.fromEntries(Object.entries(parsed));
  const summary: FrontmatterSummary = {};

  const titleRaw = record.title;
  if (typeof titleRaw === 'string') {
    const title = titleRaw.trim();
    if (title) summary.title = title;
  }

  const tags = frontmatterList(record.tags);
  if (tags) summary.tags = tags;

  const aliases = frontmatterList(record.aliases);
  if (aliases) summary.aliases = aliases;

  const date = frontmatterDate(record.date);
  if (date) summary.date = date;

  return summary;
}

export function resolveConnectorRoot(
  connectorId: string,
  connectionConfig: Record<string, unknown>,
): { root: string | null; diagnostics: Diagnostic[] | null } {
  const primaryKey = rootPathKeyForConnector(connectorId);
  const legacyKey =
    connectorId === 'obsidian'
      ? 'vault_path'
      : connectorId === 'local-directory'
        ? 'directory_path'
        : null;
  const fallbackKey = connectorId === 'local-directory' ? 'root_path' : null;
  const raw =
    connectionConfig[primaryKey] ??
    (legacyKey ? connectionConfig[legacyKey] : null) ??
    (fallbackKey ? connectionConfig[fallbackKey] : null);
  const text = (typeof raw === 'string' ? raw : '').trim();

  if (!text) {
    return {
      root: null,
      diagnostics: [
        {
          errorCode: 'CONFIG_REQUIRED',
          message: `缺少必填配置：${primaryKey}`,
          hint: '请填写有效的本地目录路径。',
        },
      ],
    };
  }

  const expanded = text.startsWith('~') ? join(process.env.HOME ?? '', text.slice(1)) : text;
  let resolved: string;
  try {
    resolved = resolve(expanded);
  } catch {
    return {
      root: null,
      diagnostics: [
        {
          errorCode: 'PATH_UNRESOLVABLE',
          message: '目录路径无法解析',
          details: { path: text },
        },
      ],
    };
  }

  return { root: resolved, diagnostics: null };
}

async function validateRoot(root: string): Promise<Diagnostic[] | null> {
  let st;
  try {
    st = await stat(root);
  } catch {
    return [
      {
        errorCode: 'PATH_NOT_FOUND',
        message: '目录不存在',
        hint: '请检查路径是否正确，或确认后端进程有权限访问该目录。',
        details: { path: root },
      },
    ];
  }

  if (!st.isDirectory()) {
    return [
      {
        errorCode: 'NOT_A_DIRECTORY',
        message: '路径不是目录',
        details: { path: root },
      },
    ];
  }

  return null;
}

async function walkDirectory(
  root: string,
  extensions: readonly string[],
  includeFrontmatter: boolean,
): Promise<SnapshotEntry[]> {
  const entries: SnapshotEntry[] = [];
  const extSet = new Set(extensions.map((e) => e.toLowerCase()));

  async function walk(dir: string): Promise<void> {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }

    for (const name of names) {
      if (name.startsWith('.')) continue;
      const fullPath = join(dir, name);
      let st;
      try {
        st = await stat(fullPath);
      } catch {
        continue;
      }

      if (st.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!st.isFile()) continue;

      const suffix = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
      if (!extSet.has(suffix)) continue;

      const rel = relative(root, fullPath).split('\\').join('/');
      let relativePath: string;
      try {
        relativePath = normalizeRelativePath(rel);
      } catch {
        continue;
      }

      const modifiedAt = new Date(st.mtimeMs).toISOString();
      let contentHash: string | undefined;
      let frontmatter: FrontmatterSummary | undefined;

      if (includeFrontmatter && (suffix === '.md' || suffix === '.markdown')) {
        try {
          const raw = await readFile(fullPath);
          contentHash = createHash('sha256').update(raw).digest('hex');
          const summary = extractFrontmatterSummary(fullPath, raw);
          if (Object.keys(summary).length) frontmatter = summary;
        } catch {
          // skip hash/frontmatter on read error; size/mtime still useful
        }
      } else {
        try {
          const raw = await readFile(fullPath);
          contentHash = createHash('sha256').update(raw).digest('hex');
        } catch {
          // optional
        }
      }

      entries.push({
        relativePath: relativePath,
        sizeBytes: st.size,
        modifiedAt: modifiedAt,
        ...(contentHash ? { contentHash } : {}),
        ...(frontmatter ? { frontmatterSummary: frontmatter } : {}),
      });
    }
  }

  await walk(root);
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return entries;
}

export async function buildFilesystemSnapshot(
  connectorId: string,
  connectionConfig: Record<string, unknown>,
): Promise<Snapshot> {
  const { root, diagnostics } = resolveConnectorRoot(connectorId, connectionConfig);
  if (!root) {
    const message = diagnostics?.[0]?.message ?? 'Invalid connector path';
    throw new Error(message);
  }

  const rootDiags = await validateRoot(root);
  if (rootDiags) {
    throw new Error(rootDiags[0]?.message ?? 'Invalid connector path');
  }

  const resolvedRoot = resolve(root);
  const extensions = extensionsForConnector(connectorId);
  const includeFrontmatter = connectorId === 'obsidian' || connectorId === 'local-directory';
  const entries = await walkDirectory(resolvedRoot, extensions, includeFrontmatter);

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
}

export async function readConnectorFileBytes(
  connectorId: string,
  connectionConfig: Record<string, unknown>,
  relativePath: string,
): Promise<Uint8Array> {
  const { root, diagnostics } = resolveConnectorRoot(connectorId, connectionConfig);
  if (!root) {
    throw new Error(diagnostics?.[0]?.message ?? 'Invalid connector path');
  }

  const resolvedRoot = resolve(root);
  const normalized = normalizeRelativePath(relativePath);
  const candidate = resolve(resolvedRoot, normalized);

  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}/`)) {
    throw new Error('relative_path escapes root directory');
  }

  const extensions = extensionsForConnector(connectorId);
  const suffix = candidate.includes('.') ? `.${candidate.split('.').pop()!.toLowerCase()}` : '';
  if (!extensions.includes(suffix)) {
    throw new Error('unsupported file type');
  }

  const file = Bun.file(candidate);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${relativePath}`);
  }

  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function getConnectorDiagnostics(
  connectorId: string,
  connectionConfig: Record<string, unknown> | null,
): Promise<Diagnostic[] | null> {
  if (!connectionConfig) return null;
  const { root, diagnostics } = resolveConnectorRoot(connectorId, connectionConfig);
  if (diagnostics) return diagnostics;
  if (!root) return null;
  return validateRoot(root);
}
