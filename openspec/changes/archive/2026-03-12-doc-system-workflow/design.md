## Context

Crystalith 目前的文档/规范/指令入口主要分布在：

- `docs/content/**`：面向用户/操作者的站点文档（Zensical / mkdocs.yml）
- `openspec/specs/**`：规范（需求与契约）
- `openspec/changes/**`：规范变更工作区与历史归档
- `AGENTS.md`、各子目录 `AGENTS.md`：协作/约束入口（agent 与贡献者都会读取）
- 各类生成链路：
  - 配置 schema：`cd backend/py && just config-schema` 生成 `config/app.schema.json`
  - OpenAPI schema：`just api-export` 导出 `frontend/web/openapi.json`
  - 前端生成 client：`openapi-ts` 输出 `frontend/web/src/api/generated/**`

现状问题不在于“缺少文档”，而在于缺少**可长期维护的治理边界**：

- agent/贡献者无法稳定判断：哪些文件可以直接编辑、哪些必须生成、改完要跑什么、CI 会如何兜底。
- 已存在生成物的识别规则不统一（有的用 `.gen.ts`，有的用固定文件名；docs 侧缺少受控生成边界）。
- 指令与文档容易在多处复制同一事实，产生漂移。

本设计把 scalim 的 doc-system-workflow 核心思想迁移到 Crystalith：**先确立治理基线，再收敛入口与门禁，最后迁移高漂移内容**。

## Goals / Non-Goals

**Goals:**
- 建立清晰的 Doc Taxonomy（SSOT / Generated / Manual / Injected Blocks）与 Ownership（责任边界）。
- 让“生成物/注入区块”具备统一的可机械识别规则（`.gen.*` + `AUTOGEN`）。
- 将 docs 生成与 drift check 收敛到稳定入口（`just gen-docs` / `just docs-drift-check` / `just doc-governance-check`）并纳入 `just check`。
- 将现存关键 legacy 生成物一次性升级为 `.gen.*` 命名（不做兼容），消灭“隐式 generated”与长期漂移源。
- 在 docs-site 引入少量受控的 generated reference 页面，并把手工文档聚焦为叙事/决策与直达链接。

**Non-Goals:**
- 不引入运行时新依赖；治理变更不改变系统运行行为（除了生成物路径重命名引发的构建/脚本路径变更）。
- 不把 `openspec/specs/**` 直接作为 docs-site 页面渲染（只生成索引/链接 reference）。
- 不把所有手工文档都自动生成；目标是“关键 reference 可生成 + 可校验”，其余仍手工维护。

## Decisions

### D1: Doc Taxonomy + Ownership（分层与责任边界）

定义四类内容，并强制各自的推荐维护方式：

1) **SSOT**：事实来源（代码/配置/规范本体）。
2) **Generated（全文件生成）**：以 `*.gen.*` 命名；禁止手改；必须可由脚本/just 目标稳定重建。
3) **Manual（手工叙事）**：面向读者的指南、排障路径、决策说明；避免复制完整 reference。
4) **Manual + Injected Blocks**：手工文档内允许少量 `AUTOGEN` 区块，由生成器替换以保持与 SSOT 同步。

### D2: 统一生成边界识别规则（让 agent 可遵守）

- 文件级：文件名包含 `.gen.` 视为 generated，禁止手改。
- 区块级：任何 `<!-- BEGIN AUTOGEN:<id> --> ... <!-- END AUTOGEN:<id> -->` 视为 injected，禁止手改区块内部。
- generated 文件必须包含可追溯生成入口提示（脚本路径或 `just` 目标）。

### D3: 生成入口与 drift gate 收敛

- 新增 `just gen-docs`：刷新 docs 受控生成页面与 AUTOGEN 区块。
- 新增 `just docs-drift-check`：校验 `docs/content/**/*.gen.md` 与 AUTOGEN 区块无漂移（失败提示必须指向 `just gen-docs`）。
- 新增 `just doc-governance-check`：校验仓库治理硬规则（例如 `CLAUDE.md` symlink）。
- 将上述 gate 纳入 `just check`，使本地默认入口覆盖关键护栏。

### D4: legacy generated 产物“一步到位”升级

本 change 选择不做兼容处理，将关键生成物改名为 `.gen.*` 并全仓替换引用：

- `config/app.schema.json` → `config/app.schema.gen.json`
- `frontend/web/openapi.json` → `frontend/web/openapi.gen.json`

拒绝“保留旧名 + 白名单”的原因：长期会形成例外集合并反向侵蚀治理规则；同时对 agent 来说不够机械与稳定。

### D5: docs-site 引入受控 generated reference（限制数量、明确入口）

- generated reference 放在 `docs/content/reference/`，以 `.gen.md` 命名，并在 `mkdocs.yml` nav 中显式收录。
- 手工页面保留叙事与排错路径，reference 内容优先改为链接到 generated 页面；仅对少量“必须就地展示的片段”使用 AUTOGEN 区块。

## Risks / Trade-offs

- [破坏性改名影响面大] → 一次性全仓替换引用 + 在 `just check` 中增加 drift gate，确保改名后路径稳定。
- [generated 引入站点导致 diff 噪音] → 强制确定性输出（排序、末尾换行、稳定标题），并把 generated 范围限制为少量关键 reference。
- [手工页迁移成本高] → 先迁移高漂移段落（命令清单、字段列表、路径约定），其余内容维持手工叙事。

## Migration Plan

1) **治理基线**：新增 `doc-governance` 规范，补齐 openspec 写作护栏；建立 `.gen.*`/AUTOGEN 规则与单源策略。
2) **改名升级**：配置 schema 与 OpenAPI schema 改名并全仓替换引用；更新相关 spec 与 docs。
3) **入口与门禁**：实现 `gen-docs`/`docs-drift-check`/`doc-governance-check` 并纳入 `just check`。
4) **docs 迁移**：将 `docs/content` 中高漂移 reference 段落迁移到 generated reference 或 AUTOGEN 区块；手工页保留叙事与直达链接。

回滚边界：
- `.gen.*` 文件与 AUTOGEN 区块是治理边界；可以按文件/区块回滚，不影响运行时核心逻辑。

## Open Questions

（无）本变更已选择：允许 docs-site 收录 generated reference、`CLAUDE.md` symlink、以及 legacy 生成物改名升级且不兼容旧路径。
