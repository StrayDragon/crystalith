// Tests for embedding-vector relation detection (c28 — restored from v1).
//
// Uses synthetic embedding vectors to verify cosine similarity pair detection.
import { describe, expect, it } from 'bun:test';

import { detectRelations } from '../../src/features/analysis/correlation.ts';
import type { VectorChunkMeta } from '../../src/features/analysis/correlation.ts';

function vec(...vals: number[]): Float32Array {
  return new Float32Array(vals);
}

// ML-like vectors (high cosine similarity to each other), physics-like (different).
const ML_A = vec(0.9, 0.1, 0.0, 0.0);
const ML_B = vec(0.85, 0.15, 0.0, 0.0);
const PHYSICS = vec(0.0, 0.0, 0.9, 0.1);

function mkEntry(chunkId: number, sourceId: number, vector: Float32Array): VectorChunkMeta {
  return { chunkId, sourceId, vector };
}

describe('detectRelations (embedding vectors)', () => {
  it('returns empty for less than 2 entries', () => {
    expect(detectRelations([mkEntry(1, 1, ML_A)], 1)).toEqual([]);
  });

  it('returns empty for empty entries', () => {
    expect(detectRelations([], 1)).toEqual([]);
  });

  it('detects similar pairs from high-cosine vectors', () => {
    const entries = [mkEntry(1, 1, ML_A), mkEntry(2, 2, ML_B), mkEntry(3, 3, PHYSICS)];

    const relations = detectRelations(entries, 1, { minScore: 0.3 });

    // Chunks 1,2 (both ML) should be related; chunk 3 (physics) should not match.
    const mlPair = relations.find(
      (r) =>
        (r.sourceChunkId === 1 && r.targetChunkId === 2) ||
        (r.sourceChunkId === 2 && r.targetChunkId === 1),
    );
    expect(mlPair).toBeDefined();
    expect(mlPair!.relationType).toBe('similar');
    expect(mlPair!.score).toBeGreaterThan(0.3);
  });

  it('excludes same-source pairs', () => {
    const entries = [
      mkEntry(1, 1, ML_A),
      mkEntry(2, 1, ML_B), // same sourceId
    ];

    const relations = detectRelations(entries, 1, { minScore: 0.1 });
    expect(relations).toEqual([]);
  });

  it('respects maxRelations cap', () => {
    // All point in the same direction, different sources → all pairwise match.
    const entries: VectorChunkMeta[] = Array.from({ length: 10 }, (_, i) =>
      mkEntry(i + 1, i + 1, ML_A),
    );

    const relations = detectRelations(entries, 1, { minScore: 0.1, maxRelations: 5 });
    expect(relations.length).toBeLessThanOrEqual(5);
  });

  it('returns relations sorted by score descending', () => {
    const entries = [
      mkEntry(1, 1, ML_A),
      mkEntry(2, 2, ML_B),
      mkEntry(3, 3, vec(0.8, 0.2, 0.0, 0.0)), // slightly less similar to ML_A
    ];

    const relations = detectRelations(entries, 1, { minScore: 0.1 });
    for (let i = 1; i < relations.length; i++) {
      expect(relations[i].score).toBeLessThanOrEqual(relations[i - 1].score);
    }
  });
});
