## MODIFIED Requirements

### Requirement: Workspace layout system
工作区布局 MUST 从固定三栏改为 GridStack 模块化自由布局。所有功能面板（来源、对话、Studio 等）作为独立 widget 存在于可自由编排的画布中。

#### Scenario: 模块化布局渲染
- **WHEN** 工作区以模块化布局模式渲染
- **THEN** 所有已添加的 widget MUST 按用户配置的位置和大小渲染
- **AND** widget 内容 MUST 自适应容器尺寸

#### Scenario: 功能完整性
- **WHEN** 工作区从固定布局迁移到模块化布局
- **THEN** 所有原有功能（来源管理、对话、Studio 工具、研究、图谱等）MUST 完整可达
- **AND** 无功能退化

### Requirement: Studio panel with collapsible tools
Studio 面板 MUST 保持为单一模块，内部包含可收纳的工具区和输出/笔记列表区。

#### Scenario: Studio 工具和笔记一体化
- **WHEN** Studio 模块在画布中可见
- **THEN** 工具区和输出/笔记列表 MUST 在同一 widget 内显示
- **AND** 工具区支持折叠/展开

#### Scenario: 所有 Studio 功能可达
- **WHEN** Studio 模块可见
- **THEN** 以下功能 MUST 完整可达：工具选择、参数配置、生成触发、队列状态、输出查看/导出/删除、笔记编辑、转为来源
