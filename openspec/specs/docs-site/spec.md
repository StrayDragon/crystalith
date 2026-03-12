# docs-site Specification

## Purpose

定义仓库内 docs-site 的布局与组织规则：使用 Zensical（MkDocs-compatible 配置格式）构建站点，以 `docs/doc/` 作为唯一文档真源，并将站点构建产物收敛到 `docs/site/`。

## Non-goals

- 不定义运行时业务逻辑与 API 语义
- 不要求将 `openspec/specs/**` 或 `openspec/changes/**` 作为 docs-site 的可阅读页面渲染（仅允许在手工页面中链接）

## Related Code (as implemented)

- `docs/zensical.toml`
- `docs/doc/`
- `docs/site/`
- `justfile`

## Requirements

### Requirement: Documentation site exists
系统 MUST 在 `docs/zensical.toml` 提供 Zensical 的 MkDocs-compatible 配置，并允许从仓库 Markdown 源构建文档站点。

#### Scenario: Build succeeds
- **WHEN** 开发者运行 docs build 命令（Zensical）
- **THEN** 构建 MUST 成功完成

### Requirement: Canonical docs live under docs/doc
系统 MUST 将 `docs/doc/` 视为 docs-site 的唯一文档真源（curated manuals + controlled reference）。

#### Scenario: Docs root is docs/doc
- **WHEN** docs-site 被配置
- **THEN** 配置的 `docs_dir` MUST 解析到 `docs/doc/`（例如 `docs/zensical.toml` 在 `docs/` 下配置 `docs_dir = "doc"`）

### Requirement: Site build output is scoped under docs/site
系统 MUST 将 docs-site 的构建产物输出到 `docs/site/`，避免污染仓库根目录。

#### Scenario: Site output path is stable
- **WHEN** docs-site 构建完成
- **THEN** 输出目录 MUST 位于 `docs/site/`

### Requirement: Site scope stays curated
系统 MUST 将 docs-site 范围限制为 `docs/doc/` 下的 curated 页面与仓库脚本生成的受控 reference 页面，并且 MUST NOT 将 `openspec/specs/**`、`openspec/changes/**`（含 archive）或其它不受控目录作为站点页面来源。

#### Scenario: Specs and change artifacts are out of scope
- **WHEN** docs-site 构建或 serve
- **THEN** nav MUST NOT 引用来自 `openspec/specs/**` 或 `openspec/changes/**` 的页面

### Requirement: Legacy scattered docs are moved and removed after reorg
系统 MUST 将迁移前散落/旧布局下的文档迁移到 `docs/doc/`，并在迁移完成后删除旧路径以避免双真源。

#### Scenario: Old paths are removed
- **WHEN** 开发者完成 docs 迁移
- **THEN** 旧路径下的同名文档 MUST 不再存在（已移动到 `docs/doc/`）
