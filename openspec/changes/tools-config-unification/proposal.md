## Why

- Workspace tools 的“配置能力”目前存在重复入口：`GET /v1/workspace/tools` 已返回 `config_schema`（插件可覆盖），但 Studio 工具配置弹窗仍依赖 `/v1/workspace/tools/{tool_id}/config` 的独立契约，容易产生漂移与维护成本。
- 插件化 output type 已支持 declarative `render_descriptor/config_schema`，但 UI 侧尚未把它作为一等驱动源，导致新增/覆盖工具时仍需要额外前端适配。

## What Changes

- 将 tools 配置的权威来源统一为 `GET /v1/workspace/tools` 的 `config_schema`（含默认选项与 placeholder），并让 Studio 配置弹窗直接消费该 schema。
- 对 `/v1/workspace/tools/{tool_id}/config` 做兼容处理：要么派生自同一 schema（保证一致），要么标记为 deprecated 并规划移除窗口。
- 明确 tool config 的稳定字段与默认值规则（数量/难度/主题支持等），并允许插件覆盖/扩展（保持向后兼容）。

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `workspace-api-contract`: 工具列表与工具配置的稳定契约（单一权威来源、向后兼容策略、弃用计划）。

## Impact

- Backend: `/v1/workspace/tools` 的 `config_schema` 需要成为完整、稳定、可直接驱动 UI 的 schema；`/config` 端点与之对齐或逐步弃用。
- Frontend: StudioToolsGrid 移除对 `/config` 端点的依赖，改为直接使用 tool.configSchema；减少网络请求与漂移风险。
- Docs: 更新工具配置与插件覆盖的说明。
