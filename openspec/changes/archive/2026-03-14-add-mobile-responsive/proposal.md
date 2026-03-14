## Why

当前 Workspace 使用 12 列的模块化画布（Sources / Chat / Studio 三栏并排）。在移动端窄屏下，这种多列布局会被压缩成“每栏都很窄”的形态，导致可读性与可操作性显著下降（尤其是 Sources 列表与 Chat 输入区）。我们需要一个明确的移动端响应式策略，让核心工作流在手机上仍然可用。

## What Changes

- 在移动端窄屏（以 `md` 断点为界）进入 **单面板模式**：一次只展示 Sources / Chat / Studio 中的一个主面板
- 提供 **底部 TabBar**（来源 / 聊天 / 笔记）用于快速切换主面板，并保持顶部 `WorkspaceHeader` 可用
- 面板切换不应清空关键状态（例如：Chat 草稿、来源选择、当前输出列表与队列状态）
- TabBar 需要处理 iOS safe-area（home indicator）与可访问性（aria-current / 可聚焦）
- 桌面端（>= `md`）保持现有 Modular Canvas（GridStack）布局与布局编辑能力不变

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workspace-ui-core`: 增加移动端响应式策略的规范要求（单面板模式 + 底部 TabBar + safe-area + 状态保留）

## Impact

- 主要影响前端 Workspace 顶层布局与导航：
  - `frontend/web/src/features/workspace/layout/WorkspaceLayout.tsx`
  - `frontend/web/src/features/workspace/layout/WorkspaceTabs.tsx`（复用或改造为移动端 TabBar）
  - 可能新增一个轻量的断点/媒体查询 hook（用于条件渲染，避免在移动端挂载 GridStack）
- 不涉及后端 API 变更与数据迁移
- 需要补充移动端使用说明文档，并在实现后跑完整前后端测试以避免回归
