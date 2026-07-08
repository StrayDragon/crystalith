// Tests for the epoch-based retrieval cache.
import { afterEach, describe, expect, it } from 'bun:test';

import {
  bumpSourcesEpoch,
  bumpVectorEpoch,
  getCached,
  setCached,
  clearCache,
} from '../../src/rag/cache.ts';

afterEach(() => clearCache());

describe('epoch cache', () => {
  it('returns undefined for uncached queries', () => {
    expect(getCached(1, 'q', 'p')).toBeUndefined();
  });

  it('returns cached data within the same epoch', () => {
    setCached(1, 'q', 'p', [{ chunk_id: 1, text: 't', score: 0.9, source_id: 1, chunk_index: 0 }]);
    const cached = getCached(1, 'q', 'p');
    expect(cached).toHaveLength(1);
    expect(cached?.[0].chunk_id).toBe(1);
  });

  it('invalidates on bumpSourcesEpoch', () => {
    setCached(1, 'q', 'p', [{ chunk_id: 1, text: 't', score: 0.9, source_id: 1, chunk_index: 0 }]);
    expect(getCached(1, 'q', 'p')).toBeDefined();
    bumpSourcesEpoch(1);
    expect(getCached(1, 'q', 'p')).toBeUndefined();
  });

  it('invalidates on bumpVectorEpoch', () => {
    setCached(2, 'q', 'p', [{ chunk_id: 1, text: 't', score: 0.9, source_id: 1, chunk_index: 0 }]);
    expect(getCached(2, 'q', 'p')).toBeDefined();
    bumpVectorEpoch(2);
    expect(getCached(2, 'q', 'p')).toBeUndefined();
  });

  it('isolates epochs per notebook', () => {
    setCached(1, 'q', 'p', [{ chunk_id: 1, text: 'a', score: 0.9, source_id: 1, chunk_index: 0 }]);
    setCached(2, 'q', 'p', [{ chunk_id: 2, text: 'b', score: 0.9, source_id: 2, chunk_index: 0 }]);
    bumpSourcesEpoch(1);
    // notebook 1 invalidated, notebook 2 still cached
    expect(getCached(1, 'q', 'p')).toBeUndefined();
    expect(getCached(2, 'q', 'p')).toBeDefined();
  });

  it('distinguishes by query and params', () => {
    setCached(1, 'q1', 'p', [{ chunk_id: 1, text: 't', score: 0.9, source_id: 1, chunk_index: 0 }]);
    expect(getCached(1, 'q1', 'p')).toBeDefined();
    expect(getCached(1, 'q2', 'p')).toBeUndefined();
    expect(getCached(1, 'q1', 'other')).toBeUndefined();
  });
});
