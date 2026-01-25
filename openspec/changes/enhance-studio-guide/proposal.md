## Why

当前指南功能仅生成静态模块列表，缺乏交互式学习路径和进度追踪。用户无法按步骤学习、标记完成状态，也无法获得个性化的学习建议。

## What Changes

- **交互式学习路径**：将指南转化为可勾选的步骤清单
- **进度追踪**：记录用户在每个模块的完成状态
- **预估时间**：为每个模块显示预估学习时间
- **依赖关系**：支持模块间的前置依赖，锁定未解锁内容
- **检查点测验**：在关键节点插入小测验验证理解
- **书签与笔记**：允许用户在任意位置添加个人笔记
- **打印友好视图**：提供可打印的清单格式

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - `backend/py/src/crystalith/outputs/generators/guide.py`
  - `backend/py/src/crystalith/db/models.py`（新增 GuideProgress 表）
