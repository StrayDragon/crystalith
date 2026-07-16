// Correlation detection — per-entry vector-KNN index query (c47 — restored from v1).
//
// For each chunk entry, query the sqlite-vec KNN index (searchVectors) for the
// top_k nearest neighbors, excluding same-source pairs, and collect high-
// similarity pairs as "similar" relations, de-duplicated and capped at
// maxRelations.
//
// v1 reference: features/analysis/correlation.py (detect_relations).
// v1 calls `vector_store.search(top_k=20, min_score=0.7, exclude_source_ids=...)`
// per entry; v2 mirrors that via the existing searchVectors KNN index query
// (db/vectors.ts:79) which RAG and research also use. Earlier c28 code did an
// in-memory brute-force pairwise cosine — c47 re-aligns to the KNN path so the
// edge set and score semantics match v1 (score = 1 - distance).

import type { RelationType } from '@crystalith/shared';

import type { Orm } from '../../db/index.ts';
import { searchVectors } from '../../db/vectors.ts';

export interface Relation {
  sourceChunkId: number;
  targetChunkId: number;
  relationType: RelationType;
  score: number;
}

/** A chunk entry with its embedding vector for similarity computation. */
export interface VectorChunkMeta {
  chunkId: number;
  sourceId: number;
  vector: Float32Array;
}

/**
 * Detect similar chunk pairs via per-entry vector-KNN index query.
 *
 * For each entry, query the KNN index (searchVectors) for its nearest
 * neighbors, convert distance → score (1 - distance, matching v1 chroma
 * semantics), drop same-source hits and sub-min_score hits, then collect
 * unique pairs sorted by score descending.
 *
 * Mirrors v1 detect_relations (min_score=0.7, top_k=20, exclude_source_ids,
 * max_relations=200).
 */
export async function detectRelations(
  entries: VectorChunkMeta[],
  notebookId: number,
  orm: Orm,
  options: {
    minScore?: number;
    maxRelations?: number;
    topK?: number;
  } = {},
): Promise<Relation[]> {
  const { minScore = 0.7, maxRelations = 200, topK = 20 } = options;
  if (maxRelations <= 0 || topK <= 0 || entries.length < 2) return [];

  const entriesByChunk = new Map<number, VectorChunkMeta>(entries.map((e) => [e.chunkId, e]));
  const relationMap = new Map<string, Relation>();

  for (const entry of entries) {
    // Per-entry KNN query against the sqlite-vec index (v1 parity). We do not
    // pass sourceIds (that is an *include* filter in searchVectors); instead
    // we over-fetch then post-filter to exclude the entry's own source —
    // mirroring v1's exclude_source_ids=[entry.source_id].
    const hits = searchVectors(orm, entry.vector, notebookId, topK);

    for (const hit of hits) {
      const target = entriesByChunk.get(hit.rowid);
      // hit not in our entry set
      if (target === undefined) continue;
      // exclude same-source
      if (target.sourceId === entry.sourceId) continue;

      // v1 chroma cosine space: score = 1 - distance (chroma.py:136).
      const score = 1 - hit.distance;
      if (score < minScore) continue;

      const leftChunkId = Math.min(entry.chunkId, target.chunkId);
      const rightChunkId = Math.max(entry.chunkId, target.chunkId);
      const key = `${leftChunkId}-${rightChunkId}`;

      const existing = relationMap.get(key);
      if (existing && existing.score >= score) continue;

      relationMap.set(key, {
        sourceChunkId: leftChunkId,
        targetChunkId: rightChunkId,
        relationType: 'similar',
        score,
      });
    }
  }

  const relations = [...relationMap.values()].toSorted((a, b) => b.score - a.score);
  return relations.slice(0, maxRelations);
}
