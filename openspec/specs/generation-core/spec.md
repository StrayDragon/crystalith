# generation-core Specification

## Purpose

定义统一生成主链路：上下文解析、结构化生成、后处理、引用映射、持久化，以及 QA/refine 与 preference 的一致语义。

## Non-goals

- 不定义部署与监控基础设施
- 不定义前端展示细节

## Requirements

### Requirement: Output generation follows deterministic node pipeline
结构化输出 MUST 遵循 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 逻辑顺序。

### Requirement: Source scope is explicit and validated
生成/问答请求中的 `source_ids` 语义 MUST 明确且可校验；非法范围 MUST 返回错误。

### Requirement: Preference tuning is table-driven
`preference` MUST 通过集中 tuning 表映射到检索与重试默认值。

### Requirement: Explicit request knobs override defaults
请求显式给定 `top_k/min_score` 等参数时 MUST 覆盖 preference 默认值。

### Requirement: QA stream and non-stream completion logic is shared
流式与非流式 QA MUST 复用同一完成阶段逻辑，保证 citations/evidence/confidence 一致。

### Requirement: Refine keeps stable request/response contracts
refine 单格式与批量路径 MUST 保持稳定字段语义与引用返回结构。

### Requirement: Postprocessing is deterministic and citation-safe
后处理 MUST 先于引用映射，且对非法 citation 索引做清洗并保持非阻塞。
