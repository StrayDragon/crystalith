// Embed RAG strategy — semantic search via sqlite-vec KNN.
//
// Chunks source text → embeds each chunk via AI SDK → stores vectors in
// vec_chunks virtual table. Retrieval uses sqlite-vec KNN join against the
// chunks table for full text results.
import { eq } from 'drizzle-orm';

import { db } from '../db/index.ts';
import { chunks } from '../db/schema.ts';
import {
  insertChunkVector,
  deleteSourceVectors,
  searchVectors,
  countVectors,
} from '../db/vectors.ts';
import { embedSingle, embedBatch } from './embedder.ts';
import type { RAGStrategy, ChunkResult } from './types.ts';

export interface EmbedStrategyConfig {
  batchSize?: number;
}

const DEFAULT_CONFIG: EmbedStrategyConfig = {
  batchSize: 32,
};

export class EmbedStrategy implements RAGStrategy {
  readonly id = 'embed';
  readonly name = 'Semantic Search';
  readonly version = '1.0.0';
  private config: EmbedStrategyConfig;

  constructor(config?: EmbedStrategyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Index a source: fetch all its chunks, embed them, and store vectors.
   */
  async indexSource(sourceId: number, notebookId: number): Promise<void> {
    const chunkRows = db()
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, sourceId))
      .orderBy(chunks.chunkIndex)
      .all();

    const texts = chunkRows.map((c) => c.text);
    const batchSize = this.config.batchSize ?? 32;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await embedBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        const chunkRow = chunkRows[i + j];
        insertChunkVector(db(), chunkRow.id, notebookId, sourceId, embeddings[j]);
      }
    }
  }

  /**
   * Retrieve top-K chunks by KNN search on the query embedding.
   */
  async retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]> {
    const queryVec = await embedSingle(query);
    const topK = opts?.topK ?? 10;
    const minScore = opts?.minScore ?? 0;

    const hits = searchVectors(db(), queryVec, notebookId, topK);

    return hits
      .filter((h) => h.distance >= minScore)
      .map((h) => ({
        chunk_id: h.rowid,
        text: h.text,
        distance: h.distance,
        source_id: h.source_id,
        chunk_index: h.chunk_index,
      }));
  }

  /**
   * Check if a notebook has any indexed vectors.
   */
  async isIndexed(notebookId: number): Promise<boolean> {
    return countVectors(db(), notebookId) > 0;
  }

  /**
   * Delete all vectors for a source.
   */
  async deleteSource(sourceId: number): Promise<void> {
    deleteSourceVectors(db(), sourceId);
  }
}
