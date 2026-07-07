## Approach

### Chunker

Paragraph-based 分块，500 chars + 50 chars overlap:

```ts
function chunkText(text: string, maxLen = 500, overlap = 50): Chunk[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: Chunk[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxLen) {
      chunks.push({ text: para.trim() });
    } else {
      // Split long paragraphs by sentences with overlap
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > maxLen && current.length > 0) {
          chunks.push({ text: current.trim() });
          current = current.slice(-overlap) + s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push({ text: current.trim() });
    }
  }
  return chunks;
}
```

### Embedder

通过 AI SDK embedding provider:

```ts
import { embed } from 'ai';

async function embedChunks(chunks: string[], model: EmbeddingModel): Promise<Float32Array[]> {
  const { embeddings } = await embed({ model, values: chunks });
  return embeddings;
}
```

### Embed RAG Strategy

实现 `RAGStrategy` 接口:

```ts
const embedStrategy: RAGStrategy = {
  id: 'embed',
  name: 'Embed RAG',
  version: '1.0.0',
  async index(sources: Source[]) {
    /* chunk → embed → insert vec_chunks */
  },
  async retrieve(query: string, notebookId: number, k = 10) {
    const qVec = await embedSingle(query);
    return searchVectors(orm, qVec, notebookId, k);
  },
  async isIndexed(notebookId: number) {
    /* check vec_chunks count */
  },
};
```

### Cache

Epoch-based LRU 缓存（桌面 app 无需 Redis）:

```ts
class EpochCache<T> {
  private cache = new Map<string, { data: T; epoch: number }>();

  get(key: string, currentEpoch: number): T | undefined {
    const entry = this.cache.get(key);
    return entry?.epoch === currentEpoch ? entry.data : undefined;
  }
  set(key: string, data: T, epoch: number) {
    this.cache.set(key, { data, epoch });
  }
}
```

### Migration note

- Embedding model 通过 config 选择（默认 bge-m3 1024-dim）
- 向量与 chunk 同库 JOIN
- 缓存用内存 LRU，不进 agent loop
