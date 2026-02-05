## Why

当前生成的输出内容（FAQ、Guide、Timeline、Mindmap 等）仅能在应用内查看，缺少导出能力。用户需要将生成的内容分享给团队、嵌入文档或离线使用。本提案在 notplan-changes/add-output-export 基础上扩展，覆盖所有输出类型的多格式导出。

> 注：本提案替代 notplan-changes/add-output-export，提供更完整的导出方案。

## What Changes

- 所有输出类型支持导出为 Markdown 格式
- 报告/Briefing 类输出支持导出为 PDF
- Slides 输出支持导出为 PPTX
- Quiz/Flashcard 输出支持导出为 JSON（可导入其他学习工具）
- 统一的导出按钮和格式选择 UI

## Impact

- 受影响的规范：`workspace-ui`（MODIFIED）
- 受影响的系统：
  - 前端输出查看器（添加导出按钮）
  - 后端输出 API（可选的服务端渲染导出）
  - 前端文件下载逻辑
