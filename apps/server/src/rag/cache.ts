// Epoch-based cache — LRU-style in-memory cache with per-notebook epoch invalidation.
//
// Ports v1's epoch model: each notebook tracks two monotonic counters —
// sources_epoch (bumped on source add/delete) and vector_epoch (bumped on
// re-embed). Retrieval results are cached keyed by (notebook, query, params,
// epoch); a bump invalidates that notebook's entries. Desktop app (no Redis).
import type { ChunkResult } from './types.ts';

interface CacheEntry {
  data: ChunkResult[];
  sourcesEpoch: number;
  vectorEpoch: number;
}

// Per-notebook epoch counters.
const sourcesEpochs = new Map<number, number>();
const vectorEpochs = new Map<number, number>();

// The cache itself: key = `${notebookId}:${query}:${params}`, value = entry.
const cache = new Map<string, CacheEntry>();

function epochKey(notebookId: number, sourcesEpoch: number, vectorEpoch: number): string {
  return `${notebookId}:${sourcesEpoch}:${vectorEpoch}`;
}

function makeKey(notebookId: number, query: string, params: string): string {
  const s = sourcesEpochs.get(notebookId) ?? 0;
  const v = vectorEpochs.get(notebookId) ?? 0;
  return `${epochKey(notebookId, s, v)}:${query}:${params}`;
}

/** Bump sources_epoch for a notebook (call on source add/delete). */
export function bumpSourcesEpoch(notebookId: number): void {
  sourcesEpochs.set(notebookId, (sourcesEpochs.get(notebookId) ?? 0) + 1);
}

/** Bump vector_epoch for a notebook (call on re-embed). */
export function bumpVectorEpoch(notebookId: number): void {
  vectorEpochs.set(notebookId, (vectorEpochs.get(notebookId) ?? 0) + 1);
}

/**
 * Try to read a cached retrieval result. Returns undefined if missing or if
 * the notebook's epoch has advanced since the entry was written.
 */
export function getCached(
  notebookId: number,
  query: string,
  params: string,
): ChunkResult[] | undefined {
  return cache.get(makeKey(notebookId, query, params))?.data;
}

/** Store a retrieval result under the current epoch. */
export function setCached(
  notebookId: number,
  query: string,
  params: string,
  data: ChunkResult[],
): void {
  const s = sourcesEpochs.get(notebookId) ?? 0;
  const v = vectorEpochs.get(notebookId) ?? 0;
  cache.set(makeKey(notebookId, query, params), { data, sourcesEpoch: s, vectorEpoch: v });
}

/** Clear all cached entries (e.g. for tests). */
export function clearCache(): void {
  cache.clear();
  sourcesEpochs.clear();
  vectorEpochs.clear();
}

// ---------------------------------------------------------------------------
// Legacy EpochCache class — kept for backwards compat but now delegates to the
// module-level functions above. Prefer getCached/setCached directly.
// ---------------------------------------------------------------------------

export class EpochCache<T> {
  private store = new Map<string, { data: T; epoch: number }>();

  get(key: string, currentEpoch: number): T | undefined {
    const entry = this.store.get(key);
    return entry?.epoch === currentEpoch ? entry.data : undefined;
  }

  set(key: string, data: T, epoch: number): void {
    this.store.set(key, { data, epoch });
  }

  clear(): void {
    this.store.clear();
  }

  clearEpoch(epoch: number): void {
    for (const [key, entry] of this.store) {
      if (entry.epoch === epoch) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
