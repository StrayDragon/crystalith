## Context

当前仓库准备发布为 public，但顶层 `README.md` 过于精简；已有 `docs/` 内容缺少统一导航与“在线可分享”的入口，也缺少对外展示用的最小演示素材。这会增加首次上手、部署与贡献成本，并降低外部反馈效率。

约束与现状：

- 仓库已有基础文档：`docs/deployment.md`、`docs/sdk-python.md`、`docs/plugins.md`。
- 需要一个静态站点生成器与 GitHub Pages 发布链路。
- 文档应尽量与实现保持同步，但不希望引入过重的文档工程复杂度。

## Goals / Non-Goals

**Goals:**

- 提供一个可本地预览、可在 CI 构建、可发布到 GitHub Pages 的文档站点。
- 将现有 `docs/*.md` 整理进清晰的信息架构与导航（Getting Started / Deployment / SDK / Plugins / Configuration / Contributing）。
- 在文档站点与 README 中提供明确入口（站点链接、快速启动、关键命令）。
- 提供最小演示媒体入口（视频或动图）用于展示核心工作流。

**Non-Goals:**

- 不在本变更中重写产品功能或补齐所有细节文档（仅保证“能上手”的最小闭环）。
- 不在本变更中引入复杂的多版本文档（按 tag 构建版本）与多语言体系（可后续拆分）。
- 不在本变更中将文档拆分为独立仓库（明确保留单仓内文档站点）。

## Decisions

### 1) 站点生成器选择：MkDocs + Material（推荐）

**Decision:** 采用 MkDocs + Material theme 作为文档站点生成器。

**Rationale:**

- 与当前以 Python 为主的仓库工具链更贴合；配置轻量、迁移成本低。
- 对 Markdown 支持成熟，适合快速把现有 `docs/*.md` 组织成站点。

**Alternatives:**

- VitePress：与前端栈一致，但需要引入额外 Node 工具链与配置。
- Docusaurus：功能强但更重，初期维护成本高。

### 2) 内容来源与结构：以 `docs/` 为单一来源

**Decision:** 站点内容以 `docs/` 目录为单一来源；现有文档文件保留并被纳入导航。

**Rationale:** 避免重复维护（站点一份、README 一份）导致漂移。

### 3) 发布策略：GitHub Actions 部署到 GitHub Pages

**Decision:** 提供一个 docs 部署 workflow（`push` 到 `main` 自动发布 + `workflow_dispatch` 手动发布）。

**Rationale:** Pages 是最低摩擦的 public 文档承载方式，适合开源发布初期。

**Alternatives:**

- 单独 docs 仓库：隔离更好，但引入跨仓维护与同步成本。
- 外部托管（Vercel/Netlify）：体验好但引入第三方依赖与配置。

### 4) 文档依赖安装：独立 docs Python 项目（uv 管理）

**Decision:** 在 `docs/` 下创建独立的 Python project（`docs/pyproject.toml` + `docs/uv.lock`），并使用：

- `uv sync --project docs` 安装依赖
- `uv run --project docs mkdocs serve/build` 运行站点

**Rationale:**

- 依赖可复现（lockfile），同时不污染 `backend/py` 的运行环境。
- 与仓库现有 uv 工具链一致，降低新工具引入成本。

**Alternatives:**

- `pipx install mkdocs-material`：更轻，但依赖版本不受控，CI/本地一致性较弱。
- `docs/requirements.txt`：可行，但较难表达工具链与额外脚本依赖关系（仍可作为 fallback）。

### 5) 演示媒体：优先入仓（小体积），否则 Release assets 外链

**Decision:** 演示媒体默认入仓到 `docs/assets/`（例如 `docs/assets/demo.webm`），但必须控制体积（建议上限 10MB）；若超过上限则改为 GitHub Release assets 外链并在文档中引用。默认不启用 Git LFS。

**Rationale:** 对外可访问性与长期可维护性优先，避免仓库因为大文件显著膨胀。

### 6) 语言策略：先单语（中文），不做双语框架

**Decision:** 首版文档站点默认以中文为主，不引入双语（i18n）框架；需要时以独立 change 评估与落地。

**Rationale:** 避免早期信息架构与维护成本过高，先保证“能上手”的闭环质量。

### 7) 文档验证门禁：只做 `mkdocs build --strict`

**Decision:** docs workflow（与本地验证建议）使用 `mkdocs build --strict` 作为基础门禁；不额外引入独立的链接检查器（dead link checker），避免噪声与维护成本。

**Rationale:** `--strict` 能覆盖大量常见问题（缺失页面、配置错误等），且维护成本低；链接检查可在后续需要时单独引入。

## Risks / Trade-offs

- [二进制演示文件过大导致仓库膨胀] → 优先选择 webm/gif 压缩；必要时改为外链（Release assets/外部平台）并在文档中说明。
- [文档与实现漂移] → 先把“启动/部署/配置/SDK/插件”作为最小闭环；后续在 CI 中加入 `mkdocs build` 校验与（可选）链接检查。
- [工具链分叉（Python + Node）] → 采用 MkDocs 以减少额外 Node 依赖；若未来改用 VitePress 再做迁移变更。

## Migration Plan

1. 引入 MkDocs 配置（`mkdocs.yml`）并把现有 `docs/*.md` 纳入导航。
2. 补齐缺失页面骨架（Getting Started / Configuration / Contributing 等），保证最小闭环可读。
3. 添加 GitHub Pages workflow，支持自动与手动发布。
4. 更新 `README.md`：快速启动、文档入口、演示入口。
5. 本地 `mkdocs build/serve` 与 Pages 发布验证通过后合并。

## Open Questions

- GitHub Pages 的最终 URL / base path 是什么（仓库名、组织名、是否自定义域名）？这会影响 `mkdocs.yml` 的 `site_url`/`use_directory_urls` 与部署配置。
- 演示媒体最终体积是否能控制在 10MB 以内？若不能，选用哪种外链策略（GitHub Release assets vs 外部平台）？
- 是否需要在文档站点落地前，先完成 `deployment-one-click` 与 `ci-tests-and-publish` 两个变更，以避免部署命令与 CI 约束在文档中反复改写？
