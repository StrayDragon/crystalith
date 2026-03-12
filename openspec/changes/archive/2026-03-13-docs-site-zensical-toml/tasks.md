## 1. Zensical 配置与目录布局

- [x] 1.1 新增 `docs/zensical.toml`：将现有 `mkdocs.yml` 配置翻译为 TOML（`docs_dir = "doc"`、`site_dir = "site"`、nav 等价）
- [x] 1.2 确认 `docs/pyproject.toml` 的 `zensical` 版本可读取 `docs/zensical.toml` 并正常构建/serve

## 2. 文档真源迁移（不兼容旧路径）

- [x] 2.1 迁移站点内容：`docs/content/**` → `docs/doc/**`（包含 `reference/` 与静态资源目录）
- [x] 2.2 删除旧真源目录：`docs/content/`（避免双真源与漂移）
- [x] 2.3 修复 docs 内部链接与资源引用（logo、图片、下载资源等相对路径）
- [x] 2.4 更新仓库内对旧 docs 路径的引用（README/脚本/spec/注释等）

## 3. 构建入口与产物收敛

- [x] 3.1 更新 `just docs-serve`：改用 `uv run --project docs zensical serve -f docs/zensical.toml ...`
- [x] 3.2 更新 `just docs-build`：改用 `uv run --project docs zensical build -f docs/zensical.toml ...`，并在构建前先运行 `just gen-docs`
- [x] 3.3 收敛构建产物：确保站点输出到 `docs/site/`，并清理 repo root 的旧 `site/`（必要时更新 `.gitignore`）

## 4. docs 生成器与治理门禁升级

- [x] 4.1 升级 `backend/py/scripts/gen_docs.py`：输出到 `docs/doc/reference/*.gen.md`，并扫描 `docs/doc/**/*.md` 做 AUTOGEN 注入
- [x] 4.2 升级 `backend/py/scripts/check_doc_governance.py`：
  - 改为解析 `docs/zensical.toml`（TOML）并校验 nav 显式收录 required reference
  - 校验 required reference 文件存在且包含“AUTO-GENERATED + 生成入口提示”文件头
- [x] 4.3 对齐 required reference 列表与 `docs/zensical.toml` nav（必要时调整 reference 页面路径/命名）

## 5. 破坏性收尾（清理旧入口）

- [x] 5.1 删除 repo root `mkdocs.yml`
- [x] 5.2 确保 docs 构建/serve 不再依赖任何 `mkdocs.yml`/`docs/content` 旧路径

## 6. 规范同步与归档

- [x] 6.1 将本 change 的增量 specs 同步到 canonical specs：
  - 新增 `openspec/specs/docs-site/spec.md`
  - 更新 `openspec/specs/doc-governance/spec.md`
- [x] 6.2 完成后归档 change 到 `openspec/changes/archive/`

## 7. 验收（必须可复现）

- [x] 7.1 运行并通过：`just gen-docs`
- [x] 7.2 运行并通过：`just docs-drift-check`
- [x] 7.3 运行并通过：`just doc-governance-check`
- [x] 7.4 运行并通过：`just docs-build`
- [x] 7.5 运行并通过：`just check`
