// Correlation detection — embedding-vector cosine similarity (c28 — restored from v1).
//
// For each chunk entry, compute pairwise cosine similarity against all other
// entries (excluding same-source pairs). Collect high-similarity pairs as
// "similar" relations, de-duplicated and capped at maxRelations.
//
// v1 reference: features/analysis/correlation.py (detect_relations).
// v1 uses per-entry KNN search (vector_store.search top_k=20); since v2 now
// has all vectors in memory via getStoredVectors, pairwise cosine is simpler
// and equivalent for desktop-scale datasets.

export interface Relation {
  sourceChunkId: number;
  targetChunkId: number;
  relationType: 'similar' | 'contradicts';
  score: number;
}

/** A chunk entry with its embedding vector for similarity computation. */
export interface VectorChunkMeta {
  chunkId: number;
  sourceId: number;
  vector: Float32Array;
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i]! * right[i]!;
    leftNorm += left[i]! * left[i]!;
    rightNorm += right[i]! * right[i]!;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/**
 * Detect similar chunk pairs via embedding-vector cosine similarity.
 *
 * For each entry, compare against all others (excluding same-source pairs).
 * Collect unique pairs with score >= minScore, sorted by score descending.
 *
 * Mirrors v1 detect_relations (min_score=0.7, top_k=20, exclude_source_ids,
 * max_relations=200). The pairwise approach replaces v1's per-entry KNN but
 * produces the same "similar" relation set.
 */
export function detectRelations(
  entries: VectorChunkMeta[],
  _notebookId: number,
  options: {
    minScore?: number;
    maxRelations?: number;
    topK?: number;
  } = {},
): Relation[] {
  const { minScore = 0.7, maxRelations = 200, topK = 20 } = options;
  if (maxRelations <= 0 || topK <= 0 || entries.length < 2) return [];

  const relationMap = new Map<string, Relation>();

  for (const entry of entries) {
    let neighbors = 0; // cap per-entry matches at topK (v1 behavior)

    // Sort others by similarity to this entry (descending), take top_k.
    const scored: Array<{ other: VectorChunkMeta; score: number }> = [];
    for (const other of entries) {
      if (other.chunkId === entry.chunkId) continue;
      if (other.sourceId === entry.sourceId) continue;
      scored.push({ other, score: cosineSimilarity(entry.vector, other.vector) });
    }
    scored.sort((a, b) => b.score - a.score);

    for (const { other, score } of scored) {
      if (neighbors >= topK) break;
      if (score < minScore) break;

      const leftChunkId = Math.min(entry.chunkId, other.chunkId);
      const rightChunkId = Math.max(entry.chunkId, other.chunkId);
      const key = `${leftChunkId}-${rightChunkId}`;

      const existing = relationMap.get(key);
      if (existing && existing.score >= score) continue;

      relationMap.set(key, {
        sourceChunkId: leftChunkId,
        targetChunkId: rightChunkId,
        relationType: 'similar',
        score,
      });
      neighbors++;
    }
  }

  const relations = [...relationMap.values()].toSorted((a, b) => b.score - a.score);
  return relations.slice(0, maxRelations);
}
