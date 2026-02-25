## Context

- `WorkspaceLayout.tsx` 聚合了：
  - ModularCanvas（锁定/布局/目录/命令面板）
  - 多种 overlays/dialogs（output viewer、graph view、source/session detail、slides dialog、session switcher、shortcut help）
  - 跨域 domain hooks（notebooks/sessions/sources/messages/refine/analysis 等）
  - 大量 handler（键盘快捷键、关闭 overlay、打开 viewer、graph 点击等）
- 当前结构使得任何 UI 变更都可能触及多个不相关状态，难以局部推理与测试。

## Goals / Non-Goals

**Goals:**
- 将 `WorkspaceLayout` 按职责拆分为更小模块，降低单文件复杂度并明确边界：
  - Canvas/Widgets（布局与 widget 容器）
  - Overlays（dialogs/viewers）
  - Shortcuts（快捷键绑定与“关闭 overlay”策略）
  - Graph/Slides 等子域的局部 state/handlers
- 将大量 `useState` 聚合为少数“状态域对象”（hook 或 store slice），减少散落的 setState 交错。
- 拆分过程保持行为不变（纯重构），并以手动回归清单保障核心路径。

**Non-Goals:**
- 不在本次引入新的 UI 功能或视觉改动。
- 不强制将所有 UI 状态迁移到 Zustand（允许局部 context/hook 更合适）。

## Decisions

### 1) 新增 `layout/overlays` 与 `layout/hooks` 目录承载拆分产物
**Decision:** 在 `frontend/web/src/features/workspace/layout/` 下新增：
- `overlays/`：纯渲染的 overlays 组件（只收 props）
- `hooks/`：管理 overlays/canvas/shortcuts 的 state 与 handlers

**Rationale:** 与 `frontend-module-structure` 中的“副作用收敛在 hooks、展示组件纯渲染”的规则一致。

### 2) 将 overlay state 收敛到一个 hook（单一关闭策略）
**Decision:** 引入 `useWorkspaceOverlays()`（或等价命名），统一管理：
- command palette / catalog / shortcut help
- viewer / graph view / slides dialog
- graph detail dialogs 与 citation popover dialogs
并暴露：
- `closeActiveOverlay(): boolean`
- 各 overlay 的 open/close handlers

**Rationale:** 当前 `closeActiveOverlay` 依赖大量 state；集中管理可降低依赖扩散并便于测试。

### 3) Graph/session message fetch 抽到专用 hook
**Decision:** 将 `handleGraphSessionClick` 及其消息加载 state 抽到 `useGraphSessionDetail()`（或 overlays hook 的子模块），并将数据获取与 UI 展示解耦。

**Rationale:** 网络请求与 UI state 交织是回归风险点；抽离后可单测与复用。

## Risks / Trade-offs

- **[风险]** 拆分导致 props drilling 增加 → **缓解**：对跨多个 overlays 共享的少量状态使用 context（仅在必要时），其余保持局部 props。
- **[风险]** 行为回归（某些 overlay 关闭顺序/清理遗漏） → **缓解**：为 closeActiveOverlay 提供单元测试（纯函数/有限状态），并列出手动回归清单。

## Migration Plan

1. 第一阶段：只提取“纯展示组件”（保持 state 仍在 WorkspaceLayout）。
2. 第二阶段：引入 overlays hooks，将 state/handlers 迁移并收敛依赖。
3. 第三阶段：删除 WorkspaceLayout 中的冗余 state，确保文件显著瘦身。

## Open Questions

- 是否需要将 overlay state 迁移到 Zustand 的 `ui` slice，以便跨 widget/跨页面共享（当前倾向保持局部，避免全局耦合）。
