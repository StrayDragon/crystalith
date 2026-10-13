// embedding-runtime r479 — indexSource stamps chunk embedding metadata
// (embedding_model / embedding_dims), refreshes it on re-embed, and the source
// filename reaches the engine as the document title through the facade.
//
// Hermetic per-file setup (mirrors embed-similarity.test.ts): the 'ai' module
// is mocked with DIMS-wide vectors and records every batch it receives; config
// is seeded BEFORE setupIntegrationEnv so vec_chunks is created at the declared
// DIMS. No DB / module state leaks across files under `--parallel` isolation.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

import { eq } from 'drizzle-orm';

const DIMS = 6;
const sentBatches: string[][] = [];
const mockVector = () => Array.from({ length: DIMS }, (_, i) => (i + 1) / DIMS);

mock.module('ai', () => ({
  Output: { object: <T>(spec: T) => spec },
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    stream: (async function* () {})(),
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  embed: async () => ({ embedding: mockVector() }),
  embedMany: async ({ values }: { values: string[] }) => {
    sentBatches.push([...values]);
    return { embeddings: values.map(() => mockVector()) };
  },
  tool: (def: unknown) => def,
}));

import { db } from '../../src/db/index.ts';
import { chunks, messages, notebooks, sessions, sources } from '../../src/db/schema.ts';
import { countVectors, deleteSourceVectors } from '../../src/db/vectors.ts';
import { convertSessionToSource } from '../../src/features/sessions/convert.ts';
import { sourceExtrasRouter } from '../../src/features/sources/source-extras.router.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import { resetConfig } from '../../src/shared/config.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

let nbId: number;
let sourceId: number;

beforeAll(() => {
  // Seed config FIRST so createDb builds vec_chunks at the declared DIMS
  // (initVecChunks reads getDefaultEmbeddingModel()?.embedding?.dims).
  resetConfig({
    models: {
      defaults: { embedding: 'test-embed' },
      available: [
        {
          id: 'test-embed',
          provider: 'openai',
          model: 'bge-m3-test',
          displayName: 'Test Embed',
          roles: ['embed'],
          capabilities: [],
          embedding: { dims: DIMS, modalities: ['text'], prefixPreset: 'embeddinggemma2' },
          providerConfig: { apiKey: 'test-key' },
        },
      ],
    },
    raw: {},
  });
  setupIntegrationEnv();

  const orm = getOrm();
  nbId = orm.insert(notebooks).values({ name: 'embed-metadata-nb' }).returning().get().id;
  sourceId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'metadata.md', status: 'ready' })
    .returning()
    .get().id;
  orm.insert(chunks).values({ sourceId, chunkIndex: 0, text: '第一段' }).run();
  orm.insert(chunks).values({ sourceId, chunkIndex: 1, text: '第二段' }).run();
});

afterAll(async () => {
  teardownIntegrationEnv();
  resetConfig();
});

describe('r479 indexSource writes model and dims metadata', () => {
  it('stamps embedding_model (entry id) and embedding_dims (actual vector length)', async () => {
    // covers: r479 indexsource-writes-model-and-dims
    await new EmbedStrategy().indexSource(sourceId, nbId);

    const rows = getOrm()
      .select({ model: chunks.embeddingModel, dims: chunks.embeddingDims })
      .from(chunks)
      .where(eq(chunks.sourceId, sourceId))
      .orderBy(chunks.chunkIndex)
      .all();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.model).toBe('test-embed');
      expect(row.dims).toBe(DIMS);
    }
    // Vectors actually landed for every stamped chunk.
    expect(await countVectors(db(), nbId)).toBe(2);
  });

  it('passes the source filename as the document title through the facade', () => {
    // covers: c130 T5 titles wiring — indexSource → embedBatch(titles) → preset
    expect(sentBatches).toEqual([
      ['title: metadata.md | text: 第一段', 'title: metadata.md | text: 第二段'],
    ]);
  });

  it('re-embedding refreshes the metadata instead of leaving stale values', async () => {
    // covers: r479 重嵌后两列反映最新一次嵌入
    const orm = getOrm();
    orm
      .update(chunks)
      .set({ embeddingModel: 'stale-model', embeddingDims: 999 })
      .where(eq(chunks.sourceId, sourceId))
      .run();

    // Production re-embed entries delete vectors before indexSource
    // (handleReEmbedSource / batch.service) — vec_chunks rowid is a PK.
    await deleteSourceVectors(db(), sourceId);
    await new EmbedStrategy().indexSource(sourceId, nbId);

    const rows = orm
      .select({ model: chunks.embeddingModel, dims: chunks.embeddingDims })
      .from(chunks)
      .where(eq(chunks.sourceId, sourceId))
      .orderBy(chunks.chunkIndex)
      .all();
    for (const row of rows) {
      expect(row.model).toBe('test-embed');
      expect(row.dims).toBe(DIMS);
    }
    expect(await countVectors(db(), nbId)).toBe(2);
    // The second indexSource went through the same titled document path.
    expect(sentBatches).toHaveLength(2);
  });
});

describe('r483 direct-write vector paths persist chunk metadata', () => {
  it('sessions convert stamps embedding_model and dims (c131)', async () => {
    const orm = getOrm();
    const sid = orm
      .insert(sessions)
      .values({ notebookId: nbId, title: 'conv' })
      .returning()
      .get().id;
    orm
      .insert(messages)
      .values([
        { sessionId: sid, role: 'user', content: '会话转来源的第一条消息，内容足够成块。' },
        { sessionId: sid, role: 'assistant', content: '会话转来源的第二条消息，内容足够成块。' },
      ])
      .run();

    const result = await convertSessionToSource(nbId, sid, {});
    expect(result.chunkCount).toBeGreaterThan(0);

    const rows = orm
      .select({ model: chunks.embeddingModel, dims: chunks.embeddingDims })
      .from(chunks)
      .where(eq(chunks.sourceId, result.sourceId))
      .all();
    expect(rows.length).toBe(result.chunkCount);
    for (const row of rows) {
      expect(row.model).toBe('test-embed');
      expect(row.dims).toBe(DIMS);
    }
  });

  it('qa-to-source stamps embedding_model and dims (c131)', async () => {
    const res = await sourceExtrasRouter.handle(
      new Request(`http://local/v2/notebooks/${nbId}/sources/${sourceId}/qa-to-source`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: '检索元数据如何落库', answer: '直写路径也要落库。' }),
      }),
    );
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { sourceId: number };
    expect(body.sourceId).toBeGreaterThan(0);

    const rows = getOrm()
      .select({ model: chunks.embeddingModel, dims: chunks.embeddingDims })
      .from(chunks)
      .where(eq(chunks.sourceId, body.sourceId))
      .all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.model).toBe('test-embed');
      expect(row.dims).toBe(DIMS);
    }
  });
});
