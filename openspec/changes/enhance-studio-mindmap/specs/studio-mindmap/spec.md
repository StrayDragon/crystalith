## ADDED Requirements

### Requirement: 可编辑思维导图

系统 **MUST** 支持直接编辑思维导图节点。

#### Scenario: 编辑节点文本

- **WHEN** 用户双击节点
- **THEN** 节点进入编辑模式
- **AND** 用户可修改节点文本

#### Scenario: 添加子节点

- **WHEN** 用户选中节点并按 Tab 键
- **THEN** 在该节点下创建新的子节点
- **AND** 新节点自动进入编辑模式

#### Scenario: 删除节点

- **WHEN** 用户选中节点并按 Delete 键
- **THEN** 删除该节点及其所有子节点
- **AND** 显示确认对话框（如有子节点）

### Requirement: 拖拽重组

系统 **MUST** 支持通过拖拽重新组织节点结构。

#### Scenario: 拖拽移动节点

- **WHEN** 用户拖拽节点到另一个节点上
- **THEN** 被拖拽节点成为目标节点的子节点
- **AND** 显示放置预览指示

#### Scenario: 拖拽调整顺序

- **WHEN** 用户拖拽节点到同级节点之间
- **THEN** 节点顺序重新排列

### Requirement: 节点样式自定义

系统 **MUST** 支持自定义节点的视觉样式。

#### Scenario: 修改节点颜色

- **WHEN** 用户右键节点选择颜色
- **THEN** 节点背景色更新为所选颜色

#### Scenario: 添加节点图标

- **WHEN** 用户为节点添加图标
- **THEN** 图标显示在节点文本旁

### Requirement: 多种布局模式

系统 **MUST** 支持多种思维导图布局。

#### Scenario: 切换布局

- **WHEN** 用户选择布局模式
- **THEN** 思维导图以新布局重新排列
- **AND** 支持树形/放射状/组织架构布局

#### Scenario: 布局动画

- **WHEN** 切换布局
- **THEN** 节点平滑过渡到新位置

### Requirement: 演示模式

系统 **MUST** 支持思维导图的演示模式。

#### Scenario: 进入演示模式

- **WHEN** 用户点击演示按钮
- **THEN** 进入全屏演示视图
- **AND** 仅显示根节点

#### Scenario: 逐级展开

- **WHEN** 用户按右箭头或点击下一步
- **THEN** 展开下一级节点
- **AND** 展开时有动画效果

### Requirement: 思维导图导出

系统 **MUST** 支持将思维导图导出为多种格式。

#### Scenario: 导出为图片

- **WHEN** 用户选择导出为图片
- **THEN** 生成 PNG 或 SVG 格式的图片

#### Scenario: 导出为 XMind

- **WHEN** 用户选择导出为 XMind
- **THEN** 生成 .xmind 格式文件
