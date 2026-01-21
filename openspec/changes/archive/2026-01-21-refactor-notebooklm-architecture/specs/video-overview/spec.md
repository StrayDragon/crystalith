## ADDED Requirements

> **背景**：视频概述（Video Overview）是 NotebookLM 音频功能的"视觉进化版"。
> 它自动抓取文档中的图片、图表，或生成关键的摘要幻灯片，配合语音生成视频。
> 这种形式适合需要视觉辅助的学习场景，如技术文档、研究报告等。
>
> **实现状态**：本阶段仅定义接口和数据模型，暂不实现具体功能。后端返回 501 Not Implemented，前端显示"即将推出"状态。

### Requirement: 视频概述 API 接口定义
系统 MUST定义视频概述的 API 接口，为后续实现预留扩展点。

#### Scenario: API 接口定义
- **WHEN** 客户端调用 `POST /v1/notebooks/{id}/video-overview` 端点
- **THEN** 后端返回 HTTP 501 Not Implemented，响应体包含 `{"error": "Video overview is not yet implemented", "status": "coming_soon"}`

#### Scenario: 请求体定义
- **WHEN** 定义 API 请求体
- **THEN** 包含以下字段：`resolution`（分辨率，720p/1080p）、`language`（语言，默认 zh-CN）、`chunk_ids`（可选，指定来源片段）、`include_subtitles`（是否包含字幕）

#### Scenario: 响应体定义
- **WHEN** 定义 API 响应体（未来实现）
- **THEN** 包含以下字段：`task_id`（任务 ID）、`status`（状态）、`video_url`（视频 URL，完成后）、`duration`（时长）、`thumbnail_url`（缩略图）、`subtitle_url`（字幕文件）

### Requirement: 视频概述数据模型
系统 MUST定义视频概述的数据模型，为后续实现预留。

#### Scenario: VideoOverview 模型
- **WHEN** 定义数据模型
- **THEN** 包含字段：`id`、`notebook_id`、`status`（pending/processing/completed/failed）、`video_url`、`duration`、`resolution`、`thumbnail_url`、`subtitle_url`、`language`、`created_at`

### Requirement: 前端 UI 预留
系统 MUST在前端预留视频概述的 UI 入口，显示"即将推出"状态。

#### Scenario: UI 入口
- **WHEN** 用户查看输出类型选择器
- **THEN** 显示"视频概述"选项，带有"即将推出"标签，按钮处于禁用状态

#### Scenario: 禁用交互
- **WHEN** 用户点击禁用的视频概述按钮
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
