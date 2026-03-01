## ADDED Requirements

### Requirement: Chat panel renders UI envelopes embedded in assistant messages
Chat 面板 MUST 能识别 assistant `content` 中的 delimiter `[[crystalith-ui:v1]]` 并解析其 JSON envelope；解析成功后 MUST 按 `parts[]` 渲染结构化 UI（text/component/tool_use/tool_result）。

#### Scenario: Render a registered component from an envelope
- **WHEN** assistant 消息包含有效的 UI envelope，且其中 `component.name` 已在前端 registry 注册
- **THEN** Chat 面板 SHALL 渲染对应组件并展示其 props 表达的内容
- **AND** 消息的 `fallback_text` SHALL 不作为主要正文重复展示（仅用于解析失败回退）

#### Scenario: Envelope parse failure falls back to fallback_text
- **WHEN** assistant 消息包含 delimiter 但 JSON 解析失败或 `schema` 不匹配
- **THEN** Chat 面板 SHALL 展示 `fallback_text`
- **AND** UI SHALL 保持可用且不影响其它消息渲染

#### Scenario: Unknown component falls back safely
- **WHEN** envelope 中出现未注册的 `component.name`
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
