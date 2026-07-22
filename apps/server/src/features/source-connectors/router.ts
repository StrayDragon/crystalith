// Source connectors router — /v2/notebooks/:nid/source-connectors, bindings, snapshot, sync.
//
// Mirrors v1 `features/source_connectors/api.py`.
import {
  Empty204Schema,
  ImportScopeApplyResponseSchema,
  ImportScopeSchema,
  SnapshotSchema,
  SourceConnectorBindingCreateRequestSchema,
  SourceConnectorBindingSchema,
  SourceConnectorsListResponseSchema,
  SyncCheckApplyRequestSchema,
  SyncCheckResultSchema,
  type Snapshot,
  type SyncCheckResult,
} from '@crystalith/shared';
import { eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks, sourceConnectorBindings } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';
import { AppHttpError, ErrorCode } from '../../shared/errors.ts';
import { requirePositiveIntId } from '../../shared/ids.ts';
import {
  BUILTIN_CONNECTORS,
  getBuiltinConnector,
  normalizeConnectionConfig,
} from './connectors.ts';
import { buildFilesystemSnapshot, getConnectorDiagnostics } from './scanner.ts';
import {
  applyImportScopeToBinding,
  applySyncCheckToBinding,
  buildSyncCandidates,
  filterSnapshotByScope,
  normalizeImportScope,
  serializeBinding,
} from './sync.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredSchemaKeys(schema: Record<string, unknown>): string[] {
  if (!Array.isArray(schema.required)) return [];
  return schema.required.filter((key): key is string => typeof key === 'string');
}

function schemaPropertyKeys(schema: Record<string, unknown>): string[] {
  const properties = schema.properties;
  if (!isRecord(properties)) return [];
  return Object.keys(properties);
}

function readThrownExtras(error: unknown): {
  message: string;
  status?: number;
  hint?: string;
  details?: unknown;
  errorCode?: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  if (!isRecord(error)) return { message };
  return {
    message,
    status: typeof error.status === 'number' ? error.status : undefined,
    hint: typeof error.hint === 'string' ? error.hint : undefined,
    details: error.details,
    errorCode: typeof error.errorCode === 'string' ? error.errorCode : undefined,
  };
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/notebooks/:nid/source-connectors',
    method: 'get',
    summary: '列出可用连接器类型',
    tags: ['source-connectors'],
    responses: { 200: { description: '连接器描述' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connectors/:connectorId/bindings',
    method: 'post',
    summary: '创建连接器绑定',
    tags: ['source-connectors'],
    responses: { 201: { description: '已创建的绑定' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/snapshot',
    method: 'post',
    summary: '为绑定生成文件系统快照',
    tags: ['source-connectors'],
    responses: { 200: { description: '快照' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/sync-check',
    method: 'post',
    summary: '对比当前快照与已确认基线',
    tags: ['source-connectors'],
    responses: { 200: { description: '同步检查结果' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/sync-check/apply',
    method: 'post',
    summary: '导入新增/变更的同步候选项',
    tags: ['source-connectors'],
    responses: { 200: { description: '导入结果' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connector-bindings/:bindingId/import-scope',
    method: 'post',
    summary: '设定导入范围并导入所选文件',
    tags: ['source-connectors'],
    responses: { 200: { description: '导入结果' } },
  },
  {
    path: '/v2/source-connector-bindings/:id/sync',
    method: 'post',
    summary: 'sync-check 别名',
    tags: ['source-connectors'],
    responses: { 200: { description: '同步检查结果' } },
  },
  {
    path: '/v2/source-connector-bindings/:id',
    method: 'delete',
    summary: '删除连接器绑定',
    tags: ['source-connectors'],
    responses: { 204: { description: '已删除' } },
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
  // c44: unavailable connector → 409 with install hint (v1 _get_connector_plugin_or_409)
  if (!connector) {
    throw new ConnectorUnavailableError(connectorId);
  }
  return connector;
}

/** H3 fix: proper Error subclass instead of plain object throw. */
class ConnectorUnavailableError extends Error {
  status = 409;
  body: Record<string, unknown>;
  constructor(connectorId: string) {
    super(`Source connector "${connectorId}" is not available`);
    this.name = 'ConnectorUnavailableError';
    this.body = {
      errorCode: 'CONNECTOR_UNAVAILABLE',
      message: `Source connector "${connectorId}" is not available`,
      hint: `Install or enable the "${connectorId}" connector plugin`,
      pluginDiagnostic: { connectorId: connectorId, loaded: false },
    };
  }
}

/**
 * c53: lightweight JSON-schema validation for connection_config (v1 api.py:77-98
 * uses jsonschema Draft7Validator; here we check the subset our built-in
 * connectors declare: type=object, required keys present + non-empty strings,
 * no unknown properties when additionalProperties:false).
 * Returns null on success, or an error message string on failure.
 */
function validateConnectionConfig(
  config: Record<string, unknown>,
  schema: Record<string, unknown> | null,
): string | null {
  // no schema → accept anything
  if (!schema) return null;
  if (schema.type === 'object' && typeof config !== 'object') {
    return 'connection_config must be an object';
  }
  const required = requiredSchemaKeys(schema);
  for (const key of required) {
    const v = config[key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      return `connection_config missing required field: ${key}`;
    }
  }
  if (schema.additionalProperties === false) {
    const allowed = new Set(schemaPropertyKeys(schema));
    for (const key of Object.keys(config)) {
      if (!allowed.has(key)) return `connection_config unknown field: ${key}`;
    }
  }
  return null;
}

function throwStatusError(
  status: number,
  message: string,
  details?: Record<string, unknown>,
): never {
  const code =
    status === 400
      ? ErrorCode.INVALID_REQUEST
      : status === 409
        ? ErrorCode.CONFLICT
        : ErrorCode.INTERNAL_ERROR;
  throw new AppHttpError(code, message, details);
}

async function runSyncCheck(
  notebookId: number,
  binding: typeof sourceConnectorBindings.$inferSelect,
): Promise<SyncCheckResult> {
  getConnectorOr404(binding.connectorId);

  let baseSnapshot: Snapshot | null = null;
  if (binding.lastConfirmedSnapshot) {
    baseSnapshot = binding.lastConfirmedSnapshot;
  }

  const currentSnapshot = await buildFilesystemSnapshot(
    binding.connectorId,
    binding.connectionConfig,
  );

  let scopeDirectories: string[] = [];
  let scopeFiles: string[] = [];
  if (binding.importScope) {
    try {
      const normalized = normalizeImportScope(binding.importScope);
      scopeDirectories = normalized.directories;
      scopeFiles = normalized.files;
    } catch (error) {
      const err = readThrownExtras(error);
      if (err.errorCode !== 'IMPORT_SCOPE_EMPTY') throw error;
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
    checkedAt: new Date().toISOString(),
    baseSnapshot: scopedBase,
    currentSnapshot: scopedCurrent,
    candidates,
  };

  db()
    .update(sourceConnectorBindings)
    .set({
      lastSyncCheckResult: result,
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
  .get(
    '/notebooks/:nid/source-connectors',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      requireNotebook(nid);

      const connectors = await Promise.all(
        BUILTIN_CONNECTORS.map(async (connector) => ({
          ...connector,
          diagnostics: await getConnectorDiagnostics(connector.connectorId, null),
        })),
      );

      return { connectors };
    },
    { response: SourceConnectorsListResponseSchema },
  )

  .post(
    '/notebooks/:nid/source-connectors/:connectorId/bindings',
    ({ params, body, set }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      requireNotebook(nid);

      const connectorId = String(params.connectorId ?? '').trim();
      const connector = getConnectorOr404(connectorId);

      const config = normalizeConnectionConfig(connectorId, body.connectionConfig);

      // c53: validate connection_config against the connector's JSON schema
      // (v1 api.py:77-98,199-200 Draft7Validator). Malformed → 400.
      const validationError = validateConnectionConfig(config, connector.connectionConfigSchema);
      if (validationError) {
        throw new AppHttpError(ErrorCode.INVALID_REQUEST, validationError);
      }

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
    },
    {
      body: SourceConnectorBindingCreateRequestSchema,
      response: SourceConnectorBindingSchema,
    },
  )
  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/snapshot',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const bindingId = requirePositiveIntId(params.bindingId, 'binding id');
      const binding = getBindingOr404(nid, bindingId);
      getConnectorOr404(binding.connectorId);

      try {
        return await buildFilesystemSnapshot(binding.connectorId, binding.connectionConfig);
      } catch (error) {
        const message = error instanceof Error ? error.message : '连接器快照枚举失败';
        throw new AppHttpError(ErrorCode.INTERNAL_ERROR, '连接器快照枚举失败', {
          hint: '检查连接参数与目录权限，或查看后端日志。',
          error: message,
        });
      }
    },
    { response: SnapshotSchema },
  )

  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/sync-check',
    async ({ params }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const bindingId = requirePositiveIntId(params.bindingId, 'binding id');
      const binding = getBindingOr404(nid, bindingId);
      return runSyncCheck(nid, binding);
    },
    { response: SyncCheckResultSchema },
  )

  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/sync-check/apply',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const bindingId = requirePositiveIntId(params.bindingId, 'binding id');
      const binding = getBindingOr404(nid, bindingId);
      const syncCheckId = body.syncCheckId;

      try {
        return await applySyncCheckToBinding(nid, binding, syncCheckId);
      } catch (error) {
        const err = readThrownExtras(error);
        if (err.status) {
          throwStatusError(err.status, err.message, {
            ...(err.hint ? { hint: err.hint } : {}),
            ...(err.details ? { details: err.details } : {}),
          });
        }
        throw error;
      }
    },
    {
      body: SyncCheckApplyRequestSchema,
      response: ImportScopeApplyResponseSchema,
    },
  )

  .post(
    '/notebooks/:nid/source-connector-bindings/:bindingId/import-scope',
    async ({ params, body }) => {
      const nid = requirePositiveIntId(params.nid, 'notebook id');
      const bindingId = requirePositiveIntId(params.bindingId, 'binding id');
      const binding = getBindingOr404(nid, bindingId);
      getConnectorOr404(binding.connectorId);

      const scope = body;

      try {
        normalizeImportScope(scope);
      } catch (error) {
        const err = readThrownExtras(error);
        throwStatusError(err.status ?? 400, err.message, err.hint ? { hint: err.hint } : undefined);
      }

      let currentSnapshot: Snapshot;
      try {
        currentSnapshot = await buildFilesystemSnapshot(
          binding.connectorId,
          binding.connectionConfig,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : '连接器快照枚举失败';
        throw new AppHttpError(ErrorCode.INTERNAL_ERROR, '连接器快照枚举失败', {
          hint: '检查连接参数与目录权限，或查看后端日志。',
          error: message,
        });
      }

      return applyImportScopeToBinding(nid, binding, scope, currentSnapshot);
    },
    {
      body: ImportScopeSchema,
      response: ImportScopeApplyResponseSchema,
    },
  )
  .post(
    '/source-connector-bindings/:id/sync',
    async ({ params }) => {
      const bindingId = requirePositiveIntId(params.id, 'binding id');
      const binding = db()
        .select()
        .from(sourceConnectorBindings)
        .where(eq(sourceConnectorBindings.id, bindingId))
        .get();
      if (!binding) throw new NotFoundError(`Connector binding ${bindingId} not found`);
      return runSyncCheck(binding.notebookId, binding);
    },
    { response: SyncCheckResultSchema },
  )

  .delete(
    '/source-connector-bindings/:id',
    ({ params, set }) => {
      const id = requirePositiveIntId(params.id, 'binding id');
      const existing = db()
        .select()
        .from(sourceConnectorBindings)
        .where(eq(sourceConnectorBindings.id, id))
        .get();
      if (!existing) throw new NotFoundError(`Connector binding ${id} not found`);

      db().delete(sourceConnectorBindings).where(eq(sourceConnectorBindings.id, id)).run();
      set.status = 204;
      return;
    },
    { response: { 204: Empty204Schema } },
  );

registerApiDoc(apiDocs);
