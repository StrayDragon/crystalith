// Embed RAG strategy — semantic search via sqlite-vec KNN.
//
// Chunks source text → embeds each chunk via AI SDK → stores vectors in
// vec_chunks virtual table. Retrieval uses sqlite-vec KNN join against the
// chunks table for full text results.
import { and, eq, inArray } from 'drizzle-orm';

import { client, db } from '../db/index.ts';
import { chunks, sources } from '../db/schema.ts';
import {
  insertChunkVector,
  deleteSourceVectors,
  searchVectors,
  countVectors,
} from '../db/vectors.ts';
import { getEmbeddingSettings } from '../shared/config.ts';
import { getCached, setCached, bumpVectorEpoch } from './cache.ts';
import { applyDiversity } from './diversity.ts';
import { markChunksEmbedded } from './embed-metadata.ts';
import { embedSingle, embedBatch } from './embedder.ts';
import { buildQuerySeeds, rrfFuseSeeds } from './multi-query.ts';
import type { RAGStrategy, ChunkResult, RetrieveOptions } from './types.ts';

export interface EmbedStrategyConfig {
  batchSize?: number;
}

const DEFAULT_CONFIG: EmbedStrategyConfig = {};

export class EmbedStrategy implements RAGStrategy {
  readonly id = 'embed';
  readonly name = 'Semantic Search';
  readonly version = '1.0.0';
  private config: EmbedStrategyConfig;

  constructor(config?: EmbedStrategyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Resolve batch size: explicit config override → embedding.batch_size config. */
  private get batchSize(): number {
    return this.config.batchSize ?? getEmbeddingSettings().batch_size;
  }

  /**
   * Index a source: fetch all its chunks, embed them, and store vectors.
   * Stamps embedding_model / embedding_dims on the chunk rows (c130 r479 — a
   * re-embed refreshes both) and bumps the notebook's vector_epoch so cached
   * retrievals are invalidated.
   */
  async indexSource(sourceId: number, notebookId: number): Promise<void> {
    const chunkRows = await client().all(
      db().select().from(chunks).where(eq(chunks.sourceId, sourceId)).orderBy(chunks.chunkIndex),
    );
    if (chunkRows.length === 0) {
      bumpVectorEpoch(notebookId);
      return;
    }

    // Document-role titles: the source filename feeds the document prefix
    // template (r475). One PK lookup — only when there are chunks to embed.
    const sourceRow = await client().get(
      db().select({ filename: sources.filename }).from(sources).where(eq(sources.id, sourceId)),
    );
    const title = sourceRow?.filename;

    const texts = chunkRows.map((c) => c.text);
    const batchSize = this.batchSize;
    let vectorDims: number | null = null;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await embedBatch(batch, {
        titles: title ? batch.map(() => title) : undefined,
      });
      vectorDims = embeddings[0].length;

      for (let j = 0; j < batch.length; j++) {
        const chunkRow = chunkRows[i + j];
        await insertChunkVector(db(), chunkRow.id, notebookId, sourceId, embeddings[j]);
      }
    }

    // r479/r483: stamp embedding index metadata on this source's chunk rows —
    // a re-embed overwrites both columns, so no stale values survive.
    await markChunksEmbedded(sourceId, vectorDims);
    // New vectors invalidate cached retrievals for this notebook.
    bumpVectorEpoch(notebookId);
  }

  /**
   * Retrieve top-K chunks by KNN search on the query embedding.
   *
   * vec_chunks declares `distance_metric=cosine` (see initVecChunks), so
   * sqlite-vec returns cosine `distance` (0 = identical, lower = closer).
   * We convert to a similarity `score = 1 - distance` (higher = better) so the
   * filter direction (`score >= minScore`) is consistent across all strategies.
   * Defaults match v1: topK=8, minScore=0.2.
   *
   * Options:
   *  - multiQuery: expand query into seeds + RRF-fuse (default off)
   *  - chunkIds: reuse path — return these chunks directly (skip search)
   *  - maxPerSource: diversity cap (default 3)
   */
  async retrieve(
    query: string,
    notebookId: number,
    opts?: RetrieveOptions,
  ): Promise<ChunkResult[]> {
    const topK = opts?.topK ?? 8;
    const minScore = opts?.minScore ?? 0.2;

    // chunk_id reuse path: skip embed/search/cache, fetch directly.
    if (opts?.chunkIds?.length) {
      return applyDiversity(await this.fetchByIds(opts.chunkIds, notebookId), opts.maxPerSource);
    }

    // Epoch cache: identical query+params within the same epoch skips re-embed.
    // Include sourceIds so an empty scoped miss cannot poison other scopes.
    const sourceKey = opts?.sourceIds?.length
      ? [...opts.sourceIds].toSorted((a, b) => a - b).join(',')
      : '';
    const paramsKey = `${topK}:${minScore}:${opts?.multiQuery ?? false}:${opts?.outputType ?? ''}:src=${sourceKey}`;
    const cached = getCached(notebookId, query, paramsKey);
    if (cached) return applyDiversity(cached, opts?.maxPerSource);

    let results: ChunkResult[];
    if (opts?.multiQuery) {
      const seeds = buildQuerySeeds(query, opts.outputType);
      const lists = await Promise.all(
        seeds.map((s) => this.searchOne(s, notebookId, topK, minScore, opts?.sourceIds)),
      );
      results = rrfFuseSeeds(lists, topK);
    } else {
      results = await this.searchOne(query, notebookId, topK, minScore, opts?.sourceIds);
    }
    setCached(notebookId, query, paramsKey, results);
    return applyDiversity(results, opts?.maxPerSource);
  }

  /** Single-query KNN search (shared by single + multi-query paths). */
  private async searchOne(
    query: string,
    notebookId: number,
    topK: number,
    minScore: number,
    sourceIds?: number[],
  ): Promise<ChunkResult[]> {
    const queryVec = await embedSingle(query);
    const hits = await searchVectors(db(), queryVec, notebookId, topK, sourceIds);
    return hits
      .map((h) => ({
        chunkId: h.rowid,
        text: h.text,
        // distance → similarity
        score: Math.max(0, 1 - h.distance),
        sourceId: h.source_id,
        chunkIndex: h.chunk_index,
      }))
      .filter((h) => h.score >= minScore);
  }

  /** Fetch specific chunks by id (reuse path), scoped to a notebook via sources. */
  private async fetchByIds(chunkIds: number[], notebookId: number): Promise<ChunkResult[]> {
    const rows = await client().all(
      db()
        .select({
          id: chunks.id,
          text: chunks.text,
          sourceId: chunks.sourceId,
          chunkIndex: chunks.chunkIndex,
        })
        .from(chunks)
        .innerJoin(sources, eq(chunks.sourceId, sources.id))
        .where(and(inArray(chunks.id, chunkIds), eq(sources.notebookId, notebookId))),
    );
    return rows.map((r) => ({
      chunkId: r.id,
      text: r.text,
      // explicitly selected — max relevance
      score: 1,
      sourceId: r.sourceId,
      chunkIndex: r.chunkIndex,
    }));
  }

  /**
   * Check if a notebook has any indexed vectors.
   */
  async isIndexed(notebookId: number): Promise<boolean> {
    return (await countVectors(db(), notebookId)) > 0;
  }

  /**
   * Delete all vectors for a source.
   */
  async deleteSource(sourceId: number): Promise<void> {
    await deleteSourceVectors(db(), sourceId);
  }
}
