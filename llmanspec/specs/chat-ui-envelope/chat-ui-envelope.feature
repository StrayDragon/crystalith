# language: zh-CN
# capability: chat-ui-envelope
# purpose: 对话内 UI 的当前态约束：UI 元数据由 server-authoritative 的 session `sharedState.ui` 承载，assistant `content` 保持纯文本/markdown；legacy envelope transport 已移除且 MUST NOT 回归。
# scope: src/, tests/

功能: chat-ui-envelope

  @req:r26 @human
  场景: Legacy envelope is never emitted at runtime
    - 系统 MUST NOT 在 QA 响应、SSE 事件、消息持久化结果或导出正文中生成 `[[crystalith-ui:v1]]` delimiter 或随后的 envelope JSON。

  @req:r84 @human
  场景: Frontend does not parse legacy envelope markers
    - Chat 前端 MUST NOT 解析 assistant `content` 中的 legacy envelope marker；UI mounts MUST 仅依据 session `sharedState.ui`（服务端权威）由前端渲染层恢复。

  @req:r26 @human
  场景: qa-and-messages-stay-plain-text
    - 必须成立：当 后端生成一条 assistant 回答并持久化到 session message；那么 `message.content` SHALL 仅包含纯文本/markdown 回答
    当 后端生成一条 assistant 回答并持久化到 session message
    那么 `message.content` SHALL 仅包含纯文本/markdown 回答

  @req:r84 @human
  场景: refresh-ignores-legacy-parsing-path
    - 必须成立：当 用户刷新页面并重新加载会话；那么 前端 SHALL 通过 `/ui/state` 恢复 mounts
    当 用户刷新页面并重新加载会话
    那么 前端 SHALL 通过 `/ui/state` 恢复 mounts
