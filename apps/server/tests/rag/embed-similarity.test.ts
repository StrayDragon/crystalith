// retrieval-and-cache r229 — Embed strategy distance→similarity conversion.
// sqlite-vec returns cosine `distance`; the embed strategy must score
// `score = max(0, 1 - distance)`, filter with `score >= minScore` (higher
// similarity wins — never `distance >= minScore`, which is inverted), and
// sort by score descending.
//
// Hermetic setup: real vec_chunks table in the temp DB, controlled vectors,
// and a mocked 'ai' embed returning a fixed vector matching the seeded ones.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// The mocked embedding vector: 1024 × 0.01 (matches DEFAULT_EMBEDDING_DIM).
const MOCK_VECTOR = Array.from({ length: 1024 }, () => 0.01);

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  embed: async () => ({ embedding: MOCK_VECTOR }),
  embedMany: async ({ values }: { values: string[] }) => ({
    embeddings: values.map(() => MOCK_VECTOR),
  }),
  tool: (def: unknown) => def,
}));

import { db } from '../../src/db/index.ts';
import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { insertChunkVector, searchVectors } from '../../src/db/vectors.ts';
import { clearCache } from '../../src/rag/cache.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

// Orthogonal to MOCK_VECTOR: +0.01 on the first half, -0.01 on the second.
function orthogonalVector(): number[] {
  return Array.from({ length: 1024 }, (_, i) => (i < 512 ? 0.01 : -0.01));
}

// Cosine 0.3 mixture of the query vector and the orthogonal one:
// for v = a·q + b·o with q ⊥ o, cos(v, q) = a / √(a² + b²) = 0.3 when b² = 1 - a².
function mixtureVector(): number[] {
  const a = 0.3;
  const b = Math.sqrt(1 - a * a);
  const o = orthogonalVector();
  return MOCK_VECTOR.map((q, i) => a * q + b * o[i]);
}

let nbId: number;
let chunkSameId: number;
let chunkOrthoId: number;
let chunkMixId: number;

beforeAll(() => {
  setupIntegrationEnv();
  resetConfig({
    models: {
      defaults: { chat: 'test-chat', embedding: 'test-embed' },
      available: [
        {
          id: 'test-chat',
          provider: 'openai',
          model: 'gpt-4o-test',
          displayName: 'Test Chat',
          roles: ['chat'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-m3-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });

  const orm = getOrm();
  nbId = orm.insert(notebooks).values({ name: 'similarity-nb' }).returning().get().id;
  const sourceId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'vectors.md', status: 'ready' })
    .returning()
    .get().id;
  chunkSameId = orm
    .insert(chunks)
    .values({ sourceId, chunkIndex: 0, text: 'identical to query vector' })
    .returning()
    .get().id;
  chunkOrthoId = orm
    .insert(chunks)
    .values({ sourceId, chunkIndex: 1, text: 'orthogonal to query vector' })
    .returning()
    .get().id;
  chunkMixId = orm
    .insert(chunks)
    .values({ sourceId, chunkIndex: 2, text: 'partial match to query vector' })
    .returning()
    .get().id;

  // vec_chunks rowid must equal the chunk id (KNN joins chunks on it).
  insertChunkVector(db(), chunkSameId, nbId, sourceId, [...MOCK_VECTOR]);
  insertChunkVector(db(), chunkOrthoId, nbId, sourceId, orthogonalVector());
  insertChunkVector(db(), chunkMixId, nbId, sourceId, mixtureVector());
});

afterAll(() => {
  teardownIntegrationEnv();
  resetConfig();
});

describe('r229 embed strategy converts distance to similarity', () => {
  it('scores hits as 1 - distance and sorts by score descending', async () => {
    // covers: r229
    clearCache();
    const results = await new EmbedStrategy().retrieve('query', nbId, {
      topK: 10,
      minScore: 0,
    });
    expect(results).toHaveLength(3);

    // Raw distances straight from sqlite-vec for the same query vector.
    const raw = searchVectors(db(), MOCK_VECTOR, nbId, 10);
    const distanceByChunk = new Map(raw.map((hit) => [hit.rowid, hit.distance]));

    for (const result of results) {
      const distance = distanceByChunk.get(result.chunkId);
      expect(distance).toBeDefined();
      expect(Math.abs(result.score - (1 - (distance ?? 0)))).toBeLessThan(1e-5);
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
    // Descending by similarity (highest first).
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
    // Identical vector ≈ similarity 1; orthogonal ≈ 0; mixture ≈ 0.3.
    const byId = new Map(results.map((r) => [r.chunkId, r.score]));
    expect(byId.get(chunkSameId)).toBeGreaterThan(0.99);
    expect(byId.get(chunkOrthoId)).toBeLessThan(0.001);
    expect(byId.get(chunkMixId)).toBeGreaterThan(0.29);
    expect(byId.get(chunkMixId)).toBeLessThan(0.31);
  });

  it('filters with score >= minScore (direction: higher similarity wins)', async () => {
    // covers: r229
    clearCache();
    const results = await new EmbedStrategy().retrieve('query', nbId, {
      topK: 10,
      minScore: 0.5,
    });
    const ids = results.map((r) => r.chunkId);
    // The near-1 similarity hit survives; the 0.3 and ~0 hits are dropped.
    expect(ids).toContain(chunkSameId);
    expect(ids).not.toContain(chunkMixId);
    expect(ids).not.toContain(chunkOrthoId);
  });
});
