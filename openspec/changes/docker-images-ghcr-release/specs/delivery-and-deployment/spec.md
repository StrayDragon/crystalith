## ADDED Requirements

### Requirement: Versioned runtime images are published to GHCR
系统 MUST 将生产运行镜像以版本化方式发布到 GHCR（或等价 registry），并覆盖 `api` 与 `web` 两个核心服务。
镜像标签 SHOULD 支持 SemVer（`X.Y.Z`）与可追溯 SHA 标签（`sha-<shortsha>`），并包含 OCI labels（source/revision/version）。

#### Scenario: Release tag publishes both images
- **WHEN** 维护者推送 `vX.Y.Z` tag
- **THEN** 系统 SHALL 将 `api` 与 `web` 镜像推送到 GHCR
- **AND** 镜像 SHALL 至少包含 `X.Y.Z` 与 `sha-<shortsha>` 标签

#### Scenario: Published images pass minimal runtime health checks
- **WHEN** 用户从 GHCR 拉取同一版本的 `api` 与 `web` 镜像并启动最小拓扑
- **THEN** `api` SHALL 通过 `GET /health` 健康检查
- **AND** `web` SHALL 能通过反代访问 `GET /health`（验证 `web`→`api` 链路）
