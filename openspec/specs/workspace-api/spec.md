# workspace-api Specification

## Purpose

定义 Workspace 前端依赖的 HTTP API **稳定契约**（字段、错误响应、SSE 事件形状与关键端点语义），用于避免“后端已变更但前端/SDK 未同步”的漂移。

本规范不替代 OpenAPI：细节以 `/v1/codev/openapi.json` 为准；本文件只约束**跨端必须稳定**的部分，并尽量通过 cross-links 把端点语义拆到对应 capability spec。

## Related specs

- `GLOSSARY.md`
- `openapi-docs/spec.md`
- `frontend-api-client/spec.md`
- `notebook-management/spec.md`
- `rag-qa/spec.md`
- `analysis-api/spec.md`
- `search-engine/spec.md`
- `source-ingestion/spec.md`
- `source-ingestion-management/spec.md`
- `source-ingestion-url/spec.md`
- `source-ingestion-summary-qa/spec.md`
- `content-conversion/spec.md`
- `generation-preference/spec.md`
- `agent-architecture/spec.md`
- `output-graph/spec.md`
- `plugin-system/spec.md`

## Requirements

### Requirement: Versioned API base
系统 MUST 以 `/v1` 作为对外 API 的版本前缀，并保持已有端点在同一 major 版本内的兼容性（新增字段允许，破坏性变更需新版本或明确迁移策略）。

### Requirement: Standardized error response envelope (non-SSE)
系统 MUST 对**非 SSE**的 HTTP 错误响应返回统一 JSON：`{ error_code, message, details?, retry_after? }`；`retry_after`（秒）与 `Retry-After` header 保持一致。

请求参数校验失败时 MUST 返回 422 且 `error_code = "VALIDATION_ERROR"`，并在 `details` 中包含字段级校验错误信息（数组）。

### Requirement: Notebook, session, and message endpoints are stable
系统 MUST 提供 Notebook/Session/Message 的稳定端点与 notebook-scoped 归属语义：

- `GET /v1/notebooks`：元素至少包含 `id`, `name`, `created_at`, `updated_at`
- `POST /v1/notebooks?template_id=<int>`：template 不存在 MUST 返回 404（细则见 `notebook-management/spec.md`）
- `GET /v1/notebooks/{notebook_id}/sessions`：session MUST 归属该 notebook
- `GET /v1/notebooks/{notebook_id}/sessions/{session_id}/messages`：session 不属于 notebook MUST 返回 404

### Requirement: QA endpoints are stable
系统 MUST 提供基于检索的 Q&A 接口（语义见 `rag-qa/spec.md`），并在请求携带 `session_id` 时持久化该轮 user/assistant 两条消息到该 Session。

系统 MUST 提供 Q&A 的 SSE 流式接口：`POST /v1/notebooks/{notebook_id}/qa/stream`；事件最小契约：
- `chunk`: `{"text": "..."}`
- `done`: `{"citations": [...], "evidence": bool, "confidence": float, "created_at": "...", "context": {...}}`
- `error`: `{"message": "..."}`

QA 请求体 MUST 接受字段（默认值可调整，但语义必须稳定）：`question`, `source_ids`, `top_k`, `min_score`, `session_id`。

### Requirement: Citation data model
系统 MUST 使用统一的 Citation 对象结构（用于 QA、messages、outputs 等），字段至少包含：

- `source_id: int`
- `source_name: string`
- `chunk_id: int`
- `chunk_index: int`
- `snippet: string`
- `page_number: int | null`（可选）
- `paragraph_index: int | null`（可选）
- `score: float | null`（可选）
当返回的 `answer` 文本包含内联引用标记（如 `[1]`）时，索引 MUST 为 1-based 且与 `citations` 数组顺序对齐（`citations[0]` 对应 `[1]`），并落在 `1..len(citations)` 范围内。

### Requirement: Workspace tools endpoints are stable
系统 MUST 暴露 Studio/Workspace 工具目录：`GET /v1/workspace/tools`，响应 MUST 为 `{ tools: WorkspaceTool[] }`，用于前端渲染工具卡片与输出类型选项。

工具条目 MUST 至少包含 `id/label/description/tone/output_type/prompt`，并 MAY 包含 `badge/enabled/render_descriptor/config_schema`。

`GET /v1/workspace/tools/slides/config` MUST 返回 slides 的 generation_config defaults 与 option 列表（quantity/audience/tone/language/density/theme 等）。

系统 MUST 提供 `GET /v1/workspace/tools/{tool_id}/config` 返回工具配置选项；不存在的 `{tool_id}` MUST 返回 404（Tool not found）。

### Requirement: Output creation endpoints
系统 MUST 提供 outputs 的创建与读取接口，并用于 Studio 输出队列与历史列表。

- `POST /v1/notebooks/{notebook_id}/outputs/{output_type}`：返回 201 与持久化 output（至少包含 `id`, `type`, `content`, `created_at`, `updated_at`）；body MAY 包含 `prompt`, `source_ids`, `model_id`, `preference`
- `SLIDES`：不使用 `/outputs/SLIDES`，而使用 slides draft + SSE 端点（见 `studio-slides/spec.md`）

### Requirement: Notebook analysis endpoint is stable
系统 MUST 提供 Notebook 分析接口 `GET /v1/notebooks/{notebook_id}/analysis`；返回结构与边界见 `analysis-api/spec.md`。
