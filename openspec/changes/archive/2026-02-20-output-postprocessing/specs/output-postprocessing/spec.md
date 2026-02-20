## ADDED Requirements

### Requirement: Deterministic postprocessing for structured outputs
系统 MUST 在 outputs 持久化前执行确定性的后处理，以保证输出满足最低渲染契约（字段存在、列表非空、文本可用）。

#### Scenario: 空列表会被修复为可渲染的最小结构
- **WHEN** 模型输出结构可解析但关键列表为空
- **THEN** 系统将其修复为最小可渲染结构
- **AND** 生成结果仍可被前端插件渲染

### Requirement: Citation index sanitization
系统 MUST 清洗输出中的 citations 索引，移除非整数、重复或越界的索引，避免引用映射异常。

#### Scenario: 非法 citations 被移除
- **WHEN** 输出中包含非整数或越界的 citations 索引
- **THEN** 系统在映射前移除这些索引

### Requirement: Optional repair pass in quality mode
系统 MUST 支持在 `preference = quality` 且满足触发条件时执行一次受控的 repair pass，用于修复“可解析但不满足契约”的输出。

#### Scenario: quality 模式触发一次 repair
- **WHEN** `preference = quality`
- **AND** 后处理判定输出不满足最低契约
- **THEN** 系统最多执行一次 repair

### Requirement: Postprocessing warnings are non-breaking
系统 MAY 在输出 content 中附加可选的 `_warnings` 字段用于提示自动修复/截断等情况，但 MUST 保持对现有前端渲染的兼容。

#### Scenario: _warnings 不影响渲染
- **WHEN** 输出 content 包含 `_warnings`
- **THEN** 前端仍可正常渲染主要内容
