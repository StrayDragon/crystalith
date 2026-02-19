## ADDED Requirements

### Requirement: SlideGenerationConfig supports preference
系统 MUST 支持在 slides draft 的 `generation_config` 中保存 `preference`，并在读取 draft 时回填。

#### Scenario: preference 持久化与回填
- **WHEN** 客户端创建或更新 slides draft 时提交 `generation_config.preference`
- **THEN** 后端保存该字段
- **AND** 再次读取该 draft 时返回相同的 `generation_config.preference`

### Requirement: Preference consistency across stages
系统 MUST 在 outline 与 markdown 两个阶段使用相同的 `generation_config.preference`，并且 MUST 不在生成过程中隐式修改该值。

#### Scenario: outline 与 markdown 一致
- **WHEN** draft 已保存 `generation_config.preference`
- **AND** 用户分别触发 outline 与 markdown 生成
- **THEN** 两个阶段均使用该 preference
