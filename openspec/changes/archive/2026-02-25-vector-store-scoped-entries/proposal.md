## Why

`GET /v1/notebooks/{notebook_id}/analysis` 当前通过 `vector_store.entries()` 拉取全量向量条目后再按 `notebook_id` 过滤，这会导致：

- 大数据量下的内存/延迟膨胀（即使只分析一个 notebook，也会加载其他 notebook 的向量）
- 向量存储抽象泄漏：调用方被迫了解/弥补存储层缺少“按 notebook 查询”的能力

需要把“按 notebook（及可选 source 范围）枚举向量条目”的能力下沉到 VectorStore 接口层，并让 analysis 端点使用该能力，避免全量扫描。

## What Changes

- 扩展 VectorStore 接口：为 `entries()` 增加可选过滤参数（至少 `notebook_id`，并支持可选 `source_ids` 过滤）。
- 更新所有向量存储实现（memory/sqlite/chroma/chroma_http 及任何包装层）以支持过滤参数；对 Chroma/HTTP 形态使用后端 where 子句而非应用层过滤。
- 更新 analysis API：只获取目标 notebook 的 entries（必要时再按 source 维度过滤），不再 `list(await vector_store.entries())` 全量加载。
- 增加回归测试/基准：验证 analysis 不会拉取其他 notebook entries，并覆盖各实现的过滤行为一致性。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `vector-storage`: VectorStore 接口与实现增加 notebook-scoped entries/query 能力，避免全量扫描。
- `analysis-api`: analysis 端点的数据访问方式变为 notebook-scoped，满足性能与隔离要求。

## Impact

- 受影响代码（预计）：
  - `backend/py/src/crystalith/shared/vector_storage/interfaces.py`
  - `backend/py/src/crystalith/shared/vector_storage/{memory,sqlite,chroma,chroma_http,cached}.py`
  - `backend/py/src/crystalith/features/analysis/api.py`
  - 相关测试与可能的类型检查/协议一致性
- 风险：
  - VectorStore 作为内部协议发生签名变更（对自定义实现属于“内部 breaking”）；通过提供默认参数保持对既有调用的兼容性。
