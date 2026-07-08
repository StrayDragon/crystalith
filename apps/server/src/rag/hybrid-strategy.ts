import { EmbedStrategy } from './embed-strategy.ts';
import { KeywordStrategy } from './keyword-strategy.ts';
// Hybrid RAG Strategy — parallel Embed + BM25 with RRF (Reciprocal Rank Fusion).
//
// Runs both semantic and keyword retrieval concurrently, then fuses results
// using RRF: score = Σ(1 / (k + rank)) with k = 60.
import type { RAGStrategy, ChunkResult } from './types.ts';

const RRF_K = 60;

interface RankedHit {
  chunk_id: number;
  text: string;
  source_id: number;
  chunk_index: number;
  embedDistance: number;
  bm25Distance: number;
}

function rrfFuse(
  embedResults: ChunkResult[],
  bm25Results: ChunkResult[],
  topK: number,
): ChunkResult[] {
  const scoreMap = new Map<number, { hit: RankedHit; score: number }>();

  // Compute RRF scores for embed results
  for (let i = 0; i < embedResults.length; i++) {
    const r = embedResults[i];
    const rrfScore = 1 / (RRF_K + (i + 1));
    const existing = scoreMap.get(r.chunk_id);
    if (existing) {
      existing.score += rrfScore;
      existing.hit.embedDistance = r.distance;
    } else {
      scoreMap.set(r.chunk_id, {
        score: rrfScore,
        hit: {
          chunk_id: r.chunk_id,
          text: r.text,
          source_id: r.source_id,
          chunk_index: r.chunk_index,
          embedDistance: r.distance,
          bm25Distance: 0,
        },
      });
    }
  }

  // Compute RRF scores for BM25 results
  for (let i = 0; i < bm25Results.length; i++) {
    const r = bm25Results[i];
    const rrfScore = 1 / (RRF_K + (i + 1));
    const existing = scoreMap.get(r.chunk_id);
    if (existing) {
      existing.score += rrfScore;
      existing.hit.bm25Distance = r.distance;
    } else {
      scoreMap.set(r.chunk_id, {
        score: rrfScore,
        hit: {
          chunk_id: r.chunk_id,
          text: r.text,
          source_id: r.source_id,
          chunk_index: r.chunk_index,
          embedDistance: 0,
          bm25Distance: r.distance,
        },
      });
    }
  }

  // Sort by RRF score descending and take topK
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => ({
      chunk_id: entry.hit.chunk_id,
      text: entry.hit.text,
      distance: entry.score, // RRF score as distance for consistency
      source_id: entry.hit.source_id,
      chunk_index: entry.hit.chunk_index,
    }));
}

export class HybridStrategy implements RAGStrategy {
  readonly id = 'hybrid';
  readonly name = 'Hybrid (RRF)';
  readonly version = '1.0.0';
  private embed = new EmbedStrategy();
  private keyword = new KeywordStrategy();

  async indexSource(sourceId: number, notebookId: number): Promise<void> {
    // Index for both strategies
    await Promise.all([
      this.embed.indexSource(sourceId, notebookId),
      this.keyword.indexSource(sourceId, notebookId),
    ]);
  }

  async retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]> {
    const topK = opts?.topK ?? 10;
    const minScore = opts?.minScore ?? 0;

    // Retrieve from both strategies in parallel, then fuse
    const [embedResults, bm25Results] = await Promise.all([
      this.embed.retrieve(query, notebookId, { topK: topK * 2 }),
      this.keyword.retrieve(query, notebookId, { topK: topK * 2 }),
    ]);

    const fused = rrfFuse(embedResults, bm25Results, topK);
    return fused.filter((r) => r.distance >= minScore);
  }

  async isIndexed(notebookId: number): Promise<boolean> {
    return this.embed.isIndexed(notebookId);
  }

  async deleteSource(sourceId: number): Promise<void> {
    await Promise.all([this.embed.deleteSource(sourceId), this.keyword.deleteSource(sourceId)]);
  }
}
