// Tests for keyword-TF-based topic clustering.
import { describe, expect, it } from 'bun:test';

import { clusterTopics } from '../../src/features/analysis/clustering.ts';

describe('clusterTopics', () => {
  it('returns empty array for no entries', () => {
    expect(clusterTopics([])).toEqual([]);
  });

  it('returns a single topic for one entry', () => {
    const result = clusterTopics([{ chunkId: 1, sourceId: 1, text: 'machine learning models' }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('topic-1');
    expect(result[0].chunkIds).toEqual([1]);
  });

  it('clusters similar entries together', () => {
    const result = clusterTopics([
      { chunkId: 1, sourceId: 1, text: 'machine learning deep neural networks' },
      { chunkId: 2, sourceId: 2, text: 'deep learning convolutional neural networks' },
      { chunkId: 3, sourceId: 3, text: 'quantum physics wave particle duality' },
    ]);

    // First two should cluster (similar keywords), third should be separate
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Find which topic contains chunk 1 and 2
    const mlTopics = result.filter((t) => t.chunkIds.includes(1) || t.chunkIds.includes(2));
    // Both ML entries should be in the same topic
    const mlTopic = mlTopics.find((t) => t.chunkIds.includes(1) && t.chunkIds.includes(2));
    expect(mlTopic).toBeDefined();
    expect(
      mlTopic!.keywords.some(
        (k) => k.includes('learn') || k.includes('neural') || k.includes('network'),
      ),
    ).toBeTrue();
  });

  it('respects maxTopics limit', () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({
      chunkId: i + 1,
      sourceId: i + 1,
      text: `unique topic ${i} totally different keywords`,
    }));

    const result = clusterTopics(entries, { maxTopics: 3 });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('assigns topic names from top-3 keywords', () => {
    const result = clusterTopics([
      { chunkId: 1, sourceId: 1, text: 'artificial intelligence machine' },
    ]);

    expect(result[0].keywords.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBeTruthy();
  });

  it('sorts chunkIds ascending within each topic', () => {
    const result = clusterTopics([
      { chunkId: 5, sourceId: 1, text: 'same topic keywords here' },
      { chunkId: 3, sourceId: 2, text: 'same topic keywords here too' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].chunkIds).toEqual([3, 5]);
  });
});
