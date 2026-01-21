## ADDED Requirements

### Requirement: Automated CI Pipeline

系统必须（SHALL）提供自动化 CI 流水线，在 PR 和主分支推送时自动运行质量检查。

#### Scenario: PR 触发 CI 检查

- **WHEN** 开发者创建或更新 Pull Request
- **THEN** 自动触发 CI 流水线
- **AND** 运行后端测试
- **AND** 运行前端测试和构建

#### Scenario: CI 失败阻止合并

- **WHEN** CI 流水线中任一步骤失败
- **THEN** PR 显示检查失败状态
- **AND** 在分支保护规则下无法合并

#### Scenario: CI 缓存加速

- **WHEN** CI 流水线运行
- **THEN** 利用依赖缓存加速构建
- **AND** 缓存包括 uv cache 和 pnpm cache

### Requirement: Branch Protection

系统必须（SHALL）配置分支保护规则，确保主分支代码质量。

#### Scenario: main 分支保护

- **WHEN** 尝试直接推送到 main 分支
- **THEN** 推送被拒绝
- **AND** 提示需要通过 PR 合并

#### Scenario: 强制 CI 通过

- **WHEN** PR 的 CI 检查未全部通过
- **THEN** 合并按钮显示为禁用状态
