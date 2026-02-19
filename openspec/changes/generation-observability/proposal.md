## Why

要同时优化“生成速度”和“输出质量”，必须先能稳定回答两个问题：慢在哪里、差在哪里。当前生成链路（outputs / slides / QA / refine）缺少统一的、可对比的时延分解与错误分类；即便已有少量日志，也难以跨路径对齐字段并做聚合分析（例如 cache hit rate、fallback rate、不同 output_type 的分布）。

因此需要一套面向生成链路的可观测性契约：统一 trace 标识、统一阶段耗时字段、统一错误/重试语义，才能支撑后续检索调参、缓存策略与后处理质量提升的迭代闭环。

## What Changes

- 定义“Generation Trace”最小模型（建议以结构化日志为主）：
  - 关联字段：`trace_id`/`request_id`、`notebook_id`、`output_type`、`preference`、`model_id`
  - 阶段耗时：embed/search/db/format/generate/persist 等（按路径可选）
  - 结果/质量信号：cache hit/miss、retrieval 结果数、avg score、fallback/repair 触发、重试次数、错误类型
- 在 outputs（OutputGraph）与 slides（outline/markdown）先落地统一字段，逐步扩展到 QA/refine 形成全链路一致性。
- 可选（受控开关）：在不破坏兼容的前提下，为 slides SSE `done` 事件或输出对象附带 `timings_ms` 汇总，便于前端/调试页面展示“耗时分解”（默认关闭或仅在 debug 模式开启）。

## Capabilities

### New Capabilities
- `generation-observability`: 规定生成链路必须产出的结构化可观测性信息（统一字段、阶段划分、错误分类、采样/开关与隐私约束），以及可选的前端可见 timings 输出。

### Modified Capabilities
- `studio-slides`:（如启用）SSE `done` 事件可携带兼容性新增字段 `timings_ms`/`stats`，用于展示 outline/markdown 的阶段耗时与关键计数。

## Impact

- Backend
  - outputs/slides 的日志字段对齐与 trace 生成/传递
  -（可选）slides SSE payload 增量字段与 debug 开关
- Frontend
  -（可选）增加一个轻量的“生成耗时详情”展示（仅 debug/开发可见）
- Ops
  - 日志聚合：可按 output_type / preference / model_id 聚合 latency 与失败率
  - 性能回归：为后续调参/缓存/后处理提供可量化对比基线
