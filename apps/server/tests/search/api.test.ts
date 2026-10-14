// c132 (seam ①) — POST /v2/search wire contract over the integration app:
// scope semantics (global crosses notebooks / notebook-limited), facets,
// originTypes filtering, jump-context fields, degraded absence in the happy
// path, and request validation failures.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

const DIMS = 4;

mock.module('ai', () => ({
  embed: async () => ({
    embedding: Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0)),
  }),
  embedMany: async ({ values }: { values: string[] }) => ({
    embeddings: values.map(() => Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0))),
  }),
}));

import { insertChunk } from '../../src/db/chunks.ts';
import { notebooks, outputs, sources } from '../../src/db/schema.ts';
import { insertChunkVector } from '../../src/db/vectors.ts';
import { indexOutputForSearch } from '../../src/features/outputs/auto-index.ts';
import { createApp } from '../../src/server.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

let app: ReturnType<typeof createApp>;
let nbA: number;
let nbB: number;
let chunkA: number;

beforeAll(async () => {
  resetConfig({
    models: {
      defaults: { embedding: 'test-embed' },
      available: [
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          embedding: { dims: DIMS, modalities: ['text'] },
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
  setupIntegrationEnv();
  app = createApp();

  const orm = getOrm();
  nbA = orm.insert(notebooks).values({ name: 'api-甲' }).returning().get().id;
  nbB = orm.insert(notebooks).values({ name: 'api-乙' }).returning().get().id;
  const srcA = orm
    .insert(sources)
    .values({ notebookId: nbA, filename: 'api-a.md', status: 'ready' })
    .returning()
    .get();
  const srcB = orm
    .insert(sources)
    .values({ notebookId: nbB, filename: 'api-b.md', status: 'ready' })
    .returning()
    .get();
  const c1 = await insertChunk({ sourceId: srcA.id, chunkIndex: 0, text: '接口合约命中甲祖冲之' });
  const c2 = await insertChunk({ sourceId: srcB.id, chunkIndex: 0, text: '接口合约命中乙' });
  await insertChunkVector(orm, c1.id, nbA, srcA.id, [1, 0, 0, 0]);
  await insertChunkVector(orm, c2.id, nbB, srcB.id, [1, 0, 0, 0]);
  chunkA = c1.id;

  const out = orm
    .insert(outputs)
    .values({
      notebookId: nbB,
      type: 'GUIDE',
      prompt: null,
      content: { title: '产出指南', sections: [{ title: 's', content: '产出关键词郭守敬' }] },
    })
    .returning()
    .get();
  await indexOutputForSearch(out);
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

function search(body: unknown): Promise<Response> {
  return app.handle(
    new Request('http://localhost/v2/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('r484 POST /v2/search wire', () => {
  it('global scope crosses notebooks with facets and jump context', async () => {
    const res = await search({ query: '接口合约命中' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{
        chunkId: number;
        notebookId: number;
        notebookTitle: string;
        originType: string;
        sourceTitle: string;
      }>;
      facets: { notebooks: Array<{ notebookId: number }>; originTypes: Array<{ type: string }> };
      degraded?: string;
    };
    const nids = body.results.map((r) => r.notebookId);
    expect(nids).toContain(nbA);
    expect(nids).toContain(nbB);
    expect(body.degraded).toBeUndefined();
    for (const r of body.results) {
      expect(r.notebookTitle).toBeTruthy();
      expect(r.sourceTitle).toBeTruthy();
    }
    expect(body.facets.notebooks.map((n) => n.notebookId).sort()).toEqual([nbA, nbB].sort());
    expect(body.facets.originTypes.length).toBeGreaterThan(0);
  });

  it('notebook scope limits results to that notebook', async () => {
    const res = await search({
      query: '接口合约命中',
      scope: { kind: 'notebook', notebookId: nbA },
    });
    const body = (await res.json()) as { results: Array<{ chunkId: number; notebookId: number }> };
    expect(body.results.map((r) => r.chunkId)).toEqual([chunkA]);
    expect(body.results.every((r) => r.notebookId === nbA)).toBe(true);
  });

  it('originTypes filter excludes outputs when narrowed to source', async () => {
    const all = (await (await search({ query: '郭守敬' })).json()) as {
      results: Array<{ originType: string; originId: number | null }>;
    };
    expect(all.results.length).toBeGreaterThan(0);
    expect(all.results.some((r) => r.originType === 'output')).toBe(true);

    const narrowed = (await (await search({ query: '郭守敬', originTypes: ['source'] })).json())
      .results as Array<{ originType: string }>;
    // The mock embedder gives every chunk an identical vector, so the KNN
    // channel can surface unrelated source chunks — the contract under test is
    // that NO output-origin item survives the narrowing.
    expect(narrowed.every((r) => r.originType === 'source')).toBe(true);
  });

  it('bounds topK: within wire max it clamps (200), beyond it validates (422)', async () => {
    const clamped = await search({ query: '接口合约', topK: 499 });
    expect(clamped.status).toBe(200);
    const rejected = await search({ query: '接口合约', topK: 10_000 });
    expect(rejected.status).toBe(422);
  });

  it('rejects an empty query with a validation error', async () => {
    const res = await search({ query: '' });
    expect(res.status).toBe(422);
  });
});
