// c131 real-world regression (2026-10-13, finding B): with sourceIds scoped
// across a large and a small source, the small source's only hit must keep a
// slot in the merged top-K. The old merge sorted all per-source hits by
// distance and sliced top-K — a 5-chunk source filled all slots and the
// 1-chunk source was dropped entirely.
//
// Hermetic: config seeded with tiny DIMS before setupIntegrationEnv so the
// vec table is created at DIMS; vectors are crafted by hand (no embed calls).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

const DIMS = 4;

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
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

describe('searchVectors multi-source merge keeps small sources represented', () => {
  it('guarantees the 1-chunk source a slot when a 5-chunk source dominates ranking', async () => {
    const orm = getOrm();
    const { insertChunkVector, searchVectors } = await import('../../src/db/vectors.ts');

    const nid = orm.insert(notebooks).values({ name: 'merge-nb' }).returning().get().id;
    const big = orm
      .insert(sources)
      .values({ notebookId: nid, filename: 'big.md', status: 'ready' })
      .returning()
      .get().id;
    const small = orm
      .insert(sources)
      .values({ notebookId: nid, filename: 'small.md', status: 'ready' })
      .returning()
      .get().id;

    // Query points at e0. Big source: 5 chunks all closer to e0 than the
    // small source's single chunk (angle grows with index, small is worst).
    const at = (angle: number) => {
      const v = new Float32Array(DIMS);
      v[0] = Math.cos(angle);
      v[1] = Math.sin(angle);
      return v;
    };
    for (let i = 0; i < 5; i++) {
      const chunkId = orm
        .insert(chunks)
        .values({ sourceId: big, chunkIndex: i, text: `big-${i}` })
        .returning()
        .get().id;
      await insertChunkVector(orm, chunkId, nid, big, at(0.01 * (i + 1)));
    }
    const smallChunkId = orm
      .insert(chunks)
      .values({ sourceId: small, chunkIndex: 0, text: 'small-0' })
      .returning()
      .get().id;
    await insertChunkVector(orm, smallChunkId, nid, small, at(0.5));

    const hits = await searchVectors(orm, at(0), nid, 5, [big, small]);

    // Small source kept its slot despite ranking last on every chunk.
    expect(hits.some((h) => h.source_id === small)).toBe(true);
    expect(hits).toHaveLength(5);
    // r229: result stays distance-ascending (score descending).
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].distance).toBeGreaterThanOrEqual(hits[i - 1].distance);
    }
    // The 5th-best big chunk is the one sacrificed, not the small source.
    const bigHits = hits.filter((h) => h.source_id === big);
    expect(bigHits).toHaveLength(4);
  });

  it('single-source scope behaves as before (pure distance order)', async () => {
    const orm = getOrm();
    const { insertChunkVector, searchVectors } = await import('../../src/db/vectors.ts');
    const nid = orm.insert(notebooks).values({ name: 'merge-nb2' }).returning().get().id;
    const src = orm
      .insert(sources)
      .values({ notebookId: nid, filename: 'solo.md', status: 'ready' })
      .returning()
      .get().id;
    const at = (angle: number) => {
      const v = new Float32Array(DIMS);
      v[0] = Math.cos(angle);
      v[1] = Math.sin(angle);
      return v;
    };
    for (let i = 0; i < 3; i++) {
      const chunkId = orm
        .insert(chunks)
        .values({ sourceId: src, chunkIndex: i, text: `solo-${i}` })
        .returning()
        .get().id;
      await insertChunkVector(orm, chunkId, nid, src, at(0.02 * (i + 1)));
    }
    const hits = await searchVectors(orm, at(0), nid, 2, [src]);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.chunk_index)).toEqual([0, 1]);
  });
});
