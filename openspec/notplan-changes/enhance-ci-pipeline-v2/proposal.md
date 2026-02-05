## Why

当前项目仅有 Python SDK 相关的 CI/CD workflow，缺乏对后端测试、前端构建、代码质量检查的自动化验证。PR 合并前无法自动验证代码质量，可能引入回归问题。本提案在 notplan-changes/add-ci-pipeline 基础上大幅扩展，覆盖完整的 CI/CD 需求。

> 注：本提案替代 notplan-changes/add-ci-pipeline，提供更完整的 CI/CD 方案。

## What Changes

- GitHub Actions 完整 CI 流水线（后端测试、前端构建+测试、类型检查）
- PR 自动检查（代码质量、测试覆盖率报告）
- 安全扫描（依赖漏洞检查）
- 自动化发布流程（版本管理、changelog 生成）
- 分支保护规则建议

## Impact

- 受影响的规范：`ci-cd`（MODIFIED，扩展 notplan 版本）
- 受影响的系统：
  - GitHub Actions workflow 文件
  - 项目测试配置（覆盖率报告）
  - 依赖管理（安全扫描工具）
