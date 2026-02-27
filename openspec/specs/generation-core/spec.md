# generation-core Specification

## Purpose

定义统一生成主链路：上下文解析、结构化生成、后处理、引用映射、持久化，以及 QA/refine 与 preference 的一致语义。

## Non-goals

- 不定义部署与监控基础设施
- 不定义前端展示细节

## Requirements

### Requirement: Output generation follows deterministic node pipeline
结构化输出 MUST 遵循 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 逻辑顺序。

#### Scenario: Generation pipeline order is stable
- **WHEN** 系统处理一次结构化输出生成请求
- **THEN** 各阶段 SHALL 按 `ResolveContext -> Generate -> Postprocess -> MapCitations -> Persist` 的顺序执行

### Requirement: Source scope is explicit and validated
生成/问答请求中的 `source_ids` 语义 MUST 明确且可校验；非法范围 MUST 返回错误。

#### Scenario: Invalid source scope is rejected
- **WHEN** 请求携带非法或越权的 `source_ids`
- **THEN** 系统 SHALL 返回明确错误并拒绝继续生成

### Requirement: Preference tuning is table-driven
`preference` MUST 通过集中 tuning 表映射到检索与重试默认值。

#### Scenario: Preference maps to defaults
- **WHEN** 请求选择某个 `preference`
- **THEN** 系统 SHALL 从集中 tuning 表加载对应的检索与重试默认值

### Requirement: Explicit request knobs override defaults
请求显式给定 `top_k/min_score` 等参数时 MUST 覆盖 preference 默认值。

#### Scenario: Request knobs override tuning
- **WHEN** 请求同时提供 `preference` 与显式 `top_k/min_score` 等参数
- **THEN** 系统 SHALL 以显式参数覆盖 tuning 默认值

### Requirement: QA stream and non-stream completion logic is shared
流式与非流式 QA MUST 复用同一完成阶段逻辑，保证 citations/evidence/confidence 一致。

#### Scenario: Stream and non-stream responses are consistent
- **WHEN** 同一输入分别使用流式与非流式 QA 路径
- **THEN** 系统 SHALL 在完成阶段返回一致的 citations/evidence/confidence 语义

### Requirement: Refine keeps stable request/response contracts
refine 单格式与批量路径 MUST 保持稳定字段语义与引用返回结构。

#### Scenario: Refine contract stays stable
- **WHEN** 调用 refine 的单格式或批量接口
- **THEN** 系统 SHALL 返回稳定的字段语义与引用结构

### Requirement: Postprocessing is deterministic and citation-safe
后处理 MUST 先于引用映射，且对非法 citation 索引做清洗并保持非阻塞。

#### Scenario: Invalid citations are sanitized
- **WHEN** 模型输出包含非法 citation 索引或越界引用
- **THEN** 系统 SHALL 在后处理阶段清洗并保持流程非阻塞
