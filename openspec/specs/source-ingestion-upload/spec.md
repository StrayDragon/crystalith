# source-ingestion-upload Specification

## Purpose

定义通过**上传文件**创建 Source 的后端契约：支持的文件类型、parser 选择规则、异步解析、chunk 结构与错误处理。UI 交互见 `workspace-sources-ui/spec.md`。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `source-ingestion/spec.md`
- `source-ingestion-management/spec.md`

## Requirements

### Requirement: Upload endpoint returns a ready source on success
系统 MUST 提供上传端点：`POST /v1/notebooks/{notebook_id}/sources`（`multipart/form-data`，字段名 `file`）。

成功完成 ingest 时 MUST 返回 201 与 `SourceRead` 且 `status = ready`；上传请求执行过程中，该 source MAY 短暂以 `processing` 出现在 sources 列表中（用于可观测进度）。

### Requirement: Supported formats are parser-driven
系统 MUST 根据 `filename` 与 `mime_type` 解析上传内容，并支持以下内置 parser（以及插件扩展）：

- Text：`text/plain`, `text/markdown`（`.txt/.md/.markdown`）
- PDF：`application/pdf`（`.pdf`）
- HTML：`text/html`（`.html/.htm`）
- Audio：`audio/mpeg|audio/mp3|audio/wav|...`（`.mp3/.wav`）
- Video：`video/mp4`（`.mp4`）

上传的文件类型无法匹配任何 parser 时 MUST 返回 415（Unsupported file type），且 MUST NOT 创建 Source 记录。

### Requirement: Empty uploads return 400 and do not create sources
对确定性用户输入错误（例如空文件或解析后无有效内容），系统 MUST 返回 400，且 MUST NOT 创建 Source 记录：

- 空文件（0 bytes）上传 MUST 返回 400
- parser 解析成功但产出 chunks 为空（无可索引内容）时 MUST 返回 400

### Requirement: Parsing runs in executor
系统 MUST 将同步解析操作放入线程池/执行器中运行，避免阻塞异步事件循环。

### Requirement: Chunks are persisted with offsets and metadata
系统 MUST 将 parser 产出的 chunks 持久化为 Chunk 记录：

- `chunk_index` 从 0 开始递增
- `text` 为 chunk 内容
- `start_offset/end_offset` 指向原文偏移（若可用）
- `metadata` MAY 包含 `page`、`paragraph_index` 等

### Requirement: Status transitions and failures
系统 MUST 遵循以下状态转换：

- ingest 成功：`processing -> ready`（解析 + 嵌入 + 向量写入）
- ingest 失败：`processing -> failed`（写入 `error_message`）
对运行时异常（解析/嵌入/向量写入发生异常）Source 记录 MUST 保留且 `status = failed`，客户端收到 500（Ingestion failed）。
对确定性用户输入错误（空文件/空内容）系统 MUST 返回 400，且 MUST NOT 创建 Source 记录。
