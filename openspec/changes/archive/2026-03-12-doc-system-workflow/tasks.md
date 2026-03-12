## 1. 治理基线（规范 + 入口约束）

- [x] 1.1 将 `doc-governance` 规范作为本仓库新的 canonical capability（新增 `openspec/specs/doc-governance/spec.md`，并确保 `openspec/specs/README.md` 可发现）
- [x] 1.2 更新 `openspec/config.yaml`：补齐 doc governance 上下文 + per-artifact rules（proposal/design/tasks 写清 SSOT/生成入口/漂移门禁）
- [x] 1.3 落单源策略：`CLAUDE.md` 改为指向 `AGENTS.md` 的 symlink，并添加治理门禁强制校验

## 2. legacy generated 产物改名升级（不兼容旧路径）

- [x] 2.1 配置 schema 改名：`config/app.schema.json` → `config/app.schema.gen.json`（含 `config/app.yaml` 的 `$schema` 注释与后端默认路径/脚本/测试/文档引用）
- [x] 2.2 OpenAPI schema 改名：`frontend/web/openapi.json` → `frontend/web/openapi.gen.json`（含 just 入口、`openapi-ts` 输入、Fern 生成配置、文档与规范引用）
- [x] 2.3 同步更新被影响的 OpenSpec 规范（canonical specs）：`config-and-models`、`openapi-and-client-generation`、`quality-and-regression`（以及任何引用旧路径的 spec）

## 3. docs 生成入口与漂移门禁

- [x] 3.1 新增 docs 生成器：`backend/py/scripts/gen_docs.py`（生成 `docs/content/reference/*.gen.md` + 替换 `AUTOGEN:<id>` 区块；支持 `--check`）
- [x] 3.2 新增治理检查器：`backend/py/scripts/check_doc_governance.py`（至少校验：`CLAUDE.md` symlink、`*.gen.md` 文件头生成提示、`mkdocs.yml` nav 显式收录 reference）
- [x] 3.3 新增并接入 just 入口：`just gen-docs` / `just docs-drift-check` / `just doc-governance-check`，并纳入 `just check`（本地默认 guardrail）

## 4. docs/content 迁移（方案 C：手工页只留叙事 + 直达链接/少量 AUTOGEN）

- [x] 4.1 引入受控 generated reference 页面并加入 `mkdocs.yml` nav：
  - `docs/content/reference/config-schema.gen.md`
  - `docs/content/reference/openspec-index.gen.md`
  - `docs/content/reference/just-commands.gen.md`
- [x] 4.2 迁移 `docs/content/configuration.md`：把高漂移键列表迁移为“链接到 reference + 少量 AUTOGEN 片段”
- [x] 4.3 迁移 `docs/content/getting-started.md` / `docs/content/contributing.md`：命令清单改为“直达链接或 AUTOGEN 注入”，避免与 `justfile` 漂移
- [x] 4.4 迁移 `docs/content/sdk-*.md`：统一引用 `openapi.gen.json`，并用受控片段避免生成链路说明漂移

## 5. 验收（必须可复现）

- [x] 5.1 运行并通过：`cd backend/py && just config-schema`（生成 `config/app.schema.gen.json`，且 `git diff --exit-code` clean）
- [x] 5.2 运行并通过：`just api-check` + `cd frontend/web && pnpm run api:generate`（确保 client 与 schema 对齐）
- [x] 5.3 运行并通过：`just gen-docs` + `just docs-drift-check` + `just doc-governance-check`
- [x] 5.4 运行并通过：`just check` + `just docs-build`

## 执行记录

- 2026-03-12：`just gen-docs`
- 2026-03-12：`just docs-drift-check`
- 2026-03-12：`just doc-governance-check`
- 2026-03-12：`cd backend/py && just config-schema-check`
- 2026-03-12：`just api-check`
- 2026-03-12：`just docs-build`
- 2026-03-12：`just check`
