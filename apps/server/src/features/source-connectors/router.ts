// Source connectors router — /v2/source-connectors
//
// Manages source connector bindings (Obsidian vault, local directory sync).
// Mirrors v1 `features/source_connectors/api.py`.
import { desc, eq } from 'drizzle-orm';
import { Elysia, NotFoundError } from 'elysia';

import { db } from '../../db/index.ts';
import { notebooks, sourceConnectorBindings } from '../../db/schema.ts';
import { registerApiDoc, type OpenApiRoute } from '../../openapi.ts';

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

const apiDocs: OpenApiRoute[] = [
  {
    path: '/v2/source-connectors',
    method: 'get',
    summary: 'List available connector types',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Available connectors' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connectors',
    method: 'get',
    summary: 'List connector bindings for a notebook',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Binding list' } },
  },
  {
    path: '/v2/notebooks/:nid/source-connectors',
    method: 'post',
    summary: 'Create a connector binding',
    tags: ['source-connectors'],
    responses: { 201: { description: 'Created binding' } },
  },
  {
    path: '/v2/source-connectors/:id',
    method: 'delete',
    summary: 'Delete a connector binding',
    tags: ['source-connectors'],
    responses: { 204: { description: 'Deleted' } },
  },
  {
    path: '/v2/source-connectors/:id/sync',
    method: 'post',
    summary: 'Trigger sync check for a connector',
    tags: ['source-connectors'],
    responses: { 200: { description: 'Sync result' } },
  },
];

// ---------------------------------------------------------------------------
// Built-in connector descriptors
// ---------------------------------------------------------------------------

const BUILTIN_CONNECTORS = [
  {
    id: 'obsidian',
    name: 'Obsidian Vault',
    description: 'Sync notes from an Obsidian vault directory',
    capabilities: {
      supports_file_sync: true,
      supports_incremental: true,
      supported_extensions: ['.md'],
    },
    config_schema: {
      vault_path: { type: 'string', description: 'Absolute path to Obsidian vault directory' },
    },
  },
  {
    id: 'local-directory',
    name: 'Local Directory',
    description: 'Sync files from a local directory',
    capabilities: {
      supports_file_sync: true,
      supports_incremental: true,
      supported_extensions: ['.md', '.txt', '.pdf', '.html'],
    },
    config_schema: {
      directory_path: { type: 'string', description: 'Absolute path to directory' },
      include_pattern: { type: 'string', description: 'Glob pattern for included files' },
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeBinding(row: typeof sourceConnectorBindings.$inferSelect) {
  return {
    id: row.id,
    notebook_id: row.notebookId,
    connector_id: row.connectorId,
    connection_config: row.connectionConfig,
    import_scope: row.importScope,
    last_confirmed_snapshot: row.lastConfirmedSnapshot,
    last_sync_check_result: row.lastSyncCheckResult,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sourceConnectorsRouter = new Elysia({ prefix: '/v2' })
  // List available connector types
  .get('/source-connectors', () => BUILTIN_CONNECTORS)

  // List bindings for a notebook
  .get('/notebooks/:nid/source-connectors', ({ params }) => {
    const nid = Number(params.nid);
    const rows = db()
      .select()
      .from(sourceConnectorBindings)
      .where(eq(sourceConnectorBindings.notebookId, nid))
      .orderBy(desc(sourceConnectorBindings.createdAt))
      .all();
    return rows.map(serializeBinding);
  })

  // Create a binding
  .post('/notebooks/:nid/source-connectors', ({ params, body }) => {
    const nid = Number(params.nid);

    // Verify notebook
    const nb = db().select().from(notebooks).where(eq(notebooks.id, nid)).get();
    if (!nb) throw new NotFoundError(`Notebook ${nid} not found`);

    const { connector_id, connection_config } = body as {
      connector_id: string;
      connection_config: Record<string, unknown>;
    };

    const binding = db()
      .insert(sourceConnectorBindings)
      .values({
        notebookId: nid,
        connectorId: connector_id,
        connectionConfig: connection_config,
      })
      .returning()
      .get();

    return serializeBinding(binding);
  })

  // Delete a binding
  .delete('/source-connectors/:id', ({ params, set }) => {
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
  })

  // Trigger sync
  .post('/source-connectors/:id/sync', ({ params }) => {
    const id = Number(params.id);
    const binding = db()
      .select()
      .from(sourceConnectorBindings)
      .where(eq(sourceConnectorBindings.id, id))
      .get();
    if (!binding) throw new NotFoundError(`Connector binding ${id} not found`);

    // Sync is async — mark as pending
    db()
      .update(sourceConnectorBindings)
      .set({
        lastSyncCheckResult: { status: 'pending', started_at: new Date().toISOString() },
      })
      .where(eq(sourceConnectorBindings.id, id))
      .run();

    // TODO: actual sync logic (Obsidian dir scan, file comparison)
    // For now, return a stub acknowledging the request
    return {
      binding_id: id,
      status: 'sync_scheduled',
      message: 'Sync has been scheduled. Check back for results.',
    };
  });

registerApiDoc(apiDocs);
