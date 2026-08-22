// Sync-check apply error paths (regression: 409 SYNC_CHECK_REQUIRED used to
// degrade to a plain-text 500 when the translation layer was removed).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { notebooks, sourceConnectorBindings } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let bindingId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  notebookId = getOrm().insert(notebooks).values({ name: 'sync-apply-err' }).returning().get().id;
  bindingId = getOrm()
    .insert(sourceConnectorBindings)
    .values({
      notebookId,
      connectorId: 'obsidian',
      connectionConfig: { vaultPath: '/tmp/does-not-matter' },
    })
    .returning()
    .get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('sync-check apply error envelope', () => {
  it('returns 409 CONFLICT with SYNC_CHECK_REQUIRED when no sync_check ran', async () => {
    const res = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/source-connector-bindings/${bindingId}/sync-check/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncCheckId: 'sc_missing' }),
        },
      ),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      errorCode?: string;
      message?: string;
      details?: { errorCode?: string };
    };
    expect(body.errorCode).toBe('CONFLICT');
    expect(body.message).toContain('sync_check');
    expect(body.details?.errorCode).toBe('SYNC_CHECK_REQUIRED');
  });

  it('returns 409 CONFLICT with SYNC_CHECK_OUTDATED when the id mismatches', async () => {
    // Seed a lastSyncCheckResult so the REQUIRED gate passes, then mismatch the id.
    const orm = getOrm();
    orm
      .update(sourceConnectorBindings)
      .set({
        lastSyncCheckResult: {
          id: 'sc_real',
          createdAt: new Date().toISOString(),
          added: [],
          updated: [],
          removed: [],
          currentSnapshot: { connectorId: 'obsidian', rootName: 'vault', entries: [] },
        },
      })
      .where(eqBinding(bindingId))
      .run();

    const res = await app.handle(
      new Request(
        `${BASE}/v2/notebooks/${notebookId}/source-connector-bindings/${bindingId}/sync-check/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syncCheckId: 'sc_stale' }),
        },
      ),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      errorCode?: string;
      details?: { errorCode?: string; expected?: string; hint?: string };
    };
    expect(body.errorCode).toBe('CONFLICT');
    expect(body.details?.errorCode).toBe('SYNC_CHECK_OUTDATED');
    expect(body.details?.expected).toBe('sc_real');
    expect(body.details?.hint).toContain('重新执行');
  });
});

function eqBinding(id: number) {
  // Local helper to keep the import list minimal.
  const { eq } = require('drizzle-orm') as typeof import('drizzle-orm');
  return eq(sourceConnectorBindings.id, id);
}
