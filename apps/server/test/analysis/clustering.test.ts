// Tests for embedding-vector topic clustering (c28 — restored from v1).
//
// Uses synthetic embedding vectors to verify the greedy centroid algorithm:
// similar vectors cluster together, dissimilar vectors form separate topics.
import { describe, expect, it } from 'bun:test';

import { clusterTopics } from '../../src/features/analysis/clustering.ts';
import type { VectorChunkEntry } from '../../src/features/analysis/clustering.ts';

// Synthetic 8-dim vectors: "ML" vectors are similar to each other, "physics"
// vectors point in a different direction.
function vec(...vals: number[]): Float32Array {
  return new Float32Array(vals);
}

const ML_VARIANT_A = vec(0.9, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
const ML_VARIANT_B = vec(0.85, 0.15, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
const PHYSICS_VEC = vec(0.0, 0.0, 0.0, 0.0, 0.9, 0.1, 0.0, 0.0);

function mkEntry(
  chunkId: number,
  sourceId: number,
  vector: Float32Array,
  text = 'text',
): VectorChunkEntry {
  return { chunkId, sourceId, vector, text };
}

describe('clusterTopics (embedding vectors)', () => {
  it('returns empty array for no entries', () => {
    expect(clusterTopics([])).toEqual([]);
  });

  it('returns a single topic for one entry', () => {
    const result = clusterTopics([mkEntry(1, 1, ML_VARIANT_A)]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('topic-1');
    expect(result[0].chunkIds).toEqual([1]);
  });

  it('clusters similar vectors together, separates dissimilar', () => {
    const result = clusterTopics([
      mkEntry(1, 1, ML_VARIANT_A, 'machine learning deep neural networks'),
      mkEntry(2, 2, ML_VARIANT_B, 'deep learning convolutional neural networks'),
      mkEntry(3, 3, PHYSICS_VEC, 'quantum physics wave particle duality'),
    ]);

    expect(result.length).toBeGreaterThanOrEqual(2);

    // ML entries (1,2) should be in the same topic (high cosine similarity).
    const mlTopic = result.find((t) => t.chunkIds.includes(1) && t.chunkIds.includes(2));
    expect(mlTopic).toBeDefined();
  });

  it('respects maxTopics limit', () => {
    // Each entry points in a unique direction → each forms its own cluster,
    // but maxTopics caps the total.
    const entries: VectorChunkEntry[] = Array.from({ length: 20 }, (_, i) => {
      const v = new Float32Array(8);
      v[i % 8] = 1;
      return mkEntry(i + 1, i + 1, v, `unique topic ${i}`);
    });

    const result = clusterTopics(entries, { maxTopics: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('sorts chunkIds ascending within each topic', () => {
    const result = clusterTopics([
      mkEntry(5, 1, ML_VARIANT_A, 'same'),
      mkEntry(3, 2, ML_VARIANT_A, 'same too'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].chunkIds).toEqual([3, 5]);
  });

  it('assigns topic names from keywords', () => {
    const result = clusterTopics([
      mkEntry(1, 1, ML_VARIANT_A, 'artificial intelligence machine learning'),
    ]);

    expect(result[0].keywords.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBeTruthy();
  });
});
