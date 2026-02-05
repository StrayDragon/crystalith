## ADDED Requirements

### Requirement: 列表虚拟化渲染
系统 MUST 对消息列表、来源列表和输出列表使用虚拟化渲染，仅挂载可见区域的 DOM 节点。

#### Scenario: 大量消息的流畅滚动
- **WHEN** 会话包含 100+ 条消息
- **THEN** 页面仅渲染可见区域的消息 DOM 节点
- **AND** 滚动时帧率保持 >30fps
- **AND** 新消息到达时自动滚动到底部

#### Scenario: 大量来源的流畅滚动
- **WHEN** notebook 包含 50+ 个来源
- **THEN** 来源列表仅渲染可见区域的 DOM 节点
- **AND** 多选、状态标识等交互功能正常

### Requirement: 重组件懒加载
系统 MUST 对非首屏必需的重组件使用代码分割和懒加载，减少首屏 bundle 大小。

#### Scenario: 知识图谱按需加载
- **WHEN** 用户未打开知识图谱视图
- **THEN** KnowledgeGraphView 的代码不在首屏 bundle 中
- **AND** 用户首次打开时显示加载骨架屏，代码加载完成后渲染

#### Scenario: Slides Studio 按需加载
- **WHEN** 用户未打开 Slides Studio
- **THEN** SlidesStudioDialog 的代码不在首屏 bundle 中

### Requirement: 统一骨架屏加载状态
系统 MUST 使用统一的骨架屏组件展示各面板的加载状态，保持视觉一致性。

#### Scenario: 面板加载统一样式
- **WHEN** 任一面板处于数据加载中
- **THEN** 显示与内容布局匹配的骨架屏动画
- **AND** 所有面板的骨架屏风格一致（颜色、动画速度、形状）
