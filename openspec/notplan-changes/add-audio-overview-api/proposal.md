## Why

音频概述是 NotebookLM 的标志性功能之一，可以将来源内容转化为播客风格的音频对话。虽然完整实现较为复杂，但先预留 API 接口可以为后续实现做好准备。

## What Changes

- 定义音频概述 API 接口（OpenAPI Schema）
- 前端 UI 入口（禁用状态，显示"即将推出"）
- 后端返回 501 Not Implemented

## Impact

- 受影响的规范：`audio-overview`（已存在于归档规范中）
- 受影响的代码：
  - 新增 `backend/py/src/crystalith/api/audio.py`
  - 更新 `frontend/web/src/features/workspace/components/AudioOverviewOption.tsx`（如存在）
- 依赖关系：依赖 T09（输出复制/导出）提供基础导出能力
