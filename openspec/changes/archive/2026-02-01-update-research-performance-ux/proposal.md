## Why
当前深度研究在会话切换与长列表展示上仍存在体验风险：点击研究条目时可能短暂显示旧会话内容，且“思考过程”在超长历史下展开会产生主线程负担。需要明确会话选择一致性、SSE 连接生命周期与思考时间轴的渐进渲染策略，并补充超长列表的阈值保护与连接状态提示，以保证响应性与稳定性。

## What Changes
- 新增 `research-ui` 规范增量，定义研究详情的会话选择一致性与错误处理
- 明确 SSE 仅在活动状态订阅并在完成/取消时释放连接
- 定义思考时间轴的默认窗口、加载更多与“显示全部”渐进展开行为，避免长任务阻塞
- 当条目超过阈值时要求确认并启用更激进的渲染策略（虚拟/窗口化）
- 以列表内系统提示呈现 SSE 断线/重连状态

## Impact
- 受影响规范：新增 `research-ui`
- 受影响代码：
  - `frontend/web/src/features/workspace/domains/sources/SourcesPanel.tsx`
  - `frontend/web/src/features/workspace/domains/research/useResearch.ts`
  - `frontend/web/src/features/workspace/domains/research/ResearchDetailPanel.tsx`
