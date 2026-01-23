## Why

当前项目仅配置了 pre-commit hooks，缺少 CI/CD 流水线。这导致 PR 合并前无法自动验证代码质量，可能引入破坏性变更到主分支。

## What Changes

- 配置 GitHub Actions 自动化测试工作流
- 添加后端测试、前端构建、类型检查等 CI 步骤
- 配置 main 分支保护规则

## Impact

- 受影响的规范：新增 `ci-cd` 规范
- 受影响的代码：
  - 新增 `.github/workflows/ci.yml`
  - 更新 `README.md` 添加 CI badge
- 依赖关系：建议在 T03（前端测试覆盖）完成后配置完整的测试 CI
