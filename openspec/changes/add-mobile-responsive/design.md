## Context

当前 Workspace 顶层通过 `WorkspaceLayout` 渲染：

- 顶部 `WorkspaceHeader`（notebook 切换、入口菜单、布局锁定等）
- 主体 `ModularCanvas`（GridStack 12 列，默认 Sources(3) / Chat(6) / Studio(3) 三栏并排）

在移动端窄屏下，GridStack 仍按 12 列计算，三栏会被“硬挤”成非常狭窄的列宽，造成：
- Sources 列表可读性下降、操作密度过高
- Chat 区域可用宽度不足，输入与消息浏览体验差
- Studio 区域同样拥挤，难以完成输出查看/生成

代码库中已存在可复用的“面板切换”雏形：
- `WorkspaceTabs.tsx`（来源 / 聊天 / 输出中心）
- `workspaceStore.activePanel: "sources" | "chat" | "refine"`（但当前顶层布局未使用）

## Goals / Non-Goals

**Goals:**
- 在移动端（< `md`）提供明确且可用的单面板体验：一次只显示一个主面板
- 通过底部 TabBar 快速切换 Sources / Chat / Studio
- 切换面板不丢失关键状态（草稿、选择、已加载数据等）
- 桌面端维持现有 Modular Canvas 与布局编辑能力，不引入破坏性改动

**Non-Goals:**
- 不重做 Sources/Chat/Studio 面板内部布局与交互（只做顶层装配与导航）
- 不新增后端能力、不改动 API 合同
- 不引入新的 UI 框架或重依赖

## Decisions

### 1) 断点与渲染分支

- 以 Tailwind 的 `md`（768px）为“移动端/桌面端”分界：
  - `< md`：移动端单面板模式
  - `>= md`：保留现有三栏 Modular Canvas
- 采用 **条件渲染**（而非同时渲染再用 CSS 隐藏）来避免在移动端挂载 GridStack：
  - GridStack 初始化与布局计算在移动端既无收益又可能带来性能/滚动问题
  - 通过 `matchMedia("(min-width: 768px)")` 监听视口变化，动态切换模式

备选方案对比：
- 方案 A：GridStack one-column / stack 模式（不选）
  - 会把三模块纵向堆叠成很长页面，切换成本高，且当前 `cellHeight` 逻辑也不匹配
- 方案 B：同时渲染两套布局，用 `hidden md:block` 控制（不选）
  - 移动端仍会执行 GridStack 初始化，浪费性能且更容易出现高度/滚动问题

### 2) 面板身份与状态源

- 移动端以 `workspaceStore.activePanel` 作为单一“当前主面板”状态源
- 由于历史命名：store 中为 `refine`，而 Modular Canvas widget id 为 `studio`：
  - 设计上将 `refine` 视为“Studio/输出中心”面板的 panel id（不在本变更中重命名，以避免破坏性改动）
  - 在顶层封装一个集中映射（`refine` → 渲染 StudioPanel），避免散落条件判断

### 3) 结构布局（移动端）

移动端页面结构：

```text
┌──────────────────────────────┐
│ Header (WorkspaceHeader)     │
├──────────────────────────────┤
│ Active Panel (Sources/Chat/  │
│ Studio)                      │
├──────────────────────────────┤
│ TabBar: 来源 | 聊天 | 笔记     │
└──────────────────────────────┘
```

- TabBar 固定在底部（`position: sticky` 或 `fixed`，按实际键盘遮挡表现选择）
- TabBar 需增加 `safe-area-inset-bottom` padding，避免 home indicator 遮挡点击区域
- 顶部 Header 继续保留，并在窄屏下保持关键入口可访问（符合现有 `workspace-ui-core` 约束）

### 4) 视口高度策略

移动端浏览器（尤其 iOS Safari）存在地址栏收缩导致 `100vh` 不稳定的问题。顶层容器策略：
- 将 `h-screen` 调整为基于 `100dvh` 的最小高度（例如 `min-h-[100dvh]`）
- 保持主内容区域 `min-h-0` + 可滚动，避免内容被裁切

## Risks / Trade-offs

- [窄屏/桌面切换时状态不一致] → 将 `activePanel` 作为移动端单一导航状态源；桌面端不依赖该状态；切换模式时仅改变呈现，不重置数据状态
- [底部 TabBar 与键盘/输入框遮挡] → 优先用 sticky + 内部滚动策略；必要时在 Chat 输入聚焦时降低 TabBar 占用或确保滚动容器留出底部 padding
- [safe-area 兼容性差异] → 使用 CSS `env(safe-area-inset-bottom)` 并提供合理的最小 padding 兜底

## Migration Plan

- 该变更为纯前端 UI 装配与样式改动，无数据迁移
- 发布方式：随前端构建发布
- 回滚方式：回滚前端提交即可恢复原三栏布局（桌面端不受影响，移动端回到旧行为）

## Open Questions

- TabBar 是否需要图标（当前先以文本为主，避免引入新的图标资产与密度争议）
- 移动端默认打开的面板：建议默认 `chat`（与主要工作流一致），但需确认是否与现有 onboarding/引导行为冲突
