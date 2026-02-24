# source-ingestion-summary-and-conversion Specification

## Purpose

定义单来源派生能力与内容转换能力：来源摘要、来源范围 QA、来源问答转来源，以及对话/输出转来源或笔记。

## Non-goals

- 不定义主检索问答全局策略
- 不定义 Studio 工具生成流程

## Requirements

### Requirement: Source summary is ready-only and on-demand
来源摘要接口 MUST 仅允许 `ready` 来源，并按需生成返回摘要结构。

### Requirement: Source-scoped QA is hard-bounded by source_id
来源 QA MUST 仅在该 `source_id` 范围内检索与回答。

### Requirement: Source QA conversion creates reusable source
来源问答转换 MUST 创建新来源并可立即用于后续检索。

### Requirement: Conversation/output conversion keeps traceable metadata
对话或输出转换为来源/笔记时 MUST 记录来源元数据与追踪信息。

### Requirement: Conversion follows source lifecycle and epoch rules
任何创建新来源的转换路径 MUST 遵循 source 状态机与 epoch 失效规则。
