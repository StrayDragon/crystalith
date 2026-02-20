## Context

系统已有：
- `GenerationPreference`（quality/speed）用于影响默认检索与生成策略。
- `tuning_for_request(output_type, preference)` 用于决定 `top_k/min_score/agent_retries` 等默认值（显式传参优先）。
- `retrieve_context(...)` 内部还存在其他默认策略：multi-query seeds、token budget、每来源 chunk 上限等。

目前 tuning 的“可控面”仍偏窄：多查询开关与 seed 数主要由环境变量与少量 heuristics 驱动；budget/max_chunks 的默认策略也缺少 OutputType 维度。需要把 tuning 从“零散默认值”演进为统一的、可回归的配置与日志。

## Goals / Non-Goals

**Goals:**
- 将 tuning 扩展为按 OutputType + preference 的统一表述，覆盖检索与生成的关键默认参数。
- 保持显式参数优先：当请求提供 `top_k/min_score/...` 时不被默认 tuning 覆盖。
- 在日志中记录 effective tuning，使“数据驱动调参”成为可能。

**Non-Goals:**
- 不引入复杂的在线自动调参/学习系统（先把 knobs 与观测补齐）。
- 不在本次直接引入“配置文件里写 tuning 表”的大规模可配置化（可作为后续）。

## Decisions

### 1) 扩展 tuning 的表达能力

将 tuning 从单纯的 `top_k/min_score/agent_retries` 扩展到包含 retrieval 与 generation 的关键维度，例如：
- retrieval：multi-query（开关/seed 上限）、`max_chunks_per_source`、`token_budget_ratio` 或预算 tokens
- generation：`agent_retries`（含 repair pass 的上限约束）

理由：这些参数直接决定 query_count 与上下文覆盖，必须纳入同一套 OutputType 维度的调参入口。

### 2) “单点解析 + 多处消费”

- tuning 的解析保持单点（`tuning_for_request` / `retrieval_tuning_for_request` 之类）。
- 调用点（outputs、slides、future research 等）只消费 effective tuning 并传入 `retrieve_context(...)` / `Agent(...)`。

理由：减少“每个入口自己猜默认值”的分叉。

### 3) 显式参数优先与回归边界

对所有可外部显式控制的参数遵循：
- 请求显式提供 → 不应用默认 tuning 覆盖
- 未提供 → 使用 OutputType + preference 的默认 tuning

理由：避免 silent behavior change 影响已有调用方的可控性。

### 4) 可观测性：记录 effective tuning

在“creating output / context resolved / generating output”等日志中记录：
- effective top_k/min_score/max_chunks/budget
- query_count（multi-query seeds 数）
- embed/search/generate timings

理由：后续可以按 OutputType 回归与调参（你提出的 #3）。

## Risks / Trade-offs

- [默认成本上升] → quality 表应保守；显式参数可覆盖；通过日志回归逐步微调。
- [调参入口变多] → 通过“表驱动 + 单点解析”限制复杂度。

## Migration Plan

- 第一步：补齐 tuning 表与日志字段（不改变 API 形状）。
- 第二步：基于日志数据回归调整默认值（按 OutputType/场景）。
- 如发现退化，可回滚到更保守默认并保留显式覆盖能力。

## Open Questions

- tuning 表是否需要支持“按模型 family”差异（本地模型 vs OpenAI）？
- multi-query seeds 数是否需要按 prompt 长度或 source 数动态缩放？
