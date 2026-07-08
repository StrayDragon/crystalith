// Greedy topic clustering using keyword vectors (TF-based).
//
// Since sqlite-vec does not expose stored vectors via SELECT, we build
// keyword-frequency vectors from chunk text for clustering. Each chunk is
// represented by a TF vector over its top tokens, and clusters are formed
// by cosine similarity between chunk TF vectors and cluster centroids.
// This mirrors the v1 approach (greedy incremental centroid) but uses
// keyword-space instead of embedding-space when vectors are inaccessible.

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

interface ChunkEntry {
  chunkId: number;
  /** Source id for exclusion in correlation. */
  sourceId: number;
  text: string;
}

interface ClusterState {
  sumVector: Record<string, number>;
  chunkIds: number[];
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (STOPWORDS.has(raw)) continue;
    tokens.push(raw);
  }
  return tokens;
}

/** Build a TF (term frequency) vector from a text. */
function tfVector(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] ?? 0) + 1;
  }
  // Normalize by max frequency so vectors are length-insensitive.
  const maxFreq = Math.max(1, ...Object.values(freq));
  for (const k of Object.keys(freq)) {
    freq[k] /= maxFreq;
  }
  return freq;
}

function dotProduct(a: Record<string, number>, b: Record<string, number>): number {
  let sum = 0;
  for (const k of Object.keys(a)) {
    if (b[k]) sum += a[k] * b[k];
  }
  return sum;
}

function norm(vec: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(vec)) {
    sum += v * v;
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const an = norm(a);
  const bn = norm(b);
  if (an === 0 || bn === 0) return 0;
  return dotProduct(a, b) / (an * bn);
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

/**
 * Greedy incremental centroid clustering on keyword TF vectors.
 *
 * For each chunk (sorted by chunk_id), find the most similar existing cluster.
 * If similarity >= minSimilarity, add to that cluster and update centroid.
 * Otherwise, create a new cluster (max maxTopics).
 */
export function clusterTopics(
  entries: ChunkEntry[],
  options: { minSimilarity?: number; maxTopics?: number; maxKeywords?: number } = {},
): Topic[] {
  const { minSimilarity = 0.7, maxTopics = 10, maxKeywords = 6 } = options;

  if (maxTopics <= 0 || entries.length === 0) return [];

  // Pre-compute TF vectors.
  const vectors = new Map<number, Record<string, number>>();
  for (const e of entries) {
    vectors.set(e.chunkId, tfVector(e.text));
  }

  const sorted = [...entries].toSorted((a, b) => a.chunkId - b.chunkId);
  const clusters: ClusterState[] = [];

  for (const entry of sorted) {
    const vec = vectors.get(entry.chunkId)!;

    if (clusters.length === 0) {
      clusters.push({ sumVector: { ...vec }, chunkIds: [entry.chunkId] });
      continue;
    }

    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const centroid: Record<string, number> = {};
      const count = cluster.chunkIds.length;
      for (const [k, v] of Object.entries(cluster.sumVector)) {
        centroid[k] = v / count;
      }
      const score = cosineSimilarity(vec, centroid);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestScore >= minSimilarity || clusters.length >= maxTopics) {
      // Add to best cluster.
      for (const [k, v] of Object.entries(vec)) {
        clusters[bestIndex].sumVector[k] = (clusters[bestIndex].sumVector[k] ?? 0) + v;
      }
      clusters[bestIndex].chunkIds.push(entry.chunkId);
    } else {
      // Start new cluster.
      clusters.push({ sumVector: { ...vec }, chunkIds: [entry.chunkId] });
    }
  }

  // Build topics.
  const chunkTextMap = new Map<number, string>();
  for (const e of entries) {
    chunkTextMap.set(e.chunkId, e.text);
  }

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
