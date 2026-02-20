## 1. Docs site scaffold

- [x] 1.1 新增 `docs/pyproject.toml` + `docs/uv.lock`（MkDocs + Material 依赖），并提供标准命令：`uv sync --project docs` + `uv run --project docs mkdocs serve/build`
- [x] 1.2 新增 `mkdocs.yml`：站点元信息（name、repo_url 等）与基础导航骨架
- [x] 1.3 将 `docs/assets/logo.webp` 接入站点配置（logo / favicon，如适用）

## 2. 内容与信息架构

- [x] 2.1 新增 `docs/getting-started.md`：最小可运行路径（本地 dev / docker compose）
- [x] 2.2 将 `docs/deployment.md` 纳入站点导航，并对齐最新部署入口与环境变量说明
- [x] 2.3 将 `docs/sdk-python.md` 纳入站点导航，并补齐本地生成与发布前置校验说明
- [x] 2.4 将 `docs/plugins.md` 纳入站点导航，并补齐示例插件的最小安装与启用步骤
- [x] 2.5 新增 `docs/configuration.md`：`config/app.yaml`、`${{ env.* }}` / `${{ secrets.* }}`、`CRYSTALITH_SECRETS_PATH` 的使用说明
- [x] 2.6 新增 `docs/contributing.md`：开发命令、目录结构、测试入口、提交流程与常见问题
- [x] 2.7 确保站点导航包含最小页面集合（Getting Started / Deployment / SDK / Plugins / Configuration / Contributing）

## 3. GitHub Pages 发布

- [x] 3.1 新增 docs GitHub Actions workflow：`push` 到 `main` 自动发布 + `workflow_dispatch` 手动发布
- [x] 3.2 配置 GitHub Pages 发布方式（artifact + deploy-pages），并在 workflow 中固定 Python/Node 版本与缓存策略（如适用）
- [x] 3.3 在 README 与站点中添加 GitHub Pages 的在线文档入口链接
- [x] 3.4 在 workflow 中执行 `uv run --project docs mkdocs build --strict` 作为基础门禁

## 4. 演示素材

- [ ] 4.1 演示媒体优先入仓到 `docs/assets/`（建议 `demo.webm`，体积上限 10MB）；超出上限则改为 GitHub Release assets 外链（手工制作）
- [ ] 4.2 录制并导出简约演示（Cursorful），并在站点首页或 Getting Started 嵌入入口（手工制作）

## 5. 验证

- [x] 5.1 本地执行 `uv run --project docs mkdocs build --strict` 验证构建成功（输出包含 `index.html`）
- [x] 5.2 本地执行 `uv run --project docs mkdocs serve` 验证预览可访问且导航无死链
