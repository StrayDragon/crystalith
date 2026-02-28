## ADDED Requirements

### Requirement: Message content can embed a UI envelope without changing /v1 payload shape
系统 MUST 支持在 assistant 消息 `content: string` 中内嵌 UI envelope，以表达结构化 UI 内容；该能力 MUST 不要求引入新的 `/v1` 字段或新的 major 版本。

#### Scenario: List messages returns envelope inside content
- **WHEN** 后端在某条 assistant 消息中启用 UI envelope 且客户端调用 messages 列表端点获取该消息
- **THEN** 响应中的 `content` SHALL 包含 delimiter `[[crystalith-ui:v1]]` 与随后的 JSON envelope
- **AND** `content` 在协议层面仍 SHALL 是普通字符串字段（无额外必需字段）

### Requirement: Embedded UI envelope is backward-compatible at the transport level
当 `content` 内嵌 UI envelope 时：
- `content` MUST 仍为有效 UTF-8 字符串
- delimiter 前的 `fallback_text` MUST 为非空人类可读文本

#### Scenario: Non-UI clients remain functional
- **WHEN** 客户端不识别 UI envelope，仅把 `content` 当作纯文本展示
- **THEN** 用户 SHALL 仍能通过 `fallback_text` 获得可读的最小信息

### Requirement: QA streaming remains stable while enabling UI envelopes
`/qa/stream` MUST 保持 `chunk|done|error` 最小事件集与既有字段语义稳定；UI envelope 的引入 MUST 不改变该最小集合。

#### Scenario: QA stream continues to emit chunk and done
- **WHEN** 客户端使用 `/qa/stream` 发起问答
- **THEN** stream SHALL 按既有契约发送 `chunk` 与 `done`（或 `error`）事件
- **AND** 若后端选择在最终 assistant 消息中内嵌 UI envelope，客户端仍 SHALL 能仅依赖现有事件完成一次问答链路
