## ADDED Requirements

### Requirement: SDK docs use correct deployment entrypoints for base_url
文档中的 SDK 示例 MUST 使用与实际部署拓扑一致的 `base_url`/`baseUrl` 推荐值，并避免引用可选依赖服务端口（例如 Chroma 的 `8000`）作为 API 入口。

#### Scenario: Local dev base_url matches backend dev port
- **WHEN** 用户按本仓库本地开发路径启动后端（`just dev` 等价入口）
- **THEN** SDK 文档 SHALL 推荐 `http://127.0.0.1:8032`（或等价的本地后端实际端口）作为默认 `base_url`

#### Scenario: Compose base_url uses the web front door
- **WHEN** 用户按生产式 Docker Compose 启动核心栈（`web` + `api`）
- **THEN** SDK 文档 SHALL 推荐使用 `http://localhost:${CL_WEB_PORT:-8080}`（与 Web UI 同入口）作为 `base_url`
- **AND** 文档 SHALL 明确 `/v1/*` 通过 Nginx 前门反代到后端服务
