// Sync-check diffing and connector file import — mirrors v1 source_connectors/api.py logic.
import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { db } from '../../db/index.ts';
import { sourceConnectorBindings, sources } from '../../db/schema.ts';
import { checkDedup } from '../sources/dedup.ts';
import { getDedupEnabled } from '../../shared/config.ts';
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
  SyncCheckResult,
} from './types.ts';

export function serializeBinding(
  row: typeof sourceConnectorBindings.$inferSelect,
): ConnectorBindingRead {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    connector_id: row.connectorId,
    connection_config: row.connectionConfig as Record<string, unknown>,
    import_scope: (row.importScope as ImportScope | null) ?? null,
    last_confirmed_snapshot: (row.lastConfirmedSnapshot as Snapshot | null) ?? null,
    last_sync_check_result: (row.lastSyncCheckResult as SyncCheckResult | null) ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function normalizeImportScope(scope: ImportScope): {
  directories: string[];
  files: string[];
} {
  const rawDirectories = scope.include_directories ?? [];
  const rawFiles = scope.include_files ?? [];

  if (!rawDirectories.length && !rawFiles.length) {
    throw Object.assign(new Error('导入范围不能为空'), {
      status: 400,
      error_code: 'IMPORT_SCOPE_EMPTY',
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
      error_code: 'IMPORT_SCOPE_EMPTY',
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
    generated_at: snapshot.generated_at,
    entries: snapshot.entries.filter((entry) =>
      pathInScope(entry.relative_path, directories, files),
    ),
  };
}

export function buildSyncCandidates(
  baseSnapshot: Snapshot | null,
  currentSnapshot: Snapshot,
): SyncCandidates {
  const baseEntries = baseSnapshot?.entries ?? [];
  const baseMap = new Map(baseEntries.map((entry) => [entry.relative_path, entry]));
  const currentMap = new Map(currentSnapshot.entries.map((entry) => [entry.relative_path, entry]));

  const added: SyncCandidate[] = [];
  const updated: SyncCandidate[] = [];
  const missing: SyncCandidate[] = [];

  for (const [path, current] of currentMap) {
    const base = baseMap.get(path);
    if (!base) {
      added.push({ relative_path: path, current, base: null, reason: null });
      continue;
    }
    if (base.size_bytes !== current.size_bytes || base.modified_at !== current.modified_at) {
      const reasons: string[] = [];
      if (base.size_bytes !== current.size_bytes) reasons.push('size_bytes 变化');
      if (base.modified_at !== current.modified_at) reasons.push('modified_at 变化');
      updated.push({
        relative_path: path,
        current,
        base,
        reason: reasons.length ? reasons.join('; ') : null,
      });
    }
  }

  for (const [path, base] of baseMap) {
    if (!currentMap.has(path)) {
      missing.push({ relative_path: path, current: null, base, reason: null });
    }
  }

  const sortByPath = (a: SyncCandidate, b: SyncCandidate) =>
    a.relative_path.localeCompare(b.relative_path);
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
      binding.connectionConfig as Record<string, unknown>,
      entry.relative_path,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取文件失败';
    return {
      vectorsChanged: false,
      item: {
        relative_path: entry.relative_path,
        status: 'failed',
        source_id: null,
        diagnostic: {
          error_code: 'CONNECTOR_READ_FAILED',
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
        relative_path: entry.relative_path,
        status: 'failed',
        source_id: null,
        diagnostic: {
          error_code: 'EMPTY_DOCUMENT',
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
        relative_path: entry.relative_path,
        status: 'reused',
        source_id: dedup.existingSourceId,
        diagnostic: null,
      },
    };
  }

  const result = await ingestSource({
    buffer: raw,
    filename: entry.relative_path,
    notebookId,
    mimeType: mimeTypeForPath(entry.relative_path),
    dedupKey,
  });

  if (result.status === 'failed') {
    return {
      vectorsChanged: false,
      item: {
        relative_path: entry.relative_path,
        status: 'failed',
        source_id: result.sourceId,
        diagnostic: {
          error_code: result.errorCode ?? 'INGESTION_FAILED',
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
        ...(existing?.metadata as Record<string, unknown> | null | undefined),
        source_connector: connectorMetadata,
      },
    })
    .where(and(eq(sources.id, result.sourceId), eq(sources.notebookId, notebookId)))
    .run();

  return {
    vectorsChanged: true,
    item: {
      relative_path: entry.relative_path,
      status: 'imported',
      source_id: result.sourceId,
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
      connector_id: binding.connectorId,
      binding_id: binding.id,
      relative_path: entry.relative_path,
      snapshot_entry: entry,
      ...(options?.syncCheckId ? { sync_check_id: options.syncCheckId } : {}),
    };

    const { item, vectorsChanged: changed } = await ingestConnectorEntry(
      notebookId,
      binding,
      entry,
      connectorMetadata,
    );

    if (item.status === 'failed') hadFailures = true;
    if (item.status === 'imported' && item.source_id) importedSourceIds.push(item.source_id);
    if (item.status === 'reused' && item.source_id) reusedSourceIds.push(item.source_id);
    if (changed) vectorsChanged = true;

    if (
      options?.skipUnsupportedAsSkipped &&
      item.diagnostic &&
      (item.diagnostic.error_code === 'PARSER_PLUGIN_REQUIRED' ||
        item.diagnostic.error_code === 'UNSUPPORTED_FILE_TYPE')
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
      error_code: 'SYNC_CHECK_REQUIRED',
    });
  }

  const stored = binding.lastSyncCheckResult as unknown as SyncCheckResult;
  if (stored.id !== syncCheckId) {
    throw Object.assign(new Error('sync_check 已过期'), {
      status: 409,
      error_code: 'SYNC_CHECK_OUTDATED',
      hint: '请重新执行 sync_check 并确认后再应用。',
      details: { expected: stored.id, got: syncCheckId },
    });
  }

  const entriesToImport: SnapshotEntry[] = [];
  const seenPaths = new Set<string>();
  for (const candidate of [...stored.candidates.added, ...stored.candidates.updated]) {
    const entry = candidate.current;
    if (!entry || seenPaths.has(entry.relative_path)) continue;
    seenPaths.add(entry.relative_path);
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
        lastConfirmedSnapshot: stored.current_snapshot as unknown as Record<string, unknown>,
        lastSyncCheckResult: null,
        updatedAt: new Date(),
      })
      .where(eq(sourceConnectorBindings.id, binding.id))
      .returning()
      .get();
  }

  return {
    binding: serializeBinding(updatedBinding),
    imported_source_ids: importedSourceIds,
    reused_source_ids: reusedSourceIds,
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
    include_directories: directories.length ? directories : null,
    include_files: files.length ? files : null,
  };

  const selectedEntries = currentSnapshot.entries.filter((entry) =>
    pathInScope(entry.relative_path, directories, files),
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
      importScope: normalizedScope as unknown as Record<string, unknown>,
      ...(shouldConfirmSnapshot
        ? {
            lastConfirmedSnapshot: currentSnapshot as unknown as Record<string, unknown>,
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
    imported_source_ids: importedSourceIds,
    reused_source_ids: reusedSourceIds,
    results,
  };
}
