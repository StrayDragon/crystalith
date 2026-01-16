# 变更：输出中心 Studio 布局与统一列表

## Why
输出中心当前以多张卡片展开呈现，视觉噪音较高，且与目标的 Studio 工具区 + 扁平历史列表样式不一致，降低可用性与一致性。

## What Changes
- 输出中心顶部提供 Studio 工具区，以网格方式呈现结构化输出工具。
- 输出历史区统一为扁平列表，结构化输出与提炼输出采用同一行式布局与交互。
- 队列进度以列表化卡片/行式展示，融入输出中心整体视觉语言。

## Impact
- 受影响的 specs：workspace-ui
- 受影响的代码：
  - frontend/web/src/features/workspace/components/RefinePanel.tsx
  - frontend/web/src/features/workspace/WorkspacePage.css
