## ADDED Requirements

### Requirement: MkDocs documentation site
系统 MUST 在仓库根目录提供 `mkdocs.yml`，并以 `docs/` 作为文档源目录，使文档可被构建为静态站点。

#### Scenario: 配置与源目录存在
- **WHEN** 在仓库根目录检查文档站点配置
- **THEN** 存在 `mkdocs.yml`
- **AND** 存在 `docs/` 目录用于存放 Markdown 与资源文件

### Requirement: Local build and preview
系统 MUST 支持在本地构建与预览文档站点，以便在不依赖 CI 的情况下验证文档内容与导航结构。

#### Scenario: 本地构建成功
- **WHEN** 在仓库根目录执行 `mkdocs build`
- **THEN** 生成静态站点输出目录（默认 `site/`）
- **AND** 输出目录包含 `index.html`

#### Scenario: 本地预览可访问
- **WHEN** 在仓库根目录执行 `mkdocs serve`
- **THEN** 在本地端口提供可访问的文档站点

### Requirement: Minimum information architecture
系统 SHALL 在文档站点导航中提供以下最小页面集合：Getting Started、Deployment、Python SDK、Plugins、Configuration、Contributing。

#### Scenario: 导航包含最小页面
- **WHEN** 用户打开文档站点导航
- **THEN** 可访问上述每个页面
- **AND** 每个页面均有对应的 Markdown 源文件

### Requirement: GitHub Pages deployment
系统 MUST 提供 GitHub Actions workflow 构建并发布文档站点到 GitHub Pages，并支持自动与手动两种触发方式。

#### Scenario: main push 自动发布
- **WHEN** 向 `main` 分支推送文档变更
- **THEN** workflow 构建静态站点并部署到 GitHub Pages

#### Scenario: 手动触发发布
- **WHEN** 通过 `workflow_dispatch` 手动触发发布
- **THEN** workflow 执行相同的构建与部署步骤

### Requirement: Branding assets
系统 SHALL 在文档站点中使用仓库 logo（`docs/assets/logo.webp`）作为站点标识。

#### Scenario: 站点引用 logo
- **WHEN** 构建文档站点
- **THEN** 站点配置引用 `docs/assets/logo.webp` 作为 logo

### Requirement: Demo media entry
系统 SHALL 在文档站点中提供一个简约演示媒体入口（视频或动图），用于展示核心工作流（例如来源导入、聊天、生成输出）。

#### Scenario: 文档包含演示入口
- **WHEN** 用户阅读文档首页或 Getting Started 页面
- **THEN** 存在一个可播放或可点击的演示媒体入口
