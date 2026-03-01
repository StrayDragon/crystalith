# workspace-ui-panels Specification

## Purpose

定义 Workspace 业务面板（Sources/Chat/Studio/Analysis/Research 与引用交互）的最小 UI 契约：面板装配、流式反馈、状态与取消语义、错误可恢复路径。该规范聚焦“用户可观察行为与稳定边界”，不绑定具体组件实现。

## Non-goals

- 不定义后端检索/生成/分析算法
- 不定义视觉风格与动画细节

## Requirements

### Requirement: Panel composition is stable
Workspace MUST 以稳定的面板集合装配 Sources/Chat/Studio/Analysis/Research 等能力，并保持各面板的基本区域划分与入口可发现。

#### Scenario: Panels are consistently discoverable
- **WHEN** 用户进入 Workspace 并切换面板
- **THEN** 系统 SHALL 以一致的方式展示面板入口与基本区域，不因刷新或重连丢失

### Requirement: Streaming UX supports send/chunk/done/error and cancel
涉及流式输出的面板（如 Chat/Research）MUST 显式呈现 send/chunk/done/error 状态，并 MUST 支持用户取消以停止继续追加内容。

#### Scenario: Cancel stops streaming
- **WHEN** 用户在流式生成过程中点击取消
- **THEN** 系统 SHALL 停止继续追加 chunk，并展示取消后的可恢复状态（如可重试）

### Requirement: Chat input supports /prompt directives as user-facing commands
Workspace 的 Chat 面板 MUST 允许用户在输入框中使用 `/prompt:<preset> <query>` 指令来请求受控的预设生成模式。

#### Scenario: User can send a /prompt message
- **WHEN** 用户在 Chat 输入框中输入以 `/prompt:` 开头的内容并发送
- **THEN** UI SHALL 将该文本作为一次消息发送（不应在前端预过滤为“非法输入”）

### Requirement: Chat panel renders UI envelopes embedded in assistant messages
Chat 面板 MUST 能识别 assistant `content` 中的 delimiter `[[crystalith-ui:v1]]` 并解析其 JSON envelope；解析成功后 MUST 按 `parts[]` 渲染结构化 UI（text/component/tool_use/tool_result）。

#### Scenario: Render a registered component from an envelope
- **WHEN** assistant 消息包含有效的 UI envelope，且其中 `component.name` 已在前端 registry 注册
- **THEN** Chat 面板 SHALL 渲染对应组件并展示其 props 表达的内容
- **AND** 消息的 `fallback_text` SHALL 不作为主要正文重复展示（仅用于解析失败回退）

#### Scenario: Envelope parse failure falls back to fallback_text
- **WHEN** assistant 消息包含 delimiter 但 JSON 解析失败、`schema` 不匹配或超过资源上限
- **THEN** Chat 面板 SHALL 展示 `fallback_text`
- **AND** UI SHALL 保持可用且不影响其它消息渲染

#### Scenario: Unknown component falls back safely
- **WHEN** envelope 中出现未注册的 `component.name` 或 props 校验失败
- **THEN** Chat 面板 SHALL 使用安全回退渲染（例如 JSON 摘要）
- **AND** 同一消息中的其它 parts SHALL 继续渲染

### Requirement: Streaming UX integrates with streaming-updatable components
当一次对话响应以流式方式生成时，Chat 面板 MUST 支持将增量内容反映到 `streaming: true` 的 component props 中，并保持取消语义一致。

#### Scenario: Streaming updates component props
- **WHEN** 用户发起一次流式问答且 UI 采用 component 表达回答
- **THEN** Chat 面板 SHALL 在收到增量 chunk 时更新组件 props 并触发重渲染
- **AND** 用户 SHALL 能观察到回答逐步增长

#### Scenario: Cancel stops streaming updates
- **WHEN** 用户在流式生成过程中点击取消
- **THEN** Chat 面板 SHALL 停止继续追加增量内容并进入可恢复状态（如可重试）

### Requirement: Tool/action cards enforce confirmation and auto-exec whitelist
当消息包含 `tool_use` parts 时，Chat 面板 MUST：
- 仅对宿主白名单内且标记为 `auto_execute=true` 的动作执行自动执行
- 对需要确认或非白名单动作提供显式确认入口
- 对每次执行展示对应 `tool_result` 的结果与错误恢复路径（如允许重试）

#### Scenario: Auto-exec runs only for whitelisted tools
- **WHEN** tool_use 标记为 `auto_execute=true` 但 `name` 不在白名单
- **THEN** Chat 面板 SHALL 不自动执行
- **AND** SHALL 要求用户显式确认后才可执行

### Requirement: Sources workflows are gated and explicit
Sources 相关操作 MUST 对“未选择来源/来源未就绪/来源失败”等情况进行显式 gating，并 MUST 提供可理解的提示与可恢复路径。

#### Scenario: Generation is disabled without ready sources
- **WHEN** 用户未选择任何 `ready` 来源或当前来源未就绪
- **THEN** 系统 SHALL 禁用依赖来源的生成入口并给出明确提示

### Requirement: Ingestion feedback is queue-based and deterministic
上传/抓取/搜索等 ingest 操作 MUST 以队列项呈现并可并发显示状态，且每个队列项 MUST 有确定的终态（done/error/cancelled）与重试入口。

#### Scenario: Parallel ingestion items do not overwrite
- **WHEN** 用户连续发起多次搜索或导入操作
- **THEN** 系统 SHALL 为每次操作创建独立队列项并分别展示进度与结果

### Requirement: Sources upload file type support is consistent and includes PDF
Workspace 的 Sources 上传入口 MUST 支持后端核心发行版的常见内置解析格式，且前端 `accept`、预过滤与提示文案 MUST 保持一致。
该支持集 SHALL 至少包含：`.txt/.md/.markdown` 与 `.pdf`（`application/pdf`），以及 `.csv`（`text/csv`）。

#### Scenario: Uploading a PDF is accepted by the UI
- **WHEN** 用户在 Sources 面板通过“选择文件”或“拖拽”方式上传 `.pdf`
- **THEN** UI SHALL 接受该文件并进入上传队列
- **AND** 不应出现“文件类型不支持”的过滤提示

#### Scenario: Uploading a CSV is accepted by the UI
- **WHEN** 用户在 Sources 面板通过“选择文件”或“拖拽”方式上传 `.csv`
- **THEN** UI SHALL 接受该文件并进入上传队列
- **AND** 不应出现“文件类型不支持”的过滤提示

#### Scenario: Unsupported formats are rejected with clear feedback
- **WHEN** 用户上传一个明确不支持的格式（如 `.docx`）
- **THEN** UI SHALL 拒绝该文件
- **AND** 提供清晰、与支持集一致的提示信息

### Requirement: Analysis view is bounded and refreshable
Analysis 面板 MUST 提供可刷新与全屏查看的交互，并 MUST 对渲染规模做有界处理以避免 UI 失控或崩溃。

#### Scenario: Large analysis output is bounded
- **WHEN** 分析结果包含超大 topics/relations 列表
- **THEN** 系统 SHALL 以截断/分页/限量等方式保持 UI 可用

### Requirement: Studio queue, rendering fallback, and export gating are explicit
Studio MUST 明确展示生成队列状态并支持取消；渲染 MUST 定义确定的回退顺序；导出选项 MUST 仅显示当前输出类型支持项。

#### Scenario: Rendering falls back deterministically
- **WHEN** 专用渲染器不可用或渲染失败
- **THEN** 系统 SHALL 按既定顺序回退到通用渲染或原始 JSON，且不展示不支持的导出格式
