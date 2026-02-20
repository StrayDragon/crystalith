## Why

当前“质量/速度”调参已经能影响 `top_k / min_score / agent_retries`，但生成链路的真实成本与质量还受更多参数影响（例如 multi-query 的 query_count、token budget、每来源 chunk 上限、修复/重试策略等）。如果调参维度只停留在「tool vs non-tool」或少量参数上，会出现：

- 某些 OutputType 在 quality 下仍证据覆盖不足，或在 speed 下仍不够快；
- multi-query 产生的额外 embed/search 开销难以被 OutputType 维度控制；
- 缺少可回归的“effective tuning”记录，导致调参无法数据驱动迭代。

## What Changes

- 将 tuning 从“少数参数 + heuristics”演进为**按 OutputType 的 tuning 表**（仍允许请求显式覆盖），并扩展可调维度：
  - retrieval：`multi_query`（开关/seed 数）、`max_chunks_per_source`、`token_budget_ratio`（或预算 tokens）
  - generation：`agent_retries`（含 repair pass 的策略约束）
- 在输出生成入口与检索入口记录 effective tuning（与 query_count/embed/search/generate timings 对齐），为后续回归/优化提供数据基础。
- 补充单测覆盖：不同 OutputType + preference 的 tuning 解析、默认覆盖规则（显式参数优先）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `agent-architecture`: 系统 MUST 能基于 OutputType + preference 选择 default tuning，并在未显式传参时应用到检索与生成。
- `backend-performance`: 系统 MUST 记录 effective tuning 与关键耗时字段，使调参可回归；并确保默认策略可控（显式参数可覆盖）。

## Impact

- Backend
  - `backend/py/src/crystalith/shared/agents/generation_preference.py`：扩展 tuning 表与解析逻辑。
  - `backend/py/src/crystalith/shared/retrieval/context.py`：让 multi-query、budget、diversity 的默认策略可由 tuning 驱动。
  - `backend/py/src/crystalith/shared/agents/output_graph.py`、`backend/py/src/crystalith/features/studio/slides/generator.py`：统一记录 effective tuning 与 timings。
  - `backend/py/tests/*`：补充回归测试。
- 这是一类“默认策略”变化：API 形状不变，显式请求参数优先，不影响已有调用方的可控性。
