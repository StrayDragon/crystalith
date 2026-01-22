## Why

视频概述是音频概述的扩展，可以生成带有视觉元素的内容摘要视频。类似 T10，先预留 API 接口为后续实现做准备。

## What Changes

- 定义视频概述 API 接口（OpenAPI Schema）
- 前端 UI 入口（禁用状态，显示"即将推出"）
- 后端返回 501 Not Implemented

## Impact

- 受影响的规范：`video-overview`（已存在于归档规范中）
- 受影响的代码：
  - 新增 `backend/py/src/crystalith/api/video.py`
  - 更新 `frontend/web/src/features/workspace/components/VideoOverviewOption.tsx`（如存在）
- 依赖关系：依赖 T09（输出复制/导出）提供基础导出能力
