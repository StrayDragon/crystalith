# source-ingestion-summary-qa Specification

## Purpose

定义围绕单个 Source 的派生能力：摘要生成、source-scoped 问答，以及将来源问答记录转换为新 Source（便于后续 RAG 复用）。

## Related specs

- `GLOSSARY.md`
- `workspace-api/spec.md`
- `source-ingestion/spec.md`
- `rag-qa/spec.md`（Notebook 范围 QA）
- `content-conversion/spec.md`（跨实体转换的总览）

## Requirements

### Requirement: Source summary is generated on demand
系统 MUST 提供 `GET /v1/notebooks/{notebook_id}/sources/{source_id}/summary`：

- 仅允许 `source.status = ready`
- 读取该 source 的 chunks（用于构建摘要上下文）
- 返回 `summary/key_points/topics/word_count/generated_at`
source.status != `ready` 时 MUST 返回 400（Source is not ready）。

### Requirement: Source-scoped QA searches only within the source
系统 MUST 提供 `POST /v1/notebooks/{notebook_id}/sources/{source_id}/qa`：

- 仅允许 `source.status = ready`
- 将问题嵌入后，仅在该 `source_id` 范围内执行向量检索
- 返回 `answer` 与 `created_at`
向量检索无结果时，系统 MUST 使用该 source 的前若干 chunks 构建上下文并生成回答。

### Requirement: Convert source QA to a new source
系统 MUST 提供 `POST /v1/notebooks/{notebook_id}/sources/{source_id}/qa/convert-to-source`：

- body: `messages[]`（`role=user|assistant`, `content`）
- 创建新的 markdown Source，并写入 chunks 与向量
- 成功后 bump `sources_epoch` 与 `vector_epoch`
转换成功时 MUST 返回 201 与新 `source_id`；新 source MUST 可出现在 sources 列表中并可用于检索。
