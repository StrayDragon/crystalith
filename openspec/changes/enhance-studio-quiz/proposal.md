## Why

当前测验功能仅生成静态题目列表，缺乏真正的测验体验。用户无法进行计时测试、获得即时反馈，也无法追踪历史成绩和错题。

## What Changes

- **交互式答题界面**：一题一屏，支持选择/输入答案
- **即时反馈**：提交后立即显示对错和解释
- **计时模式**：支持限时测验，显示倒计时
- **错题本**：自动收集错题，支持重做
- **成绩统计**：显示正确率、用时、历史趋势
- **题目打乱**：支持随机打乱题目和选项顺序
- **多种题型**：支持单选、多选、判断、填空、简答
- **分享功能**：生成可分享的测验链接

## Impact

- 受影响的规范：`workspace-ui`, `refine-output`
- 受影响的代码：
  - `frontend/web/src/features/workspace/plugins/allPlugins.tsx`
  - `frontend/web/src/features/workspace/components/StudioOutputViewer.tsx`
  - `backend/py/src/crystalith/outputs/generators/quiz.py`
  - `backend/py/src/crystalith/db/models.py`（新增 QuizAttempt, QuizAnswer 表）
