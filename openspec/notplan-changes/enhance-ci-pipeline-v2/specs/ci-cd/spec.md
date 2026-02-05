## ADDED Requirements

### Requirement: PR Validation Pipeline
系统 SHALL 在每个 Pull Request 上自动运行 CI 检查，包括后端测试、前端构建+测试、类型检查和 API 一致性验证。所有检查通过 MUST 作为合并的前置条件。

#### Scenario: PR 创建触发 CI
- **WHEN** 开发者创建或更新 Pull Request
- **THEN** 自动触发后端测试、前端构建、类型检查和 API 一致性 job

#### Scenario: 测试失败阻止合并
- **WHEN** CI 中任一 job 失败
- **THEN** PR 标记为 "checks failed"，无法合并

### Requirement: Security Scanning
系统 SHALL 对 Python 和 Node.js 依赖进行漏洞扫描。扫描 MUST 在 PR 和每周定时触发。

#### Scenario: 依赖漏洞检测
- **WHEN** 依赖中存在已知安全漏洞
- **THEN** CI 报告漏洞详情和建议的升级版本

### Requirement: Test Coverage Reporting
CI MUST 在 PR 中自动报告测试覆盖率，包括总覆盖率和本次变更的覆盖率。

#### Scenario: 覆盖率报告
- **WHEN** CI 运行完成
- **THEN** PR 评论中显示覆盖率百分比和变化趋势
