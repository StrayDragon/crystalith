// Tests for QA confidence computation.
import { describe, expect, it } from 'bun:test';

function computeConfidence(simAvg: number, coverage: number, citationsCount: number): number {
  const citationScore = Math.min(1, citationsCount / 3);
  return (simAvg + coverage + citationScore) / 3;
}

describe('computeConfidence', () => {
  it('returns 0 when all inputs are 0', () => {
    expect(computeConfidence(0, 0, 0)).toBeCloseTo(0, 2);
  });

  it('returns ~1 when all inputs are max', () => {
    expect(computeConfidence(1, 1, 10)).toBeCloseTo(1, 2);
  });

  it('gives higher confidence with more citations', () => {
    const low = computeConfidence(0.5, 0.5, 0);
    const high = computeConfidence(0.5, 0.5, 3);
    expect(high).toBeGreaterThan(low);
  });

  it('caps citation contribution at 3 citations', () => {
    const c3 = computeConfidence(0, 0, 3);
    const c10 = computeConfidence(0, 0, 10);
    expect(c3).toBeCloseTo(c10, 5);
  });
});
