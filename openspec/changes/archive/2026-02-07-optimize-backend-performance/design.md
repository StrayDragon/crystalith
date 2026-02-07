## Context

Crystalith 后端使用 FastAPI + SQLAlchemy async + 自定义向量存储。随着 notebook 中 source/chunk 增长，多个核心流程出现性能瓶颈。本设计覆盖 6 个优化领域，按影响和依赖关系排序实施。

## Goals / Non-Goals

- Goals:
  - 向量搜索延迟从 O(n) 降至 O(log n)
  - 大文档嵌入吞吐量提升 3-5x（通过批处理）
  - RAG Q&A 端到端延迟降低 30-40%（通过并行化）
  - 跨文档分析从 O(n²) 降至 O(n·k)
  - 消除事件循环阻塞（PDF/HTML 解析）
- Non-Goals:
  - 不引入外部消息队列（Redis/RabbitMQ）
  - 不更改数据库引擎（保持 SQLite 兼容）
  - 不更改 API 接口契约

## Decisions

### D1: 向量搜索 — 利用 Chroma 原生 ANN

- **Decision**: 对于 Chroma 后端，直接使用其内置的 HNSW 索引进行搜索，不再在应用层做暴力遍历。对 InMemory 后端保持暴力搜索。
- **Alternatives considered**:
  - 引入 hnswlib 独立索引：额外依赖、需手动同步
  - Faiss：C++ 依赖重、部署复杂
- **Rationale**: Chroma 已内置 HNSW，只需确保 search 调用走 Chroma query API 而非加载全量条目。

### D2: 嵌入批处理 — 分片 + 缓存

- **Decision**: 在 EmbeddingProvider 层添加 `embed_batch` 方法，按 `batch_size`（默认 100）分片调用；添加基于内容 SHA256 的 LRU 缓存。
- **Alternatives considered**:
  - 全量单次调用：可能超过 API token 限制
  - 外部缓存（Redis）：增加部署复杂度
- **Rationale**: 分片避免 API 限流，内存 LRU 缓存对单进程够用，re-embed 场景大量 chunk 内容相同。

### D3: RAG Q&A 管道 — asyncio.gather 并行化

- **Decision**: 将问题嵌入与历史获取并行（`asyncio.gather`），chunk 详情获取与上下文构建尽量并行。
- **Rationale**: embed 和 history fetch 无数据依赖，可安全并行。预期减少 30-40% 端到端延迟。

### D4: 跨文档分析 — 向量存储 top-k 替代全对比较

- **Decision**: 关联检测改为对每个 entry 调用 `vector_store.search(top_k=20, exclude_same_source=True)`，矛盾检测使用 `asyncio.gather` + `Semaphore(5)` 并行 LLM 调用。
- **Rationale**: 从 O(n²) 降至 O(n·k)，k=20 足以覆盖强关联。并行矛盾检测将 12 次串行 LLM 调用缩减为 2-3 轮。

### D5: Source 解析 — run_in_executor

- **Decision**: 将同步的 PDF/HTML 解析包装在 `loop.run_in_executor(None, ...)` 中。
- **Rationale**: 避免阻塞 async 事件循环，对大 PDF 尤其重要。

### D6: AI Provider 超时与重试

- **Decision**: 在 `AIProvider` 基类添加可配置的 `timeout`（默认 60s）和 `max_retries`（默认 3）+ 指数退避。
- **Rationale**: 外部 API 偶尔超时或限流，重试可提升可用性。

## Risks / Trade-offs

- Chroma ANN 搜索精度略低于暴力搜索（召回率 ~95-99%），对 RAG 可接受
- 嵌入缓存消耗内存（LRU maxsize=10000 约 ~100MB for 1536-dim embeddings）
- 并行 LLM 调用可能触发 provider 限流，需配合 Semaphore 控制

## Migration Plan

1. 向量搜索优化可独立实施，无迁移需求（Chroma 已有数据保持兼容）
2. 嵌入批处理向下兼容（新增方法，旧接口保留）
3. RAG 管道并行化为内部重构，API 接口不变
4. 所有优化可逐项上线、逐项验证

## Open Questions

- 嵌入缓存的最大条目数（maxsize）是否需要可配置？
- 是否需要为不同 AI provider 设置不同的超时/重试参数？
