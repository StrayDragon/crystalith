// c132 r486 (seam ④) — origin filter at the two retrieval choke points:
// searchVectors (KNN) and the keyword channel default to source-origin chunks
// only, so output indexing (r485) cannot change existing citation semantics.
// Global scope (notebookId null) is locked here too: KNN drops the partition
// predicate and crosses notebooks.
//
// Hermetic: config seeded with tiny DIMS before setupIntegrationEnv so the
// vec table is created at DIMS; vectors are crafted by hand (no embed calls).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

const DIMS = 4;

import { insertChunk } from '../../src/db/chunks.ts';
import { ftsSearch } from '../../src/db/fts.ts';
import { notebooks, sources } from '../../src/db/schema.ts';
import { insertChunkVector, searchVectors } from '../../src/db/vectors.ts';
import { KeywordStrategy } from '../../src/rag/keyword-strategy.ts';
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
    raw: {},
  });
  setupIntegrationEnv();
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

describe('r486 origin filter — existing retrieval callers see source chunks only', () => {
  it('KNN default excludes output-origin chunks; explicit sets widen it', async () => {
    const orm = getOrm();
    const nid = orm.insert(notebooks).values({ name: 'origin-nb' }).returning().get().id;
    const src = orm
      .insert(sources)
      .values({ notebookId: nid, filename: 'src.md', status: 'ready' })
      .returning()
      .get().id;

    const srcChunk = await insertChunk({
      sourceId: src,
      chunkIndex: 0,
      text: '来源资料块：向量检索基础',
    });
    // A derived-output container row (T4 adds derived_output_id; the chunk
    // layer semantics are what r486 locks here).
    const derived = orm
      .insert(sources)
      .values({ notebookId: nid, filename: 'GUIDE-9', status: 'ready' })
      .returning()
      .get().id;
    const outChunk = await insertChunk({
      sourceId: derived,
      chunkIndex: 0,
      text: '产出块：向量检索实践指南',
      originType: 'output',
      originId: 9,
    });

    const vec = [1, 0, 0, 0];
    await insertChunkVector(orm, srcChunk.id, nid, src, vec);
    await insertChunkVector(orm, outChunk.id, nid, derived, vec);

    const byDefault = await searchVectors(orm, vec, nid, 10);
    expect(byDefault.map((h) => h.rowid)).toEqual([srcChunk.id]);

    const outputsOnly = await searchVectors(orm, vec, nid, 10, undefined, ['output']);
    expect(outputsOnly.map((h) => h.rowid)).toEqual([outChunk.id]);

    const all = await searchVectors(orm, vec, nid, 10, undefined, ['source', 'output']);
    expect(all.map((h) => h.rowid).sort()).toEqual([srcChunk.id, outChunk.id].sort());
  });

  it('keyword channel: KeywordStrategy defaults to source, ftsSearch stays opt-in', async () => {
    const orm = getOrm();
    const nid = orm.select().from(notebooks).all().at(-1)!.id;

    const strategy = new KeywordStrategy();
    const hits = await strategy.retrieve('向量检索', nid);
    expect(hits.length).toBeGreaterThan(0);
    // Derived output chunks never leak into strategy retrieval.
    for (const h of hits) expect(h.text).toContain('来源资料块');

    const unrestricted = await ftsSearch(orm, '向量检索', { notebookId: nid, topK: 10 });
    expect(unrestricted.length).toBeGreaterThan(hits.length);
  });

  it('global KNN (notebookId null) crosses notebooks', async () => {
    const orm = getOrm();
    const nb1 = orm.insert(notebooks).values({ name: 'g1' }).returning().get().id;
    const nb2 = orm.insert(notebooks).values({ name: 'g2' }).returning().get().id;
    const mk = (nid: number, name: string) =>
      orm
        .insert(sources)
        .values({ notebookId: nid, filename: name, status: 'ready' })
        .returning()
        .get().id;
    const s1 = mk(nb1, 'g1.md');
    const s2 = mk(nb2, 'g2.md');
    const c1 = await insertChunk({ sourceId: s1, chunkIndex: 0, text: '全局语义命中甲' });
    const c2 = await insertChunk({ sourceId: s2, chunkIndex: 0, text: '全局语义命中乙' });
    const vec = [0, 1, 0, 0];
    await insertChunkVector(orm, c1.id, nb1, s1, vec);
    await insertChunkVector(orm, c2.id, nb2, s2, vec);

    const global = await searchVectors(orm, vec, null, 10);
    const notebooksHit = global.map((h) => h.notebook_id);
    // Same-DB earlier cases may also match — the contract under test is that
    // both notebooks' chunks are reachable without a partition predicate.
    expect(notebooksHit).toContain(nb1);
    expect(notebooksHit).toContain(nb2);
  });
});
