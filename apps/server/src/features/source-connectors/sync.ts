// Sync-check diffing and connector file import — mirrors v1 source_connectors/api.py logic.
import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { sourceConnectorBindings, sources } from '../../db/schema.ts';
import { getDedupEnabled } from '../../shared/config.ts';
import { checkDedup } from '../sources/dedup.ts';
import { ingestSource } from '../sources/pipeline.ts';
import { normalizeDirectoryPath, normalizeFilePath, pathInScope } from './paths.ts';
import { readConnectorFileBytes } from './scanner.ts';
import type {
  ConnectorBindingRead,
  ImportResultItem,
  ImportScope,
  ImportScopeApplyResponse,
  Snapshot,
  SnapshotEntry,
  SyncCandidate,
  SyncCandidates,
} from './types.ts';

export function serializeBinding(
  row: typeof sourceConnectorBindings.$inferSelect,
): ConnectorBindingRead {
  return {
    id: row.id,
    notebookId: row.notebookId,
    connectorId: row.connectorId,
    connectionConfig: row.connectionConfig,
    importScope: row.importScope ?? null,
    lastConfirmedSnapshot: row.lastConfirmedSnapshot ?? null,
    lastSyncCheckResult: row.lastSyncCheckResult ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeImportScope(scope: ImportScope): {
  directories: string[];
  files: string[];
} {
  const rawDirectories = scope.includeDirectories ?? [];
  const rawFiles = scope.includeFiles ?? [];

  if (!rawDirectories.length && !rawFiles.length) {
    throw Object.assign(new Error('导入范围不能为空'), {
      status: 400,
      errorCode: 'IMPORT_SCOPE_EMPTY',
      hint: '至少选择一个目录或文件。',
    });
  }

  const directories: string[] = [];
  for (const value of rawDirectories) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    directories.push(normalizeDirectoryPath(text));
  }

  const files: string[] = [];
  for (const value of rawFiles) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    files.push(normalizeFilePath(text));
  }

  const uniqueDirectories = [...new Set(directories)];
  const uniqueFiles = [...new Set(files)];

  if (!uniqueDirectories.length && !uniqueFiles.length) {
    throw Object.assign(new Error('导入范围不能为空'), {
      status: 400,
      errorCode: 'IMPORT_SCOPE_EMPTY',
      hint: '至少选择一个目录或文件。',
    });
  }

  return { directories: uniqueDirectories, files: uniqueFiles };
}

export function filterSnapshotByScope(
  snapshot: Snapshot,
  directories: string[],
  files: string[],
): Snapshot {
  return {
    generatedAt: snapshot.generatedAt,
    entries: snapshot.entries.filter((entry) =>
      pathInScope(entry.relativePath, directories, files),
    ),
  };
}

export function buildSyncCandidates(
  baseSnapshot: Snapshot | null,
  currentSnapshot: Snapshot,
): SyncCandidates {
  const baseEntries = baseSnapshot?.entries ?? [];
  const baseMap = new Map(baseEntries.map((entry) => [entry.relativePath, entry]));
  const currentMap = new Map(currentSnapshot.entries.map((entry) => [entry.relativePath, entry]));

  const added: SyncCandidate[] = [];
  const updated: SyncCandidate[] = [];
  const missing: SyncCandidate[] = [];

  for (const [path, current] of currentMap) {
    const base = baseMap.get(path);
    if (!base) {
      added.push({ relativePath: path, current, base: null, reason: null });
      continue;
    }
    if (base.sizeBytes !== current.sizeBytes || base.modifiedAt !== current.modifiedAt) {
      const reasons: string[] = [];
      if (base.sizeBytes !== current.sizeBytes) reasons.push('size_bytes 变化');
      if (base.modifiedAt !== current.modifiedAt) reasons.push('modified_at 变化');
      updated.push({
        relativePath: path,
        current,
        base,
        reason: reasons.length ? reasons.join('; ') : null,
      });
    }
  }

  for (const [path, base] of baseMap) {
    if (!currentMap.has(path)) {
      missing.push({ relativePath: path, current: null, base, reason: null });
    }
  }

  const sortByPath = (a: SyncCandidate, b: SyncCandidate) =>
    a.relativePath.localeCompare(b.relativePath);
  added.sort(sortByPath);
  updated.sort(sortByPath);
  missing.sort(sortByPath);

  return { added, updated, missing };
}

function connectorDedupKey(connectorId: string, raw: Uint8Array): string {
  const digest = createHash('sha256').update(raw).digest('hex');
  return `connector:${connectorId}:sha256:${digest}`;
}

function mimeTypeForPath(relativePath: string): string | undefined {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return undefined;
}

async function ingestConnectorEntry(
  notebookId: number,
  binding: typeof sourceConnectorBindings.$inferSelect,
  entry: SnapshotEntry,
  connectorMetadata: Record<string, unknown>,
): Promise<{ item: ImportResultItem; vectorsChanged: boolean }> {
  let raw: Uint8Array;
  try {
    raw = await readConnectorFileBytes(
      binding.connectorId,
      binding.connectionConfig,
      entry.relativePath,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取文件失败';
    return {
      vectorsChanged: false,
      item: {
        relativePath: entry.relativePath,
        status: 'failed',
        sourceId: null,
        diagnostic: {
          errorCode: 'CONNECTOR_READ_FAILED',
          message: '读取文件失败',
          hint: '检查连接参数与文件权限，或查看后端日志。',
          details: { error: message },
        },
      },
    };
  }

  if (!raw.length) {
    return {
      vectorsChanged: false,
      item: {
        relativePath: entry.relativePath,
        status: 'failed',
        sourceId: null,
        diagnostic: {
          errorCode: 'EMPTY_DOCUMENT',
          message: '空文档，无法导入',
          hint: '请检查文件内容是否为空。',
        },
      },
    };
  }

  // c57/P0-B: gate dedup by config (v1 source_connectors/api.py:898,1070)
  const dedupKey = connectorDedupKey(binding.connectorId, raw);
  const dedup = getDedupEnabled()
    ? checkDedup(notebookId, dedupKey)
    : { hit: false, existingSourceId: null as number | null };
  if (dedup.hit) {
    return {
      vectorsChanged: false,
      item: {
        relativePath: entry.relativePath,
        status: 'reused',
        sourceId: dedup.existingSourceId,
        diagnostic: null,
      },
    };
  }

  const result = await ingestSource({
    buffer: raw,
    filename: entry.relativePath,
    notebookId,
    mimeType: mimeTypeForPath(entry.relativePath),
    dedupKey,
  });

  if (result.status === 'failed') {
    return {
      vectorsChanged: false,
      item: {
        relativePath: entry.relativePath,
        status: 'failed',
        sourceId: result.sourceId,
        diagnostic: {
          errorCode: result.errorCode ?? 'INGESTION_FAILED',
          message: result.errorMessage ?? '导入失败',
          hint: '可稍后重试；若持续失败，检查日志或依赖服务状态。',
        },
      },
    };
  }

  const existing = db()
    .select({ metadata: sources.metadata })
    .from(sources)
    .where(eq(sources.id, result.sourceId))
    .get();

  db()
    .update(sources)
    .set({
      metadata: {
        ...existing?.metadata,
        sourceConnector: connectorMetadata,
      },
    })
    .where(and(eq(sources.id, result.sourceId), eq(sources.notebookId, notebookId)))
    .run();

  return {
    vectorsChanged: true,
    item: {
      relativePath: entry.relativePath,
      status: 'imported',
      sourceId: result.sourceId,
      diagnostic: null,
    },
  };
}

export async function importSnapshotEntries(
  notebookId: number,
  binding: typeof sourceConnectorBindings.$inferSelect,
  entries: SnapshotEntry[],
  options?: { syncCheckId?: string; skipUnsupportedAsSkipped?: boolean },
): Promise<{
  results: ImportResultItem[];
  importedSourceIds: number[];
  reusedSourceIds: number[];
  vectorsChanged: boolean;
  hadFailures: boolean;
}> {
  const results: ImportResultItem[] = [];
  const importedSourceIds: number[] = [];
  const reusedSourceIds: number[] = [];
  let vectorsChanged = false;
  let hadFailures = false;

  for (const entry of entries) {
    const connectorMetadata: Record<string, unknown> = {
      connectorId: binding.connectorId,
      bindingId: binding.id,
      relativePath: entry.relativePath,
      snapshotEntry: entry,
      ...(options?.syncCheckId ? { syncCheckId: options.syncCheckId } : {}),
    };

    const { item, vectorsChanged: changed } = await ingestConnectorEntry(
      notebookId,
      binding,
      entry,
      connectorMetadata,
    );

    if (item.status === 'failed') hadFailures = true;
    if (item.status === 'imported' && item.sourceId) importedSourceIds.push(item.sourceId);
    if (item.status === 'reused' && item.sourceId) reusedSourceIds.push(item.sourceId);
    if (changed) vectorsChanged = true;

    if (
      options?.skipUnsupportedAsSkipped &&
      item.diagnostic &&
      (item.diagnostic.errorCode === 'PARSER_PLUGIN_REQUIRED' ||
        item.diagnostic.errorCode === 'UNSUPPORTED_FILE_TYPE')
    ) {
      results.push({ ...item, status: 'skipped' });
    } else {
      results.push(item);
    }
  }

  return { results, importedSourceIds, reusedSourceIds, vectorsChanged, hadFailures };
}

export async function applySyncCheckToBinding(
  notebookId: number,
  binding: typeof sourceConnectorBindings.$inferSelect,
  syncCheckId: string,
): Promise<ImportScopeApplyResponse> {
  if (!binding.lastSyncCheckResult) {
    throw Object.assign(new Error('请先执行 sync_check'), {
      status: 409,
      errorCode: 'SYNC_CHECK_REQUIRED',
    });
  }

  const stored = binding.lastSyncCheckResult;
  if (stored.id !== syncCheckId) {
    throw Object.assign(new Error('sync_check 已过期'), {
      status: 409,
      errorCode: 'SYNC_CHECK_OUTDATED',
      hint: '请重新执行 sync_check 并确认后再应用。',
      details: { expected: stored.id, got: syncCheckId },
    });
  }

  const entriesToImport: SnapshotEntry[] = [];
  const seenPaths = new Set<string>();
  for (const candidate of [...stored.candidates.added, ...stored.candidates.updated]) {
    const entry = candidate.current;
    if (!entry || seenPaths.has(entry.relativePath)) continue;
    seenPaths.add(entry.relativePath);
    entriesToImport.push(entry);
  }

  const { results, importedSourceIds, reusedSourceIds, vectorsChanged, hadFailures } =
    await importSnapshotEntries(notebookId, binding, entriesToImport, {
      syncCheckId: stored.id,
    });

  let updatedBinding = binding;
  if (!hadFailures) {
    updatedBinding = db()
      .update(sourceConnectorBindings)
      .set({
        lastConfirmedSnapshot: stored.currentSnapshot,
        lastSyncCheckResult: null,
        updatedAt: new Date(),
      })
      .where(eq(sourceConnectorBindings.id, binding.id))
      .returning()
      .get();
  }

  return {
    binding: serializeBinding(updatedBinding),
    importedSourceIds: importedSourceIds,
    reusedSourceIds: reusedSourceIds,
    results,
    ...(vectorsChanged ? {} : {}),
  };
}

export async function applyImportScopeToBinding(
  notebookId: number,
  binding: typeof sourceConnectorBindings.$inferSelect,
  scope: ImportScope,
  currentSnapshot: Snapshot,
): Promise<ImportScopeApplyResponse> {
  const { directories, files } = normalizeImportScope(scope);
  const normalizedScope: ImportScope = {
    includeDirectories: directories.length ? directories : null,
    includeFiles: files.length ? files : null,
  };

  const selectedEntries = currentSnapshot.entries.filter((entry) =>
    pathInScope(entry.relativePath, directories, files),
  );

  const { results, importedSourceIds, reusedSourceIds } = await importSnapshotEntries(
    notebookId,
    binding,
    selectedEntries,
    { skipUnsupportedAsSkipped: true },
  );

  const shouldConfirmSnapshot = importedSourceIds.length > 0 || reusedSourceIds.length > 0;
  const updatedBinding = db()
    .update(sourceConnectorBindings)
    .set({
      importScope: normalizedScope,
      ...(shouldConfirmSnapshot
        ? {
            lastConfirmedSnapshot: currentSnapshot,
            lastSyncCheckResult: null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(sourceConnectorBindings.id, binding.id))
    .returning()
    .get();

  return {
    binding: serializeBinding(updatedBinding),
    importedSourceIds: importedSourceIds,
    reusedSourceIds: reusedSourceIds,
    results,
  };
}
