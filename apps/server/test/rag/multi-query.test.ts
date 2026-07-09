// Tests for multi-query expansion + RRF fusion.
import { describe, expect, it } from 'bun:test';

import { buildQuerySeeds, rrfFuseSeeds } from '../../src/rag/multi-query.ts';
import type { ChunkResult } from '../../src/rag/types.ts';

function mkChunk(id: number, score = 0.5): ChunkResult {
  return { chunk_id: id, text: `text-${id}`, score, source_id: 1, chunk_index: 0 };
}

describe('buildQuerySeeds', () => {
  it('returns the original query alone when no output type', () => {
    const seeds = buildQuerySeeds('what is RAG?');
    expect(seeds[0]).toBe('what is RAG?');
    expect(seeds.length).toBeGreaterThanOrEqual(1);
  });

  it('appends hint variants for known output types', () => {
    const seeds = buildQuerySeeds('topic', 'FAQ');
    expect(seeds.length).toBeGreaterThan(1);
    expect(seeds.some((s) => s.includes('常见问题') || s.includes('疑问'))).toBe(true);
  });

  it('caps at SEED_CAP (3)', () => {
    const seeds = buildQuerySeeds('q', 'FAQ');
    expect(seeds.length).toBeLessThanOrEqual(3);
  });
});

describe('rrfFuseSeeds', () => {
  it('fuses multiple lists, ranking chunks appearing in both higher', () => {
    const listA = [mkChunk(1), mkChunk(2), mkChunk(3)];
    const listB = [mkChunk(2), mkChunk(4), mkChunk(1)];
    const fused = rrfFuseSeeds([listA, listB], 4);
    // Chunks 1 and 2 appear in both lists → higher RRF score.
    const ids = fused.map((c) => c.chunk_id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(fused[0].score).toBeGreaterThan(0);
    expect(fused[0].score).toBeLessThanOrEqual(1);
  });

  it('respects topK limit', () => {
    const list = [mkChunk(1), mkChunk(2), mkChunk(3), mkChunk(4), mkChunk(5)];
    const fused = rrfFuseSeeds([list], 2);
    expect(fused).toHaveLength(2);
  });

  it('normalizes scores to [0,1] with top result at 1', () => {
    const fused = rrfFuseSeeds([[mkChunk(1), mkChunk(2)]], 2);
    expect(fused[0].score).toBeCloseTo(1, 5);
  });
});
