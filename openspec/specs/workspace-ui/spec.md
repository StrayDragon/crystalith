# Workspace UI

## Purpose

定义 Crystalith 前端工作区界面的布局、交互和样式要求，包括三栏布局、响应式设计、Sources/Chat/Studio 面板组成以及 Tailwind CSS 驱动的样式系统。
## Requirements
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

### Requirement: Studio panel with collapsible tools
Studio 面板 MUST 保持为单一模块，内部包含可收纳的工具区和输出/笔记列表区。

#### Scenario: Studio 工具和笔记一体化
- **WHEN** Studio 模块在画布中可见
- **THEN** 工具区和输出/笔记列表 MUST 在同一 widget 内显示
- **AND** 工具区支持折叠/展开

#### Scenario: 所有 Studio 功能可达
- **WHEN** Studio 模块可见
- **THEN** 以下功能 MUST 完整可达：工具选择、参数配置、生成触发、队列状态、输出查看/导出/删除、笔记编辑、转为来源

#### Scenario: Studio panel layout
- **WHEN** the Studio panel is visible
- **THEN** tool tiles render in a grid above the notes list and the add-note button

### Requirement: Studio tool grid responsiveness
The Studio tool grid **MUST** render square tiles that adapt to available width and keep icon/label sizing readable.

#### Scenario: Narrow Studio panel
- **WHEN** the Studio panel width is reduced
- **THEN** tool tiles wrap to fewer columns and labels remain readable without clipping

### Requirement: Generic Output Renderer

The frontend MUST provide a `GenericOutputRenderer` component that renders output content based on a `RenderDescriptor` returned by the backend. The renderer MUST support the following layout types:

- `list` — ordered/unordered list of items
- `cards` — card grid layout
- `tree` — hierarchical tree structure
- `timeline` — chronological event timeline
- `sections` — titled sections with content
- `table` — tabular data

Each layout MUST render fields according to the `FieldDescriptor` definitions, supporting field types: `text`, `heading`, `badge`, `list`, `tree`, `date`, `citation`, `code`.

#### Scenario: Plugin output with render_descriptor
- **WHEN** an output has a type not registered in the frontend `pluginRegistry`
- **AND** the backend provides a `render_descriptor` for that output type
- **THEN** `OutputContent` MUST use `GenericOutputRenderer` to render the content
- **AND** the rendered output SHALL follow the layout and field structure defined in the descriptor

#### Scenario: No plugin and no render_descriptor
- **WHEN** an output has a type not registered in the frontend `pluginRegistry`
- **AND** no `render_descriptor` is available
- **THEN** `OutputContent` MUST fall back to rendering raw JSON

#### Scenario: Built-in output type with dedicated plugin
- **WHEN** an output has a type registered in the frontend `pluginRegistry` (e.g., FAQ, GUIDE)
- **THEN** `OutputContent` MUST use the dedicated plugin's `render` function
- **AND** the `GenericOutputRenderer` SHALL NOT be used

#### Scenario: Invalid or unsupported layout type
- **WHEN** a `render_descriptor` contains an unrecognized `layout` value
- **THEN** `GenericOutputRenderer` MUST fall back to rendering raw JSON
- **AND** the component SHALL log a warning to the console

#### Scenario: Nested FieldDescriptor rendering
- **WHEN** a `FieldDescriptor` contains `children` field descriptors
- **THEN** `GenericOutputRenderer` MUST recursively render the nested fields
- **AND** the nesting depth SHALL be limited to prevent infinite recursion

### Requirement: Render Descriptor API Contract

The backend MUST expose `render_descriptor` and `config_schema` information for output types provided by plugins. The frontend MUST handle the presence or absence of these fields gracefully.

The `render_descriptor` MUST conform to the following structure:
- `layout: string` — one of `list`, `cards`, `tree`, `timeline`, `sections`, `table`
- `item_schema: object | null` — describes the fields of each item in the layout
  - `fields: FieldDescriptor[]` — array of field descriptors
- `options: object` — layout-specific options

Each `FieldDescriptor` MUST contain:
- `key: string` — the JSON field name in the output content
- `type: string` — one of `text`, `heading`, `badge`, `list`, `tree`, `date`, `citation`, `code`
- `label: string | null` — optional display label
- `children: FieldDescriptor[]` — optional nested field descriptors

The `config_schema` MUST conform to:
- `quantity_options: ConfigOption[]` — quantity presets
- `difficulty_options: ConfigOption[]` — difficulty presets
- `topic_placeholder: string` — placeholder text
- `supports_topic: boolean` — topic customization support

#### Scenario: Backend returns render_descriptor for plugin output type
- **WHEN** a plugin registers an output type with a `render_descriptor`
- **THEN** the `GET /v1/workspace/tools` endpoint MUST include the `render_descriptor` in the tool's response
- **AND** the descriptor MUST be a valid `RenderDescriptor` object

#### Scenario: Plugin without render_descriptor
- **WHEN** a plugin registers an output type without a `render_descriptor`
- **THEN** the `GET /v1/workspace/tools` endpoint MUST return `null` for the `render_descriptor` field
- **AND** the frontend SHALL fall back to raw JSON rendering for that output type

#### Scenario: Frontend backward compatibility
- **WHEN** the backend has not been updated to include `render_descriptor` in the tools response
- **THEN** the frontend MUST treat the missing field as `null`
- **AND** existing functionality SHALL NOT be affected

### Requirement: Render Descriptor Data Flow

The frontend MUST cache `render_descriptor` data from the workspace tools API and make it available to the `OutputContent` component.

#### Scenario: Render descriptor cached from tools API
- **WHEN** the frontend fetches workspace tools via `GET /v1/workspace/tools`
- **THEN** `normalizeTool()` MUST extract `render_descriptor` from each tool
- **AND** the render descriptors MUST be stored in a lookup map (outputType → renderDescriptor) accessible by `OutputContent`

#### Scenario: OutputContent resolves render_descriptor
- **WHEN** `OutputContent` receives an output with a type not in `pluginRegistry`
- **THEN** it MUST look up the `render_descriptor` from the cached tools data
- **AND** pass it to `GenericOutputRenderer` if available

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

### Requirement: Source Multi-select UI
SourcesPanel SHALL 支持多选操作。用户 MUST 能通过 Ctrl+Click 选择单个、Shift+Click 范围选择、全选/取消全选。选中状态下 SHALL 显示批量操作栏。

#### Scenario: Ctrl+Click 多选
- **WHEN** 用户按住 Ctrl 点击多个 source
- **THEN** 被点击的 source 切换选中状态，显示已选数量和批量操作按钮

#### Scenario: 批量操作栏
- **WHEN** 有 source 被选中
- **THEN** 面板顶部显示批量操作栏（删除、标签、re-embed），显示已选数量

### Requirement: Source List Sorting
Source 列表 SHALL 支持多维度排序（名称、创建日期、大小、类型）。

#### Scenario: 按日期排序
- **WHEN** 用户选择 "按日期排序"
- **THEN** source 列表按创建日期降序排列

### Requirement: Theme System
工作区 SHALL 支持主题系统，包含浅色、深色和跟随系统三种模式。主题偏好 MUST 持久化到 localStorage。切换主题时 MUST 无页面闪烁。

#### Scenario: 切换到深色模式
- **WHEN** 用户在 WorkspaceHeader 中选择 "深色模式"
- **THEN** 所有组件切换为深色配色，偏好保存到 localStorage

#### Scenario: 跟随系统模式
- **WHEN** 用户选择 "跟随系统" 且操作系统切换到深色模式
- **THEN** 工作区自动切换为深色配色

#### Scenario: 刷新后保持主题
- **WHEN** 用户设置深色模式后刷新页面
- **THEN** 页面直接以深色模式加载，无浅色→深色的闪烁

### Requirement: Keyboard Shortcut System
工作区 SHALL 提供全局键盘快捷键系统。快捷键 MUST 在输入框获得焦点时自动禁用（避免冲突）。系统 SHALL 提供快捷键帮助面板。

#### Scenario: 全局搜索快捷键
- **WHEN** 用户按下 Ctrl+K（焦点不在输入框）
- **THEN** 打开搜索/命令面板

#### Scenario: 输入框焦点时忽略全局快捷键
- **WHEN** 用户在消息输入框中按下 Ctrl+K
- **THEN** 不触发全局搜索，Ctrl+K 被输入框正常处理

#### Scenario: 快捷键帮助面板
- **WHEN** 用户按下 Ctrl+?
- **THEN** 显示所有可用快捷键的分类列表

### Requirement: Panel Navigation Shortcuts
用户 SHALL 能通过键盘快捷键在面板间导航。

#### Scenario: 面板切换
- **WHEN** 用户按下 Ctrl+1
- **THEN** 焦点切换到左侧面板（Sources）

### Requirement: Output Export System
所有输出类型 SHALL 支持至少 Markdown 格式的导出。特定输出类型 SHALL 支持额外格式：Slides → PPTX，Quiz/Flashcard → JSON，Briefing → PDF。

#### Scenario: 导出为 Markdown
- **WHEN** 用户点击输出查看器的 "导出" 按钮并选择 "Markdown"
- **THEN** 浏览器下载包含输出内容的 .md 文件

#### Scenario: 导出 Slides 为 PPTX
- **WHEN** 用户在 Slides 查看器中选择 "导出为 PPTX"
- **THEN** 浏览器下载包含所有幻灯片的 .pptx 文件

#### Scenario: 导出格式限制
- **WHEN** 用户查看 Timeline 输出并点击 "导出"
- **THEN** 仅显示该输出类型支持的导出格式（Markdown）

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

### Requirement: 拖拽上传文件
Sources 面板 MUST 支持拖拽文件上传，提供视觉反馈。

#### Scenario: 拖拽文件到 Sources 面板
- **WHEN** 用户将文件拖拽到 Sources 面板区域
- **THEN** 面板显示高亮边框和"拖放文件到此处"提示
- **AND** 用户释放文件后触发上传流程

#### Scenario: 拖拽非支持格式文件
- **WHEN** 用户拖拽不支持的文件格式
- **THEN** 面板显示提示说明支持的格式
- **AND** 不触发上传

### Requirement: AI 操作取消
系统 MUST 支持取消进行中的 AI 生成操作（QA 流式回答、Studio 输出生成）。

#### Scenario: 取消流式 QA
- **WHEN** AI 正在生成流式回答
- **AND** 用户点击"停止生成"按钮
- **THEN** 系统中断 LLM 生成流
- **AND** 已接收的部分内容正常显示
- **AND** 输入框恢复可用状态

#### Scenario: 取消 Studio 输出生成
- **WHEN** Studio 输出正在生成队列中处理
- **AND** 用户点击取消按钮
- **THEN** 任务状态变为"已取消"
- **AND** 不在输出列表中添加不完整的结果

### Requirement: Modal 焦点陷阱
系统 MUST 在所有 Modal 对话框中实现焦点陷阱，Tab 键循环在 Modal 内部元素之间。

#### Scenario: Tab 键焦点循环
- **WHEN** Modal 对话框打开
- **AND** 用户按 Tab 键
- **THEN** 焦点在 Modal 内的可交互元素之间循环
- **AND** 焦点不逃逸到 Modal 外的背景内容

#### Scenario: ESC 关闭 Modal
- **WHEN** Modal 对话框打开
- **AND** 用户按 ESC 键
- **THEN** Modal 关闭
- **AND** 焦点返回到触发 Modal 的元素

### Requirement: 空状态操作引导
系统 MUST 在内容为空时提供清晰的操作引导，帮助新用户理解使用流程。

#### Scenario: 无来源时引导
- **WHEN** notebook 无来源
- **THEN** Sources 面板显示引导卡片提示添加文档

#### Scenario: 有来源但无会话时引导
- **WHEN** notebook 有来源但无会话消息
- **THEN** Chat 面板显示提示选择来源后提问

#### Scenario: Studio 无输出时引导
- **WHEN** notebook 无 Studio 输出
- **THEN** Studio 面板显示引导流程：选择来源 → 点击工具卡片

### Requirement: 统一 Toast 通知样式
系统 MUST 统一所有操作反馈的 Toast 样式、颜色和显示时长。

#### Scenario: 操作成功 Toast
- **WHEN** 用户操作成功
- **THEN** 显示绿色 Toast 通知
- **AND** 3 秒后自动关闭

#### Scenario: 操作失败 Toast
- **WHEN** 用户操作失败
- **THEN** 显示红色 Toast 通知
- **AND** 5 秒后自动关闭
- **AND** 用户可手动关闭

### Requirement: Workspace Template System
系统 SHALL 支持工作区模板，允许用户保存 notebook 配置为模板并从模板创建新 notebook。系统 MUST 提供内置模板（论文研究、项目文档、知识收集）。

#### Scenario: 从模板创建 notebook
- **WHEN** 用户在新建 notebook 时选择 "论文研究" 模板
- **THEN** 新 notebook 按模板预配置好 session 结构和输出类型偏好

#### Scenario: 保存为模板
- **WHEN** 用户在 notebook 菜单中选择 "保存为模板" 并填写名称
- **THEN** 当前 notebook 的配置被保存为自定义模板，出现在模板列表中

#### Scenario: 模板管理
- **WHEN** 用户打开模板管理页面
- **THEN** 显示所有模板（内置 + 自定义），支持删除自定义模板
