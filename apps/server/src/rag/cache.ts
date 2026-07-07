// Epoch-based cache — LRU-style in-memory cache with epoch invalidation.
//
// Desktop app (no Redis). Query vectors are cached keyed by notebook id so
// repeated identical queries within the same epoch skip re-embedding.
// A new epoch (e.g. source upload) invalidates all cached entries.
export class EpochCache<T> {
  private cache = new Map<string, { data: T; epoch: number }>();

  get(key: string, currentEpoch: number): T | undefined {
    const entry = this.cache.get(key);
    return entry?.epoch === currentEpoch ? entry.data : undefined;
  }

  set(key: string, data: T, epoch: number): void {
    this.cache.set(key, { data, epoch });
  }

  /** Remove all entries regardless of epoch. */
  clear(): void {
    this.cache.clear();
  }

  /** Remove all entries for a specific epoch (purge stale). */
  clearEpoch(epoch: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.epoch === epoch) {
        this.cache.delete(key);
      }
    }
  }

  /** Number of cached entries. */
  get size(): number {
    return this.cache.size;
  }
}
