## 1. Backend：统一 tool config 权威来源

- [ ] 1.1 明确 `WorkspaceTool.config_schema` 的完整性与默认值规则，并补齐缺失字段（如 placeholder/supports_topic）。
- [ ] 1.2 将 `/v1/workspace/tools/{tool_id}/config` 的返回值改为从同一 schema 派生（或标注弃用并规划移除窗口）。
- [ ] 1.3 为 tools/config 的一致性增加后端测试（含插件覆盖路径）。

## 2. Frontend：Studio 配置弹窗切换

- [ ] 2.1 `StudioToolsGrid` 改为仅依赖 tools 列表中的 `configSchema` 渲染与取默认值。
- [ ] 2.2 移除对 `/config` 端点的请求状态管理（或保留为回退路径）。

## 3. Docs

- [ ] 3.1 更新插件与工具配置说明：config_schema 如何覆盖、默认值如何选择、弃用策略（如有）。

## 4. Verification

- [ ] 4.1 `cd backend/py && just test`
- [ ] 4.2 `cd frontend/web && pnpm test`
- [ ] 4.3 `just api-sync`（如 OpenAPI 变更）
