// Tests for diversity + dedup.
import { describe, expect, it } from 'bun:test';

import { applyDiversity } from '../../src/rag/diversity.ts';
import type { ChunkResult } from '../../src/rag/types.ts';

function mkChunk(id: number, sourceId: number, text = 'unique'): ChunkResult {
  return { chunkId: id, text: `${text}-${id}`, score: 0.5, sourceId: sourceId, chunkIndex: 0 };
}

describe('applyDiversity', () => {
  it('removes near-duplicate chunks by content sha256', () => {
    const dupes = [
      { chunkId: 1, text: 'same text', score: 0.9, sourceId: 1, chunkIndex: 0 },
      { chunkId: 2, text: 'same text', score: 0.9, sourceId: 1, chunkIndex: 0 }, // dup
      { chunkId: 3, text: 'different', score: 0.8, sourceId: 1, chunkIndex: 0 },
    ];
    const result = applyDiversity(dupes);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.chunkId)).toEqual([1, 3]);
  });

  it('caps results per source (default 3)', () => {
    const fromOneSource = Array.from({ length: 5 }, (_, i) => mkChunk(i + 1, 10));
    const result = applyDiversity(fromOneSource);
    expect(result).toHaveLength(3);
  });

  it('allows multiple sources up to the cap each', () => {
    const mixed = [
      ...Array.from({ length: 2 }, (_, i) => mkChunk(i + 1, 10)),
      ...Array.from({ length: 2 }, (_, i) => mkChunk(i + 10, 20)),
    ];
    const result = applyDiversity(mixed);
    expect(result).toHaveLength(4);
  });

  it('respects custom maxPerSource', () => {
    const fromOneSource = Array.from({ length: 4 }, (_, i) => mkChunk(i + 1, 10));
    const result = applyDiversity(fromOneSource, 2);
    expect(result).toHaveLength(2);
  });
});
