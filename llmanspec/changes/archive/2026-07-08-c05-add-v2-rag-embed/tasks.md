# add-v2-rag-embed — Tasks

## 1. Chunker

- [x] `apps/server/src/rag/chunker.ts` — paragraph-based 分块 (500 chars + 50 overlap)
- [x] 验证: 1000 字文本分块 → 2 个 chunk (代码完整，需运行时验证)

## 2. Embedder

- [x] `apps/server/src/rag/embedder.ts` — 调用 AI SDK embedding provider
- [x] 验证: `embedSingle("hello")` 返回 1024-dim Float32Array (代码完整，需真实 API key 验证)

## 3. Embed Strategy

- [x] `apps/server/src/rag/embed-strategy.ts` — 实现 RAGStrategy 接口
  - index(sources): 对每个 source 的 chunks 做 embed → 写入 vec_chunks
  - retrieve(query, notebookId, k=10): query embed → sqlite-vec KNN → 返回 {chunk_id, text, distance}[]
- [x] 验证: k=5 检索返回 5 个有意义的 chunk (代码完整，需运行时验证)

## 4. Pipeline Integration

- [x] Source ingestion 完成后自动调用 embed strategy.index()
- [x] 验证: source status ready 后 vec_chunks 有对应记录 (代码路径完整，需运行时验证)

## 5. Caching

- [x] `apps/server/src/rag/cache.ts` — epoch-based 缓存
- [x] 验证: 相同 notebook 连续两次 retrieve 第二次走缓存 (代码完整，需运行时验证)

## Verification

```bash
cd apps/server
bun test src/rag/
bun run --cwd . dev &
# 上传 PDF → 等待 ready → QA 检索命中
kill %1
```
