## Approach

### RAGStrategy Interface

```ts
// apps/server/src/rag/types.ts
export interface RAGStrategy {
  id: string;
  name: string;
  version: string;
  index(sources: Source[]): Promise<void>;
  retrieve(
    query: string,
    notebookId: number,
    opts?: { topK?: number; minScore?: number },
  ): Promise<ChunkResult[]>;
  isIndexed(notebookId: number): Promise<boolean>;
  deleteSource(sourceId: number): Promise<void>;
}
```

### Registry

```ts
// apps/server/src/rag/registry.ts
class RAGRegistry {
  private strategies = new Map<string, RAGStrategy>();

  register(strategy: RAGStrategy): void;
  get(id: string): RAGStrategy;
  list(notebookId: number): Promise<AvailableStrategy[]>; // includes indexing status
  apply(notebookId: number, strategyIds: string[]): Promise<void>; // persist to DB
}
```

### Strategies

| ID           | Name            | Backend              | Use Case         |
| :----------- | :-------------- | :------------------- | :--------------- |
| `embed`      | Semantic Search | sqlite-vec KNN       | General QA       |
| `keyword`    | BM25            | sqlite-fts5          | Precision search |
| `hybrid`     | Hybrid (RRF)    | vec KNN + fts5       | Balanced         |
| `page-index` | Page Index      | chunks.metadata.page | Slide generation |

BM25 via `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content=chunks)` — built into sqlite, zero deps.

RRF fusion: `score = Σ(1 / (k + rank))` with k=60.

### Notebook-level strategy config

`POST /v2/notebooks/:id/strategies` — persist selection. Each notebook can enable multiple strategies; QA/Output generation picks the active one(s).

### Dependencies

None beyond sqlite-fts5 (built into bun:sqlite). No external npm packages for BM25/RRF.
