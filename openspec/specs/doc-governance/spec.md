# doc-governance Specification

## Purpose

定义 Crystalith 仓库的文档/规范/指令治理边界：哪些内容是事实来源（SSOT），哪些必须生成（Generated），哪些是手工叙事（Manual），以及哪些片段允许以受控方式注入（Injected Blocks）。该规范的目标是减少“重复维护 + 漂移”，并为 agent 与贡献者提供可机械遵守的护栏。

## Non-goals

- 不定义运行时业务逻辑与 API 语义
- 不要求将所有手工文档全部自动生成
- 不要求把 `openspec/specs/**` 作为 docs-site 的可阅读页面直接渲染（只允许受控索引/链接）

## Requirements

### Requirement: 文档与产物必须遵循 SSOT / Generated / Manual / Injected Blocks 分层
仓库 MUST 将文档与产物分为：
- **SSOT**：代码/配置/规范本体（事实来源）
- **Generated**：可稳定重建的全文件生成物
- **Manual**：手工叙事/排障路径/入口索引
- **Injected Blocks**：手工文档中的受控注入片段

并明确：reference 内容 SHOULD 来自 SSOT 或 generated；Manual 页面 SHOULD 避免复制整段 reference 以降低漂移风险。

#### Scenario: 手工文档避免重复 reference
- **WHEN** 手工页面需要展示字段列表、命令清单或路径约定
- **THEN** 页面 SHOULD 链接到受控 generated reference
- **AND** 若必须就地展示片段，SHALL 使用受控注入区块而非手工复制

### Requirement: 生成物必须使用 `.gen.*` 并禁止手工编辑
仓库 MUST 以文件名包含 `.gen.` 作为 generated 的统一识别规则；任何 `*.gen.*` 文件 MUST 视为可由生成器稳定重建且禁止手工编辑。

#### Scenario: 贡献者需要修改 generated 内容
- **WHEN** 贡献者希望修改某个 `*.gen.*` 文件呈现的内容
- **THEN** 贡献者 SHALL 修改其 SSOT 并运行对应生成入口刷新产物
- **AND** SHALL NOT 直接编辑 `*.gen.*` 文件内容

### Requirement: Injected Blocks 必须使用 AUTOGEN 标记并由生成器替换
手工 Markdown 文档 MAY 包含少量必须与 SSOT 同步的受控注入区块；这些区块 MUST 使用：
`<!-- BEGIN AUTOGEN:<id> -->` 与 `<!-- END AUTOGEN:<id> -->` 标记，并由生成器替换区块内部内容。

#### Scenario: AUTOGEN 区块漂移被检测
- **WHEN** 文档中 `AUTOGEN:<id>` 区块内容与生成器计算结果不一致
- **THEN** docs drift check SHALL 失败并给出可执行修复提示（运行 `just gen-docs`）

### Requirement: docs 生成与漂移门禁必须收敛到稳定入口
仓库 MUST 提供 docs 相关的稳定入口命令：
- `just gen-docs`：刷新 docs 受控生成页面与 AUTOGEN 区块
- `just docs-drift-check`：校验 docs 受控生成物与注入区块无漂移
- `just doc-governance-check`：校验文档治理硬规则

并且这些门禁 MUST 纳入本地默认 guardrail（`just check` 或等价入口）。

#### Scenario: 本地默认入口覆盖 docs guardrails
- **WHEN** 开发者在本地运行 `just check`
- **THEN** 系统 SHALL 执行 docs drift check 与治理检查
- **AND** 在失败时 SHALL 返回非 0 并提供可执行修复建议

### Requirement: docs-site 允许并显式收录受控 generated reference 页面
docs-site（`docs/content` + `mkdocs.yml`）MUST 允许并约束受控生成的 reference 页面：
- 文件 MUST 放在 `docs/content/reference/`
- 文件名 MUST 为 `*.gen.md`
- `mkdocs.yml` nav MUST 显式收录这些页面

#### Scenario: 生成 reference 页面可在站点中发现
- **WHEN** 开发者生成了 `docs/content/reference/*.gen.md`
- **THEN** 这些页面 SHALL 通过 docs-site 构建并在导航中可见

### Requirement: 仓库协作指令必须单源
仓库 MUST 以 `AGENTS.md` 作为协作指令 SSOT；`CLAUDE.md` MUST 为指向 `AGENTS.md` 的 symlink，并由治理门禁强制执行。

#### Scenario: 单源策略被强制
- **WHEN** `CLAUDE.md` 不是指向 `AGENTS.md` 的 symlink
- **THEN** doc governance check SHALL 失败并阻止合入
