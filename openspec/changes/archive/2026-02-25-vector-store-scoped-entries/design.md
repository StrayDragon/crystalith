## Context

- `analysis` 端点需要读取 notebook 的向量条目（VectorEntry）来做主题聚类、关系抽取与矛盾检测。
- 当前实现通过 `vector_store.entries()` 拉取全量条目后在应用层过滤，这在多 notebook 或大规模数据下会导致明显的性能与内存浪费。
- SQLite 向量存储实现已经具备按 `notebook_id` 过滤的查询能力，但 VectorStore 协议未表达该能力，导致上层无法安全使用。

## Goals / Non-Goals

**Goals:**
- 在 VectorStore 接口层表达并实现“按 notebook（可选按 source_ids）枚举向量条目”的能力。
- 让 analysis API 使用 notebook-scoped entries，避免加载其他 notebook 的向量。
- 保持不同向量后端（memory/sqlite/chroma/chroma_http）在语义上对齐，并在可行时走后端原生过滤（where 子句）。

**Non-Goals:**
- 不改变 analysis 的算法（top-k、聚类、矛盾检测）参数与输出结构（除非为修复性能问题必须）。
- 不引入新的向量后端或迁移流程（仅调整接口与调用方式）。

## Decisions

### 1) 扩展 `VectorStore.entries()` 为可选过滤参数（保持兼容）
**Decision:** 将 `VectorStore.entries()` 扩展为带可选关键字参数（至少 `notebook_id`，并支持可选 `source_ids`），且默认值为 `None`/空以保持现有调用不破坏。

**Rationale:** 最小改动即可让调用方表达“只取某 notebook”；对实现方而言也便于逐步优化（例如 Chroma where 过滤）。

### 2) 对 Chroma/HTTP 实现使用 where 过滤，而非应用层过滤
**Decision:** 对 `ChromaVectorStore` 与 `ChromaHttpVectorStore` 的 entries 实现使用 where 子句按 `notebook_id`（及 `source_id in ...`）过滤。

**Rationale:** 避免将全量 embeddings 拉回应用层；与 `vector-storage` spec 中“避免全量扫描”的性能约束一致。

### 3) Analysis 端点只消费 notebook-scoped entries
**Decision:** `GET /analysis` 直接请求 `entries(notebook_id=notebook_id)`，不再构造全量 list 再过滤。

**Rationale:** 这是性能与隔离的直接修复点；上层不应承担过滤责任。

## Risks / Trade-offs

- **[风险]** Protocol 方法签名变更影响自定义 VectorStore 实现 → **缓解**：仅新增可选参数；保持无参调用仍可用，并在任务中补齐所有内置实现。
- **[风险]** Chroma HTTP 的 entries 需要分页与 where 组合 → **缓解**：实现端统一分页策略，where 固定为 notebook 过滤；并补充测试覆盖。

## Migration Plan

- 无数据迁移：仅接口与调用方式调整。
- 部署顺序：先合入 VectorStore 实现与 analysis 调用，再跑全量测试；如发现性能回退可回滚到上一版本。

## Open Questions

- 是否需要在 `entries()` 上支持 `limit/offset`（目前 analysis 可能需要全量，但其他调用方未来可能需要分页）。
