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

### Requirement: 来源详情对话框

系统必须（SHALL）提供来源详情对话框，展示来源的完整信息并支持交互操作。

#### Scenario: 显示来源摘要

- **WHEN** 用户打开来源详情对话框
- **THEN** 系统调用 `/sources/{id}/summary` API
- **AND** 展示来源摘要内容
- **AND** 摘要加载时显示加载状态

#### Scenario: 显示关键词标签

- **WHEN** 来源详情加载完成
- **THEN** 显示来源关键词作为可点击标签
- **AND** 点击标签可触发相关搜索

#### Scenario: 显示统计信息

- **WHEN** 来源详情加载完成
- **THEN** 显示字数统计
- **AND** 显示页数（如适用）
- **AND** 显示上传时间

#### Scenario: 在来源内提问

- **WHEN** 用户在来源详情中输入问题
- **AND** 点击发送
- **THEN** 系统仅使用当前来源作为上下文进行问答
- **AND** 答案展示在详情面板内

#### Scenario: 对话框内弹出菜单层级

- **WHEN** 用户在来源详情对话框内点击下拉菜单
- **THEN** 菜单使用 `dropdown` 层级
- **AND** 菜单显示在对话框内容之上但不超出对话框边界

### Requirement: 批量添加搜索结果到来源

系统 **MUST** 支持批量添加搜索结果到来源，并正确处理多层对话框的显示层级。

#### Scenario: 批量添加到来源

- **WHEN** 用户选择多个搜索结果并点击添加按钮
- **THEN** 系统显示添加进度对话框
- **AND** 逐个处理选中的结果
- **AND** 完成后刷新来源列表

#### Scenario: 从全屏模式触发添加

- **WHEN** 用户在全屏搜索结果对话框中点击添加按钮
- **THEN** 系统先关闭全屏对话框
- **AND** 显示添加进度对话框
- **AND** 进度对话框显示在最上层，不被其他元素遮挡

#### Scenario: 添加进度对话框层级

- **WHEN** 添加进度对话框打开
- **THEN** 对话框使用 `modal` 层级
- **AND** 对话框内的下拉菜单使用 `dropdown` 层级并正确显示在对话框之上
- **AND** Toast 通知使用 `toast` 层级并显示在所有对话框之上

### Requirement: 知识图谱视图

来源面板 **MUST** 提供一个按钮打开全屏知识图谱视图，使用 ReactFlow 展示来源之间的关联关系。

#### Scenario: 打开知识图谱

- **WHEN** 用户点击来源面板头部的图谱按钮
- **THEN** 系统显示全屏覆盖的知识图谱视图
- **AND** 自动触发跨文档分析（如尚未分析）

#### Scenario: 图谱节点展示

- **WHEN** 知识图谱视图打开且分析完成
- **THEN** 每个来源显示为一个可拖拽的节点
- **AND** 节点颜色根据主题聚类分配
- **AND** 存在矛盾的节点显示红色警告标记

#### Scenario: 图谱边展示

- **WHEN** 来源之间存在关联关系
- **THEN** 关联以连线形式显示
- **AND** 线条粗细和透明度反映关联强度
- **AND** 矛盾关系使用红色动画线条

#### Scenario: 图谱交互

- **WHEN** 用户在图谱视图中交互
- **THEN** 可以通过拖拽移动节点位置
- **AND** 可以通过滚轮缩放画布
- **AND** 可以通过拖拽平移画布
- **AND** 点击节点可选中并高亮

#### Scenario: 图谱统计面板

- **WHEN** 知识图谱视图显示
- **THEN** 顶部显示来源数、主题数、关联数、矛盾数
- **AND** 左下角显示图例说明
- **AND** 提供刷新和关闭按钮

### Requirement: 全局知识图谱视图

工作区 **MUST** 提供一个全屏知识图谱视图，展示来源、产出、对话之间的关联关系。

#### Scenario: 打开知识图谱

- **WHEN** 用户点击顶部导航栏的图谱按钮
- **THEN** 系统显示全屏覆盖的知识图谱视图
- **AND** 自动触发跨文档分析（如尚未分析）

#### Scenario: 多类型节点展示

- **WHEN** 知识图谱视图打开且分析完成
- **THEN** 来源显示为蓝色节点（按主题着色）
- **AND** 产出显示为紫色节点
- **AND** 对话显示为绿色节点
- **AND** 每个节点带有类型图标标识

#### Scenario: 关联边展示

- **WHEN** 节点之间存在关联关系
- **THEN** 来源之间的语义关联以实线显示
- **AND** 产出/对话对来源的引用以虚线显示
- **AND** 矛盾关系以红色动画线显示

#### Scenario: 按类型筛选

- **WHEN** 用户点击顶部的类型切换按钮
- **THEN** 可以显示/隐藏对应类型的节点
- **AND** 相关的边也同步显示/隐藏

#### Scenario: 节点详情预览

- **WHEN** 用户点击图谱中的节点
- **THEN** 节点被选中高亮
- **AND** 右侧显示详情预览面板
- **AND** 图谱保持打开状态

#### Scenario: 打开详情跳转

- **WHEN** 用户在详情预览面板中点击"打开详情"按钮
- **THEN** 图谱关闭
- **AND** 打开对应内容的详情视图（来源详情/产出查看器/对话）

### Requirement: 统一层级管理系统

系统 **MUST** 提供统一的 z-index 层级管理机制，确保弹窗、通知、提示等层叠元素按预期顺序显示。

#### Scenario: 层级常量定义

- **WHEN** 开发者需要为组件设置 z-index
- **THEN** 系统提供语义化层级常量（base、dropdown、popover、modal、toast、tooltip）
- **AND** 层级值按固定优先级排序：base < dropdown < popover < modal < toast < tooltip

#### Scenario: 声明式层级 API

- **WHEN** 开发者在组件中使用 `useLayer` hook
- **THEN** 可通过传入层级名称获取对应的 z-index 值
- **AND** 无需手动管理具体的数字值

#### Scenario: 动态层级 slot

- **WHEN** 同一层级存在多个元素（如多个 Toast）
- **THEN** 开发者可传入 slot 参数区分优先级
- **AND** 后出现的元素自动获得更高的 z-index

### Requirement: 后端不可用错误状态
系统 **MUST** 在后端不可用时给出明确错误提示，并停止依赖后端的交互流程，不得回退到 demo 数据。

#### Scenario: 初始加载失败
- **WHEN** 工作区初始化请求无法连接后端或返回不可用错误
- **THEN** 页面展示明确的错误提示与重试入口
- **AND** 不渲染 demo 数据或伪造内容

#### Scenario: 生成流程被阻止
- **WHEN** 后端不可用且用户触发生成或保存操作
- **THEN** 系统阻止操作并提示当前不可用
- **AND** 不进入生成队列或半完成状态

### Requirement: 来源选择作为最小范围
系统 MUST 以“来源”为最小选择单元限定对话与 Studio 输出范围，不展示引用（chunk）级的选择控件。

#### Scenario: 来源范围选择
- **WHEN** 用户在 Sources 面板进行范围选择
- **THEN** 仅显示来源级复选框
- **AND** 不出现引用列表或引用多选控件

### Requirement: Studio 输出需至少选择来源
系统 MUST 在用户未选择任何来源时禁用 Studio 输出触发，并提示需要先选择来源。

#### Scenario: 禁用空来源输出
- **WHEN** 用户未选中任何来源
- **THEN** Studio 输出入口为不可用状态
- **AND** 提示用户需先选择来源

### Requirement: 来源索引状态可见
系统 MUST 在来源列表中明确展示每个来源的 embedding/索引状态。

#### Scenario: 展示索引状态
- **WHEN** 来源列表渲染
- **THEN** 每个来源项显示“已索引 / 处理中 / 失败”等状态标识
- **AND** 非已索引状态可附带提示说明

### Requirement: 非就绪来源不可选
系统 MUST 禁用“处理中/失败”的来源选择，并提供明确的不可用提示。

#### Scenario: 禁用未完成来源
- **WHEN** 来源状态为处理中或失败
- **THEN** 该来源复选框为不可用状态
- **AND** 悬停显示“未完成索引，暂不可用”的提示

### Requirement: 失败来源可重嵌入
系统 MUST 在来源状态为失败时提供重嵌入入口，允许用户触发重新索引。

#### Scenario: 触发重嵌入
- **WHEN** 用户点击失败来源的“重新嵌入”入口
- **THEN** 系统向后端发起重试索引请求
- **AND** 来源状态切换为处理中

### Requirement: Error Boundary Protection
前端 SHALL 在全局和各领域面板级别设置 ErrorBoundary。当子组件发生未捕获异常时，ErrorBoundary MUST 显示友好的错误提示并提供"重试"操作。

#### Scenario: 面板组件崩溃恢复
- **WHEN** ChatPanel 内部发生 JavaScript 异常
- **THEN** 仅 ChatPanel 区域显示错误提示和重试按钮，其他面板不受影响

### Requirement: Operation Retry UI
前端 SHALL 对关键操作（消息发送、输出生成、source 上传）在失败时提供 retry 按钮。

#### Scenario: 消息发送失败重试
- **WHEN** 消息发送因网络错误失败
- **THEN** 消息气泡显示发送失败状态和"重新发送"按钮，点击后重新发送
