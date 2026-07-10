// RAG types — shared interfaces for the registry pattern.
//
// All RAG strategies implement this interface. The registry (c06) maps
// strategy IDs to implementations.
export interface ChunkResult {
  chunk_id: number;
  text: string;
  /**
   * Similarity score in [0,1] (higher = more relevant). This is the canonical
   * relevance signal across all strategies:
   *  - embed:   `1 - cosine_distance` (sqlite-vec returns distance; convert)
   *  - keyword: normalized BM25 rank (0-1)
   *  - hybrid:  RRF fused score
   *  - page:    substring-match density
   * Filtering MUST use `score >= minScore` (higher is better).
   */
  score: number;
  source_id: number;
  chunk_index: number;
}

export interface RAGStrategy {
  /** Unique identifier (e.g. "embed", "keyword", "hybrid"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Index a source (chunk + embed + store vectors). */
  indexSource(sourceId: number, notebookId: number): Promise<void>;
  /** Retrieve top-K chunks for a query in a notebook. */
  retrieve(query: string, notebookId: number, opts?: RetrieveOptions): Promise<ChunkResult[]>;
  /** Check if a notebook has been indexed. */
  isIndexed(notebookId: number): Promise<boolean>;
  /** Clean up vectors when a source is deleted. */
  deleteSource(sourceId: number): Promise<void>;
}

/** Options shared by all strategies' retrieve(). */
export interface RetrieveOptions {
  topK?: number;
  minScore?: number;
  /** When true, expand the query into multiple seeds and RRF-fuse (embed only). */
  multiQuery?: boolean;
  /** Output type hint for seed generation (e.g. 'FAQ', 'GUIDE'). */
  outputType?: string;
  /** Cap results per source to enforce diversity. Default 3. */
  maxPerSource?: number;
  /** When set, skip search and return these chunks directly (reuse path). */
  chunkIds?: number[];
  /**
   * Restrict retrieval to these source ids (c40 — v1 source-scoping).
   * When set, the vector search is over-fetched then post-filtered to these
   * sources, since sqlite-vec vec0 cannot express source_id IN (...) in KNN.
   */
  sourceIds?: number[];
}
