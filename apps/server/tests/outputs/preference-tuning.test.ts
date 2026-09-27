// generation-core — preference tuning + explicit knobs + retrieval failure
// propagation on the outputs pipeline:
//   r162 — `preference` maps to retrieval defaults via the central tuning table
//   r163 — explicit request topK/minScore override the table defaults
//   r168 — RAG retrieval failure propagates; scoped fallback never exceeds the
//          selected sources (no whole-notebook dump)
//
// Fixture strategy: overwrite the registry's 'embed' slot with a recording
// fake so resolvePipelineContextChunks' retrieval call is observable.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { resolvePipelineContextChunks } from '../../src/features/outputs/pipeline.ts';
import { ragRegistry } from '../../src/rag/registry.ts';
import type { ChunkResult, RetrieveOptions, RAGStrategy } from '../../src/rag/types.ts';
import { AppHttpError, ErrorCode } from '../../src/shared/errors.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

interface RecordedCall {
  query: string;
  notebookId: number;
  opts?: RetrieveOptions;
}

const calls: RecordedCall[] = [];

function recordingStrategy(id: string, impl: () => Promise<ChunkResult[]>): RAGStrategy {
  return {
    id,
    name: id,
    version: '0.0.0',
    indexSource: async () => {},
    retrieve: async (query: string, notebookId: number, opts?: RetrieveOptions) => {
      calls.push({ query, notebookId, opts });
      return impl();
    },
    isIndexed: async () => true,
    deleteSource: async () => {},
  };
}

const HIT = (chunkId: number, sourceId: number, text: string): ChunkResult => ({
  chunkId,
  text,
  score: 0.9,
  sourceId,
  chunkIndex: 0,
});

let nbId: number;
let srcAId: number;
let chunkAId: number;
let srcBId: number;
let chunkBId: number;

beforeAll(() => {
  setupIntegrationEnv();
  const orm = getOrm();
  nbId = orm.insert(notebooks).values({ name: 'pref-tuning-nb' }).returning().get().id;
  srcAId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'a.md', status: 'ready' })
    .returning()
    .get().id;
  chunkAId = orm
    .insert(chunks)
    .values({ sourceId: srcAId, chunkIndex: 0, text: 'chunk in selected source A' })
    .returning()
    .get().id;
  srcBId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'b.md', status: 'ready' })
    .returning()
    .get().id;
  chunkBId = orm
    .insert(chunks)
    .values({ sourceId: srcBId, chunkIndex: 0, text: 'chunk in unselected source B' })
    .returning()
    .get().id;

  ragRegistry.register(
    recordingStrategy('embed', async () => [HIT(chunkAId, srcAId, 'registry hit')]),
  );
});

afterAll(teardownIntegrationEnv);

async function run(input: Partial<Parameters<typeof resolvePipelineContextChunks>[0]>) {
  return resolvePipelineContextChunks({
    model: {} as never,
    notebookId: nbId,
    type: 'FAQ',
    ...input,
  });
}

describe('r162 preference tuning is table-driven', () => {
  it('quality preference maps to the quality row topK', async () => {
    // covers: r162
    calls.length = 0;
    await run({ preference: 'quality' });
    expect(calls).toHaveLength(1);
    expect(calls[0].opts?.topK).toBe(10);
  });

  it('speed preference maps to the speed row topK', async () => {
    // covers: r162
    calls.length = 0;
    await run({ preference: 'speed' });
    expect(calls[0].opts?.topK).toBe(3);
  });

  it('missing preference falls back to the quality row', async () => {
    // covers: r162
    calls.length = 0;
    await run({});
    expect(calls[0].opts?.topK).toBe(10);
  });
});

describe('r163 explicit request knobs override preference defaults', () => {
  it('explicit topK and minScore win over the tuning table and builtin defaults', async () => {
    // covers: r163
    calls.length = 0;
    await run({ preference: 'speed', topK: 7, minScore: 0.55 });
    expect(calls[0].opts?.topK).toBe(7);
    expect(calls[0].opts?.minScore).toBe(0.55);
  });

  it('minScore falls back to the pipeline default when omitted', async () => {
    // covers: r163
    calls.length = 0;
    await run({ preference: 'quality' });
    expect(calls[0].opts?.minScore).toBe(0.2);
  });
});

describe('r168 RAG retrieval failure propagation', () => {
  it('unscoped retrieval failure rejects the request instead of dumping all chunks', async () => {
    // covers: r168
    ragRegistry.register(
      recordingStrategy('embed', async () => {
        throw new Error('vector search exploded');
      }),
    );
    try {
      await run({});
      throw new Error('expected resolvePipelineContextChunks to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(AppHttpError);
      expect((error as AppHttpError).code).toBe(ErrorCode.INTERNAL_ERROR);
      expect((error as AppHttpError).message).toContain('Output retrieval failed');
    }
  });

  it('scoped fallback only ever serves the selected sources, never the whole notebook', async () => {
    // covers: r168
    ragRegistry.register(
      recordingStrategy('embed', async () => {
        throw new Error('vector search exploded');
      }),
    );
    const rows = await run({ sourceIds: [srcAId] });
    expect(rows.length).toBeGreaterThan(0);
    // Selected-source chunk is served via the direct scoped fetch…
    expect(rows.some((row) => row.id === chunkAId)).toBe(true);
    // …and the unselected source's chunk never leaks into the context set.
    expect(rows.some((row) => row.id === chunkBId)).toBe(false);
    for (const row of rows) {
      expect(row.sourceId).toBe(srcAId);
    }
  });
});
