# modular-canvas-layout Specification

## Purpose

定义 Crystalith 前端工作区的模块化画布布局系统，基于 GridStack.js 提供自由拖拽、缩放的 widget 排列能力，包括锁定/编辑模式、模块目录和命令面板。

## Requirements

### Requirement: GridStack 模块化自由布局
工作区 MUST 使用 GridStack.js 提供 12 列网格的模块化自由布局，每个功能面板作为独立 widget 可拖拽、缩放、重新定位。

#### Scenario: Widget 拖拽定位
- **WHEN** 用户在编辑模式下拖拽一个 widget
- **THEN** widget MUST 移动到目标位置并自动网格对齐
- **AND** 其他 widget 自动调整位置避免重叠

#### Scenario: Widget 缩放
- **WHEN** 用户拖拽 widget 的缩放手柄
- **THEN** widget MUST 调整大小并对齐到网格
- **AND** 内容 MUST 自适应新尺寸

#### Scenario: 默认三栏布局
- **WHEN** 用户首次进入工作区
- **THEN** 默认布局 MUST 为：来源 | 对话 | Studio
- **AND** 对话区获得最大宽度比例

### Requirement: 锁定/编辑模式
系统 MUST 支持布局锁定/编辑模式切换。锁定状态下 widget 不可拖拽和缩放，防止误操作。

#### Scenario: 锁定布局
- **WHEN** 用户切换到锁定模式
- **THEN** 所有 widget MUST 固定位置，不可拖拽和缩放
- **AND** 锁定状态有明显视觉指示

#### Scenario: 解锁编辑
- **WHEN** 用户切换到编辑模式
- **THEN** 所有 widget MUST 恢复可拖拽和缩放
- **AND** widget 边框/手柄变为可见

### Requirement: 模块目录
系统 MUST 提供模块目录，展示可添加到工作区的 widget 列表。

#### Scenario: 添加模块
- **WHEN** 用户从模块目录选择一个 widget
- **THEN** 该 widget MUST 添加到工作区画布
- **AND** 自动放置在合理位置

#### Scenario: 移除模块
- **WHEN** 用户从画布移除一个 widget
- **THEN** 该 widget MUST 从画布消失
- **AND** 其余 widget 可选择性自动调整布局

### Requirement: ⌘K 命令面板
系统 MUST 提供命令面板（⌘K 触发），支持搜索和执行操作：添加/移除模块、切换锁定模式等。

#### Scenario: 打开命令面板
- **WHEN** 用户按下 ⌘K（或 Ctrl+K）
- **THEN** 命令面板 MUST 出现，显示可执行的命令列表
- **AND** 支持模糊搜索过滤

#### Scenario: 执行命令
- **WHEN** 用户在命令面板中选择一个命令
- **THEN** 命令 MUST 立即执行
- **AND** 命令面板自动关闭
