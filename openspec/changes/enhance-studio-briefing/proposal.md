## Why

当前报告功能仅生成静态章节列表，缺乏专业报告的格式和交互能力。用户无法生成带目录的长报告、添加图表，也无法进行协作编辑和版本管理。

## What Changes

- **专业报告模板**：提供多种报告模板（研究报告、商业计划、技术文档等）
- **自动目录生成**：基于标题层级自动生成可点击目录
- **图表支持**：支持插入数据图表（柱状图、饼图、折线图）
- **引用管理**：自动生成参考文献列表，支持多种引用格式
- **协作批注**：支持添加评论和建议修改
- **版本历史**：追踪报告的修改历史
- **导出格式**：支持导出为 Word、PDF、LaTeX

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - `backend/py/src/crystalith/outputs/generators/briefing.py`
  - `backend/py/src/crystalith/db/models.py`（新增 ReportVersion, ReportComment 表）
