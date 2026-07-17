// Refine citation-aware retrieval + applyFormat test (c29).
//
// Stubs EmbedStrategy.retrieve to return canned chunks (avoids real embedding
// + sqlite-vec search in tests), then exercises retrieveForRefine end-to-end:
// post-filter by source_ids, citation enrichment (strip+snippet, page/para),
// and context format. Also tests applyFormat for all three formats.
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';

// Stub EmbedStrategy.retrieve before importing modules that use it.
mock.module('ai', () => ({
  generateObject: async () => ({ object: {} }),
  generateText: async () => ({ text: 'mocked' }),
  streamText: () => ({
    fullStream: (async function* () {})(),
    textStream: (async function* () {})(),
  }),
  tool: (def: unknown) => def,
}));

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { applyFormat } from '../../src/features/refine/format.ts';
import type { StageLimiters } from '../../src/features/tasks/worker.ts';
import { createStageLimiters } from '../../src/features/tasks/worker.ts';
import { EmbedStrategy } from '../../src/rag/embed-strategy.ts';
import type { ChunkResult } from '../../src/rag/types.ts';
import { setupIntegrationEnv, teardownIntegrationEnv, getOrm } from '../helpers/integration.ts';

beforeAll(() => {
  setupIntegrationEnv();
});

afterAll(() => {
  teardownIntegrationEnv();
});

function makeLimiter(): StageLimiters {
  return createStageLimiters();
}

describe('applyFormat (v1-aligned)', () => {
  it('paragraph: trims the answer', () => {
    expect(applyFormat('paragraph', '  hello  ', '', [])).toEqual({ paragraph: 'hello' });
  });

  it('bullets: parses bullet lines', () => {
    const out = applyFormat('bullets', '- a\n- b', '', []);
    expect(out.bullets).toEqual(['a', 'b']);
  });

  it('structured: explicit construction with defaults + str coercion', () => {
    const out = applyFormat('structured', '{"title":"T","bullets":["x"],"terms":[1,2]}', '', []);
    expect(out.structured?.title).toBe('T');
    expect(out.structured?.bullets).toEqual(['x']);
    // terms coerced to string
    expect(out.structured?.terms).toEqual(['1', '2']);
  });

  it('structured: falls back on invalid JSON', () => {
    const out = applyFormat('structured', 'not json', 'my prompt', [
      { sourceId: 1, sourceName: 's', chunkId: 1, chunkIndex: 0, snippet: 'snip', score: 0.9 },
    ]);
    expect(out.structured?.title).toBe('my prompt');
    expect(out.structured?.bullets).toEqual(['snip']);
    expect(out.structured?.terms).toEqual([]);
  });
});

describe('retrieveForRefine (citation-aware)', () => {
  it('returns empty when no source_ids', async () => {
    const { retrieveForRefine } = await import('../../src/features/refine/retrieve.ts');
    const result = await retrieveForRefine(
      1,
      'prompt',
      [],
      5,
      0.2,
      new AbortController().signal,
      makeLimiter(),
    );
    expect(result.citations).toEqual([]);
    expect(result.evidence).toBe(false);
  });

  it('post-filters by source_ids and enriches citations', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'cite-nb' }).returning().get();
    const src = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'report.pdf', status: 'ready' })
      .returning()
      .get();
    const chunk = orm
      .insert(chunks)
      .values({
        sourceId: src.id,
        chunkIndex: 0,
        text: '  relevant evidence text here  ',
        metadata: { page: 3, paragraph_index: 7 },
      })
      .returning()
      .get();

    // Stub EmbedStrategy.retrieve to return this chunk (skip real embed+search).
    const mockResults: ChunkResult[] = [
      {
        chunk_id: chunk.id,
        text: '  relevant evidence text here  ',
        score: 0.9,
        source_id: src.id,
        chunk_index: 0,
      },
    ];
    EmbedStrategy.prototype.retrieve = async () => mockResults;

    const { retrieveForRefine } = await import('../../src/features/refine/retrieve.ts');
    const result = await retrieveForRefine(
      nb.id,
      'query',
      [src.id],
      5,
      0.2,
      new AbortController().signal,
      makeLimiter(),
    );

    expect(result.evidence).toBe(true);
    expect(result.citations).toHaveLength(1);
    const cite = result.citations[0];
    expect(cite.sourceName).toBe('report.pdf');
    // snippet: strip THEN slice(0,200)
    expect(cite.snippet).toBe('relevant evidence text here');
    expect(cite.pageNumber).toBe(3);
    expect(cite.paragraphIndex).toBe(7);
    // context: [N] Source: <filename> (chunk <idx>)\n<full text> — 1-based idx
    expect(result.context).toContain('[1] Source: report.pdf (chunk 1)');
    expect(result.context).toContain('relevant evidence text here');
    expect(cite.chunkIndex).toBe(1);
  });

  it('filters out chunks not in source_ids (post-filter)', async () => {
    const orm = getOrm();
    const nb = orm.insert(notebooks).values({ name: 'filter-nb' }).returning().get();
    const src1 = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'a.txt', status: 'ready' })
      .returning()
      .get();
    const src2 = orm
      .insert(sources)
      .values({ notebookId: nb.id, filename: 'b.txt', status: 'ready' })
      .returning()
      .get();
    const c1 = orm
      .insert(chunks)
      .values({ sourceId: src1.id, chunkIndex: 0, text: 'from src1' })
      .returning()
      .get();
    const c2 = orm
      .insert(chunks)
      .values({ sourceId: src2.id, chunkIndex: 0, text: 'from src2' })
      .returning()
      .get();

    // retrieve returns both, but only src1 is requested
    EmbedStrategy.prototype.retrieve = async () => [
      { chunk_id: c1.id, text: 'from src1', score: 0.9, source_id: src1.id, chunk_index: 0 },
      { chunk_id: c2.id, text: 'from src2', score: 0.8, source_id: src2.id, chunk_index: 0 },
    ];

    const { retrieveForRefine } = await import('../../src/features/refine/retrieve.ts');
    const result = await retrieveForRefine(
      nb.id,
      'query',
      [src1.id], // only src1
      5,
      0.2,
      new AbortController().signal,
      makeLimiter(),
    );

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].sourceName).toBe('a.txt');
  });
});
