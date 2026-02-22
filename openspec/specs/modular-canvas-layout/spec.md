# modular-canvas-layout Specification

## Purpose

定义 Crystalith 前端工作区的模块化画布布局系统，基于 GridStack.js 提供自由拖拽、缩放的 widget 排列能力，包括锁定/编辑模式、模块目录和命令面板。

## Related specs

- `GLOSSARY.md`
- `workspace-ui/spec.md`
- `workspace-ux-system/spec.md`

## Requirements

### Requirement: GridStack 模块化自由布局
工作区 MUST 使用 GridStack.js 提供 12 列网格的模块化自由布局，每个功能面板作为独立 widget 可拖拽、缩放、重新定位。

最小行为：

- 编辑模式下拖拽 widget MUST 网格对齐，且其他 widget 自动调整避免重叠
- 缩放 widget 时 MUST 对齐到网格，且内容自适应新尺寸
- 首次进入工作区默认布局 MUST 为：来源 | 对话 | Studio，且对话区获得最大宽度比例

### Requirement: 锁定/编辑模式
系统 MUST 支持布局锁定/编辑模式切换。锁定状态下 widget 不可拖拽和缩放，防止误操作。

锁定模式下所有 widget MUST 固定位置且不可拖拽/缩放，并提供明显视觉指示；编辑模式下 MUST 恢复可拖拽/缩放，并显示边框/手柄等编辑 affordance。

### Requirement: 模块目录
系统 MUST 提供模块目录，展示可添加到工作区的 widget 列表。

用户从模块目录选择 widget 时 MUST 将其添加到画布并自动放置在合理位置；从画布移除 widget 时 MUST 使其消失，其余 widget MAY 自动调整布局。

### Requirement: ⌘K 命令面板
系统 MUST 提供命令面板（⌘K 触发），支持搜索和执行操作：添加/移除模块、切换锁定模式等。

用户按下 ⌘K/Ctrl+K 时命令面板 MUST 打开并支持模糊搜索；选择命令后 MUST 立即执行并自动关闭。
