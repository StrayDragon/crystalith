# delivery-and-deployment Specification

## Purpose

定义部署与交付最小闭环：部署目录约束、生产 compose 入口、离线 profile、镜像构建基线与文档可发现性。

## Non-goals

- 不定义业务 API 语义
- 不定义前端交互行为

## Requirements

### Requirement: Deployments directory is canonical
仓库 MUST 以 `deployments/` 作为部署清单根目录，并包含 `deployments/prod/`。

#### Scenario: Locate production manifests
- **WHEN** 新操作者在仓库中寻找生产部署入口
- **THEN** 系统 SHALL 在 `deployments/` 下提供清晰的清单与 `deployments/prod/` 目录

### Requirement: Production stack is runnable from layered prod manifests
`deployments/prod` MUST 提供可一键启动的生产栈配置，且该配置 MUST 将 `frontend` 与 `backend` 定义为核心必选服务；任何附加服务 MUST 通过 profile 或等价组合开关显式启用。
规范术语与 Compose 服务名映射 MUST 固定为：`frontend -> web`，`backend -> api`。

#### Scenario: Deploying core production stack
- **WHEN** 运维使用生产清单在未启用可选 profile 的情况下部署
- **THEN** 系统 SHALL 启动前后端核心服务并保持可选服务默认关闭

### Requirement: Stateful services persist data
有状态服务 MUST 使用 volume 持久化，容器重建后数据不丢失。

#### Scenario: Recreate containers without data loss
- **WHEN** 有状态服务容器被重建或升级
- **THEN** 系统 SHALL 通过 volume 保持数据不丢失

### Requirement: Runtime images are optimized and non-root
生产镜像 MUST 使用多阶段构建且以非 root 用户运行。

#### Scenario: Runtime container does not run as root
- **WHEN** 运维检查生产容器运行用户
- **THEN** 生产镜像 SHALL 以非 root 用户运行并保持最小运行时体积

### Requirement: Optional offline Ollama composition is supported
生产 compose MUST 支持可选本地 Ollama 组合（overlay 或 `ollama` profile），且在未启用该可选组合时 MUST 允许使用外部 Ollama 或其他 embedding/chat 提供方，不得强制绑定本地 Ollama 容器。

#### Scenario: Using external Ollama without profile
- **WHEN** 用户未启用本地 Ollama 可选组合且配置了外部 Ollama 地址
- **THEN** 系统 SHALL 使用外部地址完成模型调用并保持部署栈有效

### Requirement: Deployment entrypoints are documented
`deployments/README.md` MUST 清晰区分核心最小拓扑与可选增强拓扑，并为每个可选 profile 提供启用条件、依赖说明与验收步骤。

#### Scenario: New operator follows deployment docs
- **WHEN** 新操作者仅按部署文档执行核心启动步骤
- **THEN** 系统 SHALL 在不引入额外服务的情况下可运行并可通过基础健康检查

### Requirement: SDK docs use correct deployment entrypoints for base_url
文档中的 SDK 示例 MUST 使用与实际部署拓扑一致的 `base_url`/`baseUrl` 推荐值，并避免引用可选依赖服务端口（例如 Chroma 的 `8000`）作为 API 入口。

#### Scenario: Local dev base_url matches backend dev port
- **WHEN** 用户按本仓库本地开发路径启动后端（`just dev` 等价入口）
- **THEN** SDK 文档 SHALL 推荐 `http://127.0.0.1:8032`（或等价的本地后端实际端口）作为默认 `base_url`

#### Scenario: Compose base_url uses the web front door
- **WHEN** 用户按生产式 Docker Compose 启动核心栈（`web` + `api`）
- **THEN** SDK 文档 SHALL 推荐使用 `http://localhost:${CL_WEB_PORT:-8080}`（与 Web UI 同入口）作为 `base_url`
- **AND** 文档 SHALL 明确 `/v1/*` 通过 Nginx 前门反代到后端服务

### Requirement: Self-host diagnostics are discoverable
自托管部署 MUST 提供可发现的诊断入口与最小排障路径，以降低用户定位成本。

#### Scenario: Operator can find diagnostics quickly
- **WHEN** 用户在自托管环境遇到“无法连接/功能不可用”
- **THEN** 系统 SHALL 提供明确的诊断入口（UI 或文档）
- **AND** 至少包含：后端健康检查、可选服务状态与恢复建议

### Requirement: Backup and restore guidance exists
部署文档 MUST 描述数据备份与恢复的最小闭环（含风险与验证步骤）。

#### Scenario: User performs minimal backup
- **WHEN** 用户希望备份并迁移其本地数据
- **THEN** 文档 SHALL 明确最小备份集与恢复步骤
- **AND** 提供验收检查以确认恢复成功

### Requirement: Local development entrypoint mirrors composition model
本地开发入口 MUST 与部署入口共享“核心 + 可选 profile”模型，使开发与生产在依赖启停语义上保持一致。

#### Scenario: Local dev with optional profile
- **WHEN** 开发者在本地启用可选 profile
- **THEN** 本地运行形态 SHALL 与部署形态在服务组合与探活行为上保持一致

### Requirement: Compose composition follows merge-first rule
部署组合 MUST 以 `-f` merge（core + optional overlays）作为主路径；`profiles` 可作为可选增强，`include` 仅可用于强隔离模块，且不得引入同名服务/网络/卷冲突。

#### Scenario: Enabling optional overlays with merge
- **WHEN** 用户基于核心清单叠加一个或多个可选 overlay
- **THEN** 系统 SHALL 仅启用被显式选择的可选服务，且核心服务定义保持可预期
