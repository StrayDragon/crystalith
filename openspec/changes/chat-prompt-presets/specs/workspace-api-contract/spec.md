## ADDED Requirements

### Requirement: QA endpoints accept in-band prompt directives in question
QA 端点 MUST 支持在 `question: string` 中内嵌 `/prompt:<preset> <query>` 指令，并在启用 presets 功能时以该指令选择受控的预设生成策略。

#### Scenario: QA non-stream respects /prompt directive
- **WHEN** 客户端调用 `/v1/notebooks/{notebook_id}/qa` 且 `question` 以 `/prompt:` 开头
- **THEN** 系统 SHALL 在不改变 `/v1` payload 字段形状的前提下解析指令并选择对应 preset

#### Scenario: QA stream respects /prompt directive
- **WHEN** 客户端调用 `/v1/notebooks/{notebook_id}/qa/stream` 且 `question` 以 `/prompt:` 开头
- **THEN** 系统 SHALL 解析指令并在 stream 中保持 `chunk|done|error` 的最小事件集语义稳定

### Requirement: Assistant message content can embed a UI envelope without changing /v1 payload shape
当系统需要持久化结构化 UI 内容时，assistant 消息 `content` MUST 仍为普通字符串字段；UI 元数据 MUST 以内嵌方式存在（delimiter + JSON），而不要求新增 `/v1` 字段。

#### Scenario: Messages list returns embedded envelope in content
- **WHEN** 某条 assistant 消息启用了 UI envelope
- **THEN** messages 列表端点响应中的 `content` SHALL 包含 delimiter `[[crystalith-ui:v1]]` 与随后的 JSON envelope
- **AND** `content` 在传输层面仍 SHALL 是 UTF-8 字符串（无额外必填字段）

## MODIFIED Requirements

### Requirement: Exports can include citations
系统 MUST 支持将 QA/Outputs 导出为包含 citations 的格式（Markdown/JSON 或等价），以便分享与复盘。
当被导出的 assistant `content` 内嵌 UI envelope 时，导出正文 MUST 使用 delimiter 前的 `fallback_text`，且 MUST 不包含 delimiter 与 JSON 元数据。

#### Scenario: Export includes citation list
- **WHEN** 用户导出 QA 或某个 Output
- **THEN** 导出结果 SHALL 包含引用清单与可定位信息（source_id 或可解析来源标识）
- **AND** 导出正文 SHALL 不包含 `[[crystalith-ui:v1]]` delimiter 与随后的 JSON 元数据（如存在）
