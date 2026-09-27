// retrieval-and-cache — unified retrieval paths:
//   r224 — outputs and slides reuse the same retrieval strategy family: both
//          resolve through ragRegistry's 'embed' registration
//   r233 — studio retrieval goes through the unified RAG registry entry, not
//          raw text slicing
//
// Fixture strategy: overwrite the registry's 'embed' slot with a recording
// fake; then drive the outputs pipeline and the studio slide context builder
// and observe both funnel into the same strategy instance.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { chunks, notebooks, sources, studioSlides } from '../../src/db/schema.ts';
import { resolvePipelineContextChunks } from '../../src/features/outputs/pipeline.ts';
import { getContext } from '../../src/features/studio/service.ts';
import { ragRegistry } from '../../src/rag/registry.ts';
import type { ChunkResult, RetrieveOptions, RAGStrategy } from '../../src/rag/types.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

interface RecordedCall {
  query: string;
  notebookId: number;
  opts?: RetrieveOptions;
}

const calls: RecordedCall[] = [];

let nbId: number;
let srcId: number;
let chunkId: number;

const recordingEmbed: RAGStrategy = {
  id: 'embed',
  name: 'recording embed',
  version: '0.0.0',
  indexSource: async () => {},
  retrieve: async (query: string, notebookId: number, opts?: RetrieveOptions) => {
    calls.push({ query, notebookId, opts });
    return [
      {
        chunkId,
        text: 'registry-served chunk text',
        score: 0.9,
        sourceId: srcId,
        chunkIndex: 0,
      },
    ];
  },
  isIndexed: async () => true,
  deleteSource: async () => {},
};

beforeAll(() => {
  setupIntegrationEnv();
  const orm = getOrm();
  nbId = orm.insert(notebooks).values({ name: 'unified-retrieval-nb' }).returning().get().id;
  srcId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'unified.md', status: 'ready' })
    .returning()
    .get().id;
  chunkId = orm
    .insert(chunks)
    .values({ sourceId: srcId, chunkIndex: 0, text: 'unified chunk' })
    .returning()
    .get().id;
  ragRegistry.register(recordingEmbed);
});

afterAll(teardownIntegrationEnv);

describe('r233 studio retrieval goes through the unified RAG registry', () => {
  it('studio slide context is served by the registry embed strategy', async () => {
    // covers: r233
    calls.length = 0;
    const slide = getOrm()
      .insert(studioSlides)
      .values({
        notebookId: nbId,
        title: 'Deck',
        prompt: 'deck prompt',
        sourceIds: [srcId],
      })
      .returning()
      .get();

    const context = await getContext(slide);
    // The context text is exactly what the registry strategy returned — not a
    // raw text slice of some other source.
    expect(context).toBe('registry-served chunk text');
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toBe('deck prompt');
    expect(calls[0].notebookId).toBe(nbId);
    // Scoped to the slide's sources, default tuning (no preference set).
    expect(calls[0].opts?.sourceIds).toEqual([srcId]);
    expect(calls[0].opts?.topK).toBe(8);
    expect(calls[0].opts?.minScore).toBe(0.2);
  });
});

describe('r224 outputs and slides share the same retrieval strategy', () => {
  it('outputs pipeline hits the same registry embed registration as slides', async () => {
    // covers: r224
    calls.length = 0;
    const rows = await resolvePipelineContextChunks({
      model: {} as never,
      notebookId: nbId,
      type: 'FAQ',
      sourceIds: [srcId],
      prompt: 'faq prompt',
    });
    // Same single strategy instance served the outputs path…
    expect(rows.map((row) => row.text)).toEqual(['registry-served chunk text']);
    expect(calls).toHaveLength(1);
    // …the same registration the slides path used above (r233 asserted it),
    // driven by the shared buildOutputQuery retrieval-query construction.
    expect(calls[0].query).toContain('faq prompt');
    expect(calls[0].query).toContain('闪卡');
  });
});
