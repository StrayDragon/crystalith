// Source connectors router — /v2/notebooks/:nid/source-connectors, bindings, snapshot, sync.
//
// Mirrors v1 `features/source_connectors/api.py`.
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks, sourceConnectorBindings } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { BUILTIN_CONNECTORS, getBuiltinConnector } from './connectors.ts';
import { buildFilesystemSnapshot, getConnectorDiagnostics } from './scanner.ts';
import {
  applyImportScopeToBinding,
  applySyncCheckToBinding,
  buildSyncCandidates,
  filterSnapshotByScope,
  normalizeImportScope,
  serializeBinding,
} from './sync.ts';
import type { ImportScope, Snapshot, SyncCheckResult } from './types.ts';

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/source-connectors',
    method: 'get',
    summary: 'List available connector types for a notebook',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Connector descriptors' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connectors/:connectorId/bindings',
    method: 'post',
    summary: 'Create a connector binding',
    tags: ['source-connectors'],
    responses: { 201: { description: 'Created binding' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/snapshot',
    method: 'post',
    summary: 'Build a filesystem snapshot for a binding',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Snapshot' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/sync-check',
    method: 'post',
    summary: 'Compare current snapshot against last confirmed baseline',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Sync check result' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/sync-check/apply',
    method: 'post',
    summary: 'Import added/updated sync candidates',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Import results' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/import-scope',
    method: 'post',
    summary: 'Set import scope and import selected files',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Import results' } },
  },
  {
    path: '/v2/source-connector-bindings/:id/sync',
    method: 'post',
    summary: 'Alias for sync-check on a binding',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Sync check result' } },
  },
  {
    path: '/v2/source-connector-bindings/:id',
    method: 'delete',
    summary: 'Delete a connector binding',
    tags: ['source-connectors'],
    responses: { 204: { description: 'Deleted' } },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireNotebook(notebookId: number) {
  const nb = db().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();
  if (!nb) throw new NotFoundError(`Notebook ${notebookId} not found`);
  return nb;
}

function getBindingOr404(notebookId: number, bindingId: number) {
  const binding = db()
    .select()
    .from(sourceConnectorBindings)
    .where(eq(sourceConnectorBindings.id, bindingId))
    .get();
  if (!binding || binding.notebookId !== notebookId) {
    throw new NotFoundError(`Connector binding ${bindingId} not found`);
  }
  return binding;
}

function getConnectorOr404(connectorId: string) {
  const connector = getBuiltinConnector(connectorId.trim());
  if (!connector) throw new NotFoundError(`Source connector ${connectorId} not found`);
  return connector;
}

function apiError(
  set: { status?: number | string },
  status: number,
  detail: Record<string, unknown>,
): never {
  set.status = status;
  throw detail;
}

async function runSyncCheck(
  notebookId: number,
  binding: typeof sourceConnectorBindings.$inferSelect,
): Promise<SyncCheckResult> {
  getConnectorOr404(binding.connectorId);

  let baseSnapshot: Snapshot | null = null;
  if (binding.lastConfirmedSnapshot) {
    baseSnapshot = binding.lastConfirmedSnapshot as unknown as Snapshot;
  }

  const currentSnapshot = await buildFilesystemSnapshot(
    binding.connectorId,
    binding.connectionConfig as Record<string, unknown>,
  );

  let scopeDirectories: string[] = [];
  let scopeFiles: string[] = [];
  if (binding.importScope) {
    try {
      const normalized = normalizeImportScope(binding.importScope as ImportScope);
      scopeDirectories = normalized.directories;
      scopeFiles = normalized.files;
    } catch (error) {
      const err = error as Error & { error_code?: string };
      if (err.error_code !== 'IMPORT_SCOPE_EMPTY') throw error;
    }
  }

  const scopedBase =
    baseSnapshot && (scopeDirectories.length || scopeFiles.length)
      ? filterSnapshotByScope(baseSnapshot, scopeDirectories, scopeFiles)
      : baseSnapshot;

  const scopedCurrent =
    scopeDirectories.length || scopeFiles.length
      ? filterSnapshotByScope(currentSnapshot, scopeDirectories, scopeFiles)
      : currentSnapshot;

  const candidates = buildSyncCandidates(scopedBase, scopedCurrent);
  const result: SyncCheckResult = {
    id: crypto.randomUUID(),
    checked_at: new Date().toISOString(),
    base_snapshot: scopedBase,
    current_snapshot: scopedCurrent,
    candidates,
  };

  db()
    .update(sourceConnectorBindings)
    .set({
      lastSyncCheckResult: result as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(sourceConnectorBindings.id, binding.id))
    .run();

  return result;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sourceConnectorsRouter = new Elysia({ prefix: '/v2' })
  .get('/notebooks/:nid/source-connectors', async ({ params }) => {
    const nid = Number(params.nid);
    requireNotebook(nid);

    const connectors = await Promise.all(
      BUILTIN_CONNECTORS.map(async (connector) => ({
        ...connector,
        diagnostics: await getConnectorDiagnostics(connector.connector_id, null),
      })),
    );

    return { connectors };
  })

  .post('/notebooks/:nid/source-connectors/:connectorId/bindings', ({ params, body, set }) => {
    const nid = Number(params.nid);
    requireNotebook(nid);

    const connectorId = String(params.connectorId ?? '').trim();
    getConnectorOr404(connectorId);

    const { connection_config } = (body ?? {}) as {
      connection_config?: Record<string, unknown>;
    };
    const config = connection_config ?? {};

    const binding = db()
      .insert(sourceConnectorBindings)
      .values({
        notebookId: nid,
        connectorId,
        connectionConfig: config,
      })
      .returning()
      .get();

    set.status = 201;
    return serializeBinding(binding);
  })

  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/snapshot',
    async ({ params, set }) => {
      const nid = Number(params.nid);
      const bindingId = Number(params.bindingId);
      const binding = getBindingOr404(nid, bindingId);
      getConnectorOr404(binding.connectorId);

      try {
        return await buildFilesystemSnapshot(
          binding.connectorId,
          binding.connectionConfig as Record<string, unknown>,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '连接器快照枚举失败';
        apiError(set, 500, {
          error_code: 'CONNECTOR_SNAPSHOT_FAILED',
          message: '连接器快照枚举失败',
          hint: '检查连接参数与目录权限，或查看后端日志。',
          details: { error: message },
        });
      }
    },
  )

  .post('/notebooks/:nid/source-connector-bindings/:bindingId/sync-check', async ({ params }) => {
    const nid = Number(params.nid);
    const bindingId = Number(params.bindingId);
    const binding = getBindingOr404(nid, bindingId);
    return runSyncCheck(nid, binding);
  })

  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/sync-check/apply',
    async ({ params, body, set }) => {
      const nid = Number(params.nid);
      const bindingId = Number(params.bindingId);
      const binding = getBindingOr404(nid, bindingId);
      const { sync_check_id } = (body ?? {}) as { sync_check_id?: string };

      if (!sync_check_id) {
        apiError(set, 400, {
          error_code: 'SYNC_CHECK_ID_REQUIRED',
          message: 'sync_check_id is required',
        });
      }

      try {
        return await applySyncCheckToBinding(nid, binding, sync_check_id);
      } catch (error) {
        const err = error as Error & {
          status?: number;
          error_code?: string;
          hint?: string;
          details?: unknown;
        };
        if (err.status) {
          apiError(set, err.status, {
            error_code: err.error_code ?? 'SYNC_CHECK_APPLY_FAILED',
            message: err.message,
            ...(err.hint ? { hint: err.hint } : {}),
            ...(err.details ? { details: err.details } : {}),
          });
        }
        throw error;
      }
    },
  )

  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/import-scope',
    async ({ params, body, set }) => {
      const nid = Number(params.nid);
      const bindingId = Number(params.bindingId);
      const binding = getBindingOr404(nid, bindingId);
      getConnectorOr404(binding.connectorId);

      const scope = (body ?? {}) as ImportScope;

      try {
        normalizeImportScope(scope);
      } catch (error) {
        const err = error as Error & { status?: number; error_code?: string; hint?: string };
        apiError(set, err.status ?? 400, {
          error_code: err.error_code ?? 'IMPORT_SCOPE_INVALID',
          message: err.message,
          ...(err.hint ? { hint: err.hint } : {}),
        });
      }

      let currentSnapshot: Snapshot;
      try {
        currentSnapshot = await buildFilesystemSnapshot(
          binding.connectorId,
          binding.connectionConfig as Record<string, unknown>,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '连接器快照枚举失败';
        apiError(set, 500, {
          error_code: 'CONNECTOR_SNAPSHOT_FAILED',
          message: '连接器快照枚举失败',
          hint: '检查连接参数与目录权限，或查看后端日志。',
          details: { error: message },
        });
      }

      return applyImportScopeToBinding(nid, binding, scope, currentSnapshot);
    },
  )

  .post('/source-connector-bindings/:id/sync', async ({ params }) => {
    const bindingId = Number(params.id);
    const binding = db()
      .select()
      .from(sourceConnectorBindings)
      .where(eq(sourceConnectorBindings.id, bindingId))
      .get();
    if (!binding) throw new NotFoundError(`Connector binding ${bindingId} not found`);
    return runSyncCheck(binding.notebookId, binding);
  })

  .delete('/source-connector-bindings/:id', ({ params, set }) => {
    const id = Number(params.id);
    const existing = db()
      .select()
      .from(sourceConnectorBindings)
      .where(eq(sourceConnectorBindings.id, id))
      .get();
    if (!existing) throw new NotFoundError(`Connector binding ${id} not found`);

    db().delete(sourceConnectorBindings).where(eq(sourceConnectorBindings.id, id)).run();
    set.status = 204;
    return '';
  });

registerApiDoc(apiDocs);
