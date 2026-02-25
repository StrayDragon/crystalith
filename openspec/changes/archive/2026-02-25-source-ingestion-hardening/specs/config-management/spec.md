# config-management (delta) Specification

## ADDED Requirements

### Requirement: URL fetch security settings are schema-validated and safe by default
系统 MUST 在配置 schema 中表达 URL fetch 的安全策略（SSRF 防护相关字段），并保证默认值为“安全拒绝”（阻止 localhost/私网/元数据等目标）。

#### Scenario: Missing security config uses safe defaults
- **WHEN** 部署方未显式配置 URL fetch 安全策略字段
- **THEN** 系统默认拒绝抓取 localhost/私网/元数据等目标

#### Scenario: Allowlist explicitly permits configured hosts
- **WHEN** 部署方显式配置 allowlist 并命中目标 host
- **THEN** 系统允许抓取继续执行
