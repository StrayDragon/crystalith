## ADDED Requirements

### Requirement: Lenient Core Output Schema Parsing
系统 MUST 对核心结构化输出的 schema 解析采取宽容策略：当模型输出存在轻微偏差（例如额外字段、citations 类型偏差、列表元素为字符串）时，系统仍应尽最大可能解析并进入后处理归一化阶段，避免不必要的 fallback。

#### Scenario: 忽略额外字段但保留核心结构
- **WHEN** 模型输出在合法 JSON 结构基础上包含额外字段
- **THEN** 系统 MUST 忽略额外字段而不触发整体 schema 校验失败

#### Scenario: citations 类型偏差可被归一化
- **WHEN** 模型输出的 citations 以字符串/混合列表等形式出现
- **THEN** 系统 MUST 将其归一化为整数索引列表并在后处理阶段进行合法性清洗

#### Scenario: CitedText 列表元素可为字符串
- **WHEN** 模型输出将 `items`/`bullets` 等字段的元素以字符串形式返回
- **THEN** 系统 MUST 将字符串视为 `text` 并补全缺失字段（例如 citations 默认空列表）
