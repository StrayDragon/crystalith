## Context

当前 outputs 与 slides 的检索与上下文构建方式基本一致，但分散在多个模块并存在硬编码与不稳定点：

- 单 query embedding → vector search（`top_k/min_score`）→ DB 查 chunk → `format_context` 拼接全部文本。
- outputs（OutputGraph）与 slides 各自实现了过滤与格式化逻辑，易产生漂移。
- retrieval context 缺少 token budget 管控：上下文过长会增加成本与失败率，并加剧质量波动。
- 缺少按 `output_type` 与 `preference` 的差异化策略（覆盖率、多样性、阈值/召回、是否多查询）。

现有可复用基础：

- `ContextWindow`/`TokenCounter` 已用于 QA，具备对 retrieval segment 的截断能力。
- `cached_vector_search` 已存在，可作为 retrieval 基础缓存层。

## Goals / Non-Goals

**Goals:**
- 抽象并复用 outputs/slides 的检索与上下文构建逻辑，形成单一实现（减少复制粘贴与行为漂移）。
- 引入 token budget：对 retrieval context 做稳定截断/压缩，避免超长导致的模型失败与成本飙升。
- 按 `output_type + preference` 提供策略差异：召回/阈值、覆盖/多样性、去重、（可选）多查询。

**Non-Goals:**
- 不在本次重写向量存储/索引方式（仍基于 Chroma 的 ANN query）。
- 不强制引入 LLM 做 query expansion（可作为可选路径，优先用确定性/低成本策略）。

## Decisions

### 1) 引入共享的 Retrieval 模块

新增模块（示例命名）：`backend/py/src/crystalith/shared/retrieval/`

职责：

- 输入：`notebook_id`, `prompt/seed`, `source_ids`, `preference`, `output_type`, `model_id`
- 输出：
  - `resolved_chunk_ids`
  - `citations`（或 citation 构建所需的 chunk_map）
  - `context_text`（已格式化并应用 budget）
  - `stats`（results、avg_score、coverage、truncated 等）

outputs 的 `ResolveContext` 与 slides 的 `_resolve_context` 统一改用该模块。

### 2) Token budget 策略：优先截断 retrieval

- 使用 `TokenCounter(model_name)` 对 retrieval segment 做截断（复用 `ContextWindow` 的 retrieval 截断逻辑或提取为独立 helper）。
- budget 来源：
  - 默认使用 `settings.context_window.max_tokens` 的一定比例（例如 50–70%）作为 retrieval 上限；
  - 或为 outputs/slides 单独提供常量上限（更可控），并允许按 preference 缩放（speed 更小，quality 更大）。

### 3) 去重与多样性

确定性规则（先实现）：

- chunk_id 去重（已有）
- 近似重复文本折叠（简单 hash/normalize 后去重）
- 每个 source 的最大 chunk 数限制（避免单源占满 context），例如 `max_chunks_per_source = 2`（quality 可更高）

### 4) Multi-query retrieval（可选、质量优先）

第一阶段实现不依赖额外 LLM：

- 生成多个 embedding seed（例如 `prompt`、`prompt + output_type`、`tool default prompt` 等）并合并检索结果。
- 合并策略：score 合并（max/avg）、dedup、再按多样性规则裁剪。

后续可扩展（受控开关）：用 chat 模型生成 query expansions。

## Risks / Trade-offs

- [策略复杂度上升] → 先落地最小共享模块 + budget + 去重/多样性；multi-query 作为可选阶段。
- [截断导致信息丢失] → 在 stats 中记录 `truncated=true` 与截断比例；结合 observability 做回归评估。
- [不同 output_type 的最佳策略差异大] → 先提供少量 preset（按 preference），再逐步按 output_type 微调。

## Migration Plan

- 先在 slides 或 outputs 单边接入共享 retrieval 模块，验证效果后再统一。
- 保留旧实现一段时间（可通过 feature flag）以便回滚。

## Open Questions

- retrieval budget 是否应按模型不同（context window 不同）动态调整？
- 是否需要在 DB 输出记录中持久化 retrieval stats（便于对比质量/速度）？
