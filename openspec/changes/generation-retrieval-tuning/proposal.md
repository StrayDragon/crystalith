## Why

检索质量直接决定输出质量上限，而检索成本也决定端到端延迟下限。当前生成链路的检索策略相对“固定且单一”：单 query embedding + top_k/min_score 过滤 + 全量 context 拼接，缺少按 output_type 的差异化（例如 Slides 更需要覆盖面与多样性，FAQ 更需要聚焦与高精度），也缺少 token budget 约束导致上下文过长时的稳定性风险。

同时，我们希望 `preference`（quality/speed）不只是一个“参数”，而是能驱动检索策略与上下文构建策略的系统性开关，形成可解释、可调优、可观测的检索层。

## What Changes

- 引入“按 output_type + preference 的检索预设/策略”：
  - `top_k/min_score` 的默认值与上限
  - source 多样性/覆盖率约束（避免单一来源占满 context）
  - 去重（chunk_id 去重、近似重复内容折叠）
- 为 outputs/slides 引入 token budget 管控：复用现有 `ContextWindow`/`TokenCounter`，对 retrieval context 进行截断/压缩，降低超长上下文导致的失败率与成本。
-（质量优先路径）可选 multi-query retrieval：生成 2-3 个子查询并合并结果（dedup + rerank），提升召回与覆盖；（速度优先路径）保持单查询但更严格阈值与更小 top_k。
-（性能）为 embedding 与 retrieval 引入更系统的缓存/复用点（例如同一请求内复用 query embedding、对常见 seed 做短 TTL 缓存），并通过 observability 监控收益。

## Capabilities

### New Capabilities
- `generation-retrieval`: 定义生成场景（outputs + slides）的检索策略、token budget 行为、质量/速度倾向下的策略差异，以及可观测指标（coverage/diversity/score 分布）。

### Modified Capabilities
- `agent-architecture`: ResolveContext 不再仅是“固定参数的向量搜索”，而是按策略构建 context（预算截断、去重/多样性、可选多查询），并与 `preference` 形成清晰契约。
- `studio-slides`: Slides outline/markdown 的 context 构建遵循统一的检索策略与预算约束，确保质量与性能可控且可解释。

## Impact

- Backend
  - `OutputGraph.ResolveContext` 与 slides context 构建逻辑将被抽象/复用（共享策略与 budget）
  - 可能新增检索策略模块（避免在各 feature 里复制粘贴）
- 配置
  - 可能需要为不同 output_type 提供可配置默认值（但应有安全默认）
- 测试/验收
  - 单测：策略合并/去重/多样性与预算截断行为
  - 回归：确保 speed/quality 两种倾向下生成稳定且可观测
