// Diversity + dedup (ports v1 context.py:375-413 _apply_dedup_and_diversity).
//
// After retrieval, near-duplicate chunks (identical or near-identical text via
// sha256) are removed, and a per-source cap (`max_chunks_per_source`) enforces
// source diversity so one dominant source doesn't crowd out others.
import { createHash } from 'node:crypto';

import type { ChunkResult } from './types.ts';

const DEFAULT_MAX_PER_SOURCE = 3;

/**
 * Remove near-duplicate chunks (by content sha256) and cap results per source.
 */
export function applyDiversity(
  results: ChunkResult[],
  maxPerSource = DEFAULT_MAX_PER_SOURCE,
): ChunkResult[] {
  const seen = new Set<string>();
  const perSource = new Map<number, number>();
  const out: ChunkResult[] = [];

  for (const r of results) {
    const hash = createHash('sha256').update(r.text.trim()).digest('hex');
    if (seen.has(hash)) continue; // dedup near-identical
    const count = perSource.get(r.source_id) ?? 0;
    if (count >= maxPerSource) continue; // source diversity cap
    seen.add(hash);
    perSource.set(r.source_id, count + 1);
    out.push(r);
  }
  return out;
}
