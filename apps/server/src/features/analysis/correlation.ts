// Correlation detection — keyword-TF-cosine-based relation mapping.
//
// For each chunk entry in a notebook, compute pairwise keyword TF cosine
// similarity (excluding same-source pairs) and collect high-similarity
// pairs as "similar" relations. De-duplicated and capped at maxRelations.
//
// NOTE: Full vector-based correlation (using sqlite-vec KNN) would be more
// accurate but requires embedding storage accessible via SELECT, which
// sqlite-vec's virtual table does not support. Keyword TF cosine is a
// reasonable approximation for the desktop MVP.

export interface Relation {
  sourceChunkId: number;
  targetChunkId: number;
  relationType: 'similar' | 'contradicts';
  score: number;
}

export interface ChunkMeta {
  chunkId: number;
  sourceId: number;
  text: string;
}

/**
 * Detect similar chunk pairs via vector KNN search.
 *
 * For each entry, search top_k nearest neighbors (excluding chunks from the
 * same source). Collect unique pairs with score >= minScore.
 *
 * NOTE: This function requires that the embed strategy has indexed the
 * notebook's chunks already. Returns empty array if no vectors found.
 */
export function detectRelations(
  entries: ChunkMeta[],
  notebookId: number,
  options: {
    minScore?: number;
    maxRelations?: number;
    topK?: number;
  } = {},
): Relation[] {
  const { minScore = 0.7, maxRelations = 200, topK = 20 } = options;
  if (maxRelations <= 0 || topK <= 0 || entries.length < 2) return [];

  const entryByChunk = new Map<number, ChunkMeta>();
  for (const e of entries) {
    entryByChunk.set(e.chunkId, e);
  }

  const relationMap = new Map<string, Relation>();

  for (const entry of entries) {
    // KNN search needs an embedding. We use a workaround: search by each
    // chunk's text → AI SDK embed → searchVectors.
    // For now, we compute the relation via chunk-id-based approach:
    // Use the first entry's text as query — but this is inefficient.
    //
    // SIMPLIFICATION: Since we can't embed inline here (would need AI SDK
    // embed call per iteration), we use a text-based similarity fallback
    // via keyword TF cosine using the same approach as clustering.ts.
    //
    // FULL vector-based approach requires the caller to provide pre-computed
    // embeddings. For now, use keyword-based similarity.

    for (const other of entries) {
      if (other.chunkId === entry.chunkId) continue;
      if (other.sourceId === entry.sourceId) continue;

      const leftKey = Math.min(entry.chunkId, other.chunkId);
      const rightKey = Math.max(entry.chunkId, other.chunkId);
      const key = `${leftKey}-${rightKey}`;

      if (relationMap.has(key)) continue;

      const score = keywordCosineSimilarity(entry.text, other.text);
      if (score >= minScore) {
        relationMap.set(key, {
          sourceChunkId: leftKey,
          targetChunkId: rightKey,
          relationType: 'similar',
          score,
        });
      }
    }
  }

  const relations = [...relationMap.values()].toSorted((a, b) => b.score - a.score);
  return relations.slice(0, maxRelations);
}

// ---------------------------------------------------------------------------
// Keyword TF cosine similarity (shared with clustering.ts logic)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'he',
  'her',
  'his',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'may',
  'not',
  'of',
  'on',
  'or',
  'our',
  'she',
  'that',
  'the',
  'their',
  'them',
  'there',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
]);

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    tokens.push(raw);
  }
  return tokens;
}

function buildTfVector(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;
  const maxFreq = Math.max(1, ...Object.values(freq));
  for (const k of Object.keys(freq)) freq[k] /= maxFreq;
  return freq;
}

function keywordCosineSimilarity(a: string, b: string): number {
  const va = buildTfVector(a);
  const vb = buildTfVector(b);
  let dot = 0;
  for (const k of Object.keys(va)) if (vb[k]) dot += va[k] * vb[k];
  const na = Math.sqrt(Object.values(va).reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(Object.values(vb).reduce((s, v) => s + v * v, 0));
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}
