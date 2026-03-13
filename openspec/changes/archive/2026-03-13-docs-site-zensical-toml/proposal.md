## Why

Crystalith 目前的 docs-site 虽然已经通过 `just docs-serve` / `just docs-build` 使用 Zensical 构建，但配置仍依赖仓库根目录的 `mkdocs.yml`，内容根目录固定为 `docs/content/`。这与 `scalim/docs` 的“文档自包含（`docs/zensical.toml` + `docs/doc/` + `docs/site/`）”方案不一致，导致以下问题：

- repo root 被 `mkdocs.yml` 与 `site/`（构建产物）污染，结构不收敛；
- docs 生成与治理脚本（如 `backend/py/scripts/gen_docs.py`、`backend/py/scripts/check_doc_governance.py`）对 `mkdocs.yml` / `docs/content` 进行硬编码，难以跨仓复用，也难以演进；
- 文档资源（assets/js/扩展）与站点配置缺少统一约定，后续引入更多 generated reference / injected blocks 时维护成本更高。

因此需要把 Crystalith 的 docs-site 迁移到与 `scalim/docs` 一致的方案与架构：以 `docs/zensical.toml` 作为唯一站点配置，`docs/doc/` 作为文档真源，并把站点构建产物收敛到 `docs/site/`。

## What Changes

- **BREAKING** 文档真源路径迁移：
  - `docs/content/**` → `docs/doc/**`（迁移后旧路径直接删除，避免双真源）
- **BREAKING** 站点配置迁移：
  - `mkdocs.yml`（repo root）→ `docs/zensical.toml`
  - `just docs-serve` / `just docs-build` 改为以 `docs/zensical.toml` 为入口
- **BREAKING** 站点构建产物收敛：
  - `site/`（repo root）→ `docs/site/`
- docs 生成与治理脚本升级为新布局（不做兼容旧路径）：
  - `backend/py/scripts/gen_docs.py`：generated reference 与注入区块扫描根目录迁移到 `docs/doc/`
  - `backend/py/scripts/check_doc_governance.py`：校验入口从 `mkdocs.yml` 迁移为 `docs/zensical.toml`（解析 nav 并强制显式收录 required reference）
- 对齐 `scalim/docs` 的站点能力（按需引入）：
  - `zensical.toml` 的 `nav`/`markdown_extensions`/`extra_javascript`/theme features 结构
  - docs 内 `assets/` 的组织与引用方式

## Capabilities

### New Capabilities

- `docs-site`: 定义 Crystalith 仓库内 docs-site 的布局与构建约定（`docs/zensical.toml`、`docs/doc/`、`docs/site/`）、nav 组织规则与站点边界。

### Modified Capabilities

- `doc-governance`: 更新 docs-site 的治理要求，使其与新布局一致（`docs/zensical.toml` + `docs/doc/`），并保持对受控 generated reference / injected blocks 的门禁能力。

## Impact

- 文件路径与链接：
  - 所有 docs 页面、静态资源、generated reference 页面路径会变化，需要一次性迁移并全仓替换引用。
- 本地与 CI 入口：
  - `just docs-serve` / `just docs-build` / `just gen-docs` / `just docs-drift-check` / `just doc-governance-check` 的实现将调整，但对外命令名保持不变。
- 治理门禁：
  - `doc-governance-check` 将从校验 `mkdocs.yml` 切换为校验 `docs/zensical.toml`，并确保 required reference 页面在 nav 中可发现。
