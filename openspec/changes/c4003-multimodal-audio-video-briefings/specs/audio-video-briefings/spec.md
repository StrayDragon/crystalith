# audio-video-briefings 规范增量

## ADDED Requirements

### Requirement: Audio/Video Briefings API Contract (Phase 0)
系统 MUST 提供音频与视频简报的 API 契约定义，为后续实现锁定 OpenAPI 形态。

#### Scenario: Audio 端点定义
- **WHEN** 调用 `POST /outputs/audio`
- **THEN** 在未实现阶段返回 501 Not Implemented
- **AND** 响应体包含功能状态说明

#### Scenario: Video 端点定义
- **WHEN** 调用 `POST /outputs/video`
- **THEN** 在未实现阶段返回 501 Not Implemented
- **AND** 响应体包含功能状态说明

#### Scenario: OpenAPI Schema 包含端点
- **WHEN** 访问 OpenAPI 文档
- **THEN** 包含 `/outputs/audio` 与 `/outputs/video` 端点定义
- **AND** Schema 描述了请求参数和响应格式

### Requirement: Studio UI Placeholder
系统 MUST 在前端 Studio 中提供音频/视频简报入口，并明确“即将推出”状态。

#### Scenario: 显示即将推出状态
- **WHEN** 用户查看输出选项
- **THEN** 显示音频/视频简报入口
- **AND** 入口显示“即将推出”标签
- **AND** 入口处于禁用状态

#### Scenario: 点击显示功能说明
- **WHEN** 用户点击音频/视频简报入口
- **THEN** 显示功能说明对话框
- **AND** 说明音频/视频简报的预期功能
