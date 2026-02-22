# studio-slides-sse Specification

## Purpose

定义 SLIDES 大纲与 Markdown 生成的 SSE（Server-Sent Events）契约：端点、事件类型、payload 形状、busy/error/done 的语义，以及 debug 场景下的可选 timings 输出。

本规范只覆盖 slides SSE；draft 资源与持久化语义见 `studio-slides-drafts/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `generation-preference/spec.md`
- `generation-retrieval/spec.md`
- `generation-observability/spec.md`
- `studio-slides-drafts/spec.md`

## Requirements

### Requirement: SSE endpoints for outline and markdown
系统 MUST 提供两个 notebook-scoped 的 SSE 端点：

- `GET /v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/outline/stream`
- `GET /v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown/stream`

两者均 MAY 支持 query param `model_id` 用于动态选择模型。
draft 的 `source_ids` 为空时，SSE 端点 MUST 返回 400（不建立 event stream）。

### Requirement: busy handling and stale running cleanup
当 draft.status 为 `running` 时，系统 MUST 避免并发重复生成：

- 若 `running` 未过期 → 返回 `busy` 事件并结束连接
- 若 `running` 已过期（stale）→ 系统先清理为 `idle` 再继续本次生成
当 draft 正在生成且未 stale 时，SSE MUST 输出 `busy` 事件：`{"message": "..."}` 并结束连接。

### Requirement: markdown generation requires outline
系统 MUST 在 markdown SSE 生成前要求 draft 已存在 outline；否则返回 `error` 事件并结束连接。
当用户请求 markdown stream 但 draft.outline 为空时，SSE MUST 输出 `error`：`{"message": "尚未生成大纲，无法生成 Markdown。"}` 并结束连接。

### Requirement: Stable SSE event types and payloads
系统 MUST 使用稳定的 event 类型集合：`progress`, `toolcall`, `done`, `busy`, `error`。

事件 payload 约束如下：

- `progress`：`{ trace_id, stage, message, progress }`
  - `stage` 为 `"outline"` 或 `"markdown"`
  - `progress` 为 0..100 的整数
- `toolcall`：`{ trace_id, name }`
- `done`：`{ trace_id, slide_id, timings_ms? }`
- `busy`：`{ message }`
- `error`：`{ message, trace_id? }`（trace_id 可能缺失）
debug 开关 `CRYSTALITH_OBSERVABILITY_SSE_TIMINGS` 启用时，`done` payload MAY 包含 `timings_ms`（字典，值为毫秒整数）；默认不输出 `timings_ms`。

### Requirement: Successful generation updates draft state
当 outline/markdown 生成成功时，系统 MUST 更新 draft：

- `status: running → idle`
- `stage` 更新为对应阶段（outline 或 markdown）
- 写入生成结果（outline 或 markdown）
- 更新 `chunk_ids`（用于溯源）
生成成功时系统 MUST 先持久化 draft（commit），再输出 `done` 事件。

### Requirement: Errors are explicit and persisted when appropriate
当生成过程中发生异常时，系统 MUST：

- 将 draft.status 置为 `error`
- 记录 `error_message`（截断）
- 输出 `error` 事件并结束连接
模型配置错误等“可读错误”场景下，`error.message` MUST 为可读提示（例如“AI 模型配置错误，请检查配置。”）。
