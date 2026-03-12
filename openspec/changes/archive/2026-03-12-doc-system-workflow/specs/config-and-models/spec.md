# config-and-models 规范增量

## MODIFIED Requirements

### Requirement: YAML config is validated by schema
系统 MUST 从 YAML 加载配置并以 `config/app.schema.gen.json` 校验结构。

#### Scenario: Invalid YAML config is rejected
- **WHEN** 用户提供的 YAML 配置不满足 `config/app.schema.gen.json`
- **THEN** 系统 SHALL 以明确错误拒绝启动或拒绝加载该配置
