// RAG types — shared interfaces for the registry pattern.
//
// All RAG strategies implement this interface. The registry (c06) maps
// strategy IDs to implementations.
export interface ChunkResult {
  chunk_id: number;
  text: string;
  distance: number;
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
  retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]>;
  /** Check if a notebook has been indexed. */
  isIndexed(notebookId: number): Promise<boolean>;
  /** Clean up vectors when a source is deleted. */
  deleteSource(sourceId: number): Promise<void>;
}
