## Why
当前工作台 UI 仍包含大量占位交互，后端 API 也与前端真实需求存在偏差。需要明确 v1 文本型能力、删除无用端点，并让 Studio 卡片、搜索/Deep Research、建议问题等交互可真实跑通。

## What Changes
- 定义 v1 Workspace API 合同：Notebook/Sessions/Messages/Sources/QA/Refine/Outputs/Suggestions，并明确字段与返回结构。
- 增加 Studio 工具卡片配置接口（文本型输出），前端根据配置渲染卡片与输出类型。
- 为文本型输出提供按类型的生成接口，内部使用基础 prompt 的实现方案。
- 将 Sources 搜索/Deep Research 从占位改为可调用的简化对话实现（标记 TODO 供后续替换）。
- 移除音频/视频等非文本能力相关端点与前端占位入口。

## Impact
- 受影响的规范：新增 `workspace-api`
- 受影响的代码：`backend/py/src/crystalith/api`、`backend/py/src/crystalith/suggestions`、`frontend/web/src/features/workspace`
