# studio-collapsible-tools Specification

## Purpose

本能力点在早期用于描述“Studio 工具区折叠/展开”。当前实现已演进为 **Studio 生成工具 Popover**（从底部“生成”按钮打开），不再存在常驻可折叠的工具区。

本规范保留为“当前实现的工具 Popover 行为约束”，以避免 UI 漂移；Studio 更完整的契约见 `workspace-studio-ui/spec.md`。

## Related specs

- `workspace-studio-ui/spec.md`
- `workspace-ux-system/spec.md`（layer/z-index、modal/keyboard 等）

## Requirements

### Requirement: Tools popover trigger and dismissal
Studio MUST 提供“生成”入口用于打开工具选择 Popover；Popover MUST 支持显式关闭与点击外部关闭。
用户点击 Studio 底部“生成”按钮时 MUST 打开工具选择 Popover（展示工具网格或 loading/error 状态）；Popover 打开后点击外部或点击关闭按钮 MUST 关闭。

### Requirement: Popover is rendered outside overflow containers
工具 Popover SHOULD 使用 Portal 渲染到 `document.body`（或等效层），以避免被 widget/panel 的 overflow 裁切。
Studio widget 位于可滚动/overflow hidden 容器内时，Popover SHOULD 仍完整可见且不被裁切。
