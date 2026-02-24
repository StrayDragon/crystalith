# docs-site Specification

## Purpose

定义文档站点的最小信息架构与发布方式：使用 Zensical（MkDocs 配置兼容层）以 `docs/` 为源构建静态站点，并通过 GitHub Actions 发布到 GitHub Pages，保证关键文档（入门/部署/配置/SDK/插件/贡献）可持续维护。

## Related specs

- `GLOSSARY.md`
- `ci-cd/spec.md`
- `deployment/spec.md`
- `openapi-docs/spec.md`
- `python-sdk/spec.md`

## Requirements
### Requirement: Zensical documentation site
系统 MUST 使用 Zensical 构建文档站点，并以 `docs/` 作为文档源目录，使文档可被构建为静态站点。
仓库根目录 MUST 存在 `mkdocs.yml`（Zensical 兼容配置文件），且 MUST 存在 `docs/` 目录用于存放 Markdown 与资源文件。

### Requirement: Local build and preview
系统 MUST 支持在本地构建与预览文档站点，以便在不依赖 CI 的情况下验证文档内容与导航结构。
在仓库根目录执行 `uv run --project docs zensical build` 时 MUST 生成静态站点输出目录（默认 `site/`）并包含 `index.html`；执行 `uv run --project docs zensical serve` 时 MUST 在本地端口提供可访问的预览站点。

### Requirement: Minimum information architecture
系统 SHALL 在文档站点导航中提供以下最小页面集合：Getting Started、Deployment、Python SDK、Plugins、Configuration、Contributing。
文档站点导航 MUST 可访问上述每个页面，且每个页面 MUST 有对应的 Markdown 源文件。

### Requirement: GitHub Pages deployment
系统 MUST 提供 GitHub Actions workflow 构建并发布文档站点到 GitHub Pages，并支持自动与手动两种触发方式。
向 `main` 推送文档变更时 workflow MUST 自动构建并部署到 GitHub Pages；`workflow_dispatch` 手动触发时 MUST 执行相同的构建与部署步骤。

### Requirement: Branding assets
系统 SHALL 在文档站点中使用仓库 logo（`docs/content/static/logo.webp`）作为站点标识。
站点配置 MUST 引用 `docs/content/static/logo.webp` 作为 logo。

### Requirement: Demo media entry
系统 SHALL 在文档站点中提供一个简约演示媒体入口（视频或动图），用于展示核心工作流（例如来源导入、聊天、生成输出）。
文档首页或 Getting Started 页面 SHOULD 提供一个可播放/可点击的演示媒体入口。
