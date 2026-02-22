# studio-slides-drafts Specification

## Purpose

定义 SLIDES 生成的“草稿（draft）”资源与持久化契约：在 input/outline/markdown 三阶段中保存用户输入、已选 sources、生成参数、阶段状态与生成结果，并在 Markdown 保存后同步生成 `OutputType.SLIDES` 的 Output 记录以进入 Studio 历史列表。

本规范覆盖 draft 的 HTTP API 与状态语义；SSE 生成流细节见 `studio-slides-sse/spec.md`，预览同步细节见 `studio-slides-preview/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `workspace-studio-ui/spec.md`
- `generation-preference/spec.md`
- `generation-retrieval/spec.md`
- `studio-slides-sse/spec.md`
- `studio-slides-preview/spec.md`

## Requirements

### Requirement: Slides draft is the single source of truth
系统 MUST 以 slides draft 作为 slides 工作流的单一状态来源，draft 至少包含：

- `title`, `prompt`, `engine`
- `source_ids`（非空）
- `generation_config`（可选，允许额外字段；包含 `preference`）
- `outline`（可选）
- `markdown`（可选）
- `chunk_ids`（可选，用于溯源）
- `stage: input|outline|markdown`
- `status: idle|running|error`
- `error_message`（可选）
- `output_id`（可选：当 markdown 已保存/生成后）
用户重新打开 slides 流程时，前端 MUST 通过 draft API 读取并回填已保存的 outline/markdown/config，且 MUST NOT 自动重新生成（除非用户显式触发）。

### Requirement: Draft CRUD endpoints
系统 MUST 提供 slides draft 的 CRUD 端点（notebook-scoped）：

- `GET /v1/notebooks/{notebook_id}/slides/drafts/latest`
- `POST /v1/notebooks/{notebook_id}/slides/drafts`
- `GET /v1/notebooks/{notebook_id}/slides/drafts/{slide_id}`
- `PATCH /v1/notebooks/{notebook_id}/slides/drafts/{slide_id}`
创建 draft 时 `source_ids` 为空、或 PATCH 提交 `source_ids=[]` 时系统 MUST 返回 400（或等价校验错误）。notebook 下尚无 draft 时 `GET .../drafts/latest` MUST 返回 404。

### Requirement: Outline/Markdown save endpoints
系统 MUST 提供保存 outline 与 markdown 的端点：

- `PUT /v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/outline`
- `PUT /v1/notebooks/{notebook_id}/slides/drafts/{slide_id}/markdown`
保存 outline 时 draft.stage MUST 变为 `outline` 且 status MUST 变为 `idle`。

保存 markdown 时 draft.stage MUST 变为 `markdown` 且 status MUST 变为 `idle`；系统 MUST 写入 markdown 文件（见 `studio-slides-preview/spec.md`），并创建或更新 `OutputType.SLIDES` 的 Output 记录并回填 `output_id`。

### Requirement: Output content contract for SLIDES
系统 MUST 将 slides draft 同步为一个 `OutputType.SLIDES` 输出记录，其 `content` 至少包含：

- `title`
- `engine`
- `outline`
- `markdown`
- `slide_id`

并且该 Output 记录 MUST 携带：
- `prompt = draft.prompt`
- `chunk_ids = draft.chunk_ids`（若存在）
同一 draft 后续再次保存/生成 markdown 时，系统 MUST 更新同一个 Output 记录（不创建重复记录）。
