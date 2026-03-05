# source-ingestion-core Specification

## Purpose

定义 Source 摄取生命周期不变量：状态机、ready 语义、删除语义与 epoch 失效规则。该规范用于保证摄取与检索之间的因果一致性，避免出现“状态 ready 但不可检索”的漂移。

## Non-goals

- 不定义上传/URL 的具体输入校验细节
- 不定义来源标签 API 字段细节

## Requirements

### Requirement: Source status machine is fixed
Source 状态 MUST 仅使用 `processing|ready|failed`，并保持对外稳定。

#### Scenario: Source transitions remain in allowed set
- **WHEN** 系统创建或更新一个来源的摄取状态
- **THEN** 状态 SHALL 仅在 `processing|ready|failed` 集合内变化

### Requirement: Ready source guarantees retrievability
`ready` 来源 MUST 已持久化 chunks 且对应向量可被检索命中。

#### Scenario: Ready implies retrievable
- **WHEN** 来源被标记为 `ready`
- **THEN** 系统 SHALL 保证其 chunks 已持久化且向量可被检索命中

### Requirement: Source and vector mutations bump epochs
影响来源集合或向量集合的操作 MUST bump `sources_epoch` 与/或 `vector_epoch`。

#### Scenario: Mutations invalidate caches
- **WHEN** 发生影响来源集合或向量集合的变更操作
- **THEN** 系统 SHALL bump `sources_epoch` 与/或 `vector_epoch` 以触发缓存失效

### Requirement: Epoch updates are atomic under concurrency
并发情况下 epoch bump MUST 原子且单调递增。

#### Scenario: Concurrent bumps are monotonic
- **WHEN** 多个并发请求同时触发 epoch bump
- **THEN** 系统 SHALL 保证 bump 原子且单调递增

### Requirement: Source deletion removes vector entries
删除来源后 MUST 同步移除向量存储对应记录，防止幽灵检索结果。

#### Scenario: Deleting a source removes vectors
- **WHEN** 用户删除一个来源
- **THEN** 系统 SHALL 移除该来源的向量记录以避免幽灵检索结果

### Requirement: Parser selection is deterministic and observable
系统 MUST 以确定性规则选择用于解析来源内容的 parser（优先已启用插件，其次 core 最小解析器）。

当多个插件 parser 同时命中同一输入时，系统 MUST 使用确定性 tie-break：
- 优先按 `plugins.load_order`（若配置）确定优先级
- 否则按 `plugin_id` 字典序确定优先级

系统 MUST 在来源元数据中记录所用 `parser_type`，并 SHOULD 记录 `parser_plugin_id`（若该 parser 来自插件）以便诊断与回归。

#### Scenario: Plugin parser takes precedence over core fallback
- **WHEN** 某文件类型同时匹配已启用的 parser 插件与 core 最小解析器
- **THEN** 系统 SHALL 优先使用插件 parser
- **AND** 创建的来源对象 SHALL 记录稳定的 `parser_type`

### Requirement: Core-only ingestion profile is minimal and explicit
在 core-only 安装形态下，系统 MUST 至少支持 txt/md/markdown/csv 的 ingestion；其他格式 MUST 被视为不可用增强能力（需通过插件安装/启用提供）。

#### Scenario: Core-only profile rejects non-core formats predictably
- **WHEN** 用户在 core-only 环境上传/导入一个非核心格式（例如 PDF/HTML/音视频）
- **THEN** 系统 SHALL 返回稳定的“不支持”语义
- **AND** SHALL 提供恢复提示（例如安装/启用对应 parser 插件）
