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
环境变量 MUST 可覆盖配置字段且优先级高于 YAML 默认值；对于可选子服务，系统 MUST 支持独立的启用开关、连接地址与探活参数覆盖，不得要求用户修改核心配置结构才能接入外部服务。

#### Scenario: Override optional dependency via env
- **WHEN** 用户通过环境变量覆盖某可选子服务地址与启用开关
- **THEN** 系统 SHALL 使用环境覆盖值进行连接与探活，并保持核心配置不变

### Requirement: Secrets are not committed in plaintext
示例配置 MUST 不包含明文密钥；密钥应由环境变量或安全注入提供。

### Requirement: Model selection is centralized
模型列表与默认选择 MUST 通过集中配置管理，并 MUST 支持“核心可运行默认模型”与“可选增强模型”并存；当可选模型依赖不可达时，系统 MUST 返回可恢复错误或回退策略，不得导致整体配置加载失败。

#### Scenario: Optional embedding model unavailable
- **WHEN** 默认 embedding 指向可选服务且该服务暂时不可达
- **THEN** 系统 SHALL 报告明确的依赖不可用信息并允许恢复后自动重试或切换，而核心服务继续可用

### Requirement: Providers include built-ins and plugins
provider 体系 MUST 同时支持内置 provider 与插件扩展 provider。

### Requirement: URL fetch security config is safe by default
URL 抓取安全配置 MUST 默认拒绝高风险目标（localhost/私网/元数据地址等）。

### Requirement: Optional service config schema is explicit
配置 Schema MUST 显式声明可选子服务块（启用标记、endpoint、timeout、probe policy、degrade policy），并给出默认值与示例，避免隐式约定。

#### Scenario: Validate config with optional blocks
- **WHEN** 用户仅配置核心服务并省略可选服务配置块
- **THEN** 配置校验 SHALL 通过且使用默认可选策略

### Requirement: Probe and discovery settings are configurable
可选服务探活与自动发现参数 MUST 可通过配置或环境变量调整，以适配“服务后启动”与自托管网络拓扑。

#### Scenario: Optional service starts after backend
- **WHEN** 后端已启动后可选服务才启动
- **THEN** 系统 SHALL 在后续探活周期中发现服务恢复并更新可用状态

### Requirement: Optional service env naming is consistent
可选服务相关环境变量 MUST 遵循统一命名约定并在 `.env.example` 中按服务分组展示，避免用户在核心变量与可选变量之间混淆。

#### Scenario: User configures optional service through env template
- **WHEN** 用户按照 `.env.example` 配置某可选服务
- **THEN** 用户 SHALL 能在不阅读源码的情况下完成启用、外部地址接入与探活参数配置
