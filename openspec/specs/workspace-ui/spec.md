# Workspace UI

## Purpose

定义 Crystalith 前端工作区界面的布局、交互和样式要求，包括三栏布局、响应式设计、Sources/Chat/Studio 面板组成以及 Tailwind CSS 驱动的样式系统。
## Requirements
### Requirement: Workspace layout and navigation
The system **MUST** present a NotebookLM-style three-panel workspace on desktop with draggable side panels, and a stacked single-column layout on smaller screens without tabs.

#### Scenario: Desktop layout
- **WHEN** the viewport is at or above the desktop breakpoint
- **THEN** Sources, Chat, and Studio panels are visible side-by-side with independent scrolling regions

#### Scenario: Resizing side panels
- **WHEN** the user drags a side-panel resize handle
- **THEN** the corresponding panel width updates within defined bounds and the chat panel remains usable

#### Scenario: Mobile layout
- **WHEN** the viewport is below the desktop breakpoint
- **THEN** panels stack vertically and resize handles are hidden or disabled

### Requirement: NotebookLM-style top bar
The system **MUST** show a compact top bar with a document title on the left and action controls on the right.

#### Scenario: Rendering the top bar
- **WHEN** the workspace loads
- **THEN** the title and action controls are visible and aligned to match the reference layout

### Requirement: Sources panel composition
The Sources panel **MUST** include an add-source CTA, a Deep Research callout, a search row with engine + mode selectors, and a selectable source list.

#### Scenario: Sources panel layout
- **WHEN** the Sources panel is visible
- **THEN** the CTA, callout, search controls, and source list appear in the defined order

### Requirement: Chat panel composition
The Chat panel **MUST** include a conversation area, a lightweight action row, and a bottom input composer with a send affordance.

#### Scenario: Chat panel layout
- **WHEN** the Chat panel is visible
- **THEN** messages render in the conversation area, the action row appears below the content, and the composer sits at the bottom

### Requirement: Studio panel composition
The Studio panel **MUST** provide a tool grid (with optional Beta badges), a notes list with metadata, and a persistent add-note button.

#### Scenario: Studio panel layout
- **WHEN** the Studio panel is visible
- **THEN** tool tiles render in a grid above the notes list and the add-note button

### Requirement: Studio tool grid responsiveness
The Studio tool grid **MUST** render square tiles that adapt to available width and keep icon/label sizing readable.

#### Scenario: Narrow Studio panel
- **WHEN** the Studio panel width is reduced
- **THEN** tool tiles wrap to fewer columns and labels remain readable without clipping

### Requirement: Tailwind-driven styling
The system **MUST** use Tailwind CSS for workspace styling to keep the visual system consistent and maintainable.

#### Scenario: Workspace renders with Tailwind styles
- **WHEN** the workspace page loads
- **THEN** the header, panels, buttons, and forms render with Tailwind-based styles

### Requirement: Motion and accessibility
The system **MUST** avoid distracting continuous animations and respect reduced motion preferences.

#### Scenario: Reduced motion preference
- **WHEN** the user has `prefers-reduced-motion` enabled
- **THEN** decorative animations are disabled

### Requirement: 搜索结果胶囊队列

来源面板 **MUST** 以胶囊队列形式展示搜索结果，支持多选和批量添加到来源，并支持多个搜索请求的队列化处理。

#### Scenario: 搜索结果展示为胶囊卡片

- **WHEN** 用户执行搜索并返回结果
- **THEN** 系统在来源面板显示搜索结果队列
- **AND** 每个结果显示为带复选框的胶囊卡片
- **AND** 卡片包含标题、摘要、来源引擎和 URL

#### Scenario: 多选搜索结果

- **WHEN** 用户点击搜索结果的复选框
- **THEN** 该结果被选中并显示选中状态
- **AND** 底部显示已选数量和操作按钮
- **AND** 用户可选择"保存链接"或"获取内容"

#### Scenario: 批量添加到来源

- **WHEN** 用户选择多个搜索结果并点击添加按钮
- **THEN** 系统显示添加进度对话框
- **AND** 逐个处理选中的结果
- **AND** 完成后刷新来源列表

#### Scenario: 添加来源后保持搜索队列可见

- **WHEN** 用户从搜索结果添加来源完成后
- **THEN** 搜索结果队列保持可见
- **AND** 仅移除已成功添加的结果项
- **AND** 用户可继续从剩余结果中添加更多来源

#### Scenario: 搜索队列化处理

- **WHEN** 用户点击搜索按钮发起搜索
- **THEN** 系统立即创建一个 loading 状态的搜索队列项
- **AND** 搜索按钮不被禁用
- **AND** 用户可继续输入新查询并发起新搜索

#### Scenario: 多个搜索请求并行处理

- **WHEN** 用户在前一个搜索未完成时发起新搜索
- **THEN** 新搜索作为独立队列项添加到队列中
- **AND** 每个队列项独立显示其 loading/loaded/error 状态
- **AND** 搜索完成后队列项更新为实际结果

#### Scenario: 单独清除搜索队列项

- **WHEN** 用户点击某个搜索队列项的关闭按钮
- **THEN** 仅该队列项被移除
- **AND** 其他队列项保持不变

### Requirement: 从 URL 添加来源

系统 **MUST** 支持从 URL 创建来源，提供链接模式和获取模式两种方式。

#### Scenario: 链接模式添加来源

- **WHEN** 用户选择"保存链接"模式添加 URL
- **THEN** 系统仅保存 URL、标题和摘要作为轻量来源
- **AND** 不下载网页内容

#### Scenario: 获取模式添加来源

- **WHEN** 用户选择"获取内容"模式添加 URL
- **THEN** 系统下载网页内容并使用 HTML 解析器解析
- **AND** 创建完整的来源记录和分块
