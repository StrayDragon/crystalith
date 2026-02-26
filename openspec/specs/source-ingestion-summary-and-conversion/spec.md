# source-ingestion-summary-and-conversion Specification

## Purpose

定义单来源派生能力与内容转换能力：来源摘要、来源范围 QA、来源问答转来源，以及对话/输出转来源或笔记。该规范强调转换结果可追踪且遵循来源生命周期，避免产生不可检索或不可归因的数据。

## Non-goals

- 不定义主检索问答全局策略
- 不定义 Studio 工具生成流程

## Requirements

### Requirement: Source summary is ready-only and on-demand
来源摘要接口 MUST 仅允许 `ready` 来源，并按需生成返回摘要结构。

#### Scenario: Summary requires ready source
- **WHEN** 用户请求一个非 `ready` 来源的摘要
- **THEN** 系统 SHALL 拒绝并返回明确错误；`ready` 来源则按需生成摘要结构

### Requirement: Source-scoped QA is hard-bounded by source_id
来源 QA MUST 仅在该 `source_id` 范围内检索与回答。

#### Scenario: QA does not cross source boundary
- **WHEN** 用户对某个 `source_id` 发起来源范围 QA
- **THEN** 系统 SHALL 仅在该来源范围内检索与回答

### Requirement: Source QA conversion creates reusable source
来源问答转换 MUST 创建新来源并可立即用于后续检索。

#### Scenario: Converted QA becomes a new source
- **WHEN** 用户将来源问答结果转换为来源
- **THEN** 系统 SHALL 创建新来源并使其可用于后续检索

### Requirement: Conversation/output conversion keeps traceable metadata
对话或输出转换为来源/笔记时 MUST 记录来源元数据与追踪信息。

#### Scenario: Conversion stores provenance
- **WHEN** 用户将对话或输出转换为来源/笔记
- **THEN** 系统 SHALL 记录可追踪的元数据以支持溯源与审计

### Requirement: Conversion follows source lifecycle and epoch rules
任何创建新来源的转换路径 MUST 遵循 source 状态机与 epoch 失效规则。

#### Scenario: Conversions bump epochs and respect lifecycle
- **WHEN** 转换路径创建了新的来源并写入向量或来源集合
- **THEN** 系统 SHALL 遵循状态机并按规则 bump 相关 epoch
