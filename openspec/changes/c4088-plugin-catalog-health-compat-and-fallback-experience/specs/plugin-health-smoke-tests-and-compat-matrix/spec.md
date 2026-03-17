# plugin-health-smoke-tests-and-compat-matrix 规范增量

## ADDED Requirements

### Requirement: Plugin Health MUST Be Verifiable via Structured Readiness and Smoke Checks
系统 MUST 为插件提供结构化 readiness 与 smoke checks，而不是等运行时随机失败。

#### Scenario: 本地或 CI 检查插件健康
- **WHEN** 系统运行 plugin smoke tests
- **THEN** 每个插件或 plugin host SHALL 提供结构化健康结果
- **AND** 输出 SHALL 足以区分宿主、插件自身或 bundle 维度的问题

### Requirement: Compatibility Matrices MUST Cover Backend and Frontend Plugin Surfaces
系统 MUST 让 compat matrix 同时覆盖 backend 插件能力与 frontend bundle 兼容性，而不是只验证一半链路。

#### Scenario: 某个插件声明了 frontend renderer bundle
- **WHEN** 系统评估该插件在不同 profile 下的兼容性
- **THEN** SHALL 同时考虑后端可加载性与前端 bundle 可渲染性
- **AND** SHALL 以统一的 compat 语义输出结果
