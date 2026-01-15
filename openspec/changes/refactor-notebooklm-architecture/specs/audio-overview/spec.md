## ADDED Requirements

> **背景**：音频概述（Audio Overview）是 NotebookLM 的明星功能，贡献了 90% 的用户使用时长。
> 它不是简单的文本朗读，而是生成两个 AI 主持人（一男一女）针对用户文档进行的"深度播客对话"。
> 这种形式特别适合通勤、健身等多任务场景，用户可以随时随地通过听觉获取知识。
> NotebookLM 的音频概述支持 80 种以上语言，音频生成量在推出多语言支持后两周内翻倍。
>
> **实现状态**：本阶段仅定义接口和数据模型，暂不实现具体功能。后端返回 501 Not Implemented，前端显示"即将推出"状态。

### Requirement: 音频概述 API 接口定义
系统必须定义音频概述的 API 接口，为后续实现预留扩展点。

#### Scenario: API 接口定义
- **WHEN** 客户端调用 `POST /v1/notebooks/{id}/audio-overview` 端点
- **THEN** 后端返回 HTTP 501 Not Implemented，响应体包含 `{"error": "Audio overview is not yet implemented", "status": "coming_soon"}`

#### Scenario: 请求体定义
- **WHEN** 定义 API 请求体
- **THEN** 包含以下字段：`target_duration`（目标时长，1-10 分钟）、`language`（语言，默认 zh-CN）、`chunk_ids`（可选，指定来源片段）

#### Scenario: 响应体定义
- **WHEN** 定义 API 响应体（未来实现）
- **THEN** 包含以下字段：`task_id`（任务 ID）、`status`（状态）、`audio_url`（音频 URL，完成后）、`duration`（时长）、`script`（对话脚本）

### Requirement: 音频概述数据模型
系统必须定义音频概述的数据模型，为后续实现预留。

#### Scenario: AudioOverview 模型
- **WHEN** 定义数据模型
- **THEN** 包含字段：`id`、`notebook_id`、`status`（pending/processing/completed/failed）、`audio_url`、`duration`、`script`、`language`、`created_at`

### Requirement: 前端 UI 预留
系统必须在前端预留音频概述的 UI 入口，显示"即将推出"状态。

#### Scenario: UI 入口
- **WHEN** 用户查看输出类型选择器
- **THEN** 显示"音频概述"选项，带有"即将推出"标签，按钮处于禁用状态

#### Scenario: 禁用交互
- **WHEN** 用户点击禁用的音频概述按钮
- **THEN** 显示 Tooltip 提示"此功能正在开发中，敬请期待"

---

## 技能要求

### 后端实现技能
- **uv**: 使用 `uv sync` 管理依赖
- **python-testing**: 编写接口定义的单元测试
- **ruff**: 代码质量检查
- **FastAPI**: 定义 Pydantic 模型和路由

### 前端实现技能
- **ui-ux-pro-max**:
  - 禁用按钮使用 `opacity-50 cursor-not-allowed`
  - "即将推出"标签使用 badge 样式
- **vercel-react-best-practices**: 组件懒加载
- **web-design-guidelines**: 禁用状态的可访问性
