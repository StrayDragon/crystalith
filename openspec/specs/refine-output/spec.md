# refine-output Specification

## Purpose

定义“提炼（refine）”能力：在给定 prompt 与可选来源范围（`source_ids`）内生成提炼结果（`paragraph|bullets|structured|...`），并返回可追溯的 citations 与 evidence 标记。该能力为 Studio/工作区提供轻量的“快速总结/结构化”路径，不替代 outputs 生成流水线。

## Related specs

- `GLOSSARY.md`
- `workspace-studio-ui/spec.md`
- `workspace-api/spec.md`
- `generation-preference/spec.md`
- `background-task-queue/spec.md`

## API

- `POST /v1/notebooks/{notebook_id}/refine`：单格式提炼（通过 TaskQueue 执行并等待完成）
- `POST /v1/notebooks/{notebook_id}/refine/batch`：批量提炼（一次返回多个 formats）

## Requirements

### Requirement: Stable request fields
请求体 MUST 支持字段（语义稳定）：

- `prompt: string`
- `source_ids?: int[]`
- `top_k: int`
- `min_score: float`
- 单格式：`format: string`
- 批量：`formats?: string[]`（为空表示使用服务端默认 formats 列表）

### Requirement: Stable response envelope
响应 MUST 包含 `citations: Citation[]`, `evidence: bool`, `created_at`，并按 format 返回内容：

- 单格式：`{ format, paragraph? | bullets? | structured? }`
- 批量：`{ outputs: { [format]: { paragraph? | bullets? | structured? } } }`

### Requirement: Formats have a minimal baseline and are configurable
系统 MUST 至少支持 `paragraph`, `bullets`, `structured` 三种 format，并允许通过配置扩展 format 列表；未支持的 format MUST 返回 400（Unsupported refine format）。

最小语义：
- `paragraph`：连续段落文本
- `bullets`：项目符号列表
- `structured`：`{ title, bullets[], terms[] }`（并包含 citations）

### Requirement: Retrieval scope is constrained by source_ids
系统 MUST 支持通过 `source_ids` 显式限定提炼上下文范围，并仅从这些 sources 检索/构建 context；返回的 citations MUST 仅来自这些 sources。

当 `source_ids` 为空或未提供时，系统 MUST 不执行检索并以空上下文生成，且 citations 为空或 `evidence=false`。

### Requirement: Execution uses guardrails
单格式提炼 MUST 通过后台任务队列执行（见 `background-task-queue/spec.md`），并遵循阶段级并发限制与取消语义。
批量提炼 MAY 在单请求内执行，但 MUST 有并发上限以避免对 provider 造成突刺。
