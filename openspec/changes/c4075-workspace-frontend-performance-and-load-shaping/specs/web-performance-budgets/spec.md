# web-performance-budgets 规范增量

## ADDED Requirements

### Requirement: Critical Frontend Paths MUST Have Explicit Performance Budgets
系统 MUST 为关键前端路径定义显式 performance budgets，而不是只在用户抱怨后再做事后排查。

#### Scenario: 为关键页面和交互建立预算
- **WHEN** 系统定义 workspace 壳层、列表、输出查看或等价关键路径
- **THEN** SHALL 为 bundle、首屏渲染或关键交互定义明确预算
- **AND** 这些预算 SHALL 能被 runtime report 与回归检查复用

### Requirement: Budget Enforcement MUST Support Environment-aware Rollout
系统 MUST 支持按环境分层的预算治理，并允许先告警后强制。

#### Scenario: 新预算首次接入 CI
- **WHEN** 某项性能预算首次加入检查
- **THEN** 系统 SHALL 支持先以 warn 暴露回归
- **AND** 在预算稳定后 SHALL 能升级为 gate
