## Why
当前工作台 UI 已经固定为 NotebookLM 风格，但 API 响应结构、可用端点与 UI 行为仍存在不一致或未落地的部分，需要明确对齐方案供后续开发。

## What Changes
- 定义 Workspace API 合同（notebooks/sessions/messages/sources/outputs/qa/refine/suggestions）的字段与可选项。
- 统一 citations 的返回形态，避免前端需要分支解析。
- 决定 suggestions 与“搜索/Deep Research”控件的对接方式（接入 API 或在 UI 侧禁用/隐藏）。

## Impact
- 受影响的规范：新增 `workspace-api`
- 受影响的代码：`backend/py/src/crystalith/api`、`frontend/web/src/features/workspace`
