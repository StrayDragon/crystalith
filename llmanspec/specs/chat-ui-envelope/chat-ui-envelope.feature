# language: zh-CN
# capability: chat-ui-envelope
# purpose: 对话内 UI 的当前态约束：UI 元数据由 server-authoritative 的 session `sharedState.ui` 承载，assistant `content` 保持纯文本/markdown；legacy envelope transport 已移除且 MUST NOT 回归。
# scope: apps/server/src/features/sessions/, apps/server/src/features/messages/

功能: chat-ui-envelope

  @req:r26 @human
  场景: Legacy envelope is never emitted at runtime
    - 系统 MUST NOT 在 QA 响应、SSE 事件、消息持久化结果或导出正文中生成 `[[crystalith-ui:v1]]` delimiter 或随后的 envelope JSON；assistant `message.content` SHALL 仅包含纯文本/markdown 回答。本条为 assistant content 纯文本约束的 canonical 条目。

  @req:r84 @human
  场景: Frontend does not parse legacy envelope markers
    - Chat 前端 MUST NOT 解析 assistant `content` 中的 legacy envelope marker；UI mounts MUST 仅依据 session `sharedState.ui`（服务端权威）由前端渲染层恢复——包括页面刷新重新加载会话时经 `/ui/state` 拉取恢复。本条为前端不解析 envelope 禁令的 canonical 条目。
