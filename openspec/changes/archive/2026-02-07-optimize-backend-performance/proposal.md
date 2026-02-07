## Why

当前后端存在多处性能瓶颈，直接影响用户体验：向量搜索使用暴力遍历 O(n)，嵌入流程无批处理和缓存，RAG Q&A 管道全串行执行，跨文档分析使用 O(n²) 全对比较，批量 Refine 串行调用 LLM。随着 source 数量和 chunk 数量增长，这些瓶颈会导致明显的延迟劣化。

## What Changes

- 向量搜索引入近似最近邻（ANN）索引，替代暴力遍历
- 嵌入流程添加批处理（可配置 batch_size）和内容哈希缓存
- RAG Q&A 管道并行化无依赖操作（embed + history fetch、search + validation）
- 跨文档分析优化：关联检测从 O(n²) 降至 O(n·k)，矛盾检测并行化
- 批量 Refine 使用 asyncio.gather 并行调用 LLM
- Source 解析移至线程池（run_in_executor），避免阻塞事件循环
- AI Provider 调用添加可配置超时和重试策略

## Impact

- 受影响的规范：`vector-storage`（MODIFIED）、`source-ingestion`（MODIFIED）、`rag-qa`（MODIFIED）、`cross-document-analysis`（MODIFIED）
- 受影响的系统：
  - `shared/vector_storage/` — 搜索算法和索引
  - `shared/ai/` — 嵌入批处理、超时、重试
  - `features/qa/api.py` — RAG 管道并行化
  - `features/analysis/` — 关联/矛盾检测优化
  - `features/refine/api.py` — 批量并行化
  - `features/sources/api.py` — 解析异步化、嵌入批处理
