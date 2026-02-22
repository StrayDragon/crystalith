# research-ui Specification

## Purpose

定义 Deep Research 的前端体验与性能约束：研究会话详情的一致性、SSE 连接生命周期与可见提示、以及长思考列表的渐进渲染/窗口化策略，确保深度研究在大历史下仍可用。

## Related specs

- `GLOSSARY.md`
- `workspace-ui/spec.md`
- `workspace-api/spec.md`
- `search-engine/spec.md`
- `backend-performance/spec.md`

## Requirements
### Requirement: 研究详情会话一致性
系统 MUST 在打开研究详情前获取所选研究会话详情，并确保详情内容与所选会话一致（不显示上一次会话的残留内容）。

获取研究会话详情失败时，系统 MUST 提示错误且 MUST NOT 打开详情面板。

### Requirement: SSE 连接生命周期
系统 MUST 仅在研究会话处于活动状态时维持 SSE 连接（planning/searching/analyzing/waiting_user），并在 completed/cancelled 后释放连接并停止重连。

### Requirement: SSE 连接状态提示
系统 MUST 在 SSE 连接中断、重连、与放弃重连时提供可见提示：

- 进入重连流程时在思考列表插入状态提示（包含延迟/原因信息）
- 连接恢复时插入“连接已恢复”提示
- 重连次数用尽时插入“连接失败，请刷新页面重试”等提示

系统 MUST 对 SSE 事件列表做长度上限（例如 500）以避免长会话导致内存增长。

### Requirement: 思考过程渐进渲染
系统 **MUST** 以渐进方式渲染思考过程，避免长历史导致主线程阻塞。

最小性能护栏：

- 默认仅展示最近一段记录，并显示“已隐藏条目数”与“加载更多”入口
- 用户选择“显示全部”时 MUST 分批渲染历史条目并展示展开进度，交互保持可用
- 思考条目总数超过 500 且用户选择“显示全部”时 MUST 提示确认，且默认仅展示最近 500 条
- 思考条目总数超过 300 时 MUST 启用虚拟列表/窗口化，DOM 中的思考条目数量不超过 300
