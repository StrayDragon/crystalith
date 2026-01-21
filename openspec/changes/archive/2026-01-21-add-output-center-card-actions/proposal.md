# 变更：输出中心卡片交互与队列进度

## Why
输出中心卡片动作分散且视觉拥挤，缺少一键复用与统一的排队进度展示，影响效率与一致性。

## What Changes
- 输出中心新增结构化的队列进度卡片，统一展示提炼与结构化输出任务进度。
- 输出历史卡片与结构化输出卡片支持“点击卡片头部重新执行并入队”。
- 卡片右侧动作收敛为“更多(…)”菜单。
- 保持输出中心卡片交互一致性。

## Impact
- 受影响的 specs：workspace-ui
- 受影响的代码：
  - frontend/web/src/features/workspace/components/RefinePanel.tsx
  - frontend/web/src/features/workspace/hooks/useRefine.ts
  - frontend/web/src/features/workspace/WorkspacePage.css
