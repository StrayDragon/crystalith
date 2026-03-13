## Context

Crystalith 当前的 docs-site 形态是：

- 站点内容根目录：`docs/content/`
- 站点配置：仓库根目录 `mkdocs.yml`（`docs_dir: docs/content`）
- 构建工具：`just docs-serve` / `just docs-build` 实际调用 `uv run --project docs zensical ... -f mkdocs.yml`
- 构建产物默认输出到仓库根目录 `site/`
- docs 生成与治理脚本硬编码上述布局：
  - `backend/py/scripts/gen_docs.py` 写入 `docs/content/reference/*.gen.md`，并扫描 `docs/content/**/*.md` 进行 AUTOGEN 注入
  - `backend/py/scripts/check_doc_governance.py` 解析 `mkdocs.yml` 并要求 nav 显式收录 reference 页面

对比目标方案（参考 `scalim/docs`）：

- `docs/zensical.toml`：Zensical 的 MkDocs-compatible 配置（TOML）
- `docs/doc/`：站点文档真源（手工 + 受控 generated）
- `docs/site/`：站点构建产物（与 docs 自包含）
- docs 内可按需引入 `assets/`、`extra_javascript`、`markdown_extensions` 等站点能力

本变更要把 Crystalith 的 docs-site 一次性迁移到与 `scalim/docs` 一致的布局，并同步升级 docs 生成/治理脚本与门禁规则。

## Goals / Non-Goals

**Goals:**
- 以 `docs/zensical.toml` 替换 repo root 的 `mkdocs.yml`，并作为唯一站点配置入口。
- 将站点文档真源从 `docs/content/` 迁移到 `docs/doc/`，迁移后删除旧路径（不做兼容）。
- 将站点构建产物收敛到 `docs/site/`，避免 repo root 生成目录污染。
- 升级 docs 生成与治理脚本，使其与新布局一致：
  - generated reference 输出位置、AUTOGEN 扫描根目录
  - nav 显式收录 required reference 的检查入口与解析方式（TOML）
- 保持稳定入口命令名不变：`just gen-docs` / `just docs-drift-check` / `just doc-governance-check` / `just docs-serve` / `just docs-build`。

**Non-Goals:**
- 不在本变更中重写文档内容的叙事结构或大规模重排 nav（仅在迁移过程中做必要的路径/链接更新）。
- 不保留 `mkdocs.yml` / `docs/content/` 的兼容模式（迁移后旧写法直接删除）。
- 不引入运行时业务逻辑变更；该变更仅影响文档站点与仓库治理工具链。

## Decisions

### D1: 站点配置收敛为 `docs/zensical.toml`
使用 TOML 表达 MkDocs-compatible 配置，参考 `scalim/docs/zensical.toml` 的结构（`[project]` + `nav` 数组 + `markdown_extensions` + `[project.theme]` 等）。

替代方案：
- 继续使用 repo root 的 `mkdocs.yml`：不符合“docs 自包含”，且阻碍跨仓复用（拒绝）。

### D2: 文档真源收敛为 `docs/doc/`
将 `docs/content/**` 整体迁移到 `docs/doc/**`，并在迁移完成后删除旧路径以避免双真源与漂移。

替代方案：
- 同时保留 `docs/content/` 与 `docs/doc/`：会引入长期兼容分支与治理例外（拒绝）。

### D3: 构建产物收敛为 `docs/site/`
在 `docs/zensical.toml` 中配置 `site_dir = "site"`，并以 `docs/` 为相对根，使输出落在 `docs/site/`。

替代方案：
- 继续输出到 repo root `site/`：会持续污染根目录并与 docs 自包含目标冲突（拒绝）。

### D4: generated reference 位置与 nav 显式收录规则升级
将受控 generated reference 页面迁移到 `docs/doc/reference/*.gen.md`，并要求 `docs/zensical.toml` 的 `nav` 显式收录这些页面，避免“生成但不可见”。

说明：
- `.gen.*` 命名规则与文件头生成入口提示保持不变。
- required reference 列表继续由治理脚本强制执行。

### D5: 脚本解析从 YAML 迁移到 TOML（标准库）
`backend/py/scripts/check_doc_governance.py` 使用 `tomllib` 解析 `docs/zensical.toml` 并收集 nav 中的 `.md` 路径。

替代方案：
- 引入第三方 toml 解析依赖：无必要（拒绝）。

### D6: `gen_docs.py` 的 docs root 由 `docs/zensical.toml` 决定
`backend/py/scripts/gen_docs.py` 不再硬编码 `docs/content`，而是读取 `docs/zensical.toml` 的 `docs_dir`（失败时 fail-fast，或按约定回退到 `docs/doc`），并据此：
- 输出 generated reference 到 `<docs_root>/reference/*.gen.md`
- 扫描 `<docs_root>/**/*.md` 执行 AUTOGEN 注入

## Risks / Trade-offs

- [路径迁移导致链接断裂] → 迁移时做全仓引用替换 + 本地 `just docs-build` 验证站点可构建。
- [治理脚本与生成器路径不一致] → 以 `docs/zensical.toml` 的 `docs_dir` 为单一事实来源，并在 `doc-governance-check` 中 fail-fast 给出修复提示。
- [repo root 旧构建产物残留] → 在迁移步骤中删除/清理 `site/`，并更新 `.gitignore`（若需要）确保不会再次出现。

## Migration Plan

1) 新增 `docs/zensical.toml`：将现有 `mkdocs.yml` 配置翻译为 TOML，并将 `docs_dir` 设置为 `doc`、`site_dir` 设置为 `site`（与 `scalim/docs` 一致）。
2) 迁移 docs 内容与资源：
   - `docs/content/**` → `docs/doc/**`
   - `docs/content/static/**` → `docs/doc/assets/**`（或保持 `static/`，但需与 theme/logo 与引用一致）
3) 更新 docs 构建入口：
   - `just docs-serve` / `just docs-build` 改为 `-f docs/zensical.toml`
   - `docs-build` 在构建前先运行 `just gen-docs`（保证 generated reference 最新）
4) 升级 docs 生成器与治理检查器：
   - `backend/py/scripts/gen_docs.py`：输出与扫描根目录迁移到新 docs root
   - `backend/py/scripts/check_doc_governance.py`：校验对象改为 `docs/zensical.toml` + 新 reference 路径
5) 清理遗留与收敛入口：
   - 删除 repo root `mkdocs.yml`
   - 删除/清理 repo root `site/`（改为 `docs/site/`）
   - 更新 README/脚本/规范中对旧路径的引用
6) 验收：
   - `just gen-docs`
   - `just docs-drift-check`
   - `just doc-governance-check`
   - `just docs-build`
   - `just check`

## Open Questions

- 站点 theme/logo 的呈现方案：继续使用现有 `static/logo.webp`（迁移后对应新路径），还是在首页中以 `<img>` 方式引用 `assets/logo.*`（参考 `scalim/docs`）。
- 是否引入 `scalim/docs` 的 `extra_javascript` 与 `markdown_extensions`（例如 Mermaid）作为本变更的一部分，或后续按需引入。
