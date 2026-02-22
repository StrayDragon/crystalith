# generation-retrieval Specification

## Purpose

定义生成链路中检索与上下文构建的共享策略：为 outputs/slides 等路径提供统一的检索、去重、多样性与预算裁剪能力，并支持可控的 multi-query（多查询种子）检索、结果融合与可选缓存。

## Related specs

- `GLOSSARY.md`
- `generation-preference/spec.md`
- `vector-storage/spec.md`
- `vector-search-cache/spec.md`
- `output-graph/spec.md`
- `studio-slides/spec.md`

## Requirements

### Requirement: Shared retrieval strategy for generation
系统 MUST 为 outputs 与 slides 的生成提供共享的检索与上下文构建策略，避免不同路径行为漂移。

### Requirement: Token budget for retrieval context
系统 MUST 对检索得到的 retrieval context 应用 token budget，避免超长上下文导致的失败率与成本增加。
当检索得到的 context 超过预算时，系统 MUST 截断或压缩 retrieval context。

### Requirement: Deduplication and source diversity
系统 MUST 在构建 context 时去重并保证来源多样性，避免单一来源占满上下文。
最小行为：`resolved_chunk_ids` MUST 不包含重复 chunk_id；系统 MUST 限制每个 source 进入 context 的 chunk 数不超过配置上限。

### Requirement: Optional multi-query retrieval (quality)
系统 MUST 支持 multi-query retrieval，并在启用后合并与裁剪结果。multi-query 的默认开关 SHOULD 来自 `generation-preference/spec.md` 的 tuning，但运维 MAY 通过环境开关强制启用/禁用以便排障或压测。
multi-query 启用后系统 MUST 使用多个查询种子检索并合并结果，且合并结果 MUST 经过去重与多样性裁剪；query seeds 数量 MUST 不超过 `seed_cap`（来自 tuning 表，见 `generation-preference/spec.md`）。

### Requirement: Robust multi-query fusion strategy
系统 MUST 为 multi-query 检索提供稳健的合并策略（默认推荐 RRF），避免仅以“最大 score”作为唯一合并信号，并应可回归测试。
默认合并策略 SHOULD 使用 RRF（Reciprocal Rank Fusion）或等价策略，奖励跨 query 一致高排名的 chunk；运维可通过 `CRYSTALITH_RETRIEVAL_FUSION_STRATEGY` 指定融合策略，未识别值 MUST 回退为默认策略。

### Requirement: Batch vector search (search_many) is used when available
系统 SHOULD 优先使用向量存储提供的批量检索接口（`search_many`）一次处理多个 query vectors；当 provider 不支持时，系统 MUST 回退为逐个 `search`（行为等价，性能不同）。

### Requirement: Optional retrieval assembly cache
系统 MAY 提供“context 组装缓存”（retrieval assembly cache）：在短 TTL 内缓存一次检索得到的 `resolved_chunk_ids`，用于同一 notebook/同一 seeds 下的重复生成加速。

缓存 key SHOULD 版本化（至少包含 sources_epoch/vector_epoch），以便在 sources 或向量集合变更后自然失效；TTL SHOULD 可配置。
assembly cache 命中时系统 SHOULD 复用缓存的 chunk_ids 进行 DB 加载与格式化，并跳过 embedding 与向量检索阶段。

### Requirement: Chunk-id reuse fast path
系统 SHOULD 支持可选的 `chunk_ids` 输入：当调用方已持有一组候选 chunk_ids（例如从上一阶段生成得出），检索模块可先尝试复用这些 chunk_ids 构建 context；若校验失败再回退为向量检索。
当 chunk_ids 不存在、不可访问或对应 source 不再 `ready` 时，系统 MUST 回退为常规向量检索路径。
