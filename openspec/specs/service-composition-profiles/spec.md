# service-composition-profiles Specification

## Purpose

定义核心服务与可选子服务的组合规则、可观测状态与降级语义，确保默认最小拓扑可运行且可逐步增强。

## Non-goals

- 不定义具体业务 API 的字段细节
- 不约束非 Compose 的编排系统实现方式

## Requirements

### Requirement: Runtime topology has two mandatory core services
系统 MUST 将 `frontend` 与 `backend` 作为唯一必需核心服务；其他运行时能力 MUST 以可选子服务形式声明，不得阻塞核心服务启动。

#### Scenario: Core-only startup
- **WHEN** 用户使用默认核心配置启动系统且未启用任何可选子服务
- **THEN** 前端与后端 SHALL 成功启动并提供核心研究工作流能力

### Requirement: Optional subservices are composable by overlay/profile
系统 MUST 支持通过 compose overlay（或 profile）显式启用可选子服务（例如向量库、搜索引擎、离线模型服务），并允许改为外部托管地址接入。

#### Scenario: Enabling optional composition
- **WHEN** 用户启用某个可选 overlay/profile
- **THEN** 系统 SHALL 仅装配该组合声明的子服务与其配置，并保持未启用组合不生效

### Requirement: Optional subservice contract includes health and degrade policy
每个可选子服务 MUST 定义连接配置、探活方式、失败提示与降级策略；当可选子服务不可用时，系统 MUST 返回明确的可恢复错误而非导致核心服务不可用。

#### Scenario: Optional service unavailable
- **WHEN** 可选子服务探活失败
- **THEN** 系统 SHALL 记录依赖不可用状态并对相关增强功能返回清晰错误，同时保持核心路由可用

### Requirement: Composition state is observable for operators
系统 MUST 暴露当前组合状态（启用的 profile、可选服务健康状态、最近探活时间）以支持本地排障和部署验收。

#### Scenario: Composition diagnostics queried
- **WHEN** 运维或开发者查询运行时状态
- **THEN** 系统 SHALL 返回核心服务状态以及各可选子服务的健康细节

### Requirement: Compose source manifests are authoritative and reviewable
系统 MUST 以分层 compose 源文件作为权威配置来源，组合结果 MUST 可通过标准 compose 展开与审查流程验证，避免隐藏式模板逻辑。

#### Scenario: Review composed deployment topology
- **WHEN** 用户或评审者检查核心清单与可选 overlay 的组合结果
- **THEN** 系统 SHALL 提供可追溯的服务来源与明确的 profile 启用边界
