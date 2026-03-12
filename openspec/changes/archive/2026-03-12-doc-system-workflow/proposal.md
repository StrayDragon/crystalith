## Why

Crystalith 当前已经有相当多的文档、规范与指令入口（例如 `docs/content/**`、`openspec/specs/**`、`AGENTS.md`、各子目录 `AGENTS.md`、以及未来将不断演进的代码逻辑约束），但它们存在典型的“分散 + 重复 + 易漂移”问题：

- **同一事实多处重复**：开发命令、生成入口、版本边界、路径约定在多处出现，更新时容易漏改，最终导致“文档说法 != 仓库真实行为”。
- **生成边界不清晰**：仓库已有多类生成物（例如配置 schema、OpenAPI schema、前端生成 client），但缺少一致的“可机械识别”的规则，agent/贡献者无法稳定判断“能否手改/该改哪里/要跑什么生成器”。
- **缺少漂移门禁**：即便有生成链路，也缺少统一的 drift check 护栏，使问题经常在后置阶段（CI 或上线后）才暴露。

因此需要把文档/规范/指令系统升级为一套**可长期维护、成本可控、可自动校验**的工作流：明确 SSOT、统一生成边界、收敛入口命令，并把漂移检查前置为强门禁。

## What Changes

- 建立仓库级 **Doc Taxonomy + Ownership**：
  - SSOT（代码/配置/规范）作为事实来源
  - Generated（全文件生成）与 Manual（手工叙事）分离
  - 允许 Manual + Injected Blocks（受控注入区块）用于少量必须与 SSOT 同步的片段
- 统一生成边界与识别规则：
  - 生成文件统一使用 `*.gen.*` 命名，并在文件头标注“自动生成 + 生成入口”
  - 受控注入区块统一使用 `<!-- BEGIN AUTOGEN:<id> -->` / `<!-- END AUTOGEN:<id> -->`
- 收敛生成与漂移门禁入口：
  - 新增 `just gen-docs` 作为文档生成/注入的唯一入口
  - 新增 `just docs-drift-check`、`just doc-governance-check` 并纳入 `just check`/CI
- **BREAKING**：将现存关键生成物“一步到位”改名升级为 `*.gen.*` 并全仓替换引用（不做兼容）：
  - `config/app.schema.json` → `config/app.schema.gen.json`
  - `frontend/web/openapi.json` → `frontend/web/openapi.gen.json`
- docs-site（Zensical）引入受控的 generated reference 页面（`docs/content/reference/*.gen.md`），并把 `docs/content/*.md` 中的高漂移 reference 段落迁移为“叙事 + 直达链接 / AUTOGEN 注入”。
- `AGENTS.md` 成为仓库协作的硬规则入口，并采用单源策略：
  - `CLAUDE.md` MUST 为指向 `AGENTS.md` 的 symlink（由门禁校验）。

## Capabilities

### New Capabilities
- `doc-governance`: 定义仓库文档分层（SSOT/Generated/Manual/Injected Blocks）、生成边界（`.gen.*` + `AUTOGEN`）、入口命令与漂移门禁规则。

### Modified Capabilities
- `config-and-models`: 配置 schema 产物路径升级为 `config/app.schema.gen.json`，并以该文件作为 YAML 校验的唯一 schema 文件名。
- `openapi-and-client-generation`: OpenAPI schema 导出产物路径升级为 `frontend/web/openapi.gen.json`，并作为前端/SDK 生成与 drift check 的唯一输入。
- `quality-and-regression`: drift check 范围扩展为 docs 的受控生成物/注入区块；并更新生成物排除/识别规则以匹配 `*.gen.*`。

## Impact

- Repo-wide（高影响重构）
  - 需要全仓替换 `config/app.schema.json` 与 `frontend/web/openapi.json` 的引用（脚本、just 任务、docs、specs、tests、配置注释等）
- Backend
  - 配置加载/校验默认路径与工具脚本将切换到 `config/app.schema.gen.json`
  - 新增 docs 生成/校验脚本（`backend/py/scripts/`）
- Frontend / SDK generation
  - openapi-ts、Fern 生成配置与相关 drift check 将切换到 `openapi.gen.json`
- Docs
  - `docs/content` 将引入 `reference/*.gen.md` 受控生成页面并调整 nav
  - 手工文档将迁移为“叙事 + 链接 + 少量 AUTOGEN 区块”

## Verification

- `cd frontend/web && pnpm install`（首次：确保 `oxfmt`/`oxlint` 可用）
- `cd backend/py && just config-schema-check`
- `just api-check`
- `just gen-docs`
- `just docs-drift-check`
- `just doc-governance-check`
- `just docs-build`
- `just check`
