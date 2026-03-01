## Why

- 当前仓库已经具备“基于 OpenAPI 生成客户端”的链路与 CI 漂移校验，但产物仍停留在“仓库内代码生成与提交”。对于对外开放/生态建设来说，用户更需要可通过 PyPI / npm 直接安装的 SDK，以及可复现、可追溯的发布流程（tag → 构建 → 发布 → 产物归档）。

## What Changes

- 定义并实现 SDK 的“可发布形态”：
  - Python：将现有生成目录包装为可发布包（`pyproject.toml`、依赖声明、wheel/sdist 构建），并给出推荐的包名/导入名策略。
  - TypeScript：新增独立的 npm SDK 包（不再仅是前端应用内部的生成目录），并确保其由同一 OpenAPI 生成且可 `npm pack/publish`。
- 统一版本与发布触发：
  - 以单一语义化版本作为后端 + SDK 的发布来源（建议以 git tag `vX.Y.Z` 驱动）。
  - 发布时校验“tag 版本 == 版本源文件 == SDK 版本”，避免漂移。
- 增加 CI 守护：
  - 保留现有 Python SDK 漂移检查；
  - 增加 TypeScript SDK 的再生成校验；
  - 增加 tag 发布流水线（构建并发布 PyPI + npm，且上传构建产物到 Release）。

## Capabilities

### New Capabilities

- `sdk-distribution`: 定义多语言 SDK（Python/TypeScript）从 OpenAPI 生成到可发布（PyPI/npm）的最小闭环：版本、构建、发布、验收与回滚策略。

### Modified Capabilities

- （无）

## Impact

- Repo: 新增/调整 `sdk/client/*` 的结构与元数据（Python packaging、TypeScript 包骨架）。
- CI: 新增发布与一致性检查的 GitHub Actions 工作流；需要配置发布所需的 secrets（如 PyPI token、npm token）。
- Docs: 更新 SDK 文档以指向可安装包，并说明版本与发布策略。
