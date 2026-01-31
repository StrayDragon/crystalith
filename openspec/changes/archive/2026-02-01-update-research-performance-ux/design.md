## Context
深度研究详情面板需要在会话切换时保持一致性，同时“思考过程”可能累积大量条目，导致一次性渲染出现主线程负载。此前性能 traces 显示交互响应良好，但长列表仍可能触发峰值开销。

## Goals / Non-Goals
- Goals:
  - 保证点击研究条目时展示与所选会话一致的详情
  - 明确 SSE 订阅的生命周期，避免无效重连与资源占用
  - 让“思考过程”在长历史下仍保持可交互与渐进渲染
- Non-Goals:
  - 不引入新的后端分页协议或数据库变更
  - 不要求后端新增分页或游标 API

## Decisions
- Decision: 研究详情仅在 `fetchSession` 成功后打开
  - Reason: 避免使用旧的 `activeSession` 造成错会话闪现
- Decision: SSE 仅对活动状态（planning/searching/analyzing/waiting_user）订阅，完成/取消即释放
  - Reason: 降低冗余连接与无效重连带来的噪声与资源占用
- Decision: 思考时间轴采用“窗口 + 渐进展开”策略，并显示展开进度
  - Reason: 在不增加新依赖的前提下减少一次性渲染带来的长任务
- Decision: 当思考条目超过 500 时，“显示全部”需要用户确认；默认最多展示最近 500 条
  - Reason: 防止误触触发超长 DOM 渲染
- Decision: 当思考条目超过 300 时启用更激进的渲染策略（虚拟列表或等效窗口化），确保 DOM 规模受控
  - Reason: 尽可能降低主线程压力并保持滚动流畅
- Decision: SSE 断线/重连状态以思考列表内系统提示呈现
  - Reason: 在不增加永久占位 UI 的前提下提高可见性

## Alternatives Considered
- 引入虚拟列表库（react-window/react-virtual）
  - 优点：彻底控制 DOM 数量
  - 缺点：引入依赖与复杂度，需额外适配折叠/滚动逻辑
- 后端分页思考步骤
  - 优点：数据层面减少前端压力
  - 缺点：需要 API 变更与缓存策略，超出本次范围

## Risks / Trade-offs
- 渐进展开仍可能在“显示全部”下积累大量 DOM
  - Mitigation: 500 条确认 + 超过 300 条时启用虚拟/窗口化策略
- requestIdleCallback 在部分环境不可用
  - Mitigation: 预留 setTimeout 作为降级策略

## Migration Plan
1. 前端更新研究详情打开逻辑与 SSE 生命周期
2. 增量渲染思考时间轴并增加进度提示
3. 通过 DevTools trace 验证交互时延与布局稳定性

## Open Questions
- None (resolved: 500 条确认阈值、300 条虚拟/窗口化门槛、SSE 内联提示方式)
