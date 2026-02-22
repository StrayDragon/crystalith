# workspace-ui Specification

## Purpose

作为 Workspace 前端体验的“总览/导航”规范：定义工作区的整体组成、关键入口与响应式约束，并将细化的交互契约下沉到更聚焦的 `workspace-*-ui` specs。本规范不替代 OpenAPI，也不重复 Sources/Chat/Studio 的细节实现。

## Related specs

- `GLOSSARY.md`
- `modular-canvas-layout/spec.md`（模块化画布布局：GridStack 拖拽/缩放/锁定/⌘K）
- `workspace-ux-system/spec.md`（主题/快捷键/layer/错误态/性能策略）
- `workspace-api/spec.md`（Workspace 依赖的稳定 API 契约）
- `workspace-sources-ui/spec.md`
- `workspace-chat-ui/spec.md`
- `workspace-studio-ui/spec.md`
- `workspace-analysis-ui/spec.md`（Analysis 面板 + 知识图谱视图）
- `research-ui/spec.md`
- `citation-interaction/spec.md`
- `output-rendering/spec.md`
- `cross-document-analysis/spec.md`（跨文档分析能力入口）

## Requirements

### Requirement: Workspace layout is modular canvas
工作区布局 MUST 基于 GridStack 模块化画布布局；交互细则（拖拽/缩放/锁定/模块目录/⌘K 命令面板）见 `modular-canvas-layout/spec.md`。

首次进入工作区时默认布局 MUST 包含 Sources / Chat / Studio 三个核心模块。

在移动端/窄宽度下 widgets MAY 纵向堆叠，且缩放/拖拽手柄 MAY 隐藏或禁用。

### Requirement: Compact workspace header (NotebookLM-style)
系统 MUST 提供紧凑顶部栏，至少包含：

- Notebook 切换/管理入口（title + switcher）
- 布局锁定状态入口（锁定/编辑模式）
- 全局菜单（模块管理、命令面板、知识图谱、主题切换等）
顶部栏 MUST 可见且不遮挡主要画布内容；关键入口在窄宽度下仍 MUST 可访问（允许换行）。

### Requirement: Core panels are split into focused specs
Sources/Chat/Studio 的具体 UI 契约 MUST 分别以聚焦 spec 维护，`workspace-ui` 仅提供总览导航：

- Sources：`workspace-sources-ui/spec.md`
- Chat：`workspace-chat-ui/spec.md`
- Studio：`workspace-studio-ui/spec.md`
为某个面板增加/修改交互时，细节 MUST 写入对应聚焦 spec；`workspace-ui` 仅保留入口与跨域不变量。

### Requirement: Source selection scopes chat and studio
系统 MUST 以“来源（Source）”作为对话与 Studio 输出的最小范围选择单元；范围选择细则见 `workspace-sources-ui/spec.md` 与 `workspace-studio-ui/spec.md`。

UI MUST 不提供 chunk 级多选控件作为范围入口。

### Requirement: Knowledge graph entrypoints
工作区 MUST 提供打开全屏知识图谱视图的入口（例如顶部菜单/面板入口）。图谱交互细则见 `workspace-analysis-ui/spec.md`（数据与 API 见 `analysis-api/spec.md`）。
用户触发图谱入口时 MUST 打开全屏图谱视图。
