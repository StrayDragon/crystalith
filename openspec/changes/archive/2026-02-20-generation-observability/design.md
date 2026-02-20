## Context

当前生成链路已经有部分结构化日志与阶段耗时，但存在以下问题：

- 缺少统一的关联标识（`trace_id`/`request_id`），无法把同一次生成中的多条日志可靠串联。
- 不同路径（outputs/slides/QA/refine）阶段字段不一致，难以聚合对比（例如 cache hit rate、fallback rate、各 stage 耗时分布）。
- 没有明确的错误分类与重试语义字段，难以定位“慢在哪里/差在哪里”。

项目现状约束：

- 后端使用 `cl_logs` 结构化日志（`log.info(..., key=value)`），尚未引入 OpenTelemetry/Prometheus 等指标体系。
- slides 使用 SSE 推送进度事件，默认 payload 以进度为主。

## Goals / Non-Goals

**Goals:**
- 定义并落地“Generation Trace”的最小可观测性契约（优先结构化日志），统一字段命名与阶段划分。
- 在 outputs（OutputGraph）与 slides（outline/markdown）先实现，并为后续扩展到 QA/refine 预留一致接口。
- 可选：在 debug 模式下为 slides SSE `done` 事件附带 `timings_ms` 汇总（兼容性新增字段）。

**Non-Goals:**
- 不在本次引入完整 metrics/trace 平台（OTel/Prometheus/Grafana）。
- 不把所有内部细节暴露给前端（仅 debug/开发场景可选输出）。

## Decisions

### 1) 以结构化日志作为第一阶段“事实来源”

统一输出以下最小字段集合（能跨路径对齐）：

- 关联：`trace_id`、`request_id`（如可获得）、`notebook_id`、`output_type`、`preference`、`model_id`
- 阶段耗时：`embed_ms`、`search_ms`、`db_ms`、`format_ms`、`generate_ms`、`persist_ms`（按路径可选）
- 结果/质量信号：`cache_hit`/`cache_key`（可选）、`results`、`avg_score`（可选）、`fallback`、`agent_retries`、`error_kind`

### 2) trace_id 生成与传递方式

- 在每次“生成请求”的入口生成 `trace_id`（例如 `uuid4().hex`）。
- 将 `trace_id` 显式传入核心流程（OutputGraph state / slides generator 参数），并在关键日志点打出。
- `request_id` 优先从 HTTP header（若存在）读取，否则可等同于 `trace_id`（保持字段一致性）。

### 3) 错误分类（error_kind）

标准化 `error_kind` 取值（示例）：

- `embed_error` / `retrieval_error` / `model_error` / `validation_error` / `persist_error` / `unknown_error`

并在日志中同时记录 `error`（异常类型）与 `message`（必要时截断）。

### 4) slides SSE 的 timings 输出（可选）

- 在 `done` 事件 payload 中新增可选字段：
  - `timings_ms`: `{ embed_ms, search_ms, db_ms, format_ms, generate_ms, persist_ms, total_ms }`
- 仅在 debug 开关开启时输出（避免对外 API 行为变化与 payload 体积增加）。

## Risks / Trade-offs

- [日志量上升] → 仅在关键节点打点；可引入采样（按 trace_id hash）或 debug 开关控制细粒度字段。
- [trace_id 未能覆盖所有路径] → 先覆盖 outputs/slides；后续扩展 QA/refine 时强制携带并复用字段命名。
- [SSE payload 兼容性] → 只做兼容性新增字段，前端按存在与否展示；默认关闭。

## Migration Plan

- 后端先上线：不影响现有 API；仅增加日志字段。
- 若启用 SSE timings：先在开发环境开启验证，再逐步放开；出现问题可关闭开关回滚。

## Open Questions

- debug 开关放在配置（`settings.observability.debug_timings`）还是环境变量更合适？
- 是否需要为“同一次生成”在 DB 中持久化 trace_id（便于回放与用户反馈定位）？
