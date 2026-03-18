# source-ingestion-upload-and-url 规范增量

## ADDED Requirements

### Requirement: Lightweight Capture Ingest MUST Preserve Capture Metadata
系统 MUST 让移动端和浏览器轻入口导入路径保留 capture metadata，而不是在进入 source ingestion 后丢失入口上下文。

#### Scenario: 某个 capture 被正式导入为 source
- **WHEN** mobile capture 或 browser capture 进入正式 source ingestion 流程
- **THEN** 系统 SHALL 保留其 origin surface、capture mode、capture timestamp 与最小 provenance 摘要
- **AND** SHALL 允许后续流程读取这些 metadata
