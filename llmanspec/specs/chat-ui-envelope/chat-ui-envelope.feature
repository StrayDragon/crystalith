# language: zh-CN
# capability: chat-ui-envelope
# purpose: 对话内 UI 的当前态约束：UI 元数据由 server-authoritative 的 session `sharedState.ui` 承载，assistant `content` 保持纯文本/markdown；legacy envelope transport 已移除且 MUST NOT 回归。

功能: chat-ui-envelope

  @req:r28
  规则: Legacy envelope is never emitted at runtime
    系统 MUST NOT 在 QA 响应、SSE 事件、消息持久化结果或导出正文中生成 `[[crystalith-ui:v1]]` delimiter 或随后的 envelope JSON；assistant `message.content` SHALL 仅包含纯文本/markdown 回答。本条为 assistant content 纯文本约束的 canonical 条目。

    场景: runtime-emits-no-legacy-envelope
      假如 服务端源码树可被静态扫描
      当 检索 QA 响应、SSE 事件、消息持久化与导出路径
      那么 零处生成 `[[crystalith-ui:v1]]` delimiter 或 envelope JSON
  @req:r29
  规则: Frontend does not parse legacy envelope markers
    Chat 前端 MUST NOT 解析 assistant `content` 中的 legacy envelope marker；UI mounts MUST 仅依据 session `sharedState.ui`（服务端权威）由前端渲染层恢复——包括页面刷新重新加载会话时经 session 资源拉取恢复。本条为前端不解析 envelope 禁令的 canonical 条目。

    场景: frontend-parses-no-legacy-envelope
      假如 前端源码树可被静态扫描
      当 检索 assistant content 的 envelope marker 解析逻辑
      那么 零处解析 `[[crystalith-ui:v1]]` marker
      而且 UI 恢复仅依据 session sharedState.ui
