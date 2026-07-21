---
version: 'alpha'
name: 'Crystalith Design System'
description: 'Crystalith v2 Web 前端设计系统 — 基于 React + Tailwind CSS 的 AI 研究辅助工作台'
colors:
  primary: '#3b82f6'
  primary-hover: '#2563eb'
  primary-light: '#93c5fd'
  secondary: '#475569'
  surface: '#ffffff'
  on-surface: '#111827'
  surface-muted: '#f3f4f6'
  surface-elevated: '#ffffff'
  border: '#d1d5db'
  border-muted: '#e5e7eb'
  error: '#ef4444'
  success: '#22c55e'
  warning: '#f59e0b'
  info: '#3b82f6'
  dark-surface: '#020617'
  dark-on-surface: '#e2e8f0'
  dark-surface-muted: '#1e293b'
  dark-surface-elevated: '#0f172a'
  dark-border: '#475569'
  dark-border-muted: '#334155'
typography:
  headline-lg:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '16px'
    fontWeight: '600'
    lineHeight: '1.5'
  headline-md:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '14px'
    fontWeight: '600'
    lineHeight: '1.5'
  headline-sm:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '12px'
    fontWeight: '600'
    lineHeight: '1.5'
    letterSpacing: '0.05em'
  body-md:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '14px'
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '13px'
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '11px'
    fontWeight: '500'
    lineHeight: '1.4'
  label-xs:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    fontSize: '10px'
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '0.08em'
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: '13px'
    fontWeight: '400'
    lineHeight: '1.5'
  code-sm:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
    fontSize: '11px'
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
  xl: '14px'
  xxl: '16px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  xxl: '48px'
components:
  button-primary:
    backgroundColor: '{colors.surface-elevated}'
    textColor: '{colors.dark-on-surface}'
    backgroundColor-dark: '{colors.dark-on-surface}'
    textColor-dark: '{colors.dark-surface}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    fontSize: '12px'
    fontWeight: '600'
    border: 'none'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.secondary}'
    backgroundColor-dark: 'transparent'
    textColor-dark: '{colors.dark-on-surface}'
    rounded: '{rounded.md}'
    padding: '6px 14px'
    fontSize: '12px'
    fontWeight: '500'
    border: '1px solid {colors.border}'
    border-dark: '1px solid {colors.dark-border}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.secondary}'
    backgroundColor-hover: '{colors.surface-muted}'
    rounded: '{rounded.md}'
    padding: '6px 10px'
    fontSize: '12px'
  button-danger:
    backgroundColor: '{colors.error}'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    padding: '6px 12px'
    fontSize: '12px'
    fontWeight: '600'
  input:
    backgroundColor: '{colors.surface}'
    backgroundColor-dark: '{colors.dark-surface}'
    border: '1px solid {colors.border}'
    border-dark: '1px solid {colors.dark-border}'
    rounded: '{rounded.lg}'
    padding: '8px 12px'
    fontSize: '14px'
    textColor: '{colors.on-surface}'
    textColor-dark: '{colors.dark-on-surface}'
  card:
    backgroundColor: '{colors.surface}'
    backgroundColor-dark: '{colors.dark-surface-elevated}'
    border: '1px solid {colors.border-muted}'
    border-dark: '1px solid {colors.dark-border}'
    shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
    rounded: '{rounded.xl}'
  dialog:
    backgroundColor: '{colors.surface}'
    backgroundColor-dark: '{colors.dark-surface-elevated}'
    border: '1px solid {colors.border}'
    border-dark: '1px solid {colors.dark-border}'
    rounded: '{rounded.xxl}'
    shadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)'
    backdrop: 'rgba(0, 0, 0, 0.5)'
    backdrop-blur: '8px'
  toast-success:
    backgroundColor: '#22c55e'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    shadow: '{shadow.lg}'
  toast-error:
    backgroundColor: '#ef4444'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    shadow: '{shadow.lg}'
  toast-info:
    backgroundColor: '#3b82f6'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    shadow: '{shadow.lg}'
  toast-warning:
    backgroundColor: '#f59e0b'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    shadow: '{shadow.lg}'
  widget-shell:
    rounded: '14px'
    border-radius: '14px'
    backgroundColor: '{colors.surface}'
    backgroundColor-dark: '{colors.dark-surface-elevated}'
    border: '1px solid {colors.border-muted}'
    border-dark: '1px solid {colors.dark-border}'
    shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
    header-bg: 'rgba(249, 250, 251, 0.6)'
    header-bg-dark: 'rgba(30, 41, 59, 0.6)'
  tab-pill-active:
    backgroundColor: '#0f172a'
    textColor: '#ffffff'
    backgroundColor-dark: '#f1f5f9'
    textColor-dark: '#0f172a'
    rounded: '{rounded.full}'
    padding: '8px 12px'
    fontSize: '12px'
    fontWeight: '600'
  tab-pill-inactive:
    backgroundColor: 'transparent'
    textColor: '{colors.secondary}'
    backgroundColor-hover: '{colors.surface-muted}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
    fontSize: '12px'
    fontWeight: '600'
---

# Crystalith 设计系统

## Overview

Crystalith v2 是一个面向 AI 深度研究的辅助工作台（research assistant workspace），
UI 风格定位于 **功能优先的专业工具**，而非消费级应用。

整体视觉语言受到以下因素影响：

- **研究工具定位** — 用户长时间面对面板进行阅读、分析、写作，需要安静、
  不干扰的背景和清晰的视觉层次
- **信息密集型** — 同时展示来源列表、对话历史、输出面板三个并行的信息流，
  需要高效的视觉分割
- **桌面优先** — 虽然支持移动端面板切换，但核心交互围绕桌面大屏的
  GridStack 多面板布局设计
- **AI 辅助感** — 通过打字光标动画、流式内容渐进呈现、引用高亮等微交互，
  传达「系统正在思考」的实时感

Brand personality：**理性、沉稳、高效**。不追求花哨的视觉效果，
所有设计决策服务于阅读效率和操作流畅度。

## Colors

### 色彩哲学

Crystalith 使用**中性灰/蓝灰**作为基底色系，以**蓝色**作为品牌主色和交互色。
整体配色冷静克制，避免高饱和色彩干扰用户对内容的注意力。

- **中性色**：gray/slate 系列构成 UI 骨架（背景、边框、文字）。
  浅色模式使用 gray 体系，深色模式切换为 slate 体系。
- **品牌色**：蓝色（brand-500 `#3b82f6`）用于主要行动点、链接、聚焦指示。
- **语义色**：green / red / amber / blue 分别对应 success / error / warning / info，
  使用场景克制（toast、状态标签、进度指示）。

### Light Mode

| Token         | Tailwind | Hex       | 角色                     |
| ------------- | -------- | --------- | ------------------------ |
| `--cl-bg`     | gray-100 | `#f3f4f6` | 页面全局背景             |
| `--cl-text`   | gray-900 | `#111827` | 主要文字                 |
| text          | gray-800 | `#1f2937` | 正文文字                 |
| text-muted    | gray-600 | `#4b5563` | 次要文字（说明、时间戳） |
| text-subtle   | gray-500 | `#6b7280` | 辅助文字（占位符、提示） |
| surface       | white    | `#ffffff` | 卡片、面板、输入框背景   |
| surface-muted | gray-50  | `#f9fafb` | 悬停、区隔背景           |
| border        | gray-300 | `#d1d5db` | 主要分隔/边框            |
| border-muted  | gray-200 | `#e5e7eb` | 次要分割线               |
| brand-500     | blue-500 | `#3b82f6` | 主行动色、链接           |
| brand-600     | blue-600 | `#2563eb` | 主行动色悬停             |

### Dark Mode

| Token            | Tailwind  | Hex       | 角色                          |
| ---------------- | --------- | --------- | ----------------------------- |
| `--cl-bg`        | —         | `#020617` | 页面全局背景                  |
| `--cl-text`      | —         | `#e2e8f0` | 主要文字                      |
| surface          | slate-900 | `#0f172a` | 卡片/面板背景（`!important`） |
| surface-muted    | slate-800 | `#1e293b` | 悬停/区隔背景                 |
| surface-elevated | slate-950 | `#020617` | 页面背景                      |
| border           | slate-600 | `#475569` | 主要边框                      |
| border-muted     | slate-700 | `#334155` | 次要边框                      |

### 深色模式覆盖机制

深色模式通过 `.dark` 类选择器 + `!important` 覆盖 Tailwind 的 gray 实用类。
`tailwind.css` 中对以下类做了显式深色映射：

- `.dark .bg-white` → `#0f172a`（slate-900）
- `.dark .bg-gray-50` → `#111827`（gray-900）
- `.dark .bg-gray-100` → `#1e293b`（slate-800）
- `.dark .bg-gray-200` → `#334155`（slate-700）
- `.dark .text-gray-900` → `#f1f5f9`（slate-100）
- `.dark .text-gray-800` → `#e2e8f0`（slate-200）
- `.dark .text-gray-700` → `#cbd5e1`（slate-300）
- `.dark .text-gray-600` → `#94a3b8`（slate-400）
- `.dark .text-gray-500` → `#94a3b8`（slate-400）
- `.dark .text-gray-400` → `#64748b`（slate-500）
- `.dark .border-gray-100` → `#334155`（slate-700）
- `.dark .border-gray-200` → `#475569`（slate-600）
- `.dark .border-gray-300` → `#64748b`（slate-500）

切换主题时启用 `.theme-transition` 类，为所有色彩属性提供 180ms ease 过渡动画。

### Tool Tone 色卡

Workspace tool 使用以下 tone 色区分类型（用于 badge/border/hover 色）：

| Tone   | Tailwind 类比 | 用途          |
| ------ | ------------- | ------------- |
| slate  | slate         | 默认/笔记类   |
| blue   | blue          | 分析/报告类   |
| green  | green         | 结构化输出    |
| rose   | rose          | 测验/评测类   |
| amber  | amber         | 时间线/事件类 |
| teal   | teal          | 思维导图类    |
| indigo | indigo        | 简报类        |

## Typography

### 字体策略

Crystalith 使用**系统字体栈**，不加载外部字体。

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  'Noto Sans',
  sans-serif,
  'Apple Color Emoji',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'Noto Color Emoji';
```

选择理由：

- **性能**：零网络请求，即时渲染
- **跨平台一致性**：每个平台使用其原生字体（SF Pro / Roboto / Segoe UI），
  用户感觉「自然」
- **CJK 兼容**：`Noto Sans` 作为回退字体覆盖中日韩字符；Emoji 字体栈保证图标符号渲染
- **等宽字体**代码使用独立栈

### Type Scale

| Level       | Size             | Weight         | Use                         |
| ----------- | ---------------- | -------------- | --------------------------- |
| headline-lg | 16px / text-base | 600 (semibold) | dialog / section 标题       |
| headline-md | 14px / text-sm   | 600 (semibold) | 卡片标题、面板头部          |
| headline-sm | 12px / text-xs   | 600 (semibold) | widget 标题栏、section 标签 |
| body-md     | 14px / text-sm   | 400 (normal)   | 正文（聊天消息、卡片描述）  |
| body-sm     | 13px             | 400 (normal)   | 紧凑正文（来源列表项）      |
| label-sm    | 11px             | 500 (medium)   | 辅助文字、时间戳、标签      |
| label-xs    | 10px             | 600 (semibold) | kbd、badge、uppercase 标签  |
| code        | 13px / text-sm   | 400 (normal)   | 代码块内容                  |
| code-sm     | 11px             | 400 (normal)   | 触发词、内联代码            |

### 等宽字体栈

```css
font-family:
  ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
```

用于：代码块、触发词 (`/prompt:*`)、system prompt 预览、调试数据。

## Layout

### 页面结构

```
┌─────────────────────────────────────────────┐
│ WorkspaceHeader (sticky top)                │
│  [logo] [NotebookSwitcher] [...topbar...]   │
│                      [user menu] [theme]    │
├─────────────────────────────────────────────┤
│                                             │
│  ModularCanvas (GridStack, 12 columns)      │
│  ┌──────────┬──────────┬──────────────────┐ │
│  │ Sources  │ Studio   │ Chat Panel       │ │
│  │ (3 cols) │ (3 cols) │ (6 cols)         │ │
│  └──────────┴──────────┴──────────────────┘ │
│                                             │
├─────────────────────────────────────────────┤
│ WorkspaceTabs (mobile only)                 │
│ [来源] [聊天] [笔记]  (pill-style)          │
└─────────────────────────────────────────────┘
```

### 布局策略

- **桌面（≥768px）**：ModularCanvas 使用 GridStack 引擎，12 列网格，
  用户可拖拽调整面板大小和位置，布局持久化到 localStorage
- **移动端（<768px）**：单面板 + 底部 Tab 切换，活跃面板由 `activePanel` 控制
- 默认三面板布局：Sources (3/12) + Studio (3/12) + Chat (6/12)
- 全高布局：`cl-h-dvh` 使用 100dvh 确保移动端地址栏滚动不受影响

### Spacing Scale

Crystalith 使用 4px 基准网格（Tailwind 默认），UI 中出现的间距值均为 4px 倍数。

| Scale | Pixels | Tailwind | 使用场景                  |
| ----- | ------ | -------- | ------------------------- |
| xs    | 4px    | p-1      | 极小间距、icon 与文字间距 |
| sm    | 8px    | p-2      | 按钮内间距、元素间间距    |
| md    | 16px   | p-4      | 卡片内边距、面板间隔      |
| lg    | 24px   | p-6      | section 间距              |
| xl    | 32px   | p-8      | dialog 内容内边距         |
| xxl   | 48px   | p-12     | 大区块间距                |

GridStack margin：6px（`GRID_MARGIN`）。Grid item content inset：4px。

### Container

- 页面背景：`bg-gray-50/50`（浅色）/ `bg-slate-950`（深色）
- 卡片/面板：白色背景 + 1px 边框 + shadow-sm
- Workshop header：`rounded-xl` + border + shadow-sm + `flex-wrap`
- Dialog overlay：`fixed inset-0` + `bg-black/50` + `backdrop-blur-sm`

## Elevation & Depth

### z-index 层级系统

Crystalith 使用统一的层级管理系统 (`apps/web/src/shared/layer/`)，避免硬编码。

| Layer    | z-index | 使用场景                             |
| -------- | ------- | ------------------------------------ |
| base     | 0       | 页面内容、ModularCanvas              |
| dropdown | 100     | Menu、Switcher dropdown              |
| popover  | 200     | CitationPopover、ConfirmPopover      |
| modal    | 300     | Dialog、CommandPalette、SystemConfig |
| toast    | 400     | ToastContainer 通知                  |
| tooltip  | 500     | Tooltip、ConfirmPopover（portal）    |

每个层级内预留 50 个 slot 用于同层堆叠（如多个 toast）。

### 阴影方案

Crystalith 使用 Tailwind 原生阴影体系 + 两个自定义阴影：

| Token       | Value                                 | 使用场景          |
| ----------- | ------------------------------------- | ----------------- |
| shadow-sm   | `0 1px 2px 0 rgb(0 0 0 / 0.05)`       | 默认卡片阴影      |
| shadow-md   | `0 4px 6px -1px rgb(0 0 0 / 0.1)`     | 卡片 hover/交互态 |
| shadow-lg   | `0 10px 15px -3px rgb(0 0 0 / 0.1)`   | dropdown、popover |
| shadow-xl   | `0 20px 25px -5px rgb(0 0 0 / 0.1)`   | 浮层面板          |
| shadow-2xl  | `0 25px 50px -12px rgb(0 0 0 / 0.25)` | 模态对话框        |
| shadow-soft | `0 12px 28px rgba(15, 23, 42, 0.08)`  | 柔和浮动效果      |
| shadow-glow | `0 16px 30px rgba(37, 99, 235, 0.25)` | brand 高光交互    |

GridStack 拖拽时 active widget 的 z-index 提升至 `base + 5`。

## Shapes

### Border Radius 体系

Crystalith 使用丰富但克制的圆角体系，通过不同半径表达层次关系：

| Level | Value  | Tailwind         | 使用场景              |
| ----- | ------ | ---------------- | --------------------- |
| sm    | 6px    | rounded-md       | 按钮、kbd、紧凑元素   |
| md    | 8px    | rounded-lg       | 输入框、小图标容器    |
| lg    | 12px   | rounded-xl       | 卡片、面板、header    |
| xl    | 14px   | rounded-\[14px\] | WidgetShell 容器      |
| xxl   | 16px   | rounded-2xl      | 模态对话框、大卡片    |
| full  | 9999px | rounded-full     | 头像、pill tab、badge |

圆角从外到内递减：最外层容器（WidgetShell = 14px）→ 子卡片（12px）→ 交互元素（8px/6px），
形成清晰的嵌套层次。

### GridStack Border 样式

- Widget placeholder（拖放区域）：`2px dashed rgba(217, 119, 6, 0.3)`（amber 虚线）
- 编辑模式边框：`border-dashed border-amber-300/40`
- 锁定模式边框：`border-gray-200`（浅色）/ `border-slate-700`（深色）
- Resize handles：默认隐藏，hover 时以 0.4 透明度渐显

## Animations

### 微交互动画

| Animation           | Duration | Easing                     | 使用场景                            |
| ------------------- | -------- | -------------------------- | ----------------------------------- |
| ux-fade-in          | 150ms    | ease-out                   | 元素显现（简单出现）                |
| ux-slide-in         | 180ms    | ease-out                   | toast、新插入元素（translateY 6px） |
| ux-modal-in         | 180ms    | cubic-bezier(0.2, 0, 0, 1) | dialog 入场（scale 0.96 → 1）       |
| typing-cursor-blink | 0.9s     | steps(1) infinite          | AI 流式输出光标                     |
| source-locate-flash | 1.35s    | ease-in-out                | 来源定位高亮闪烁                    |
| theme-transition    | 180ms    | ease                       | 主题切换所有色彩属性过渡            |
| GridStack           | —        | animate: true              | 面板拖拽、大小变化动画              |

### 可访问性

当用户设置 `prefers-reduced-motion: reduce` 时，所有动画被禁用，
高亮闪烁效果退化为静态颜色覆盖。

## Components

### 按钮（Button）

**Primary 主按钮：**

- 浅色：`bg-slate-900 text-white`，hover → 更浅一级
- 深色：`bg-slate-100 text-slate-900`，hover → 稍暗
- 典型大小：`px-3 py-2`（紧凑）或 `px-2.5 py-1`（极小）
- Border radius：rounded-lg (8px) 或 rounded-xl (12px)
- 字体：text-xs (12px)，font-semibold

**Secondary 次按钮：**

- `bg-white border border-gray-200`（浅色）
- `bg-transparent border border-slate-700`（深色）
- hover 添加背景色变化
- 用于次要操作、工具按钮、取消按钮

**Ghost 幽灵按钮：**

- 无背景无边框，hover 时显示背景
- 用于图标操作（关闭、刷新、编辑）

**Danger 危险按钮：**

- `bg-red-500 text-white`，用于确认删除等破坏性操作
- 常见于 ConfirmPopover 的组合：`cancelText` + `confirmText`

### 输入框（Input / Textarea）

- 基本样式：`rounded-xl border border-gray-200 bg-white`
- 深色模式：`border-slate-700 bg-slate-950`
- Focus：outline-none（通过 border-color 变化表示 focus，使用 Tailwind 默认 ring）
- 典型宽度：`w-full`
- 典型内间距：`px-3 py-2`
- 字体：正文输入 sans-serif，代码输入 font-mono

### 卡片（Card / Panel）

- 标准卡片：`rounded-xl border border-gray-200 bg-white shadow-sm`
- 深色卡片：`border-slate-700 bg-slate-900`
- 无阴影卡片：移除 shadow，用于列表项内嵌
- 分割卡片：`border-b border-gray-100`（浅色）/ `border-slate-700`（深色）

### Dialog / Modal

Crystalith 所有对话框使用 Portal 渲染到 `document.body`，配合统一层级系统。

**结构：**

```
[backdrop] fixed inset-0, bg-black/50, backdrop-blur-sm
  [container] relative, max-w-*, shadow-2xl, rounded-2xl, ux-modal-in
    [header] border-b, px-5 py-4, flex justify-between
    [body] p-5, max-h-[75vh], overflow-y-auto
    [footer] 可选
```

- Backdrop 是一个独立 `<button>` 覆盖全屏，点击关闭
- 焦点陷阱（FocusTrap）：激活时锁定 Tab 循环和 Escape 关闭
- 使用 `useLayer('modal')` 获取正确的 z-index

### Toast 通知

- 四个类型：success (green), error (red), info (blue), warning (amber)
- 渲染：Portal 到 `document.body`，`fixed top-4 right-4`
- 入场：`ux-slide-in` 动画（180ms）
- 自动消失：3s (success) / 4s (info/warning) / 5s (error)
- 样式：`rounded-lg shadow-lg text-white`，图标 + 文字 + 关闭按钮

### Tab（Pill Tab）

- 移动端底部导航使用 pill 风格
- Active：`bg-slate-900 text-white`（浅色）/ `bg-slate-100 text-slate-900`（深色）
- Inactive：`text-gray-600 hover:bg-gray-100`（浅色）/ `text-slate-300 hover:bg-slate-800`（深色）
- Border radius：`rounded-full`
- 填充：`flex-1` 平均分布

### WidgetShell（Modular Canvas 面板容器）

```
┌──────────────────────────────────┐
│ [icon] LABEL  [extras]   ⋮⋮  ✕ │ ← mc-draghandle, border-b
├──────────────────────────────────┤
│                                  │
│  Widget content (overflow-auto)  │
│                                  │
└──────────────────────────────────┘
```

- Border radius：14px（`rounded-[14px]`）
- 锁定/编辑模式视觉区分（border style + hover shadow）
- 拖拽把手（`.mc-draghandle`）：锁定时 `cursor-default`，编辑时 `cursor-grab`
- 内容区 `overflow-y-auto overflow-x-hidden`

### Navigation / Switcher

**NotebookSwitcher 和 SessionSwitcher：**

- 由 MT Menu overlay 提供
- Search input + list + create button
- 列表项 hover 高亮

**WorkspaceTopbarSearch：**

- 搜索面板锚定在 header 中
- 两个 tab：fast（直接搜索）和 deep（深度研究）
- 使用 Portal 渲染搜索结果

### Skeleton / Loading

- `animate-pulse` 基础动画
- 背景色：`bg-gray-100` / `bg-gray-200`（浅色）
- 三种尺寸变体：SkeletonLine（单行）、SkeletonCard（卡片模拟）、SkeletonList（多行列表）
- 最后一个元素通常宽度设为 `w-2/3` 模拟自然文本长度

### Citation 组件

**CitationPopover：**

- Portal 渲染，自动检测上下边界决定展开方向
- 320px 宽度，max-height 400px
- 圆角：`rounded-xl` + `shadow-xl`
- 列表项 hover 蓝色高亮
- 两个操作按钮：定位来源 + 打开来源详情

### 输出渲染器（Output Renderers）

每个输出类型有独立 Viewer 组件：

- **FlashcardViewer**：翻转卡片 (space/click) + 前后导航 (arrows) + 进度指示
- **ReportViewer**：左目录 + 右内容，`grid md:grid-cols-[220px_1fr]`
- **TimelineViewer**：纵向时间线，左侧 dot + 竖线，点击展开详情
- 空状态统一使用 `text-sm text-gray-500 dark:text-slate-400`（或 `EmptyHint` 组件）

## Do's and Don'ts

### Do ✅

- **使用统一的层级系统** — 所有浮动元素必须通过 `useLayer()` 获取 z-index，
  不要硬编码 `z-50` 等值
- **Dialog 必须用 Portal** — 所有模态对话框渲染到 `document.body`，避免溢出裁剪
- **使用语义色克制** — 红/绿色仅用于明确的错误/成功状态，不要用于装饰
- **组件优先使用 Tailwind 类** — 保持一致的 spacing/color/topography scale
- **移动端安全区域** — 底部导航使用 `env(safe-area-inset-bottom)`
- **尊重用户运动偏好** — 检测 `prefers-reduced-motion` 并禁用动画
- **系统字体优先** — 不要引入外部自定义字体，使用 system font stack
- **source-locate 用闪烁动画** — 在来源列表中定位时使用 `ux-source-locate-flash`
  动画（1.35s），而不是静态高亮
- **对话/输出中的引用** — 使用 CitationPopover 组件，不要自己实现纯文本引用列表

### Don't ❌

- **不要硬编码 z-index** — 使用 `LAYER_LEVELS` 常量 + `useLayer()` hook
- **不要在 CSS 中使用 magic number 间距** — 所有间距应为 4px 基准的整数倍
- **Dialog 不要嵌套在 overflow: hidden 容器中** — 使用 Portal 到 body
- **不要在浅色模式使用 slate 色系** — 浅色用 gray，深色用 slate（参见 color mapping）
- **不要绕过 `.dark` 覆盖机制** — 深色模式样式优先通过 Tailwind `dark:` 前缀，
  特殊覆盖在 `tailwind.css` 中统一管理
- **不要创建新的 toast 实现** — 使用 `shared/toast.tsx` 的 `toast.success/info/error/warning` API
- **不要重复定义输出查看器模式** — 所有的输出渲染器都应是纯展示组件，
  通过 plugins 注册到 workspace
- **不要给移动端 bottom tab 加阴影** — 使用 `border-t` 分割，保持扁平
- **不要在 WidgetShell 上硬编码圆角** — 使用统一 `rounded-[14px]`，
  不要覆盖 GridStack 的圆角样式
- **不要移除 `prefers-reduced-motion` 处理** — 所有动画必须检查运动偏好
