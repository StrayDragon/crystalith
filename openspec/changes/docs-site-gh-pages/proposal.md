## Why

准备将仓库发布为 public 时，当前顶层 README 过于精简，已有文档（`docs/`）缺少统一入口与导航，也没有可直接分享的在线文档站点；这会显著增加首次上手与部署成本，降低外部贡献/反馈效率。

## What Changes

- 建立一个面向用户与贡献者的文档站点（优先方案：MkDocs + Material；备选：VitePress/Docusaurus），把现有 `docs/*.md` 纳入统一导航与信息架构。
- 新增 docs 信息架构与最小内容闭环：
  - Getting Started（快速启动 / 本地运行）
  - Deployment（复用并完善 `docs/deployment.md`）
  - Python SDK（复用 `docs/sdk-python.md`）
  - Plugins（复用 `docs/plugins.md`）
  - Configuration（如何使用 `config/app.yaml`、secrets、env overrides）
  - Contributing（开发命令、测试、代码结构、提交流程）
- GitHub Pages 发布：
  - 新增用于构建与部署文档站点的 GitHub Actions workflow（push 到 main 自动发布 + workflow_dispatch 手动发布）。
  - 在 README 与站点中提供清晰的在线文档入口链接。
- 补齐“public 发布素材”：
  - 使用现有 logo（`docs/assets/logo.webp`）作为站点/README 品牌元素。
  - 录制并嵌入一个简约演示视频（Cursorful 录制；建议导出为 webm/gif 并在文档站点与 README 展示）。

## Capabilities

### New Capabilities

- `docs-site`: 提供可构建、可预览、可发布到 GitHub Pages 的静态文档站点，覆盖安装/运行/部署/SDK/插件/配置/贡献指南等基础内容。

### Modified Capabilities

- (none)

## Impact

- 文档与站点：`docs/**`（新增首页、导航结构、资源）、站点配置文件（如 `mkdocs.yml` 或等价配置）。
- CI/CD：新增/更新 `.github/workflows/*`（docs build + deploy）。
- 项目入口：更新顶层 `README.md`（快速启动、文档入口、演示素材）。
- 非目标：不在此变更中实现产品新功能；不引入与运行时强耦合的复杂文档生成链路（如需要，可在后续迭代）。

