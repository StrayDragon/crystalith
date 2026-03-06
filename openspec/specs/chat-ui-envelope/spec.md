# chat-ui-envelope Specification

## Purpose

记录 legacy `[[crystalith-ui:v1]]` transport 已被移除。Crystalith 现在使用 server-authoritative 的 session `shared_state.ui` + Rivu mounts 表达对话内 UI，而不再把 UI 元数据嵌入 assistant `content`。

## Non-goals

- 不再定义新的 envelope 语法或 delimiter
- 不再要求客户端解析 assistant `content` 中的 UI JSON
- 不再通过 feature flag 控制该 legacy transport 的启用/关闭

## Requirements

### Requirement: Legacy envelope is never emitted at runtime
系统 MUST NOT 在 QA 响应、SSE 事件、消息持久化结果或导出正文中生成 `[[crystalith-ui:v1]]` delimiter 或随后的 envelope JSON。

#### Scenario: QA and messages stay plain text
- **WHEN** 后端生成一条 assistant 回答并持久化到 session message
- **THEN** `message.content` SHALL 仅包含纯文本/markdown 回答
- **AND** 任何结构化 UI SHALL 通过 session `shared_state.ui` 提供

### Requirement: Frontend does not parse legacy envelope markers
Chat 前端 MUST NOT 继续解析 assistant `content` 中的 legacy envelope marker；UI mounts MUST 仅由 Rivu kernel 根据 `shared_state.ui` 渲染。

#### Scenario: Refresh ignores legacy parsing path
- **WHEN** 用户刷新页面并重新加载会话
- **THEN** 前端 SHALL 通过 `/ui/state` 恢复 mounts
- **AND** SHALL 不再扫描 `message.content` 中的 delimiter
