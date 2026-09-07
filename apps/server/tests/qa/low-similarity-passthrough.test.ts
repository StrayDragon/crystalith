// allow-low-similarity-qa — low-similarity QA no longer short-circuits:
// it passes through ungrounded with a weak-grounding notice (c60 ungrounded
// semantics reused).
//
// Fixture strategy: register a fake RAG strategy returning score-controlled
// hits over a real chunk row, then drive retrieveAndJudge via strategyId.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { chunks, notebooks, sources } from '../../src/db/schema.ts';
import { WEAK_GROUNDING_TIP, retrieveAndJudge } from '../../src/features/qa/retrieve-and-judge.ts';
import { ragRegistry } from '../../src/rag/registry.ts';
import type { ChunkResult, RAGStrategy } from '../../src/rag/types.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

function fakeStrategy(id: string, hits: ChunkResult[]): RAGStrategy {
  return {
    id,
    name: id,
    version: '0.0.0',
    indexSource: async () => {},
    retrieve: async () => hits,
    isIndexed: async () => true,
    deleteSource: async () => {},
  };
}

const NB = { nbId: 0, sourceId: 0, chunkId: 0 };

beforeAll(async () => {
  setupIntegrationEnv();
  const orm = getOrm();
  const nb = orm.insert(notebooks).values({ name: 'low-sim-nb' }).returning().get();
  const src = orm
    .insert(sources)
    .values({ notebookId: nb.id, filename: 'paper.md', status: 'ready' })
    .returning()
    .get();
  const chunk = orm
    .insert(chunks)
    .values({
      sourceId: src.id,
      chunkIndex: 0,
      text: 'The Transformer architecture is based entirely on attention mechanisms.',
    })
    .returning()
    .get();
  NB.nbId = nb.id;
  NB.sourceId = src.id;
  NB.chunkId = chunk.id;

  // Both hits point at the same real chunk row; only the score differs.
  ragRegistry.register(
    fakeStrategy('fake-low-sim', [
      {
        chunkId: chunk.id,
        sourceId: src.id,
        score: 0.05,
        chunkIndex: 0,
        text: chunk.text,
      },
    ]),
  );
  ragRegistry.register(
    fakeStrategy('fake-high-sim', [
      {
        chunkId: chunk.id,
        sourceId: src.id,
        score: 0.8,
        chunkIndex: 0,
        text: chunk.text,
      },
    ]),
  );
});

afterAll(teardownIntegrationEnv);

describe('low-similarity weak-grounding pass-through', () => {
  it('below-threshold retrieval passes through ungrounded with a notice', async () => {
    const result = await retrieveAndJudge({
      notebookId: NB.nbId,
      question: 'anything',
      sourceIds: [NB.sourceId],
      strategyId: 'fake-low-sim',
    });
    expect(result.evidence).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.citations).toEqual([]);
    expect(result.context).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.groundingNotice).toBe(WEAK_GROUNDING_TIP);
  });

  it('high-similarity retrieval stays grounded without a notice', async () => {
    const result = await retrieveAndJudge({
      notebookId: NB.nbId,
      question: 'attention',
      sourceIds: [NB.sourceId],
      strategyId: 'fake-high-sim',
    });
    expect(result.evidence).toBe(true);
    expect(result.groundingNotice).toBeUndefined();
    expect(result.citations.length).toBe(1);
    expect(result.context).toContain('Transformer');
  });
});
