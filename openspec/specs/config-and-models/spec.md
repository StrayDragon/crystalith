# config-and-models Specification

## Purpose

定义配置加载、Schema 校验、模型与 provider 选择的统一规则，确保本地一键启动与生产可控覆盖并存。

## Non-goals

- 不定义具体业务流程
- 不约束前端组件结构

## Requirements

### Requirement: YAML config is validated by schema
系统 MUST 从 YAML 加载配置并以 `config/app.schema.json` 校验结构。

### Requirement: Environment overrides are supported
环境变量 MUST 可覆盖配置字段，且优先级高于 YAML 默认值。

### Requirement: Secrets are not committed in plaintext
示例配置 MUST 不包含明文密钥；密钥应由环境变量或安全注入提供。

### Requirement: Model selection is centralized
模型列表与默认选择 MUST 通过集中配置（如 `models.available` / `models.defaults`）管理。

### Requirement: Providers include built-ins and plugins
provider 体系 MUST 同时支持内置 provider 与插件扩展 provider。

### Requirement: URL fetch security config is safe by default
URL 抓取安全配置 MUST 默认拒绝高风险目标（localhost/私网/元数据地址等）。
