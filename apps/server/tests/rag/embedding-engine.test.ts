import { describe, expect, it } from 'bun:test';

// embedding-runtime r475/r476/r477 — engine prefix presets & dimension assertion.
//
// Hermetic per-file setup: a fake EmbeddingModelV4 built in this file records
// the text batches the engine actually sends through the REAL `ai`
// embed/embedMany, and returns fixed-length vectors. No module mocks, no DB,
// no config — nothing leaks across files under `--parallel` isolation.
import type { EmbeddingModelV4 } from '@ai-sdk/provider';
import type { ModelEmbeddingCapability } from '@crystalith/shared';

import { createEmbeddingEngine } from '../../src/rag/embedding-engine.ts';

/** Fake provider model: records every doEmbed() values batch it receives. */
function createFakeEmbedModel(dims: number): { model: EmbeddingModelV4; sentBatches: string[][] } {
  const sentBatches: string[][] = [];
  const model: EmbeddingModelV4 = {
    specificationVersion: 'v4',
    provider: 'fake-embed',
    modelId: `fake-embed-${dims}`,
    maxEmbeddingsPerCall: undefined,
    supportsParallelCalls: false,
    async doEmbed({ values }) {
      sentBatches.push([...values]);
      return {
        embeddings: values.map(() => Array.from({ length: dims }, (_, i) => (i + 1) / dims)),
        warnings: [],
      };
    },
  };
  return { model, sentBatches };
}

const GEMMA2_CAPABILITY: ModelEmbeddingCapability = {
  dims: 4,
  modalities: ['text'],
  prefixPreset: 'embeddinggemma2',
};

describe('embedding-engine r475 preset applies to both roles', () => {
  it('query side sends "task: search result | query: {text}"', async () => {
    // covers: r475
    const { model, sentBatches } = createFakeEmbedModel(4);
    const engine = createEmbeddingEngine(model, GEMMA2_CAPABILITY);

    const vector = await engine.embedQuery('什么是知识库');

    expect(sentBatches).toEqual([['task: search result | query: 什么是知识库']]);
    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector).toHaveLength(4);
  });

  it('document side sends "title: {title} | text: {text}" per index', async () => {
    // covers: r475
    const { model, sentBatches } = createFakeEmbedModel(4);
    const engine = createEmbeddingEngine(model, GEMMA2_CAPABILITY);

    const vectors = await engine.embedDocuments(['段落一', '段落二'], {
      titles: ['a.md', 'b.md'],
    });

    expect(sentBatches).toEqual([['title: a.md | text: 段落一', 'title: b.md | text: 段落二']]);
    expect(vectors).toHaveLength(2);
    for (const v of vectors) {
      expect(v).toBeInstanceOf(Float32Array);
      expect(v).toHaveLength(4);
    }
  });

  it('document side defaults a missing title to none', async () => {
    // covers: r475
    const { model, sentBatches } = createFakeEmbedModel(4);
    const engine = createEmbeddingEngine(model, GEMMA2_CAPABILITY);

    await engine.embedDocuments(['无标题段落', '有标题段落'], { titles: ['only-first.md'] });

    expect(sentBatches).toEqual([
      ['title: only-first.md | text: 无标题段落', 'title: none | text: 有标题段落'],
    ]);
  });
});

describe('embedding-engine r476 undeclared model embeds verbatim', () => {
  it('null capability: zero prefix on both roles', async () => {
    // covers: r476
    const { model, sentBatches } = createFakeEmbedModel(3);
    const engine = createEmbeddingEngine(model, null);

    await engine.embedQuery('原样查询');
    await engine.embedDocuments(['文档甲', '文档乙']);

    expect(sentBatches).toEqual([['原样查询'], ['文档甲', '文档乙']]);
  });

  it('capability without prefixPreset: zero prefix but dims still asserted', async () => {
    // covers: r476 + r477 boundary
    const { model, sentBatches } = createFakeEmbedModel(3);
    const engine = createEmbeddingEngine(model, { dims: 3, modalities: ['text'] });

    const vectors = await engine.embedDocuments(['one', 'two'], { titles: ['t.md'] });

    expect(sentBatches).toEqual([['one', 'two']]);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(3);
  });
});

describe('embedding-engine r477 dimension assertion', () => {
  it('query mismatch throws with declared and actual dims', async () => {
    // covers: r477 — provider returns 5-dim vectors while dims declares 4.
    const { model } = createFakeEmbedModel(5);
    const engine = createEmbeddingEngine(model, { dims: 4, modalities: ['text'] });

    expect(engine.embedQuery('x')).rejects.toThrow(/声明 4 维.*实际返回 5 维/);
  });

  it('document mismatch throws with declared and actual dims', async () => {
    // covers: r477 — nothing is returned (hence nothing reaches the vec table).
    const { model, sentBatches } = createFakeEmbedModel(5);
    const engine = createEmbeddingEngine(model, { dims: 4, modalities: ['text'] });

    expect(engine.embedDocuments(['甲', '乙'])).rejects.toThrow(/声明 4 维.*实际返回 5 维/);
    // The provider was called once (and recorded), but the engine surfaced no
    // vectors — callers cannot persist a mismatched batch.
    expect(sentBatches).toHaveLength(1);
  });

  it('matching dims pass through as Float32Array', async () => {
    // covers: r477
    const { model } = createFakeEmbedModel(4);
    const engine = createEmbeddingEngine(model, GEMMA2_CAPABILITY);

    const queryVector = await engine.embedQuery('q');
    const docVectors = await engine.embedDocuments(['d1', 'd2']);

    expect(queryVector).toBeInstanceOf(Float32Array);
    expect(queryVector).toHaveLength(4);
    expect(docVectors).toHaveLength(2);
    for (const v of docVectors) {
      expect(v).toBeInstanceOf(Float32Array);
      expect(v).toHaveLength(4);
    }
  });
});
