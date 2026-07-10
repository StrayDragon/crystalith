// Greedy topic clustering using embedding vectors (c28 — restored from v1).
//
// Each chunk is represented by its stored embedding vector. Clusters are
// formed by greedy incremental centroid: for each chunk (sorted by id), find
// the most similar existing cluster by cosine similarity to its centroid; if
// similarity >= minSimilarity, add to that cluster, else create a new one.
//
// v1 reference: features/analysis/clustering.py (cluster_topics).
// Keyword extraction for topic naming is retained (v1 _extract_keywords).

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

export interface Topic {
  id: string;
  name: string;
  chunkIds: number[];
  keywords: string[];
}

/** A chunk entry with its embedding vector + text (for keyword extraction). */
export interface VectorChunkEntry {
  chunkId: number;
  sourceId: number;
  vector: Float32Array;
  text: string;
}

// ---------------------------------------------------------------------------
// Vector math (v1 _dot / _norm / _cosine_similarity)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cluster state (v1 _Cluster: sum_vector + chunk_ids, centroid = sum / count)
// ---------------------------------------------------------------------------

interface ClusterState {
  sumVector: Float32Array;
  chunkIds: number[];
}

function newCluster(vector: Float32Array, chunkId: number): ClusterState {
  return { sumVector: new Float32Array(vector), chunkIds: [chunkId] };
}

function centroidOf(cluster: ClusterState): Float32Array {
  const count = cluster.chunkIds.length;
  const centroid = new Float32Array(cluster.sumVector.length);
  for (let i = 0; i < cluster.sumVector.length; i++) {
    centroid[i] = cluster.sumVector[i]! / count;
  }
  return centroid;
}

function addToCluster(cluster: ClusterState, vector: Float32Array, chunkId: number): void {
  for (let i = 0; i < cluster.sumVector.length; i++) {
    cluster.sumVector[i]! += vector[i]!;
  }
  cluster.chunkIds.push(chunkId);
}

// ---------------------------------------------------------------------------
// Keyword extraction for topic naming (v1 _extract_keywords + _topic_name)
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/u)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    tokens.push(raw);
  }
  return tokens;
}

function extractKeywords(texts: string[], maxKeywords = 6): string[] {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    for (const t of tokenize(text)) {
      freq[t] = (freq[t] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([k]) => k);
}

function topicName(keywords: string[], index: number): string {
  return keywords.length > 0 ? keywords.slice(0, 3).join(' / ') : `Topic ${index}`;
}

// ---------------------------------------------------------------------------
// clusterTopics (v1 cluster_topics — greedy incremental centroid on embeddings)
// ---------------------------------------------------------------------------

/**
 * Greedy incremental centroid clustering on embedding vectors.
 *
 * For each chunk (sorted by chunk_id), find the most similar existing cluster
 * by cosine similarity to its centroid. If >= minSimilarity (or maxTopics
 * reached), add to that cluster; otherwise create a new cluster.
 */
export function clusterTopics(
  entries: VectorChunkEntry[],
  options: { minSimilarity?: number; maxTopics?: number; maxKeywords?: number } = {},
): Topic[] {
  const { minSimilarity = 0.7, maxTopics = 10, maxKeywords = 6 } = options;
  if (maxTopics <= 0 || entries.length === 0) return [];

  const sorted = [...entries].toSorted((a, b) => a.chunkId - b.chunkId);
  const clusters: ClusterState[] = [];

  for (const entry of sorted) {
    if (clusters.length === 0) {
      clusters.push(newCluster(entry.vector, entry.chunkId));
      continue;
    }

    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < clusters.length; i++) {
      const centroid = centroidOf(clusters[i]!);
      const score = cosineSimilarity(entry.vector, centroid);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestScore >= minSimilarity || clusters.length >= maxTopics) {
      addToCluster(clusters[bestIndex]!, entry.vector, entry.chunkId);
    } else {
      clusters.push(newCluster(entry.vector, entry.chunkId));
    }
  }

  // Build topics with keyword-derived names.
  const chunkTextMap = new Map<number, string>();
  for (const e of entries) chunkTextMap.set(e.chunkId, e.text);

  return clusters.map((cluster, i) => {
    const ids = cluster.chunkIds.toSorted((a, b) => a - b);
    const texts = ids.map((id) => chunkTextMap.get(id) ?? '');
    const keywords = extractKeywords(texts, maxKeywords);
    return {
      id: `topic-${i + 1}`,
      name: topicName(keywords, i + 1),
      chunkIds: ids,
      keywords,
    };
  });
}
