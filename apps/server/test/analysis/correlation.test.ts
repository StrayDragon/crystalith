// Tests for keyword-TF-cosine-based relation detection.
import { describe, expect, it } from 'bun:test';

import { detectRelations } from '../../src/features/analysis/correlation.ts';

describe('detectRelations', () => {
  it('returns empty for less than 2 entries', () => {
    expect(detectRelations([{ chunkId: 1, sourceId: 1, text: 'hello' }], 1)).toEqual([]);
  });

  it('returns empty for empty entries', () => {
    expect(detectRelations([], 1)).toEqual([]);
  });

  it('detects similar pairs from same-topic content', () => {
    const entries = [
      { chunkId: 1, sourceId: 1, text: 'machine learning neural networks deep learning' },
      { chunkId: 2, sourceId: 2, text: 'deep learning models neural networks training' },
      { chunkId: 3, sourceId: 3, text: 'quantum physics wave particle duality' },
    ];

    const relations = detectRelations(entries, 1, { minScore: 0.3 });

    // Chunk 1 and 2 should be related (both ML)
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
      { chunkId: 1, sourceId: 1, text: 'machine learning neural networks' },
      { chunkId: 2, sourceId: 1, text: 'deep learning models training' },
    ];

    const relations = detectRelations(entries, 1, { minScore: 0.1 });
    // Same source (sourceId=1), so no relations
    expect(relations).toEqual([]);
  });

  it('respects maxRelations cap', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      chunkId: i + 1,
      sourceId: i + 1,
      text: 'machine learning artificial intelligence neural',
    }));

    const relations = detectRelations(entries, 1, { minScore: 0.1, maxRelations: 5 });
    expect(relations.length).toBeLessThanOrEqual(5);
  });

  it('returns relations sorted by score descending', () => {
    const entries = [
      { chunkId: 1, sourceId: 1, text: 'machine learning neural networks' },
      { chunkId: 2, sourceId: 2, text: 'deep learning models training' },
      { chunkId: 3, sourceId: 3, text: 'quantum physics wave particle' },
    ];

    const relations = detectRelations(entries, 1, { minScore: 0.1 });
    for (let i = 1; i < relations.length; i++) {
      expect(relations[i].score).toBeLessThanOrEqual(relations[i - 1].score);
    }
  });
});
