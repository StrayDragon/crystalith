## ADDED Requirements

### Requirement: Self-host diagnostics are discoverable
自托管部署 MUST 提供可发现的诊断入口与最小排障路径，以降低用户定位成本。

#### Scenario: Operator can find diagnostics quickly
- **WHEN** 用户在自托管环境遇到“无法连接/功能不可用”
- **THEN** 系统 SHALL 提供明确的诊断入口（UI 或文档）
- **AND** 至少包含：后端健康检查、可选服务状态与恢复建议

### Requirement: Backup and restore guidance exists
部署文档 MUST 描述数据备份与恢复的最小闭环（含风险与验证步骤）。

#### Scenario: User performs minimal backup
- **WHEN** 用户希望备份并迁移其本地数据
- **THEN** 文档 SHALL 明确最小备份集与恢复步骤
- **AND** 提供验收检查以确认恢复成功
