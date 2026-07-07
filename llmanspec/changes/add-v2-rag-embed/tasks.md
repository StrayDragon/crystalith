# add-v2-rag-embed — Tasks

## 1. Chunker
- [ ] `server/src/rag/chunker.ts` — paragraph-based 分块 (500 chars + 50 overlap)
- [ ] 验证: 1000 字文本分块 → 2 个 chunk

## 2. Embedder
- [ ] `server/src/rag/embedder.ts` — 调用 AI SDK embedding provider
- [ ] 验证: `embedSingle("hello")` 返回 1024-dim Float32Array

## 3. Embed Strategy
- [ ] `server/src/rag/embed-strategy.ts` — 实现 RAGStrategy 接口
  - index(sources): 对每个 source 的 chunks 做 embed → 写入 vec_chunks
  - retrieve(query, notebookId, k=10): query embed → sqlite-vec KNN → 返回 {chunk_id, text, distance}[]
- [ ] 验证: k=5 检索返回 5 个有意义的 chunk

## 4. Pipeline Integration
- [ ] Source ingestion 完成后自动调用 embed strategy.index()
- [ ] 验证: source status ready 后 vec_chunks 有对应记录

## 5. Caching
- [ ] `server/src/rag/cache.ts` — epoch-based 缓存
- [ ] 验证: 相同 notebook 连续两次 retrieve 第二次走缓存

## Verification
```bash
cd server
bun test src/rag/
bun run --cwd . dev &
# 上传 PDF → 等待 ready → QA 检索命中
kill %1
```

