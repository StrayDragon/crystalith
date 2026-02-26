## Context

后端已暴露 `WorkspaceTool`（含 `render_descriptor/config_schema`），同时存在 `get_tool_config` 端点返回另一套配置选项；前端 Studio 配置弹窗依赖后者。此结构会带来：
- 配置默认值与文案容易不一致（漂移）。
- 插件覆盖能力被削弱（config_schema 不被 UI 消费）。
- UI 需要额外请求与状态管理。

## Goals / Non-Goals

**Goals:**
- 为工具配置建立单一权威来源，避免双轨契约。
- 提升插件可扩展性：新增工具/覆盖 output type 时，尽量不改前端业务代码。
- 保持向后兼容：现有客户端仍可工作。

**Non-Goals:**
- 不在本变更中重做 Studio 的整体交互与视觉设计。
- 不引入复杂的动态表单系统（初期仍限于现有的 quantity/difficulty/topic 等字段集合）。

## Decisions

- **权威来源**：`GET /v1/workspace/tools` 的 `WorkspaceTool.config_schema` 成为 UI 的配置来源；Studio 配置弹窗仅依赖 tools 列表数据。
- **兼容策略**：
  - `/v1/workspace/tools/{tool_id}/config` 保留一段时间，但其返回值从同一 config_schema 派生（避免漂移）。
  - 在文档与 OpenAPI 描述中标注弃用计划（如果决定移除）。
- **默认值规则**：默认选项以 `is_default` 标记为准；缺失时回退到 stable 默认（standard/medium）。

## Risks / Trade-offs

- [前端切换导致回归] → 通过 MSW/RTL 为 Studio 配置弹窗增加测试覆盖；保留旧端点作为回退。
- [插件 schema 质量参差] → 在后端 registry 加入类型校验与告警（已存在 warning 行为），并在 UI 中降级显示。

## Migration Plan

- 后端确保 tools 列表已返回完整 config_schema。
- 前端切换 StudioToolsGrid 到 tools 列表驱动。
- 观测一段时间后再决定是否移除 `/config` 端点。
