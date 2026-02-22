# workspace-ux-system Specification

## Purpose

定义 Workspace 的跨域 UX “底盘”（shared primitives）：主题切换、键盘快捷键策略、层级（z-index）与 Portal 规则、Modal 可访问性、统一 toast/骨架屏/错误态，以及长列表与重组件的性能策略。

本规范用于减少 `workspace-*` specs 的重复描述：各域 spec 只需要引用这些“通用约束”，而不必重复说明实现细节（`useTheme/useKeyboardShortcuts/useLayer/toast/ErrorBoundary` 等）。

## Related specs

- `GLOSSARY.md`
- `workspace-ui/spec.md`（Workspace 组成与入口）
- `modular-canvas-layout/spec.md`（画布布局与 ⌘K）
- `workspace-api/spec.md`（错误 envelope 与关键端点）

## Requirements

### Requirement: Styling and theming
- Workspace MUST 使用 Tailwind CSS（含 dark mode class）作为主要样式手段，并保持跨面板视觉一致。
- 系统 SHALL 支持 `light|dark|system` 三种主题模式，并持久化到 localStorage（key: `crystalith_theme`）。
- **WHEN** 模式为 `system` 且 OS 主题变化 **THEN** UI 自动切换解析后的主题（light/dark）。

### Requirement: Keyboard shortcuts and help
- 系统 SHALL 提供全局快捷键，并在输入控件聚焦时避免抢占（除非明确允许）。
- 系统 SHOULD 提供快捷键帮助面板（显示快捷键列表与分组说明）。

### Requirement: Layering and portal overlays
系统 MUST 提供语义化的层级常量与 hook，用于 Dropdown/Popover/Modal/Toast/Tooltip 等叠层元素的稳定显示顺序：

- 层级名称与顺序 MUST 至少包含：`base < dropdown < popover < modal < toast < tooltip`
- **WHEN** 组件使用 `useLayer(layerName, slot?)` **THEN** 返回的 `style.zIndex` 与 `className` 可直接用于渲染（同层级内支持 slot 递增堆叠）
- overlay（Popover/Tooltip/Modal/Toast 等）MUST 通过 Portal（通常渲染到 `document.body`）避免被 widget 的 overflow 裁切

### Requirement: Modal accessibility
- 所有 Modal MUST 实现焦点陷阱（Tab/Shift+Tab 不逃逸到背景）。
- Modal MUST 支持 ESC 关闭（除非业务明确禁止），并在关闭后将焦点返回到触发元素。

### Requirement: Unified feedback and offline guardrails
- 系统 MUST 提供统一 toast（success/error/info/warn）；默认时长：success=3s，error=5s。
- 当后端不可用（连接不是 live）时，UI MUST 阻止依赖后端的关键流程（上传/搜索/生成等）并给出明确提示；不得回退到 demo 数据。
- 前端 SHOULD 使用 ErrorBoundary 隔离单面板崩溃，并提供友好错误与重试入口。
- 系统 MUST 使用统一骨架屏组件表达 loading 状态，并在 dark mode 下可读。

### Requirement: Performance and motion
- 长列表 MUST 使用虚拟化/窗口化（消息/来源/输出等），避免大量 DOM 节点导致卡顿。
- 非首屏必需的重组件 SHOULD 懒加载/代码分割（如知识图谱视图、Slides 配置/预览等）。
- 系统 MUST 尊重 `prefers-reduced-motion`，避免持续性装饰动画；必要动画应可降级为更短或瞬时。
