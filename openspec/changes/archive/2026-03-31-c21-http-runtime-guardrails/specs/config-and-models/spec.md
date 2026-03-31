# config-and-models 规范增量

## ADDED Requirements

### Requirement: HTTP Guardrails Configuration MUST Be YAML-First and Schema-Validated
系统 MUST 在 `config/app.schema.gen.json` 中显式声明 HTTP guardrails 配置块，并以 YAML-first 方式加载与校验（不依赖额外的业务 env override）。

#### Scenario: Default config validates without guardrails overrides
- **WHEN** 用户使用仓库提供的默认 `config/app.yaml`
- **THEN** 配置校验 SHALL 通过
- **AND** 系统 SHALL 使用默认的 guardrails 策略（例如 `mode=auto`）

### Requirement: Guardrails Default Mode MUST Only Enable for Non-Loopback Exposure
当 `mode=auto` 时，系统 MUST 仅在“非 loopback 暴露”场景启用 guardrails，并支持显式覆盖。

#### Scenario: Operator forces guardrails on for a local bind
- **WHEN** 运维设置 `mode=enabled`
- **AND** 后端 listen host 为 loopback
- **THEN** 系统 SHALL 启用 guardrails

#### Scenario: Operator disables guardrails for a non-local bind
- **WHEN** 运维设置 `mode=disabled`
- **AND** 后端 listen host 为非 loopback
- **THEN** 系统 SHALL 禁用 guardrails
