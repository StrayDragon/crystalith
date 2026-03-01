## ADDED Requirements

### Requirement: Chat input supports /prompt directives as user-facing commands
Workspace 的 Chat 面板 MUST 允许用户在输入框中使用 `/prompt:<preset> <query>` 指令来请求受控的预设生成模式。

#### Scenario: User can send a /prompt message
- **WHEN** 用户在 Chat 输入框中输入以 `/prompt:` 开头的内容并发送
- **THEN** UI SHALL 将该文本作为一次消息发送（不应在前端预过滤为“非法输入”）

### Requirement: Chat panel renders embedded UI envelopes with deterministic fallback
Chat 面板 MUST 能识别 assistant `content` 中的 delimiter `[[crystalith-ui:v1]]` 并解析其 JSON envelope；解析成功后 MUST 按 `parts[]` 渲染结构化内容；解析失败/超限时 MUST 稳定回退为 `fallback_text`。

#### Scenario: Envelope parse failure falls back
- **WHEN** assistant 消息包含 delimiter 但 JSON 解析失败或超过资源上限
- **THEN** Chat 面板 SHALL 仅展示 delimiter 前的 `fallback_text`
- **AND** UI SHALL 保持可用且不影响其它消息渲染

### Requirement: Component parts are rendered via a safe registry with schema validation
当 envelope `parts[]` 中包含 `type="component"` 时，Chat 面板 MUST 通过受控 registry 渲染组件，并对 props 做 schema 校验；校验失败或未知组件 MUST 走安全回退渲染。

#### Scenario: Unknown component falls back safely
- **WHEN** `component.name` 未在 registry 中注册或 props 校验失败
- **THEN** Chat 面板 SHALL 渲染回退视图（含最小诊断信息 name/id）
- **AND** 同一消息中的其它 parts SHALL 继续渲染

## MODIFIED Requirements

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
