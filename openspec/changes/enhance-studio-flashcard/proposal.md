## Why

当前闪卡（FAQ）功能仅生成静态问答列表，缺乏交互式学习体验。用户无法进行间隔重复学习、追踪掌握程度，也无法翻转卡片进行自测。这限制了闪卡作为学习工具的有效性。

## What Changes

- **交互式翻转卡片**：支持点击翻转，正面显示问题，背面显示答案
- **间隔重复系统（SRS）**：基于 SM-2 算法实现间隔重复，追踪每张卡片的复习间隔
- **掌握度评分**：用户可标记"不熟悉/模糊/掌握"来调整复习频率
- **学习模式**：提供"学习"和"测试"两种模式
- **进度统计**：显示已掌握/待复习/新卡片数量
- **批量导出**：支持导出为 Anki 格式（.apkg）

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - `backend/py/src/crystalith/outputs/generators/faq.py`
  - `backend/py/src/crystalith/db/models.py`（新增 FlashcardProgress 表）
