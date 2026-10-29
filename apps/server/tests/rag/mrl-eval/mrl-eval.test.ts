// covers: r495（embedding-mrl-truncation）——eval 框架自测：指标纯函数、切片归一化、fixture 完整性、no-go 判据。
import { describe, expect, it } from 'bun:test';

import { CORPUS } from './corpus.ts';
import { checkFixtureIntegrity, fixtureExists, loadFixture } from './fixture.ts';
import { decayPct, ndcgAtK, recallAtK } from './metrics.ts';
import { QUERIES } from './queries.ts';
import { l2Norm, sliceNormalize } from './truncate.ts';

describe('mrl-eval metrics', () => {
  it('recall@k counts hits within the truncated prefix', () => {
    const relevant = new Set(['a', 'b']);
    expect(recallAtK(['a', 'x', 'b'], relevant, 10)).toBe(1);
    expect(recallAtK(['a', 'x', 'y'], relevant, 10)).toBeCloseTo(0.5, 5);
    // 超出 k 的命中不计
    expect(recallAtK(['x', 'y', 'z', 'a', 'b'], relevant, 3)).toBe(0);
    expect(recallAtK(['a'], new Set(), 10)).toBe(0);
  });

  it('ndcg@k rewards early hits and is 1 for the ideal ranking', () => {
    const relevant = new Set(['a', 'b']);
    expect(ndcgAtK(['a', 'b', 'x'], relevant, 10)).toBe(1);
    expect(ndcgAtK(['b', 'a', 'x'], relevant, 10)).toBe(1);
    const late = ndcgAtK(['x', 'y', 'a', 'b'], relevant, 10);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(1);
    expect(ndcgAtK(['x', 'y'], relevant, 10)).toBe(0);
  });

  it('decayPct maps baseline/candidate to percentage decay', () => {
    expect(decayPct(1, 0.95)).toBeCloseTo(5, 5);
    expect(decayPct(0.8, 0.8)).toBe(0);
    expect(decayPct(0, 0.5)).toBe(0);
  });
});

describe('mrl-eval truncate (path-2 simulation, r494)', () => {
  it('slices the prefix and L2-normalizes', () => {
    const full = [3, 4, 0, 0, 0, 0, 0, 0];
    const sliced = sliceNormalize(full, 2);
    expect(sliced).toHaveLength(2);
    // Float32 精度：逐元素近似而非精确相等
    expect(sliced[0]).toBeCloseTo(0.6, 5);
    expect(sliced[1]).toBeCloseTo(0.8, 5);
    expect(l2Norm(sliced)).toBeCloseTo(1, 6);
  });

  it('full-dim slice of an already normalized vector is idempotent-ish', () => {
    const v = [0.6, 0.8];
    const out = sliceNormalize(v, 2);
    expect(out[0]).toBeCloseTo(0.6, 5);
    expect(out[1]).toBeCloseTo(0.8, 5);
  });

  it('rejects zero dims, over-dims and zero vectors', () => {
    expect(() => sliceNormalize([1, 2], 0)).toThrow();
    expect(() => sliceNormalize([1, 2], 3)).toThrow();
    expect(() => sliceNormalize([0, 0], 2)).toThrow();
  });
});

describe('mrl-eval fixtures', () => {
  it('corpus has 30 distinct-topic docs and queries have non-empty expectations', () => {
    expect(CORPUS).toHaveLength(30);
    expect(new Set(CORPUS.map((d) => d.id)).size).toBe(30);
    expect(QUERIES.length).toBeGreaterThanOrEqual(20);
    const docIds = new Set(CORPUS.map((d) => d.id));
    for (const q of QUERIES) {
      expect(q.expected.length).toBeGreaterThan(0);
      for (const e of q.expected) expect(docIds.has(e)).toBe(true);
    }
  });

  it('recorded vector fixture is integral when present (skips when absent)', () => {
    if (!fixtureExists()) return;
    const f = loadFixture();
    expect(checkFixtureIntegrity(f)).toEqual([]);
    // 归一化不作为硬断言（cosine 度量不要求），但维度必须一致（上面已查）。
    expect(f.dims).toBeGreaterThan(0);
  });
});
