// c132 (seam ②) — SearchService unit seam: RRF fusion over both channels,
// scope filtering, facets, topK clamping (r489), and the degradation matrix
// (r488: keyword-only + explicit flag; never a hard failure).
// Hermetic: mock.module('ai') embed/embedMany before server imports; temp DB
// via setupIntegrationEnv; vectors crafted by hand at the seeded DIMS.
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

import { sql } from 'drizzle-orm';

import { insertChunk } from '../../src/db/chunks.ts';
import { notebooks, outputs, sources } from '../../src/db/schema.ts';
import { insertChunkVector } from '../../src/db/vectors.ts';
import { indexOutputForSearch } from '../../src/features/outputs/auto-index.ts';
import { knowledgeSearch } from '../../src/rag/search-service.ts';
import { getKnowledgeSearchSettings } from '../../src/shared/config-settings.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

beforeAll(() => {
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
    raw: { search: { kb: { default_top_k: 5, max_top_k: 3, budget_ms: 60000 } } },
  });
  setupIntegrationEnv();
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

function seedNotebook(name: string): number {
  return getOrm().insert(notebooks).values({ name }).returning().get().id;
}

async function seedSourceChunk(nid: number, filename: string, text: string): Promise<number> {
  const src = getOrm()
    .insert(sources)
    .values({ notebookId: nid, filename, status: 'ready' })
    .returning()
    .get();
  const chunk = await insertChunk({ sourceId: src.id, chunkIndex: 0, text });
  await insertChunkVector(getOrm(), chunk.id, nid, src.id, [1, 0, 0, 0]);
  return chunk.id;
}

describe('r484/r489 SearchService', () => {
  it('config parses defaults and clamps request topK to max_top_k', async () => {
    const cfg = getKnowledgeSearchSettings();
    expect(cfg.default_top_k).toBe(5);
    expect(cfg.max_top_k).toBe(3);
    expect(cfg.budget_ms).toBe(60000);

    const nbA = seedNotebook('svc-a');
    await seedSourceChunk(nbA, 'a1.md', '检索语义资料甲');
    await seedSourceChunk(nbA, 'a2.md', '检索语义资料乙');
    await seedSourceChunk(nbA, 'a3.md', '检索语义资料丙');
    await seedSourceChunk(nbA, 'a4.md', '检索语义资料丁');

    const res = await knowledgeSearch('检索语义', { kind: 'all' }, { topK: 50 });
    expect(res.items.length).toBeLessThanOrEqual(3);
  });

  it('fuses channels, scopes notebooks, and builds facets with jump context', async () => {
    const nbA = seedNotebook('svc-fuse-a');
    const nbB = seedNotebook('svc-fuse-b');
    const chunkA = await seedSourceChunk(nbA, 'fuse-a.md', '全局搜索融合语义命中');
    const chunkB = await seedSourceChunk(nbB, 'fuse-b.md', '全局搜索融合另一命中');

    const all = await knowledgeSearch('全局搜索融合', { kind: 'all' });
    const ids = all.items.map((i) => i.chunkId);
    expect(ids).toContain(chunkA);
    expect(ids).toContain(chunkB);
    expect(all.facets.notebooks.length).toBeGreaterThanOrEqual(2);
    expect(all.facets.originTypes).toContainEqual({ type: 'source', count: expect.any(Number) });

    // Jump context present on every item.
    for (const item of all.items) {
      expect(item.sourceTitle).toBeTruthy();
      expect(item.notebookTitle).toBeTruthy();
      expect(item.originType).toBe('source');
    }

    const scoped = await knowledgeSearch('全局搜索融合', { kind: 'notebook', notebookId: nbA });
    expect(scoped.items.map((i) => i.chunkId)).toEqual([chunkA]);
    expect(scoped.facets.notebooks.map((n) => n.notebookId)).toEqual([nbA]);
  });

  it('searches indexed outputs (origin generalization end-to-end)', async () => {
    const nid = seedNotebook('svc-out');
    const row = getOrm()
      .insert(outputs)
      .values({
        notebookId: nid,
        type: 'GUIDE',
        prompt: null,
        content: {
          title: '产出指南',
          sections: [{ title: 's', content: '产出的独特关键词祖冲之' }],
        },
      })
      .returning()
      .get();
    await indexOutputForSearch(row);

    const res = await knowledgeSearch('祖冲之', { kind: 'notebook', notebookId: nid });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].originType).toBe('output');
    expect(res.items[0].originId).toBe(row.id);
    expect(res.facets.originTypes).toContainEqual({ type: 'output', count: expect.any(Number) });
  });
});

describe('r488 degradation matrix', () => {
  it('dim_mismatch skips the semantic channel but still serves keyword results', async () => {
    const nid = seedNotebook('svc-dim');
    const chunkId = await seedSourceChunk(nid, 'dim.md', '维度不匹配期间关键词命中');

    // Recreate vec_chunks at a wrong width → getIndexState reports dim_mismatch.
    const orm = getOrm();
    orm.run(sql`DROP TABLE vec_chunks`);
    orm.run(
      sql.raw(`CREATE VIRTUAL TABLE vec_chunks USING vec0(
      embedding float[${DIMS + 1}] distance_metric=cosine,
      notebook_id integer partition by,
      source_id integer partition by
    );`),
    );

    const res = await knowledgeSearch('维度不匹配', { kind: 'notebook', notebookId: nid });
    expect(res.degraded).toBe('dim_mismatch');
    expect(res.items.map((i) => i.chunkId)).toContain(chunkId);

    // Restore the table at DIMS so later cases can seed vectors again.
    orm.run(sql`DROP TABLE vec_chunks`);
    orm.run(
      sql.raw(`CREATE VIRTUAL TABLE vec_chunks USING vec0(
      embedding float[${DIMS}] distance_metric=cosine,
      notebook_id integer partition by,
      source_id integer partition by
    );`),
    );
  });

  it('embed failure degrades to keyword-only with a flag', async () => {
    const nid = seedNotebook('svc-embed-down');
    const chunkId = await seedSourceChunk(nid, 'kw.md', '嵌入挂掉时的关键词命中');

    // Break the embedding gateway: swap the mock to throw, then restore.
    mock.module('ai', () => ({
      embed: async () => {
        throw new Error('embed gateway down');
      },
      embedMany: async () => {
        throw new Error('embed gateway down');
      },
    }));
    try {
      const res = await knowledgeSearch('嵌入挂掉', { kind: 'notebook', notebookId: nid });
      expect(res.degraded).toBe('embed_unavailable');
      expect(res.items.map((i) => i.chunkId)).toContain(chunkId);
    } finally {
      mock.module('ai', () => ({
        embed: async () => ({
          embedding: Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0)),
        }),
        embedMany: async ({ values }: { values: string[] }) => ({
          embeddings: values.map(() => Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0))),
        }),
      }));
    }
  });
});
