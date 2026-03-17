# sdk-generation-drift-gates-and-release-playbook 规范增量

## ADDED Requirements

### Requirement: Public API Drift MUST Be Classified and Gated Before SDK Release
系统 MUST 在 SDK 发布前对 public API drift 做分类和门禁，而不是等外部客户端出问题后再发现。

#### Scenario: OpenAPI 或生成配置发生变化
- **WHEN** backend schema、generator 配置或 SDK 版本边界发生变更
- **THEN** 系统 SHALL 将漂移分类为 schema、generator、version 或 submodule drift
- **AND** SHALL 通过明确 gate 决定是否允许继续发布

### Requirement: SDK Release Playbooks MUST Be Repeatable Across Supported Languages
系统 MUST 为支持的 SDK 语言提供可重复的生成与发布 playbook，而不是每次人工拼步骤。

#### Scenario: 团队准备发布一个新的 SDK 版本
- **WHEN** 需要发布 TypeScript、Python、Go、Rust 或等价 SDK
- **THEN** 系统 SHALL 提供统一的 preflight、生成、检查与发布路径
- **AND** 在 breaking changes 时 SHALL 要求明确版本升级与迁移说明
