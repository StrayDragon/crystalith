## Why

当前 Crystalith 的核心功能已具备，但多处交互细节影响使用体验：文件上传仅支持按钮点击而无拖拽；长时间 AI 生成操作无法取消；进度指示缺少详细信息（百分比/已处理数）；Modal 对话框缺少焦点陷阱导致无障碍体验差；面板切换和内容加载缺少平滑过渡；新用户缺少空状态引导。这些细节的打磨可以显著提升日常使用的流畅感和满意度。

## What Changes

- Sources 面板支持拖拽上传文件（drag-and-drop）
- AI 生成操作（QA、Studio output、Refine）支持取消
- 进度指示改进：显示已处理/总数、成功/失败计数
- Modal 对话框添加焦点陷阱（focus trap）
- 面板切换和数据加载添加过渡动画
- 空状态引导优化：新 notebook 引导添加 source → 提问的流程提示
- 操作反馈统一：成功/失败 Toast 样式和时机一致化

## Impact

- 受影响的规范：`workspace-ui`（MODIFIED）
- 受影响的系统：
  - 前端 SourcesPanel — 拖拽上传
  - 前端 ChatPanel — QA 取消
  - 前端 StudioPanel — 输出生成取消
  - 前端 shared — 焦点陷阱 hook、过渡动画
  - 后端 QA/Output API — 取消信号支持
