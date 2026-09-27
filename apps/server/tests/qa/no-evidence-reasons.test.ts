// generation-core r174 — distinct no-evidence reasons.
// When evidence is false, retrieveAndJudge must settle on one of the spec'd
// reasons (embedding_empty / no_vector_hits / no_valid_chunks / low_similarity)
// and each reason must map to its own non-empty localized answer.
//
// Fixture strategy: register fake RAG strategies with score/behavior control,
// then drive retrieveAndJudge via strategyId (no real embedding involved).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

import { notebooks, sources } from '../../src/db/schema.ts';
import {
  EMBEDDING_EMPTY_ANSWER,
  LOW_SIMILARITY_ANSWER,
  NO_VECTOR_INDEX_ANSWER,
  SOURCES_NOT_READY_ANSWER,
  noEvidenceAnswerForReason,
  retrieveAndJudge,
} from '../../src/features/qa/retrieve-and-judge.ts';
import { ragRegistry } from '../../src/rag/registry.ts';
import type { ChunkResult, RAGStrategy } from '../../src/rag/types.ts';
import { getOrm, setupIntegrationEnv, teardownIntegrationEnv } from '../helpers/integration.ts';

function fakeStrategy(id: string, retrieve: () => Promise<ChunkResult[]>): RAGStrategy {
  return {
    id,
    name: id,
    version: '0.0.0',
    indexSource: async () => {},
    retrieve,
    isIndexed: async () => true,
    deleteSource: async () => {},
  };
}

let nbId: number;
let sourceId: number;

beforeAll(() => {
  setupIntegrationEnv();
  const orm = getOrm();
  nbId = orm.insert(notebooks).values({ name: 'no-evidence-nb' }).returning().get().id;
  sourceId = orm
    .insert(sources)
    .values({ notebookId: nbId, filename: 'doc.md', status: 'ready' })
    .returning()
    .get().id;

  // embedding_empty — retrieval itself blows up (embed/search failure).
  ragRegistry.register(
    fakeStrategy('fake-embed-boom', async () => {
      throw new Error('embed gateway down');
    }),
  );
  // no_vector_hits — empty index / scoped miss.
  ragRegistry.register(fakeStrategy('fake-empty-index', async () => []));
  // no_valid_chunks — hits exist but none survive chunk hydration.
  ragRegistry.register(
    fakeStrategy('fake-ghost-chunks', async () => [
      { chunkId: 987_654_321, text: 'ghost', score: 0.9, sourceId, chunkIndex: 0 },
    ]),
  );
});

afterAll(teardownIntegrationEnv);

describe('r174 distinct no-evidence reasons', () => {
  it('retrieval failure yields embedding_empty with its localized answer', async () => {
    // covers: r174
    const result = await retrieveAndJudge({
      notebookId: nbId,
      question: 'anything',
      sourceIds: [sourceId],
      strategyId: 'fake-embed-boom',
    });
    expect(result.evidence).toBe(false);
    expect(result.reason).toBe('embedding_empty');
    expect(result.citations).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(noEvidenceAnswerForReason(result.reason ?? null)).toBe(EMBEDDING_EMPTY_ANSWER);
  });

  it('empty vector index yields no_vector_hits with its localized answer', async () => {
    // covers: r174
    const result = await retrieveAndJudge({
      notebookId: nbId,
      question: 'anything',
      sourceIds: [sourceId],
      strategyId: 'fake-empty-index',
    });
    expect(result.evidence).toBe(false);
    expect(result.reason).toBe('no_vector_hits');
    expect(noEvidenceAnswerForReason(result.reason ?? null)).toBe(NO_VECTOR_INDEX_ANSWER);
  });

  it('hits without valid chunks yield no_valid_chunks with its localized answer', async () => {
    // covers: r174
    const result = await retrieveAndJudge({
      notebookId: nbId,
      question: 'anything',
      sourceIds: [sourceId],
      strategyId: 'fake-ghost-chunks',
    });
    expect(result.evidence).toBe(false);
    expect(result.reason).toBe('no_valid_chunks');
    expect(noEvidenceAnswerForReason(result.reason ?? null)).toBe(SOURCES_NOT_READY_ANSWER);
  });

  it('every spec-listed reason maps to a distinct non-empty localized answer', () => {
    // covers: r174
    const answers = new Set([
      noEvidenceAnswerForReason('embedding_empty'),
      noEvidenceAnswerForReason('no_vector_hits'),
      noEvidenceAnswerForReason('no_valid_chunks'),
      noEvidenceAnswerForReason('low_similarity'),
    ]);
    expect(answers.size).toBe(4);
    expect(noEvidenceAnswerForReason('low_similarity')).toBe(LOW_SIMILARITY_ANSWER);
    for (const answer of answers) {
      expect(answer.trim().length).toBeGreaterThan(0);
    }
  });
});
