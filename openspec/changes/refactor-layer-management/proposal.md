## Why

前端代码库中存在严重的 z-index 管理混乱问题。当前各组件使用任意硬编码的 z-index 值（如 99999、10001、10000、9999），导致多个弹窗、对话框、Tooltip、Toast 等层叠元素之间的覆盖关系不可预测。开发者已经开始绕过 Material Tailwind 的 Dialog 组件，使用 `createPortal` 直接渲染到 body 作为临时解决方案，这增加了代码复杂度且不可持续。

## What Changes

- 引入统一的 Layer 层级管理系统，定义清晰的 z-index 层级规范
- 创建 `LayerProvider` 上下文和 `useLayer` hook 用于声明式层级管理
- 定义标准层级常量：`base`、`dropdown`、`popover`、`modal`、`toast`、`tooltip`
- 重构现有组件，移除硬编码 z-index 值，使用统一的层级 API
- 提供 Portal 容器组件，自动处理层级堆叠顺序

## Impact

- 受影响的规范：`workspace-ui`
- 受影响的代码：

**全局组件：**
  - `frontend/web/src/shared/toast.tsx` - Toast 组件 (`z-[99999]`)

**对话框/覆盖层组件：**
  - `frontend/web/src/features/workspace/components/AddSearchResultDialog.tsx` - 自定义对话框 (`z-[99999]`)
  - `frontend/web/src/features/workspace/components/SourceDetailDialog.tsx` - 来源详情对话框（内部 MenuList `z-[10001]`）
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx` - Studio 输出查看器 (`z-[60]`)
  - `frontend/web/src/features/workspace/components/ResearchDetailPanel.tsx` - 研究详情面板 (`z-50`)
  - `frontend/web/src/features/workspace/components/KnowledgeGraphView.tsx` - 知识图谱视图 (`z-50`)

**弹出/下拉组件：**
  - `frontend/web/src/features/workspace/components/SearchResultsQueue.tsx` - 搜索结果队列（Menu `z-[10001]`、Tooltip `z-[10000]`）
  - `frontend/web/src/features/workspace/components/citations/CitationMark.tsx` - 引用标记弹出框 (`z-[99999]`)
  - `frontend/web/src/features/workspace/components/ModelSelector.tsx` - 模型选择器下拉 (`z-[9999]`)
  - `frontend/web/src/features/workspace/components/NotebookSwitcher.tsx` - 笔记本切换器 (`z-[9999]`)
  - `frontend/web/src/features/workspace/components/SessionSwitcher.tsx` - 会话切换器 (`z-[9999]`)

**其他含 Menu/Tooltip 的组件：**
  - `frontend/web/src/features/workspace/components/StudioPanel.tsx` - Studio 面板（MenuList `z-50`）
  - `frontend/web/src/features/workspace/components/ChatPanel.tsx` - 聊天面板（MenuList `z-50`）
  - `frontend/web/src/features/workspace/components/SearchResultCard.tsx` - 搜索结果卡片（MenuList `z-50`）
