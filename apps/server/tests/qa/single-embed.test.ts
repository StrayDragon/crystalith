// retrieval-and-cache r234 / r463 — QA retrieval is a deterministic
// single-embed path:
//   r234 — retrieveAndJudge must not enable multiQuery on its retrieval call
//   r463 — the same question + sourceIds + embedding reproduces byte-identical
//          results (no seed expansion, no RRF normalization)
//
// Fixture strategy: a recording fake RAG strategy with fixed hits; assertions
// on the recorded RetrieveOptions double as the r234/r463 shared evidence.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { retrieveAndJudge } from '../../src/features/qa/retrieve-and-judge.ts';
import { ragRegistry } from '../../src/rag/registry.ts';
import type { ChunkResult, RetrieveOptions, RAGStrategy } from '../../src/rag/types.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

interface RecordedCall {
  query: string;
  notebookId: number;
  opts?: RetrieveOptions;
}

const calls: RecordedCall[] = [];

const deterministicStrategy: RAGStrategy = {
  id: 'fake-single-embed',
  name: 'deterministic single-embed fixture',
  version: '0.0.0',
  indexSource: async () => {},
  retrieve: async (query: string, notebookId: number, opts?: RetrieveOptions) => {
    calls.push({ query, notebookId, opts });
    return HITS.map((hit) => ({ ...hit }));
  },
  isIndexed: async () => true,
  deleteSource: async () => {},
};

// Two fixed hits over real chunk rows (seeded in beforeAll); copies are
// returned per call so result identity never leaks between calls.
let HITS: ChunkResult[] = [];

let nbId: number;
let srcId: number;
let chunkOneId: number;
let chunkTwoId: number;

beforeAll(() => {
  setupIntegrationEnv();
  const orm = getOrm();
  nbId = orm.insert(notebooks).values({ name: 'single-embed-nb' }).returning().get().id;
  srcId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'paper.md', status: 'ready' })
    .returning()
    .get().id;
  chunkOneId = orm
    .insert(chunks)
    .values({ sourceId: srcId, chunkIndex: 0, text: 'first deterministic chunk' })
    .returning()
    .get().id;
  chunkTwoId = orm
    .insert(chunks)
    .values({ sourceId: srcId, chunkIndex: 1, text: 'second deterministic chunk' })
    .returning()
    .get().id;

  HITS = [
    {
      chunkId: chunkOneId,
      text: 'first deterministic chunk',
      score: 0.9,
      sourceId: srcId,
      chunkIndex: 0,
    },
    {
      chunkId: chunkTwoId,
      text: 'second deterministic chunk',
      score: 0.7,
      sourceId: srcId,
      chunkIndex: 1,
    },
  ];
  ragRegistry.register(deterministicStrategy);
});

afterAll(teardownIntegrationEnv);

async function askOnce() {
  return retrieveAndJudge({
    notebookId: nbId,
    question: 'same question',
    sourceIds: [srcId],
    strategyId: 'fake-single-embed',
  });
}

describe('r234 QA retrieval uses the single-embed path (no multi-query)', () => {
  it('retrieveAndJudge issues exactly one retrieval call with multiQuery disabled', async () => {
    // covers: r234
    calls.length = 0;
    await askOnce();
    expect(calls).toHaveLength(1);
    expect(calls[0].opts?.multiQuery).toBe(false);
    // Scoped to the requested sources; retrieval is a single embed of the question.
    expect(calls[0].opts?.sourceIds).toEqual([srcId]);
    expect(calls[0].query).toBe('same question');
  });
});

describe('r463 QA retrieval is deterministic across repeats', () => {
  it('repeating the same question and scope reproduces identical results', async () => {
    // covers: r463
    calls.length = 0;
    const first = await askOnce();
    const second = await askOnce();
    // No seed expansion: one strategy call per QA execution, nothing else.
    expect(calls).toHaveLength(2);
    // Identical citations (order + scores) and identical context text.
    expect(JSON.stringify(first.citations)).toBe(JSON.stringify(second.citations));
    expect(first.context).toBe(second.context);
    expect(first.confidence).toBe(second.confidence);
    expect(first.citations.map((c) => c.chunkId)).toEqual([chunkOneId, chunkTwoId]);
  });
});
