// Wave D.2 — qa-to-source multi-turn + tag binding per-item diagnostics.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { notebooks, sources, sourceTags } from '../../src/db/schema.ts';
import { createApp } from '../../src/server.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

mock.module('../../src/rag/embedder.ts', () => ({
  embedBatch: async (texts: string[]) => texts.map(() => new Float32Array(1024)),
}));

const BASE = 'http://test.local';
let app: InstanceType<typeof createApp>;
let notebookId: number;
let sourceId: number;
let tagId: number;

beforeAll(() => {
  setupIntegrationEnv();
  app = createApp();
  const orm = getOrm();
  notebookId = orm.insert(notebooks).values({ name: 'd2-nb' }).returning().get().id;
  sourceId = orm
    .insert(sources)
    .values({ notebookId, filename: 'base.md', status: 'ready' })
    .returning()
    .get().id;
  tagId = orm.insert(sourceTags).values({ notebookId, name: 't1' }).returning().get().id;
});

afterAll(() => {
  teardownIntegrationEnv();
});

describe('qa-to-source multi-turn', () => {
  it('accepts messages[] and creates a new source with transcript', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${sourceId}/qa-to-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'What is X?' },
            { role: 'assistant', content: 'X is Y.' },
            { role: 'user', content: 'Why?' },
            { role: 'assistant', content: 'Because Z.' },
          ],
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      sourceId: number;
      filename: string;
      chunkCount: number;
    };
    expect(body.sourceId).toBeGreaterThan(0);
    expect(body.filename).toContain('QA_');
    expect(body.chunkCount).toBeGreaterThan(0);
    const row = getOrm()
      .select()
      .from(sources)
      .all()
      .find((s) => s.id === body.sourceId);
    expect(row?.status).toBe('ready');
  });

  it('rejects empty body with 422', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/${sourceId}/qa-to-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('tag binding per-item diagnostics', () => {
  it('reports SOURCE_NOT_FOUND for missing source ids on assign', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v2/notebooks/${notebookId}/sources/tags/${tagId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: [sourceId, 999_999] }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      applied: number;
      results: Array<{ sourceId: number; ok: boolean; errorCode?: string }>;
    };
    expect(body.applied).toBe(1);
    const missing = body.results.find((r) => r.sourceId === 999_999);
    expect(missing).toEqual({
      sourceId: 999_999,
      ok: false,
      errorCode: 'SOURCE_NOT_FOUND',
    });
    const okRow = body.results.find((r) => r.sourceId === sourceId);
    expect(okRow?.ok).toBe(true);
  });
});
